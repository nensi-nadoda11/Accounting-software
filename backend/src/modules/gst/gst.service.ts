import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { accountingRepository } from "../accounting/accounting.repository";
import { companyRepository } from "../company/company.repository";
import {
  addDecimals,
  buildCsvBuffer,
  compareDecimals,
  normalizeMoney as normalizeMoneyValue
} from "../inventory/inventory.utils";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import {
  calculateHsnSummary,
  calculateInputTax,
  calculateNetGstPayable,
  calculateOutputTax,
  calculateTaxRateSummary,
  normalizeMoney
} from "./gst.calculation";
import { gstRepository } from "./gst.repository";
import type {
  GstActor,
  GstExportPayload,
  GstItcClaimStatus,
  GstItcEligibilityStatus,
  GstRequestContext,
  GstReportType
} from "./gst.types";
import type {
  CancelGstAdjustmentInput,
  CreateGstAdjustmentInput,
  GstAdjustmentsQuery,
  GstGstr1ExportQuery,
  GstGstr3bExportQuery,
  GstHsnSummaryExportQuery,
  GstHsnSummaryQuery,
  GstItcExportQuery,
  GstItcQuery,
  GstOutputTaxQuery,
  GstPurchasesExportQuery,
  GstPurchasesQuery,
  GstSalesExportQuery,
  GstSalesQuery,
  GstSummaryQuery,
  GstTaxSummaryExportQuery,
  GstTaxSummaryQuery,
  UpdateGstItcStatusInput
} from "./gst.validator";

type DateRange = {
  dateFrom: Date;
  dateTo: Date;
};

type AdjustmentBreakdown = {
  itcClaims: string;
  itcReversals: string;
  outputTaxAdjustments: string;
  lateFee: string;
  interest: string;
  rounding: string;
  other: string;
};

const EMPTY_ADJUSTMENT_BREAKDOWN = (): AdjustmentBreakdown => ({
  itcClaims: "0.00",
  itcReversals: "0.00",
  outputTaxAdjustments: "0.00",
  lateFee: "0.00",
  interest: "0.00",
  rounding: "0.00",
  other: "0.00"
});

class GstService {
  private toDate(value: Date | string | null | undefined, fieldName: string): Date {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    throw new AppError(`${fieldName} is invalid`, 400);
  }

  private normalizeDateRangeQuery<T extends { dateFrom: Date | string; dateTo: Date | string }>(
    query: T
  ): Omit<T, "dateFrom" | "dateTo"> & { dateFrom: Date; dateTo: Date } {
    return {
      ...query,
      dateFrom: this.toDate(query.dateFrom, "dateFrom"),
      dateTo: this.toDate(query.dateTo, "dateTo")
    };
  }

  private normalizeAdjustmentsQuery(query: GstAdjustmentsQuery): GstAdjustmentsQuery {
    return {
      ...query,
      ...(query.dateFrom !== undefined
        ? {
            dateFrom: query.dateFrom ? this.toDate(query.dateFrom, "dateFrom") : query.dateFrom
          }
        : {}),
      ...(query.dateTo !== undefined
        ? {
            dateTo: query.dateTo ? this.toDate(query.dateTo, "dateTo") : query.dateTo
          }
        : {})
    };
  }

  private ensureCsvFormat(format: "csv" | "xlsx" | "pdf") {
    if (format !== "csv") {
      throw new AppError("Only CSV export is available right now", 400);
    }
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${prefix}${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(6, "0")}`;
  }

  private getMonthKey(value: Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  private enumerateMonths(range: DateRange) {
    const months: string[] = [];
    const cursor = new Date(Date.UTC(range.dateFrom.getUTCFullYear(), range.dateFrom.getUTCMonth(), 1));
    const end = new Date(Date.UTC(range.dateTo.getUTCFullYear(), range.dateTo.getUTCMonth(), 1));

    while (cursor <= end) {
      months.push(this.getMonthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return months;
  }

  private async ensureCompanyGstContext(companyId: string) {
    const [company, taxSettings] = await Promise.all([
      companyRepository.findCompanyById(companyId),
      companyRepository.findTaxSettingsByCompanyId(companyId)
    ]);

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    if (taxSettings?.gstEnabled && !company.gstNumber) {
      throw new AppError("Company GSTIN is required when GST is enabled", 400);
    }

    return {
      company,
      taxSettings
    };
  }

  private async resolveDateRange(companyId: string, query: GstSummaryQuery): Promise<DateRange> {
    if (query.financialYearId) {
      const year = await companyRepository.findFinancialYearById(companyId, query.financialYearId);
      if (!year) {
        throw new AppError("Financial year not found", 404);
      }

      return {
        dateFrom: year.startDate,
        dateTo: year.endDate
      };
    }

    return {
      dateFrom: this.toDate(query.dateFrom, "dateFrom"),
      dateTo: this.toDate(query.dateTo, "dateTo")
    };
  }

  private async assertPeriodUnlocked(companyId: string, targetDate: Date, executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    const periodLock = await accountingRepository.findBlockingPeriodLock(companyId, targetDate, executor);
    if (periodLock) {
      throw new AppError("The selected period is locked for accounting", 409);
    }

    const years = await accountingRepository.listFinancialYears(companyId, executor);
    const matchingYear =
      years.find((year) => year.startDate.getTime() <= targetDate.getTime() && year.endDate.getTime() >= targetDate.getTime()) ??
      null;

    if (matchingYear?.isLocked) {
      throw new AppError("The selected financial year is locked for accounting", 409);
    }
  }

  private async syncItcStatuses(companyId: string, range: DateRange) {
    const [purchaseRows, expenseRows] = await Promise.all([
      gstRepository.listPurchaseItcCandidates(companyId, range),
      gstRepository.listExpenseItcCandidates(companyId, range)
    ]);

    await gstRepository.upsertItcStatuses([
      ...purchaseRows.map((row) => ({
        companyId,
        sourceType: "purchase" as const,
        sourceId: row.sourceId,
        sourceNumber: row.sourceNumber,
        supplierGstin: row.supplierGstin,
        invoiceDate: row.invoiceDate,
        taxableAmount: row.taxableAmount,
        cgstAmount: row.cgstAmount,
        sgstAmount: row.sgstAmount,
        igstAmount: row.igstAmount,
        cessAmount: row.cessAmount,
        totalGstAmount: row.totalGstAmount,
        eligibilityStatus: "eligible" as const,
        claimStatus: "unclaimed" as const,
        claimedAmount: "0.00"
      })),
      ...expenseRows.map((row) => ({
        companyId,
        sourceType: "expense" as const,
        sourceId: row.sourceId,
        sourceNumber: row.sourceNumber,
        supplierGstin: row.supplierGstin,
        invoiceDate: row.invoiceDate,
        taxableAmount: row.taxableAmount,
        cgstAmount: row.cgstAmount,
        sgstAmount: row.sgstAmount,
        igstAmount: row.igstAmount,
        cessAmount: row.cessAmount,
        totalGstAmount: row.totalGstAmount,
        eligibilityStatus: "eligible" as const,
        claimStatus: "unclaimed" as const,
        claimedAmount: "0.00"
      }))
    ]);
  }

  private buildAdjustmentBreakdown(
    rows: Array<{
      adjustmentType: string;
      taxComponent: string;
      amount: string;
    }>
  ) {
    const breakdown = EMPTY_ADJUSTMENT_BREAKDOWN();

    for (const row of rows) {
      if (row.adjustmentType === "itc_claim") {
        breakdown.itcClaims = addDecimals(breakdown.itcClaims, row.amount, 2);
      } else if (row.adjustmentType === "itc_reversal") {
        breakdown.itcReversals = addDecimals(breakdown.itcReversals, row.amount, 2);
      } else if (row.adjustmentType === "output_tax_adjustment") {
        breakdown.outputTaxAdjustments = addDecimals(breakdown.outputTaxAdjustments, row.amount, 2);
      } else if (row.adjustmentType === "late_fee") {
        breakdown.lateFee = addDecimals(breakdown.lateFee, row.amount, 2);
      } else if (row.adjustmentType === "interest") {
        breakdown.interest = addDecimals(breakdown.interest, row.amount, 2);
      } else if (row.adjustmentType === "rounding") {
        breakdown.rounding = addDecimals(breakdown.rounding, row.amount, 2);
      } else if (row.adjustmentType === "other") {
        breakdown.other = addDecimals(breakdown.other, row.amount, 2);
      }
    }

    return breakdown;
  }

  private createMonthlyTrend(range: DateRange, data: {
    sales: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    salesReturns: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    purchases: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    purchaseReturns: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    purchaseItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    expenseItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    adjustments: Array<{ month: string; adjustmentType: string; amount: string }>;
  }) {
    const monthMap = new Map(
      this.enumerateMonths(range).map((month) => [
        month,
        {
          month,
          taxableSales: "0.00",
          outputGst: "0.00",
          taxablePurchases: "0.00",
          inputGst: "0.00",
          expenseInputGst: "0.00",
          salesReturnGst: "0.00",
          purchaseReturnGst: "0.00",
          netGstPayable: "0.00",
          netGstCredit: "0.00"
        }
      ])
    );

    for (const row of data.sales) {
      const entry = monthMap.get(row.month);
      if (!entry) {
        continue;
      }

      entry.taxableSales = normalizeMoney(row.taxableAmount);
      entry.outputGst = normalizeMoney(row.totalGstAmount);
    }

    for (const row of data.purchases) {
      const entry = monthMap.get(row.month);
      if (!entry) {
        continue;
      }

      entry.taxablePurchases = normalizeMoney(row.taxableAmount);
    }

    for (const row of data.salesReturns) {
      const entry = monthMap.get(row.month);
      if (!entry) {
        continue;
      }

      entry.salesReturnGst = normalizeMoney(row.totalGstAmount);
    }

    for (const row of data.purchaseReturns) {
      const entry = monthMap.get(row.month);
      if (!entry) {
        continue;
      }

      entry.purchaseReturnGst = normalizeMoney(row.totalGstAmount);
    }

    const purchaseItcMap = new Map(data.purchaseItc.map((row) => [row.month, row.totalGstAmount]));
    const expenseItcMap = new Map(data.expenseItc.map((row) => [row.month, row.totalGstAmount]));
    const adjustmentMap = new Map<string, AdjustmentBreakdown>();

    for (const row of data.adjustments) {
      const current = adjustmentMap.get(row.month) ?? EMPTY_ADJUSTMENT_BREAKDOWN();
      if (row.adjustmentType === "itc_claim") {
        current.itcClaims = addDecimals(current.itcClaims, row.amount, 2);
      } else if (row.adjustmentType === "itc_reversal") {
        current.itcReversals = addDecimals(current.itcReversals, row.amount, 2);
      } else if (row.adjustmentType === "output_tax_adjustment") {
        current.outputTaxAdjustments = addDecimals(current.outputTaxAdjustments, row.amount, 2);
      }

      adjustmentMap.set(row.month, current);
    }

    for (const [month, entry] of monthMap) {
      const purchaseGst = normalizeMoney(purchaseItcMap.get(month) ?? "0.00");
      const expenseInputGst = normalizeMoney(expenseItcMap.get(month) ?? "0.00");
      const monthAdjustments = adjustmentMap.get(month) ?? EMPTY_ADJUSTMENT_BREAKDOWN();
      const outputTax = calculateOutputTax({
        salesGst: entry.outputGst,
        salesReturnGst: entry.salesReturnGst,
        outputAdjustments: monthAdjustments.outputTaxAdjustments
      });
      const inputTax = calculateInputTax({
        purchaseGst,
        eligibleExpenseGst: expenseInputGst,
        purchaseReturnGst: entry.purchaseReturnGst,
        itcReversals: monthAdjustments.itcReversals,
        itcClaims: monthAdjustments.itcClaims
      });
      const net = calculateNetGstPayable({
        outputGst: outputTax.outputGst,
        inputGst: inputTax.inputGst
      });

      entry.outputGst = outputTax.outputGst;
      entry.inputGst = inputTax.inputGst;
      entry.expenseInputGst = expenseInputGst;
      entry.netGstPayable = net.netGstPayable;
      entry.netGstCredit = net.netGstCredit;
    }

    return Array.from(monthMap.values());
  }

  private async logAudit(
    actor: GstActor,
    context: GstRequestContext,
    action: string,
    entityType: string,
    metadata: Record<string, unknown>,
    entityId?: string
  ) {
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  private validateEligibilityTransition(current: GstItcEligibilityStatus, next: GstItcEligibilityStatus) {
    const allowed: Record<GstItcEligibilityStatus, GstItcEligibilityStatus[]> = {
      eligible: ["eligible", "blocked", "reversed"],
      blocked: ["blocked", "eligible", "reversed"],
      reversed: ["reversed", "eligible"],
      pending: ["pending", "eligible", "blocked", "reversed"]
    };

    if (!allowed[current].includes(next)) {
      throw new AppError("Invalid ITC eligibility status transition", 400);
    }
  }

  private validateClaimTransition(current: GstItcClaimStatus, next: GstItcClaimStatus) {
    const allowed: Record<GstItcClaimStatus, GstItcClaimStatus[]> = {
      unclaimed: ["unclaimed", "partially_claimed", "claimed"],
      partially_claimed: ["unclaimed", "partially_claimed", "claimed"],
      claimed: ["claimed", "partially_claimed", "unclaimed"]
    };

    if (!allowed[current].includes(next)) {
      throw new AppError("Invalid ITC claim status transition", 400);
    }
  }

  private resolveClaimMutation(totalGstAmount: string, existingClaimStatus: GstItcClaimStatus, input: UpdateGstItcStatusInput) {
    const nextClaimStatus = input.claimStatus ?? existingClaimStatus;
    let claimedAmount = input.claimedAmount !== undefined ? normalizeMoney(input.claimedAmount) : null;

    if (claimedAmount === null) {
      if (nextClaimStatus === "claimed") {
        claimedAmount = normalizeMoney(totalGstAmount);
      } else if (nextClaimStatus === "unclaimed") {
        claimedAmount = "0.00";
      }
    }

    if (nextClaimStatus === "partially_claimed") {
      if (claimedAmount === null) {
        throw new AppError("claimedAmount is required when claimStatus is partially_claimed", 400);
      }

      if (compareDecimals(claimedAmount, "0.00", 2) <= 0 || compareDecimals(claimedAmount, totalGstAmount, 2) >= 0) {
        throw new AppError("claimedAmount must be greater than 0 and less than total GST for partial claims", 400);
      }
    }

    if (nextClaimStatus === "claimed" && claimedAmount !== null && compareDecimals(claimedAmount, totalGstAmount, 2) !== 0) {
      throw new AppError("claimedAmount must match total GST when claimStatus is claimed", 400);
    }

    if (nextClaimStatus === "unclaimed" && claimedAmount !== null && compareDecimals(claimedAmount, "0.00", 2) !== 0) {
      throw new AppError("claimedAmount must be 0 when claimStatus is unclaimed", 400);
    }

    return {
      claimStatus: nextClaimStatus,
      claimedAmount: claimedAmount ?? undefined
    };
  }

  public async getSummary(actor: GstActor, query: GstSummaryQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const range = await this.resolveDateRange(actor.companyId, query);
    await this.syncItcStatuses(actor.companyId, range);

    const [
      salesTotals,
      salesReturnTotals,
      purchaseTotals,
      purchaseReturnTotals,
      purchaseItcTotals,
      expenseItcTotals,
      adjustmentRows,
      salesMonthly,
      salesReturnMonthly,
      purchaseMonthly,
      purchaseReturnMonthly,
      purchaseItcMonthly,
      expenseItcMonthly,
      adjustmentsMonthly
    ] = await Promise.all([
      gstRepository.getSalesTotals(actor.companyId, range),
      gstRepository.getSalesReturnTotals(actor.companyId, range),
      gstRepository.getPurchaseTotals(actor.companyId, range),
      gstRepository.getPurchaseReturnTotals(actor.companyId, range),
      gstRepository.getEligibleItcTotals(actor.companyId, range, "purchase"),
      gstRepository.getEligibleItcTotals(actor.companyId, range, "expense"),
      gstRepository.getAdjustmentsTotals(actor.companyId, range),
      gstRepository.getSalesMonthlyTotals(actor.companyId, range),
      gstRepository.getSalesReturnMonthlyTotals(actor.companyId, range),
      gstRepository.getPurchaseMonthlyTotals(actor.companyId, range),
      gstRepository.getPurchaseReturnMonthlyTotals(actor.companyId, range),
      gstRepository.getEligibleItcMonthlyTotals(actor.companyId, range, "purchase"),
      gstRepository.getEligibleItcMonthlyTotals(actor.companyId, range, "expense"),
      gstRepository.getAdjustmentsMonthlyTotals(actor.companyId, range)
    ]);

    const adjustments = this.buildAdjustmentBreakdown(adjustmentRows);
    const outputTax = calculateOutputTax({
      salesGst: salesTotals.totalGstAmount,
      salesReturnGst: salesReturnTotals.totalGstAmount,
      outputAdjustments: adjustments.outputTaxAdjustments
    });
    const inputTax = calculateInputTax({
      purchaseGst: purchaseItcTotals.totalGstAmount,
      eligibleExpenseGst: expenseItcTotals.totalGstAmount,
      purchaseReturnGst: purchaseReturnTotals.totalGstAmount,
      itcReversals: adjustments.itcReversals,
      itcClaims: adjustments.itcClaims
    });
    const net = calculateNetGstPayable({
      outputGst: outputTax.outputGst,
      inputGst: inputTax.inputGst
    });
    const monthWiseTrend = this.createMonthlyTrend(range, {
      sales: salesMonthly,
      salesReturns: salesReturnMonthly,
      purchases: purchaseMonthly,
      purchaseReturns: purchaseReturnMonthly,
      purchaseItc: purchaseItcMonthly,
      expenseItc: expenseItcMonthly,
      adjustments: adjustmentsMonthly
    });

    await Promise.all(
      monthWiseTrend.map((month) =>
        gstRepository.saveMonthlySummary({
          companyId: actor.companyId,
          periodMonth: new Date(`${month.month}T00:00:00.000Z`),
          taxableSales: month.taxableSales,
          outputGst: month.outputGst,
          taxablePurchases: month.taxablePurchases,
          inputGst: month.inputGst,
          expenseInputGst: month.expenseInputGst,
          salesReturnGst: month.salesReturnGst,
          purchaseReturnGst: month.purchaseReturnGst,
          netGstPayable: month.netGstPayable
        })
      )
    );

    await this.logAudit(actor, context, "gst_summary_viewed", "gst_summary", {
      dateFrom: range.dateFrom.toISOString(),
      dateTo: range.dateTo.toISOString()
    });

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      taxableSales: normalizeMoney(salesTotals.taxableAmount),
      outputGst: outputTax.outputGst,
      taxablePurchases: normalizeMoney(purchaseTotals.taxableAmount),
      inputGst: inputTax.inputGst,
      expenseInputGst: normalizeMoney(expenseItcTotals.totalGstAmount),
      returns: {
        salesReturnTaxable: normalizeMoney(salesReturnTotals.taxableAmount),
        salesReturnGst: normalizeMoney(salesReturnTotals.totalGstAmount),
        purchaseReturnTaxable: normalizeMoney(purchaseReturnTotals.taxableAmount),
        purchaseReturnGst: normalizeMoney(purchaseReturnTotals.totalGstAmount)
      },
      adjustments,
      netGstPayable: net.netGstPayable,
      netGstCredit: net.netGstCredit,
      monthWiseTrend
    };
  }

  public async listSales(actor: GstActor, query: GstSalesQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    const pagination = getPagination(normalizedQuery.page, normalizedQuery.limit);
    const result = await gstRepository.listSales({
      ...normalizedQuery,
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    });

    await this.logAudit(actor, context, "gst_sales_viewed", "gst_sales_report", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString(),
      rowCount: result.rows.length
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        invoiceDate: row.invoiceDate,
        invoiceNumber: row.invoiceNumber,
        invoiceType: row.invoiceType,
        customerName: row.customerName,
        gstin: row.gstin,
        placeOfSupply: row.placeOfSupply,
        taxableAmount: normalizeMoney(row.taxableAmount),
        cgstAmount: normalizeMoney(row.cgstAmount),
        sgstAmount: normalizeMoney(row.sgstAmount),
        igstAmount: normalizeMoney(row.igstAmount),
        cessAmount: normalizeMoney(row.cessAmount),
        totalGst: normalizeMoney(row.totalGst),
        invoiceTotal: normalizeMoney(row.invoiceTotal)
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async listPurchases(actor: GstActor, query: GstPurchasesQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    await this.syncItcStatuses(actor.companyId, {
      dateFrom: normalizedQuery.dateFrom,
      dateTo: normalizedQuery.dateTo
    });
    const pagination = getPagination(normalizedQuery.page, normalizedQuery.limit);
    const result = await gstRepository.listPurchases({
      ...normalizedQuery,
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    });

    await this.logAudit(actor, context, "gst_purchases_viewed", "gst_purchase_report", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString(),
      rowCount: result.rows.length
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        purchaseDate: row.purchaseDate,
        purchaseNumber: row.purchaseNumber,
        supplierName: row.supplierName,
        gstin: row.gstin,
        supplierInvoiceNumber: row.supplierInvoiceNumber,
        taxableAmount: normalizeMoney(row.taxableAmount),
        cgstAmount: normalizeMoney(row.cgstAmount),
        sgstAmount: normalizeMoney(row.sgstAmount),
        igstAmount: normalizeMoney(row.igstAmount),
        cessAmount: normalizeMoney(row.cessAmount),
        totalGst: normalizeMoney(row.totalGst),
        invoiceTotal: normalizeMoney(row.invoiceTotal),
        itcEligibility: row.eligibilityStatus ?? "eligible",
        claimStatus: row.claimStatus ?? "unclaimed",
        claimedAmount: normalizeMoney(row.claimedAmount ?? "0.00")
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async listItc(actor: GstActor, query: GstItcQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    await this.syncItcStatuses(actor.companyId, {
      dateFrom: normalizedQuery.dateFrom,
      dateTo: normalizedQuery.dateTo
    });
    const pagination = getPagination(normalizedQuery.page, normalizedQuery.limit);
    const result = await gstRepository.listItc({
      ...normalizedQuery,
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    });

    await this.logAudit(actor, context, "gst_itc_viewed", "gst_itc_report", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString(),
      rowCount: result.rows.length
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceNumber: row.sourceNumber,
        supplierName: row.supplierName ?? row.payeeName ?? null,
        supplierGstin: row.supplierGstin,
        invoiceDate: row.invoiceDate,
        taxableAmount: normalizeMoney(row.taxableAmount),
        cgstAmount: normalizeMoney(row.cgstAmount),
        sgstAmount: normalizeMoney(row.sgstAmount),
        igstAmount: normalizeMoney(row.igstAmount),
        cessAmount: normalizeMoney(row.cessAmount),
        totalGstAmount: normalizeMoney(row.totalGstAmount),
        eligibilityStatus: row.eligibilityStatus,
        claimStatus: row.claimStatus,
        claimedAmount: normalizeMoney(row.claimedAmount),
        notes: row.notes,
        sourceMeta:
          row.sourceType === "adjustment"
            ? {
                reason: row.adjustmentReason
              }
            : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async updateItcStatus(
    actor: GstActor,
    id: string,
    input: UpdateGstItcStatusInput,
    context: GstRequestContext
  ) {
    const existing = await gstRepository.findItcStatusById(actor.companyId, id);
    if (!existing) {
      throw new AppError("ITC status record not found", 404);
    }

    if (input.eligibilityStatus) {
      this.validateEligibilityTransition(existing.eligibilityStatus, input.eligibilityStatus);
    }

    if (input.claimStatus) {
      this.validateClaimTransition(existing.claimStatus, input.claimStatus);
    }

    const claimMutation = this.resolveClaimMutation(existing.totalGstAmount, existing.claimStatus, input);
    const updated = await gstRepository.updateItcStatus(actor.companyId, id, {
      eligibilityStatus: input.eligibilityStatus ?? existing.eligibilityStatus,
      claimStatus: claimMutation.claimStatus,
      claimedAmount: claimMutation.claimedAmount ?? existing.claimedAmount,
      notes: input.notes ?? existing.notes
    });

    if (!updated) {
      throw new AppError("Failed to update ITC status", 500);
    }

    await this.logAudit(actor, context, "gst_itc_status_updated", "gst_itc_status", {
      previousEligibilityStatus: existing.eligibilityStatus,
      nextEligibilityStatus: updated.eligibilityStatus,
      previousClaimStatus: existing.claimStatus,
      nextClaimStatus: updated.claimStatus,
      claimedAmount: normalizeMoney(updated.claimedAmount)
    }, updated.id);

    return {
      itcStatus: {
        id: updated.id,
        sourceType: updated.sourceType,
        sourceId: updated.sourceId,
        sourceNumber: updated.sourceNumber,
        eligibilityStatus: updated.eligibilityStatus,
        claimStatus: updated.claimStatus,
        claimedAmount: normalizeMoney(updated.claimedAmount),
        notes: updated.notes,
        updatedAt: updated.updatedAt
      }
    };
  }

  public async getOutputTax(actor: GstActor, query: GstOutputTaxQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    const [{ salesRow, returnsRow }, adjustmentRows] = await Promise.all([
      gstRepository.getOutputTaxBase(actor.companyId, normalizedQuery),
      gstRepository.getAdjustmentsTotals(actor.companyId, {
        dateFrom: normalizedQuery.dateFrom,
        dateTo: normalizedQuery.dateTo
      })
    ]);
    const adjustments = this.buildAdjustmentBreakdown(adjustmentRows);
    const outputTax = calculateOutputTax({
      salesGst: salesRow.totalGstAmount,
      salesReturnGst: returnsRow.totalGstAmount,
      outputAdjustments: adjustments.outputTaxAdjustments
    });

    await this.logAudit(actor, context, "gst_output_tax_viewed", "gst_output_tax", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString()
    });

    return {
      taxableSales: normalizeMoney(salesRow.taxableAmount),
      salesGst: normalizeMoney(salesRow.totalGstAmount),
      salesReturnsTaxable: normalizeMoney(returnsRow.taxableAmount),
      salesReturnGst: normalizeMoney(returnsRow.totalGstAmount),
      outputAdjustments: adjustments.outputTaxAdjustments,
      outputGst: outputTax.outputGst
    };
  }

  public async getHsnSummary(actor: GstActor, query: GstHsnSummaryQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    const rows = await gstRepository.getHsnSummaryRows(actor.companyId, normalizedQuery);
    const items = calculateHsnSummary(rows);

    await this.logAudit(actor, context, "gst_hsn_summary_viewed", "gst_hsn_summary", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString(),
      source: normalizedQuery.source
    });

    return {
      items: items.map((row) => ({
        hsnSacCode: row.hsnSacCode,
        description: row.description,
        unit: row.unit,
        quantity: row.quantity,
        taxableValue: normalizeMoney(row.taxableValue),
        gstRate: normalizeMoney(row.gstRate),
        cgstAmount: normalizeMoney(row.cgstAmount),
        sgstAmount: normalizeMoney(row.sgstAmount),
        igstAmount: normalizeMoney(row.igstAmount),
        cessAmount: normalizeMoney(row.cessAmount),
        totalTax: normalizeMoney(row.totalTax)
      }))
    };
  }

  public async getTaxSummary(actor: GstActor, query: GstTaxSummaryQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeDateRangeQuery(query);
    const [salesRows, salesReturnRows, purchaseRows, purchaseReturnRows, expenseRows] = await Promise.all([
      gstRepository.getSalesTaxRateRows(actor.companyId, normalizedQuery),
      gstRepository.getSalesReturnTaxRateRows(actor.companyId, normalizedQuery),
      gstRepository.getPurchaseTaxRateRows(actor.companyId, normalizedQuery),
      gstRepository.getPurchaseReturnTaxRateRows(actor.companyId, normalizedQuery),
      gstRepository.getExpenseTaxRateRows(actor.companyId, normalizedQuery)
    ]);

    const items = calculateTaxRateSummary([
      ...salesRows,
      ...salesReturnRows,
      ...purchaseRows,
      ...purchaseReturnRows,
      ...expenseRows
    ]);

    await this.logAudit(actor, context, "gst_tax_summary_viewed", "gst_tax_summary", {
      dateFrom: normalizedQuery.dateFrom.toISOString(),
      dateTo: normalizedQuery.dateTo.toISOString()
    });

    return {
      items
    };
  }

  public async listAdjustments(actor: GstActor, query: GstAdjustmentsQuery, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);
    const normalizedQuery = this.normalizeAdjustmentsQuery(query);
    const pagination = getPagination(normalizedQuery.page, normalizedQuery.limit);
    const result = await gstRepository.listAdjustments({
      ...normalizedQuery,
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    });

    await this.logAudit(actor, context, "gst_adjustments_viewed", "gst_adjustment", {
      rowCount: result.rows.length
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        adjustmentNumber: row.adjustmentNumber,
        adjustmentDate: row.adjustmentDate,
        adjustmentType: row.adjustmentType,
        taxComponent: row.taxComponent,
        amount: normalizeMoney(row.amount),
        reason: row.reason,
        referenceNumber: row.referenceNumber,
        notes: row.notes,
        status: row.status,
        cancelledAt: row.cancelledAt,
        cancellationReason: row.cancellationReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createAdjustment(actor: GstActor, input: CreateGstAdjustmentInput, context: GstRequestContext) {
    await this.ensureCompanyGstContext(actor.companyId);

    const adjustment = await db.transaction(async (transaction) => {
      await this.assertPeriodUnlocked(actor.companyId, input.adjustmentDate, transaction);
      await gstRepository.acquireScopedLock("gst-adjustment-number", actor.companyId, transaction);
      const latest = await gstRepository.findLatestAdjustmentNumber(actor.companyId, transaction);
      const adjustmentNumber = this.buildNextSequenceNumber(latest, "GSTA-");
      const created = await gstRepository.createAdjustment(
        {
          companyId: actor.companyId,
          adjustmentNumber,
          adjustmentDate: input.adjustmentDate,
          adjustmentType: input.adjustmentType,
          taxComponent: input.taxComponent,
          amount: normalizeMoney(input.amount),
          reason: input.reason,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          status: "active",
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create GST adjustment", 500);
      }

      if (input.adjustmentType === "itc_claim" || input.adjustmentType === "itc_reversal") {
        await gstRepository.createAdjustmentItcStatus(
          {
            companyId: actor.companyId,
            sourceType: "adjustment",
            sourceId: created.id,
            sourceNumber: created.adjustmentNumber,
            supplierGstin: null,
            invoiceDate: created.adjustmentDate,
            taxableAmount: "0.00",
            cgstAmount: input.taxComponent === "cgst" ? normalizeMoney(input.amount) : "0.00",
            sgstAmount: input.taxComponent === "sgst" ? normalizeMoney(input.amount) : "0.00",
            igstAmount: input.taxComponent === "igst" ? normalizeMoney(input.amount) : "0.00",
            cessAmount: input.taxComponent === "cess" ? normalizeMoney(input.amount) : "0.00",
            totalGstAmount: normalizeMoney(input.amount),
            eligibilityStatus: input.adjustmentType === "itc_reversal" ? "reversed" : "eligible",
            claimStatus: "claimed",
            claimedAmount: normalizeMoney(input.amount),
            notes: input.notes ?? null
          },
          transaction
        );
      }

      return created;
    });

    await this.logAudit(actor, context, "gst_adjustment_created", "gst_adjustment", {
      adjustmentNumber: adjustment.adjustmentNumber,
      adjustmentType: adjustment.adjustmentType,
      amount: normalizeMoney(adjustment.amount)
    }, adjustment.id);

    return {
      adjustment: {
        id: adjustment.id,
        adjustmentNumber: adjustment.adjustmentNumber,
        adjustmentDate: adjustment.adjustmentDate,
        adjustmentType: adjustment.adjustmentType,
        taxComponent: adjustment.taxComponent,
        amount: normalizeMoney(adjustment.amount),
        reason: adjustment.reason,
        referenceNumber: adjustment.referenceNumber,
        notes: adjustment.notes,
        status: adjustment.status
      }
    };
  }

  public async cancelAdjustment(
    actor: GstActor,
    id: string,
    input: CancelGstAdjustmentInput,
    context: GstRequestContext
  ) {
    const adjustment = await db.transaction(async (transaction) => {
      const existing = await gstRepository.findAdjustmentById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("GST adjustment not found", 404);
      }

      if (existing.status === "cancelled") {
        throw new AppError("GST adjustment is already cancelled", 400);
      }

      await this.assertPeriodUnlocked(actor.companyId, existing.adjustmentDate, transaction);
      const updated = await gstRepository.updateAdjustment(
        actor.companyId,
        id,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.cancellationReason,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to cancel GST adjustment", 500);
      }

      return updated;
    });

    await this.logAudit(actor, context, "gst_adjustment_cancelled", "gst_adjustment", {
      cancellationReason: input.cancellationReason
    }, adjustment.id);

    return {
      adjustment: {
        id: adjustment.id,
        status: adjustment.status,
        cancelledAt: adjustment.cancelledAt,
        cancellationReason: adjustment.cancellationReason
      }
    };
  }

  private async persistExportLog(
    actor: GstActor,
    context: GstRequestContext,
    reportType: GstReportType,
    range: DateRange,
    filters: Record<string, unknown>,
    rowCount: number
  ) {
    await Promise.all([
      gstRepository.createReportExport({
        companyId: actor.companyId,
        reportType,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        filters,
        fileUrl: null,
        exportedBy: actor.id
      }),
      this.logAudit(actor, context, "gst_report_exported", "gst_report_export", {
        reportType,
        rowCount,
        filters
      })
    ]);
  }

  public async exportSales(actor: GstActor, query: GstSalesExportQuery, context: GstRequestContext): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.listSales(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const content = buildCsvBuffer(
      ["Invoice Date", "Invoice No", "Customer", "GSTIN", "Place Of Supply", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "Invoice Total"],
      rows.map((row) => [
        (row.invoiceDate as Date).toISOString().slice(0, 10),
        String(row.invoiceNumber),
        String(row.customerName),
        String(row.gstin ?? ""),
        String(row.placeOfSupply),
        String(row.taxableAmount),
        String(row.cgstAmount),
        String(row.sgstAmount),
        String(row.igstAmount),
        String(row.cessAmount),
        String(row.totalGst),
        String(row.invoiceTotal)
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "sales_gst",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return {
      fileName: `gst-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportPurchases(
    actor: GstActor,
    query: GstPurchasesExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.listPurchases(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const content = buildCsvBuffer(
      ["Purchase Date", "Purchase No", "Supplier", "GSTIN", "Supplier Invoice No", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "ITC Eligibility", "Claim Status", "Invoice Total"],
      rows.map((row) => [
        (row.purchaseDate as Date).toISOString().slice(0, 10),
        String(row.purchaseNumber),
        String(row.supplierName),
        String(row.gstin ?? ""),
        String(row.supplierInvoiceNumber ?? ""),
        String(row.taxableAmount),
        String(row.cgstAmount),
        String(row.sgstAmount),
        String(row.igstAmount),
        String(row.cessAmount),
        String(row.totalGst),
        String(row.itcEligibility),
        String(row.claimStatus),
        String(row.invoiceTotal)
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "purchase_gst",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return {
      fileName: `gst-purchases-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportItc(actor: GstActor, query: GstItcExportQuery, context: GstRequestContext): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.listItc(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const content = buildCsvBuffer(
      ["Source Type", "Source No", "Supplier", "Supplier GSTIN", "Invoice Date", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "Eligibility", "Claim Status", "Claimed Amount"],
      rows.map((row) => [
        String(row.sourceType),
        String(row.sourceNumber ?? ""),
        String(row.supplierName ?? ""),
        String(row.supplierGstin ?? ""),
        (row.invoiceDate as Date).toISOString().slice(0, 10),
        String(row.taxableAmount),
        String(row.cgstAmount),
        String(row.sgstAmount),
        String(row.igstAmount),
        String(row.cessAmount),
        String(row.totalGstAmount),
        String(row.eligibilityStatus),
        String(row.claimStatus),
        String(row.claimedAmount)
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "itc",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return {
      fileName: `gst-itc-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportHsnSummary(
    actor: GstActor,
    query: GstHsnSummaryExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.getHsnSummary(actor, query, context);
    const content = buildCsvBuffer(
      ["HSN/SAC", "Description", "Unit", "Quantity", "Taxable Value", "GST Rate", "CGST", "SGST", "IGST", "Cess", "Total Tax"],
      result.items.map((row) => [
        row.hsnSacCode ?? "",
        row.description ?? "",
        row.unit ?? "",
        row.quantity,
        row.taxableValue,
        row.gstRate,
        row.cgstAmount,
        row.sgstAmount,
        row.igstAmount,
        row.cessAmount,
        row.totalTax
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "hsn_summary",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return {
      fileName: `gst-hsn-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportTaxSummary(
    actor: GstActor,
    query: GstTaxSummaryExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.getTaxSummary(actor, query, context);
    const content = buildCsvBuffer(
      ["GST Rate", "Taxable Sales", "Output GST", "Taxable Purchases", "Input GST", "Net GST"],
      result.items.map((row) => [
        row.gstRate,
        row.taxableSales,
        row.outputGst,
        row.taxablePurchases,
        row.inputGst,
        row.netGst
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "tax_summary",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return {
      fileName: `gst-tax-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportGstr1(actor: GstActor, query: GstGstr1ExportQuery, context: GstRequestContext): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const result = await this.listSales(actor, query, context);
    const content = buildCsvBuffer(
      ["Invoice Date", "Invoice No", "Party Type", "GSTIN", "Place Of Supply", "Taxable", "CGST", "SGST", "IGST", "Cess", "Invoice Total"],
      result.items.map((row) => [
        row.invoiceDate.toISOString().slice(0, 10),
        row.invoiceNumber,
        row.gstin ? "B2B" : "B2C",
        row.gstin ?? "",
        row.placeOfSupply,
        row.taxableAmount,
        row.cgstAmount,
        row.sgstAmount,
        row.igstAmount,
        row.cessAmount,
        row.invoiceTotal
      ])
    );

    await this.persistExportLog(
      actor,
      context,
      "gstr1",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return {
      fileName: `gstr1-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportGstr3b(
    actor: GstActor,
    query: GstGstr3bExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    this.ensureCsvFormat(query.format);
    const summary = await this.getSummary(
      actor,
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        financialYearId: null
      },
      context
    );
    const content = buildCsvBuffer(
      ["Section", "Amount"],
      [
        ["Taxable Sales", summary.taxableSales],
        ["Output GST", summary.outputGst],
        ["Taxable Purchases", summary.taxablePurchases],
        ["Input GST", summary.inputGst],
        ["Expense Input GST", summary.expenseInputGst],
        ["Sales Return GST", summary.returns.salesReturnGst],
        ["Purchase Return GST", summary.returns.purchaseReturnGst],
        ["ITC Claims", summary.adjustments.itcClaims],
        ["ITC Reversals", summary.adjustments.itcReversals],
        ["Output Adjustments", summary.adjustments.outputTaxAdjustments],
        ["Net GST Payable", summary.netGstPayable],
        ["Net GST Credit", summary.netGstCredit]
      ]
    );

    await this.persistExportLog(
      actor,
      context,
      "gstr3b",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      12
    );

    return {
      fileName: `gstr3b-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }
}

export const gstService = new GstService();
