import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { accountingRepository } from "../accounting/accounting.repository";
import { companyRepository } from "../company/company.repository";
import {
  addDecimals,
  compareDecimals,
  normalizeMoney as normalizeMoneyValue
} from "../inventory/inventory.utils";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
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

const formatDateValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().slice(0, 10);
};

const formatReportDateLabel = (value: Date | string) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

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
    purchaseEligibleItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    purchaseClaimedItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    expenseEligibleItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
    expenseClaimedItc: Array<{ month: string; taxableAmount: string; totalGstAmount: string }>;
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

    const purchaseGstMap = new Map(data.purchases.map((row) => [row.month, row.totalGstAmount]));
    const purchaseEligibleItcMap = new Map(data.purchaseEligibleItc.map((row) => [row.month, row.totalGstAmount]));
    const purchaseClaimedItcMap = new Map(data.purchaseClaimedItc.map((row) => [row.month, row.totalGstAmount]));
    const expenseEligibleItcMap = new Map(data.expenseEligibleItc.map((row) => [row.month, row.totalGstAmount]));
    const expenseClaimedItcMap = new Map(data.expenseClaimedItc.map((row) => [row.month, row.totalGstAmount]));
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
      const purchaseGst = normalizeMoney(purchaseGstMap.get(month) ?? "0.00");
      const purchaseEligibleGst = normalizeMoney(purchaseEligibleItcMap.get(month) ?? "0.00");
      const purchaseClaimedGst = normalizeMoney(purchaseClaimedItcMap.get(month) ?? "0.00");
      const expenseEligibleGst = normalizeMoney(expenseEligibleItcMap.get(month) ?? "0.00");
      const expenseClaimedGst = normalizeMoney(expenseClaimedItcMap.get(month) ?? "0.00");
      const monthAdjustments = adjustmentMap.get(month) ?? EMPTY_ADJUSTMENT_BREAKDOWN();
      const outputTax = calculateOutputTax({
        salesGst: entry.outputGst,
        salesReturnGst: entry.salesReturnGst,
        outputAdjustments: monthAdjustments.outputTaxAdjustments
      });
      const inputTax = calculateInputTax({
        purchaseGst,
        eligiblePurchaseGst: purchaseEligibleGst,
        claimedPurchaseGst: purchaseClaimedGst,
        eligibleExpenseGst: expenseEligibleGst,
        claimedExpenseGst: expenseClaimedGst,
        purchaseReturnGst: entry.purchaseReturnGst,
        itcReversals: monthAdjustments.itcReversals,
        itcClaims: monthAdjustments.itcClaims
      });
      const net = calculateNetGstPayable({
        netOutputGst: outputTax.netOutputGst,
        inputGst: inputTax.inputGst
      });

      entry.outputGst = outputTax.outputGst;
      entry.inputGst = inputTax.inputGst;
      entry.expenseInputGst = expenseEligibleGst;
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
      purchaseEligibleItcTotals,
      purchaseClaimedItcTotals,
      expenseEligibleItcTotals,
      expenseClaimedItcTotals,
      adjustmentRows,
      salesMonthly,
      salesReturnMonthly,
      purchaseMonthly,
      purchaseReturnMonthly,
      purchaseEligibleItcMonthly,
      purchaseClaimedItcMonthly,
      expenseEligibleItcMonthly,
      expenseClaimedItcMonthly,
      adjustmentsMonthly
    ] = await Promise.all([
      gstRepository.getSalesTotals(actor.companyId, range),
      gstRepository.getSalesReturnTotals(actor.companyId, range),
      gstRepository.getPurchaseTotals(actor.companyId, range),
      gstRepository.getPurchaseReturnTotals(actor.companyId, range),
      gstRepository.getEligibleItcTotals(actor.companyId, range, "purchase"),
      gstRepository.getClaimedItcTotals(actor.companyId, range, "purchase"),
      gstRepository.getEligibleItcTotals(actor.companyId, range, "expense"),
      gstRepository.getClaimedItcTotals(actor.companyId, range, "expense"),
      gstRepository.getAdjustmentsTotals(actor.companyId, range),
      gstRepository.getSalesMonthlyTotals(actor.companyId, range),
      gstRepository.getSalesReturnMonthlyTotals(actor.companyId, range),
      gstRepository.getPurchaseMonthlyTotals(actor.companyId, range),
      gstRepository.getPurchaseReturnMonthlyTotals(actor.companyId, range),
      gstRepository.getEligibleItcMonthlyTotals(actor.companyId, range, "purchase"),
      gstRepository.getClaimedItcMonthlyTotals(actor.companyId, range, "purchase"),
      gstRepository.getEligibleItcMonthlyTotals(actor.companyId, range, "expense"),
      gstRepository.getClaimedItcMonthlyTotals(actor.companyId, range, "expense"),
      gstRepository.getAdjustmentsMonthlyTotals(actor.companyId, range)
    ]);

    const adjustments = this.buildAdjustmentBreakdown(adjustmentRows);
    const outputTax = calculateOutputTax({
      salesGst: salesTotals.totalGstAmount,
      salesReturnGst: salesReturnTotals.totalGstAmount,
      outputAdjustments: adjustments.outputTaxAdjustments
    });
    const inputTax = calculateInputTax({
      purchaseGst: purchaseTotals.totalGstAmount,
      eligiblePurchaseGst: purchaseEligibleItcTotals.totalGstAmount,
      claimedPurchaseGst: purchaseClaimedItcTotals.totalGstAmount,
      eligibleExpenseGst: expenseEligibleItcTotals.totalGstAmount,
      claimedExpenseGst: expenseClaimedItcTotals.totalGstAmount,
      purchaseReturnGst: purchaseReturnTotals.totalGstAmount,
      itcReversals: adjustments.itcReversals,
      itcClaims: adjustments.itcClaims
    });
    const net = calculateNetGstPayable({
      netOutputGst: outputTax.netOutputGst,
      inputGst: inputTax.inputGst
    });
    const monthWiseTrend = this.createMonthlyTrend(range, {
      sales: salesMonthly,
      salesReturns: salesReturnMonthly,
      purchases: purchaseMonthly,
      purchaseReturns: purchaseReturnMonthly,
      purchaseEligibleItc: purchaseEligibleItcMonthly,
      purchaseClaimedItc: purchaseClaimedItcMonthly,
      expenseEligibleItc: expenseEligibleItcMonthly,
      expenseClaimedItc: expenseClaimedItcMonthly,
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
      salesGst: normalizeMoney(salesTotals.totalGstAmount),
      netOutputGst: outputTax.netOutputGst,
      outputGst: outputTax.outputGst,
      taxablePurchases: normalizeMoney(purchaseTotals.taxableAmount),
      purchaseGst: normalizeMoney(purchaseTotals.totalGstAmount),
      eligiblePurchaseGst: inputTax.eligiblePurchaseGst,
      claimedPurchaseGst: inputTax.claimedPurchaseGst,
      inputGst: inputTax.inputGst,
      eligibleItc: inputTax.eligibleItc,
      claimedItc: inputTax.claimedItc,
      expenseInputGst: normalizeMoney(expenseEligibleItcTotals.totalGstAmount),
      claimedExpenseInputGst: inputTax.claimedExpenseGst,
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
      netOutputGst: outputTax.netOutputGst,
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
    const result = await this.listSales(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const dataset: ReportExportDataset = {
      title: "GST Sales",
      columns: [
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "invoiceNumber", label: "Invoice No" },
        { key: "customerName", label: "Customer" },
        { key: "gstin", label: "GSTIN" },
        { key: "placeOfSupply", label: "Place Of Supply" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "cgstAmount", label: "CGST", type: "number" },
        { key: "sgstAmount", label: "SGST", type: "number" },
        { key: "igstAmount", label: "IGST", type: "number" },
        { key: "cessAmount", label: "Cess", type: "number" },
        { key: "totalGst", label: "Total GST", type: "number" },
        { key: "invoiceTotal", label: "Invoice Total", type: "number" }
      ],
      rows: rows.map((row) => ({
        invoiceDate: formatDateValue(row.invoiceDate as Date | string),
        invoiceNumber: String(row.invoiceNumber),
        customerName: String(row.customerName),
        gstin: String(row.gstin ?? ""),
        placeOfSupply: String(row.placeOfSupply),
        taxableAmount: Number(row.taxableAmount ?? 0),
        cgstAmount: Number(row.cgstAmount ?? 0),
        sgstAmount: Number(row.sgstAmount ?? 0),
        igstAmount: Number(row.igstAmount ?? 0),
        cessAmount: Number(row.cessAmount ?? 0),
        totalGst: Number(row.totalGst ?? 0),
        invoiceTotal: Number(row.invoiceTotal ?? 0)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gst-sales-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "sales_gst",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return file;
  }

  public async exportPurchases(
    actor: GstActor,
    query: GstPurchasesExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    const result = await this.listPurchases(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const dataset: ReportExportDataset = {
      title: "GST Purchases",
      columns: [
        { key: "purchaseDate", label: "Purchase Date" },
        { key: "purchaseNumber", label: "Purchase No" },
        { key: "supplierName", label: "Supplier" },
        { key: "gstin", label: "GSTIN" },
        { key: "supplierInvoiceNumber", label: "Supplier Invoice No" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "cgstAmount", label: "CGST", type: "number" },
        { key: "sgstAmount", label: "SGST", type: "number" },
        { key: "igstAmount", label: "IGST", type: "number" },
        { key: "cessAmount", label: "Cess", type: "number" },
        { key: "totalGst", label: "Total GST", type: "number" },
        { key: "itcEligibility", label: "ITC Eligibility" },
        { key: "claimStatus", label: "Claim Status" },
        { key: "invoiceTotal", label: "Invoice Total", type: "number" }
      ],
      rows: rows.map((row) => ({
        purchaseDate: formatDateValue(row.purchaseDate as Date | string),
        purchaseNumber: String(row.purchaseNumber),
        supplierName: String(row.supplierName),
        gstin: String(row.gstin ?? ""),
        supplierInvoiceNumber: String(row.supplierInvoiceNumber ?? ""),
        taxableAmount: Number(row.taxableAmount ?? 0),
        cgstAmount: Number(row.cgstAmount ?? 0),
        sgstAmount: Number(row.sgstAmount ?? 0),
        igstAmount: Number(row.igstAmount ?? 0),
        cessAmount: Number(row.cessAmount ?? 0),
        totalGst: Number(row.totalGst ?? 0),
        itcEligibility: String(row.itcEligibility),
        claimStatus: String(row.claimStatus),
        invoiceTotal: Number(row.invoiceTotal ?? 0)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gst-purchases-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "purchase_gst",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return file;
  }

  public async exportItc(actor: GstActor, query: GstItcExportQuery, context: GstRequestContext): Promise<GstExportPayload> {
    const result = await this.listItc(actor, query, context);
    const rows = result.items as Array<Record<string, string | Date | null>>;
    const dataset: ReportExportDataset = {
      title: "GST ITC",
      columns: [
        { key: "sourceType", label: "Source Type" },
        { key: "sourceNumber", label: "Source No" },
        { key: "supplierName", label: "Supplier" },
        { key: "supplierGstin", label: "Supplier GSTIN" },
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "cgstAmount", label: "CGST", type: "number" },
        { key: "sgstAmount", label: "SGST", type: "number" },
        { key: "igstAmount", label: "IGST", type: "number" },
        { key: "cessAmount", label: "Cess", type: "number" },
        { key: "totalGstAmount", label: "Total GST", type: "number" },
        { key: "eligibilityStatus", label: "Eligibility" },
        { key: "claimStatus", label: "Claim Status" },
        { key: "claimedAmount", label: "Claimed Amount", type: "number" }
      ],
      rows: rows.map((row) => ({
        sourceType: String(row.sourceType),
        sourceNumber: String(row.sourceNumber ?? ""),
        supplierName: String(row.supplierName ?? ""),
        supplierGstin: String(row.supplierGstin ?? ""),
        invoiceDate: formatDateValue(row.invoiceDate as Date | string),
        taxableAmount: Number(row.taxableAmount ?? 0),
        cgstAmount: Number(row.cgstAmount ?? 0),
        sgstAmount: Number(row.sgstAmount ?? 0),
        igstAmount: Number(row.igstAmount ?? 0),
        cessAmount: Number(row.cessAmount ?? 0),
        totalGstAmount: Number(row.totalGstAmount ?? 0),
        eligibilityStatus: String(row.eligibilityStatus),
        claimStatus: String(row.claimStatus),
        claimedAmount: Number(row.claimedAmount ?? 0)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gst-itc-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "itc",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      rows.length
    );

    return file;
  }

  public async exportHsnSummary(
    actor: GstActor,
    query: GstHsnSummaryExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    const result = await this.getHsnSummary(actor, query, context);
    const dataset: ReportExportDataset = {
      title: "GST HSN Summary",
      columns: [
        { key: "hsnSacCode", label: "HSN/SAC" },
        { key: "description", label: "Description" },
        { key: "unit", label: "Unit" },
        { key: "quantity", label: "Quantity", type: "number" },
        { key: "taxableValue", label: "Taxable Value", type: "number" },
        { key: "gstRate", label: "GST Rate", type: "number" },
        { key: "cgstAmount", label: "CGST", type: "number" },
        { key: "sgstAmount", label: "SGST", type: "number" },
        { key: "igstAmount", label: "IGST", type: "number" },
        { key: "cessAmount", label: "Cess", type: "number" },
        { key: "totalTax", label: "Total Tax", type: "number" }
      ],
      rows: result.items.map((row) => ({
        hsnSacCode: row.hsnSacCode ?? "",
        description: row.description ?? "",
        unit: row.unit ?? "",
        quantity: Number(row.quantity),
        taxableValue: Number(row.taxableValue),
        gstRate: Number(row.gstRate),
        cgstAmount: Number(row.cgstAmount),
        sgstAmount: Number(row.sgstAmount),
        igstAmount: Number(row.igstAmount),
        cessAmount: Number(row.cessAmount),
        totalTax: Number(row.totalTax)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gst-hsn-summary-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "hsn_summary",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return file;
  }

  public async exportTaxSummary(
    actor: GstActor,
    query: GstTaxSummaryExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    const result = await this.getTaxSummary(actor, query, context);
    const dataset: ReportExportDataset = {
      title: "GST Tax Summary",
      columns: [
        { key: "gstRate", label: "GST Rate", type: "number" },
        { key: "taxableSales", label: "Taxable Sales", type: "number" },
        { key: "outputGst", label: "Output GST", type: "number" },
        { key: "taxablePurchases", label: "Taxable Purchases", type: "number" },
        { key: "inputGst", label: "Input GST", type: "number" },
        { key: "netGst", label: "Net GST", type: "number" }
      ],
      rows: result.items.map((row) => ({
        gstRate: Number(row.gstRate),
        taxableSales: Number(row.taxableSales),
        outputGst: Number(row.outputGst),
        taxablePurchases: Number(row.taxablePurchases),
        inputGst: Number(row.inputGst),
        netGst: Number(row.netGst)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gst-tax-summary-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "tax_summary",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return file;
  }

  public async exportGstr1(actor: GstActor, query: GstGstr1ExportQuery, context: GstRequestContext): Promise<GstExportPayload> {
    const result = await this.listSales(actor, query, context);
    const taxableAmountTotal = result.items.reduce((sum, row) => sum + Number(row.taxableAmount), 0);
    const cgstAmountTotal = result.items.reduce((sum, row) => sum + Number(row.cgstAmount), 0);
    const sgstAmountTotal = result.items.reduce((sum, row) => sum + Number(row.sgstAmount), 0);
    const igstAmountTotal = result.items.reduce((sum, row) => sum + Number(row.igstAmount), 0);
    const invoiceTotal = result.items.reduce((sum, row) => sum + Number(row.invoiceTotal), 0);
    const dataset: ReportExportDataset = {
      title: "GSTR-1",
      subtitle: "GST outward supplies return",
      metadata: [
        {
          label: "Period",
          value: `${formatReportDateLabel(query.dateFrom)} to ${formatReportDateLabel(query.dateTo)}`
        },
        {
          label: "Rows",
          value: String(result.items.length)
        }
      ],
      summary: [
        { label: "Invoices", value: result.items.length },
        { label: "Taxable Value", value: taxableAmountTotal.toFixed(2) },
        { label: "Output GST", value: (cgstAmountTotal + sgstAmountTotal + igstAmountTotal).toFixed(2) },
        { label: "Invoice Total", value: invoiceTotal.toFixed(2) }
      ],
      columns: [
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "invoiceNumber", label: "Invoice No" },
        { key: "partyType", label: "Party Type" },
        { key: "gstin", label: "GSTIN" },
        { key: "placeOfSupply", label: "Place Of Supply" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "cgstAmount", label: "CGST", type: "number" },
        { key: "sgstAmount", label: "SGST", type: "number" },
        { key: "igstAmount", label: "IGST", type: "number" },
        { key: "cessAmount", label: "Cess", type: "number" },
        { key: "invoiceTotal", label: "Invoice Total", type: "number" }
      ],
      rows: result.items.map((row) => ({
        invoiceDate: formatDateValue(row.invoiceDate),
        invoiceNumber: row.invoiceNumber,
        partyType: row.gstin ? "B2B" : "B2C",
        gstin: row.gstin ?? "",
        placeOfSupply: row.placeOfSupply,
        taxableAmount: Number(row.taxableAmount),
        cgstAmount: Number(row.cgstAmount),
        sgstAmount: Number(row.sgstAmount),
        igstAmount: Number(row.igstAmount),
        cessAmount: Number(row.cessAmount),
        invoiceTotal: Number(row.invoiceTotal)
      }))
    };
    const file = buildReportFile(dataset, query.format, `gstr1-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "gstr1",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      result.items.length
    );

    return file;
  }

  public async exportGstr3b(
    actor: GstActor,
    query: GstGstr3bExportQuery,
    context: GstRequestContext
  ): Promise<GstExportPayload> {
    const summary = await this.getSummary(
      actor,
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        financialYearId: null
      },
      context
    );
    const dataset: ReportExportDataset = {
      title: "GSTR-3B",
      subtitle: "GST summary return",
      metadata: [
        {
          label: "Period",
          value: `${formatReportDateLabel(query.dateFrom)} to ${formatReportDateLabel(query.dateTo)}`
        },
        {
          label: "Sections",
          value: "12"
        }
      ],
      summary: [
        { label: "Output GST", value: Number(summary.outputGst).toFixed(2) },
        { label: "Input GST", value: Number(summary.inputGst).toFixed(2) },
        { label: "Net Payable", value: Number(summary.netGstPayable).toFixed(2) },
        { label: "Net Credit", value: Number(summary.netGstCredit).toFixed(2) }
      ],
      columns: [
        { key: "section", label: "Section" },
        { key: "amount", label: "Amount", type: "number" }
      ],
      rows: [
        { section: "Taxable Sales", amount: Number(summary.taxableSales) },
        { section: "Output GST", amount: Number(summary.outputGst) },
        { section: "Taxable Purchases", amount: Number(summary.taxablePurchases) },
        { section: "Input GST", amount: Number(summary.inputGst) },
        { section: "Expense Input GST", amount: Number(summary.expenseInputGst) },
        { section: "Sales Return GST", amount: Number(summary.returns.salesReturnGst) },
        { section: "Purchase Return GST", amount: Number(summary.returns.purchaseReturnGst) },
        { section: "ITC Claims", amount: Number(summary.adjustments.itcClaims) },
        { section: "ITC Reversals", amount: Number(summary.adjustments.itcReversals) },
        { section: "Output Adjustments", amount: Number(summary.adjustments.outputTaxAdjustments) },
        { section: "Net GST Payable", amount: Number(summary.netGstPayable) },
        { section: "Net GST Credit", amount: Number(summary.netGstCredit) }
      ]
    };
    const file = buildReportFile(dataset, query.format, `gstr3b-${new Date().toISOString().slice(0, 10)}`);

    await this.persistExportLog(
      actor,
      context,
      "gstr3b",
      { dateFrom: query.dateFrom, dateTo: query.dateTo },
      { ...query, format: undefined },
      12
    );

    return file;
  }
}

export const gstService = new GstService();
