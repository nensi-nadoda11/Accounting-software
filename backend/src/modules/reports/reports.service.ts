import { inventoryRepository } from "../inventory/inventory.repository";
import { expensesService } from "../expenses/expenses.service";
import { payrollService } from "../payroll/payroll.service";
import { gstService } from "../gst/gst.service";
import { accountingService } from "../accounting/accounting.service";
import { customersRepository } from "../customers/customers.repository";
import { suppliersRepository } from "../suppliers/suppliers.repository";
import { auditLogService } from "../audit-logs/audit-log.service";
import { AppError } from "../../utils/app-error";
import { logger } from "../../config/logger";
import { reportExports } from "../../db/schema";
import { getPagination } from "../../utils/pagination";
import { buildReportFile } from "./reports.export";
import { reportsRepository } from "./reports.repository";
import type {
  ReportColumn,
  ReportExportDataset,
  ReportFilePayload,
  ReportMetaItem,
  ReportSummaryItem,
  ReportsActor,
  ReportsRequestContext
} from "./reports.types";
import type {
  ExportReportQuery,
  ReportExportsQuery,
  ReportLedgerQuery,
  ReportOverviewQuery,
  ReportPaginatedQuery,
  ReportSummaryQuery,
  ReportTopQuery
} from "./reports.validator";

const MAX_EXPORT_ROWS = 5000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NormalizedQuery = ReportSummaryQuery & {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
};

const toDateOnly = (value: Date) => new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));

const formatFileBaseName = (reportType: string) =>
  `${reportType.replaceAll(".", "-")}-${new Date().toISOString().slice(0, 10)}`;

const formatDateLabel = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const humanizeWords = (value: string) =>
  value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[._-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const toPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit))
});

export class ReportsService {
  private readonly hiddenExportKeys = new Set(["id"]);

  private toAuditEntityId(value: string) {
    return UUID_PATTERN.test(value) ? value : null;
  }

  private async resolveQuery(actor: ReportsActor, query: ReportSummaryQuery, options?: { requireDateRange?: boolean }) {
    let dateFrom = query.dateFrom;
    let dateTo = query.dateTo;

    if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
      throw new AppError("dateFrom and dateTo must be provided together", 400);
    }

    if (query.financialYearId) {
      const financialYear = await reportsRepository.findFinancialYear(actor.companyId, query.financialYearId);
      if (!financialYear) {
        throw new AppError("Financial year does not belong to this company", 404);
      }

      dateFrom ??= toDateOnly(financialYear.startDate);
      dateTo ??= toDateOnly(financialYear.endDate);
    }

    if (options?.requireDateRange && (!dateFrom || !dateTo)) {
      throw new AppError("dateFrom and dateTo are required for this report", 400);
    }

    await this.assertFilterOwnership(actor.companyId, query);

      return {
        ...query,
        dateFrom,
        dateTo
      } as NormalizedQuery;
  }

  private async assertFilterOwnership(companyId: string, query: ReportSummaryQuery) {
    if (query.customerId) {
      const customer = await reportsRepository.findCustomer(companyId, query.customerId);
      if (!customer) {
        throw new AppError("Customer does not belong to this company", 404);
      }
    }

    if (query.supplierId) {
      const supplier = await reportsRepository.findSupplier(companyId, query.supplierId);
      if (!supplier) {
        throw new AppError("Supplier does not belong to this company", 404);
      }
    }

    if (query.productId && !(await reportsRepository.productExists(companyId, query.productId))) {
      throw new AppError("Product does not belong to this company", 404);
    }

    if (query.categoryId && !(await reportsRepository.categoryExists(companyId, query.categoryId))) {
      throw new AppError("Category does not belong to this company", 404);
    }

    if (query.employeeId && !(await reportsRepository.employeeExists(companyId, query.employeeId))) {
      throw new AppError("Employee does not belong to this company", 404);
    }
  }

  private async logAction(
    actor: ReportsActor,
    action: string,
    reportType: string,
    query: Record<string, unknown>,
    context: ReportsRequestContext
  ) {
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action,
      entityType: "report",
      entityId: this.toAuditEntityId(reportType),
      metadata: {
        reportType,
        filters: query
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  private async safeLogAction(
    actor: ReportsActor,
    action: string,
    reportType: string,
    query: Record<string, unknown>,
    context: ReportsRequestContext
  ) {
    try {
      await this.logAction(actor, action, reportType, query, context);
    } catch (error) {
      logger.warn("Reports audit log failed", {
        action,
        reportType,
        companyId: actor.companyId,
        userId: actor.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async listRecentExportsSafe(companyId: string, limit: number) {
    try {
      return await reportsRepository.listRecentExports(companyId, limit);
    } catch (error) {
      logger.warn("Reports export history unavailable", {
        companyId,
        limit,
        message: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private async createReportExportSafe(data: typeof reportExports.$inferInsert) {
    try {
      await reportsRepository.createReportExport(data);
    } catch (error) {
      logger.warn("Report export history write failed", {
        companyId: data.companyId,
        reportType: data.reportType,
        status: data.status,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public async getOverview(actor: ReportsActor, query: ReportOverviewQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const [salesSummary, purchaseSummary, incomeSummary, recentExports] = await Promise.all([
      reportsRepository.getSalesSummary(actor.companyId, resolved),
      reportsRepository.getPurchasesSummary(actor.companyId, resolved),
      reportsRepository.getIncomeSummary(actor.companyId, resolved),
      this.listRecentExportsSafe(actor.companyId, 8)
    ]);

    await this.safeLogAction(actor, "reports_overview_viewed", "overview", resolved, context);

    return {
      summaryCards: [
        { id: "sales", label: "Sales", value: salesSummary?.grossSales ?? "0.00" },
        { id: "purchases", label: "Purchases", value: purchaseSummary?.grossPurchases ?? "0.00" },
        { id: "income", label: "Income", value: incomeSummary?.netIncome ?? "0.00" },
        { id: "receivables", label: "Receivables", value: salesSummary?.outstandingAmount ?? "0.00" },
        { id: "payables", label: "Payables", value: purchaseSummary?.outstandingAmount ?? "0.00" }
      ],
      recentExports
    };
  }

  public async listExports(actor: ReportsActor, query: ReportExportsQuery, context: ReportsRequestContext) {
    const data = await this.listRecentExportsSafe(actor.companyId, query.limit);
    await this.safeLogAction(actor, "reports_exports_viewed", "exports", query, context);
    return { items: data };
  }

  public async getSalesSummary(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getSalesSummary(actor.companyId, resolved);
    await this.safeLogAction(actor, "sales_report_viewed", "sales.summary", resolved, context);
    return data;
  }

  public async getSalesDetailed(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getSalesDetailed(actor.companyId, { ...resolved, ...pagination });
    await this.safeLogAction(actor, "sales_report_viewed", "sales.detailed", { ...resolved, ...pagination }, context);
    return {
      items: data.items,
      totals: data.totals,
      pagination: toPagination(pagination.page, pagination.limit, data.total)
    };
  }

  public async getSalesTopCustomers(actor: ReportsActor, query: ReportTopQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getSalesTopCustomers(actor.companyId, resolved, query.limit);
    await this.safeLogAction(actor, "sales_report_viewed", "sales.top-customers", resolved, context);
    return { items: data };
  }

  public async getSalesTopProducts(actor: ReportsActor, query: ReportTopQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getSalesTopProducts(actor.companyId, resolved, query.limit);
    await this.safeLogAction(actor, "sales_report_viewed", "sales.top-products", resolved, context);
    return { items: data };
  }

  public async getPurchasesSummary(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getPurchasesSummary(actor.companyId, resolved);
    await this.safeLogAction(actor, "purchase_report_viewed", "purchases.summary", resolved, context);
    return data;
  }

  public async getPurchasesDetailed(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getPurchasesDetailed(actor.companyId, { ...resolved, ...pagination });
    await this.safeLogAction(actor, "purchase_report_viewed", "purchases.detailed", { ...resolved, ...pagination }, context);
    return {
      items: data.items,
      totals: data.totals,
      pagination: toPagination(pagination.page, pagination.limit, data.total)
    };
  }

  public async getCustomersLedger(actor: ReportsActor, query: ReportLedgerQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query);
    if (!resolved.customerId) {
      throw new AppError("customerId is required for customer ledger", 400);
    }

    const customer = await reportsRepository.findCustomer(actor.companyId, resolved.customerId);
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    const ledger = await customersRepository.listLedgerTransactions(actor.companyId, resolved.customerId, {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo
    });

    const openingRows =
      customer.openingBalanceType === "none"
        ? []
        : [
            {
              date: resolved.dateFrom ?? new Date(),
              transactionType: "opening_balance",
              referenceNo: customer.customerCode,
              description: "Opening balance",
              debit: customer.openingBalanceType === "debit" ? customer.openingBalanceAmount : "0.00",
              credit: customer.openingBalanceType === "credit" ? customer.openingBalanceAmount : "0.00",
              paymentMode: null,
              remarks: null
            }
          ];

    const allRows = [...openingRows, ...ledger.rows];
    const start = pagination.offset;
    const end = start + pagination.limit;
    const items = allRows.slice(start, end);

    await this.safeLogAction(actor, "customer_report_viewed", "customers.ledger", { ...resolved, ...pagination }, context);

    return {
      customer,
      items,
      pagination: toPagination(pagination.page, pagination.limit, allRows.length)
    };
  }

  public async getCustomersOutstanding(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listCustomersOutstanding(actor.companyId, resolved);
    await this.safeLogAction(actor, "customer_report_viewed", "customers.outstanding", resolved, context);
    return { items: data };
  }

  public async getCustomersAging(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listCustomersAging(actor.companyId, resolved);
    await this.safeLogAction(actor, "customer_report_viewed", "customers.aging", resolved, context);
    return { items: data };
  }

  public async getSuppliersLedger(actor: ReportsActor, query: ReportLedgerQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query);
    if (!resolved.supplierId) {
      throw new AppError("supplierId is required for supplier ledger", 400);
    }

    const supplier = await reportsRepository.findSupplier(actor.companyId, resolved.supplierId);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    const ledger = await suppliersRepository.listLedgerTransactions(actor.companyId, resolved.supplierId, {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo
    });

    const openingRows =
      supplier.openingBalanceType === "none"
        ? []
        : [
            {
              date: resolved.dateFrom ?? new Date(),
              transactionType: "opening_balance",
              referenceNo: supplier.supplierCode,
              description: "Opening balance",
              debit: supplier.openingBalanceType === "debit" ? supplier.openingBalanceAmount : "0.00",
              credit: supplier.openingBalanceType === "credit" ? supplier.openingBalanceAmount : "0.00",
              paymentMode: null,
              remarks: null
            }
          ];

    const allRows = [...openingRows, ...ledger.rows];
    const start = pagination.offset;
    const end = start + pagination.limit;
    const items = allRows.slice(start, end);

    await this.safeLogAction(actor, "supplier_report_viewed", "suppliers.ledger", { ...resolved, ...pagination }, context);

    return {
      supplier,
      items,
      pagination: toPagination(pagination.page, pagination.limit, allRows.length)
    };
  }

  public async getSuppliersOutstanding(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listSuppliersOutstanding(actor.companyId, resolved);
    await this.safeLogAction(actor, "supplier_report_viewed", "suppliers.outstanding", resolved, context);
    return { items: data };
  }

  public async getSuppliersAging(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listSuppliersAging(actor.companyId, resolved);
    await this.safeLogAction(actor, "supplier_report_viewed", "suppliers.aging", resolved, context);
    return { items: data };
  }

  public async getInventoryCurrentStock(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query);
    const data = await inventoryRepository.listStock({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      productId: resolved.productId,
      categoryId: resolved.categoryId,
      search: null,
      warehouseId: undefined,
      lowStock: false,
      outOfStock: false,
      expired: false,
      expiringSoon: false,
      status: undefined,
      expiryAlertDays: 30
    });
    await this.safeLogAction(actor, "inventory_report_viewed", "inventory.current-stock", { ...resolved, ...pagination }, context);
    return {
      items: data.rows,
      pagination: toPagination(pagination.page, pagination.limit, data.total)
    };
  }

  public async getInventoryValuation(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await inventoryRepository.listValuation({
      companyId: actor.companyId,
      categoryId: resolved.categoryId,
      productId: resolved.productId,
      warehouseId: undefined
    });
    await this.safeLogAction(actor, "inventory_report_viewed", "inventory.valuation", resolved, context);
    return { items: data };
  }

  public async getInventoryExpiry(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listInventoryExpiry(actor.companyId, { ...resolved, ...pagination });
    await this.safeLogAction(actor, "inventory_report_viewed", "inventory.expiry", { ...resolved, ...pagination }, context);
    return {
      items: data.items,
      pagination: toPagination(pagination.page, pagination.limit, data.total)
    };
  }

  public async getInventoryMovement(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const pagination = getPagination(query.page, query.limit);
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await inventoryRepository.listMovements({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      productId: resolved.productId,
      warehouseId: undefined,
      batchId: undefined,
      movementType: undefined,
      referenceType: null,
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo
    });
    await this.safeLogAction(actor, "inventory_report_viewed", "inventory.movement", { ...resolved, ...pagination }, context);
    return {
      items: data.rows,
      pagination: toPagination(pagination.page, pagination.limit, data.total)
    };
  }

  public async getInventoryLowStock(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    const data = await reportsRepository.listInventoryLowStock(actor.companyId, resolved);
    await this.safeLogAction(actor, "inventory_report_viewed", "inventory.low-stock", resolved, context);
    return { items: data };
  }

  public async getExpenseCategoryWise(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await expensesService.getCategoryWiseReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "expense_report_viewed", "expenses.category-wise", resolved, context);
    return data;
  }

  public async getExpenseMonthly(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await expensesService.getMonthlyReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "expense_report_viewed", "expenses.monthly", resolved, context);
    return data;
  }

  public async getExpensePaymentMode(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await expensesService.getPaymentModeReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "expense_report_viewed", "expenses.payment-mode", resolved, context);
    return data;
  }

  public async getIncomeSummary(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getIncomeSummary(actor.companyId, resolved);
    await this.safeLogAction(actor, "income_report_viewed", "income.summary", resolved, context);
    return data;
  }

  public async getIncomeMonthly(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await reportsRepository.getIncomeMonthly(actor.companyId, resolved);
    await this.safeLogAction(actor, "income_report_viewed", "income.monthly", resolved, context);
    return { items: data };
  }

  public async getPayrollMonthly(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await payrollService.getMonthlyReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "payroll_report_viewed", "payroll.monthly", resolved, context);
    return data;
  }

  public async getPayrollEmployee(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await payrollService.getEmployeeReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "payroll_report_viewed", "payroll.employee", resolved, context);
    return data;
  }

  public async getPayrollDepartment(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await payrollService.getDepartmentReport({ companyId: actor.companyId }, resolved as never);
    await this.safeLogAction(actor, "payroll_report_viewed", "payroll.department", resolved, context);
    return data;
  }

  public async getGstSummary(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await gstService.getSummary(actor as never, resolved as never, context);
    await this.safeLogAction(actor, "gst_report_viewed", "gst.summary", resolved, context);
    return data;
  }

  public async getGstHsn(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await gstService.getHsnSummary(actor as never, { ...resolved, source: "all" } as never, context);
    await this.safeLogAction(actor, "gst_report_viewed", "gst.hsn", resolved, context);
    return data;
  }

  public async getTrialBalance(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await accountingService.getTrialBalance(actor as never, resolved as never, context as never);
    await this.safeLogAction(actor, "accounting_report_viewed", "accounting.trial-balance", resolved, context);
    return data;
  }

  public async getProfitLoss(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await accountingService.getProfitLoss(actor as never, resolved as never, context as never);
    await this.safeLogAction(actor, "accounting_report_viewed", "accounting.profit-loss", resolved, context);
    return data;
  }

  public async getBalanceSheet(actor: ReportsActor, query: ReportSummaryQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query);
    if (!resolved.dateTo) {
      throw new AppError("dateTo is required for balance sheet", 400);
    }

    const data = await accountingService.getBalanceSheet(
      actor as never,
      { ...resolved, asOfDate: resolved.dateTo } as never,
      context as never
    );
    await this.safeLogAction(actor, "accounting_report_viewed", "accounting.balance-sheet", resolved, context);
    return data;
  }

  public async getCashBook(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await accountingService.getCashBook(actor as never, resolved as never, context as never);
    await this.safeLogAction(actor, "accounting_report_viewed", "accounting.cash-book", resolved, context);
    return data;
  }

  public async getBankBook(actor: ReportsActor, query: ReportPaginatedQuery, context: ReportsRequestContext) {
    const resolved = await this.resolveQuery(actor, query, { requireDateRange: true });
    const data = await accountingService.getBankBook(actor as never, resolved as never, context as never);
    await this.safeLogAction(actor, "accounting_report_viewed", "accounting.bank-book", resolved, context);
    return data;
  }

  private inferColumnType(key: string, rows: Array<Record<string, unknown>>): ReportColumn["type"] {
    const sample = rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key];
    if (sample instanceof Date) {
      return key.toLowerCase().endsWith("at") ? "datetime" : "date";
    }

    if (typeof sample === "number") {
      return "number";
    }

    if (typeof sample === "string") {
      if (/^-?\d+(\.\d+)?$/.test(sample)) {
        return "number";
      }

      if (/date$/i.test(key)) {
        return "date";
      }

      if (/(createdAt|updatedAt|generatedAt)$/i.test(key)) {
        return "datetime";
      }
    }

    return "string";
  }

  private shouldHideColumn(key: string, allKeys: string[]) {
    if (this.hiddenExportKeys.has(key)) {
      return true;
    }

    if (/Id$/.test(key)) {
      const relatedNameKey = key.replace(/Id$/, "Name");
      const relatedNumberKey = key.replace(/Id$/, "Number");
      return allKeys.includes(relatedNameKey) || allKeys.includes(relatedNumberKey);
    }

    return false;
  }

  private buildDatasetMetadata(query: ExportReportQuery, rowCount: number): ReportMetaItem[] {
    const metadata: ReportMetaItem[] = [];

    if (query.dateFrom || query.dateTo) {
      metadata.push({
        label: "Period",
        value:
          query.dateFrom && query.dateTo
            ? `${formatDateLabel(query.dateFrom)} to ${formatDateLabel(query.dateTo)}`
            : query.dateFrom
              ? `From ${formatDateLabel(query.dateFrom)}`
              : `Until ${formatDateLabel(query.dateTo!)}`
      });
    }

    if (query.status) {
      metadata.push({ label: "Status", value: humanizeWords(query.status) });
    }

    if (query.paymentMode) {
      metadata.push({ label: "Payment Mode", value: humanizeWords(query.paymentMode) });
    }

    if (query.department) {
      metadata.push({ label: "Department", value: query.department });
    }

    if (query.gstRate !== undefined) {
      metadata.push({ label: "GST Rate", value: `${query.gstRate}%` });
    }

    if (query.includeDrafts) {
      metadata.push({ label: "Drafts", value: "Included" });
    }

    if (query.includeCancelled) {
      metadata.push({ label: "Cancelled", value: "Included" });
    }

    metadata.push({ label: "Exported On", value: new Date().toLocaleString("en-IN") });

    return metadata;
  }

  private buildSummaryItems(record: Record<string, unknown> | null | undefined): ReportSummaryItem[] {
    if (!record) {
      return [];
    }

    return Object.entries(record)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => ({
        label: humanizeWords(key),
        value: typeof value === "string" || typeof value === "number" ? value : String(value)
      }));
  }

  private createDatasetFromRows(
    title: string,
    rows: Array<Record<string, unknown>>,
    options?: {
      subtitle?: string;
      metadata?: ReportMetaItem[];
      summary?: ReportSummaryItem[];
    }
  ) {
    if (!rows.length) {
      return {
        title,
        subtitle: options?.subtitle,
        columns: [],
        rows: [],
        metadata: options?.metadata ?? [],
        summary: options?.summary ?? []
      } satisfies ReportExportDataset;
    }

    const keys = Object.keys(rows[0]!).filter((key, _, allKeys) => !this.shouldHideColumn(key, allKeys));
    return {
      title,
      subtitle: options?.subtitle,
      columns: keys.map((key) => ({
        key,
        label: humanizeWords(key),
        type: this.inferColumnType(key, rows)
      })),
      rows: rows as Array<Record<string, string | number | Date | null | undefined>>,
      metadata: options?.metadata ?? [],
      summary: options?.summary ?? []
    } satisfies ReportExportDataset;
  }

  private datasetFromDetailedResult(
    title: string,
    data: { items: unknown[]; totals?: Record<string, unknown> | null | undefined },
    query: ExportReportQuery
  ) {
    return this.createDatasetFromRows(title, data.items as Array<Record<string, unknown>>, {
      metadata: this.buildDatasetMetadata(query, data.items.length),
      summary: this.buildSummaryItems(data.totals ?? null)
    });
  }

  private datasetFromRowsWithMetadata(title: string, rows: Array<Record<string, unknown>>, query: ExportReportQuery, summary?: ReportSummaryItem[]) {
    return this.createDatasetFromRows(title, rows, {
      metadata: this.buildDatasetMetadata(query, rows.length),
      summary: summary ?? []
    });
  }

  private async buildExportDataset(actor: ReportsActor, query: ExportReportQuery, context: ReportsRequestContext) {
    switch (query.reportType) {
      case "sales.summary": {
        const data = await this.getSalesSummary(actor, query, context) as Record<string, unknown>;
        return this.datasetFromRowsWithMetadata("Sales Summary", [data], query, this.buildSummaryItems(data));
      }
      case "sales.detailed":
        return this.datasetFromDetailedResult(
          "Sales Detailed",
          await this.getSalesDetailed(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "sales.top-customers":
        return this.datasetFromRowsWithMetadata(
          "Top Customers",
          (await this.getSalesTopCustomers(actor, { ...query, limit: 20 }, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "sales.top-products":
        return this.datasetFromRowsWithMetadata(
          "Top Products",
          (await this.getSalesTopProducts(actor, { ...query, limit: 20 }, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "purchases.summary": {
        const data = await this.getPurchasesSummary(actor, query, context) as Record<string, unknown>;
        return this.datasetFromRowsWithMetadata("Purchase Summary", [data], query, this.buildSummaryItems(data));
      }
      case "purchases.detailed":
        return this.datasetFromDetailedResult(
          "Purchases Detailed",
          await this.getPurchasesDetailed(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "customers.ledger":
        return this.datasetFromDetailedResult(
          "Customer Ledger",
          await this.getCustomersLedger(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "customers.outstanding":
        return this.datasetFromRowsWithMetadata(
          "Customer Outstanding",
          (await this.getCustomersOutstanding(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "customers.aging":
        return this.datasetFromRowsWithMetadata(
          "Customer Aging",
          (await this.getCustomersAging(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "suppliers.ledger":
        return this.datasetFromDetailedResult(
          "Supplier Ledger",
          await this.getSuppliersLedger(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "suppliers.outstanding":
        return this.datasetFromRowsWithMetadata(
          "Supplier Outstanding",
          (await this.getSuppliersOutstanding(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "suppliers.aging":
        return this.datasetFromRowsWithMetadata(
          "Supplier Aging",
          (await this.getSuppliersAging(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "inventory.current-stock":
        return this.datasetFromDetailedResult(
          "Current Stock",
          await this.getInventoryCurrentStock(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "inventory.valuation":
        return this.datasetFromRowsWithMetadata(
          "Inventory Valuation",
          (await this.getInventoryValuation(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "inventory.expiry":
        return this.datasetFromDetailedResult(
          "Inventory Expiry",
          await this.getInventoryExpiry(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "inventory.movement":
        return this.datasetFromDetailedResult(
          "Inventory Movement",
          await this.getInventoryMovement(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context),
          query
        );
      case "inventory.low-stock":
        return this.datasetFromRowsWithMetadata(
          "Low Stock",
          (await this.getInventoryLowStock(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "expenses.category-wise":
        return this.datasetFromRowsWithMetadata(
          "Expense Category Wise",
          ((await this.getExpenseCategoryWise(actor, query, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "expenses.monthly":
        return this.datasetFromRowsWithMetadata(
          "Expense Monthly",
          ((await this.getExpenseMonthly(actor, query, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "expenses.payment-mode":
        return this.datasetFromRowsWithMetadata(
          "Expense Payment Mode",
          ((await this.getExpensePaymentMode(actor, query, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "income.summary": {
        const data = await this.getIncomeSummary(actor, query, context) as Record<string, unknown>;
        return this.datasetFromRowsWithMetadata("Income Summary", [data], query, this.buildSummaryItems(data));
      }
      case "income.monthly":
        return this.datasetFromRowsWithMetadata(
          "Income Monthly",
          (await this.getIncomeMonthly(actor, query, context)).items as Array<Record<string, unknown>>,
          query
        );
      case "payroll.monthly":
        return this.datasetFromRowsWithMetadata(
          "Payroll Monthly",
          ((await this.getPayrollMonthly(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "payroll.employee":
        return this.datasetFromRowsWithMetadata(
          "Payroll Employee",
          ((await this.getPayrollEmployee(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "payroll.department":
        return this.datasetFromRowsWithMetadata(
          "Payroll Department",
          ((await this.getPayrollDepartment(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "gst.summary": {
        const data = await this.getGstSummary(actor, query, context) as Record<string, unknown>;
        return this.datasetFromRowsWithMetadata("GST Summary", [data], query, this.buildSummaryItems(data));
      }
      case "gst.hsn":
        return this.datasetFromRowsWithMetadata(
          "GST HSN",
          ((await this.getGstHsn(actor, query, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "accounting.trial-balance":
        return this.datasetFromRowsWithMetadata(
          "Trial Balance",
          ((await this.getTrialBalance(actor, query, context)) as { items: Array<Record<string, unknown>> }).items,
          query
        );
      case "accounting.profit-loss": {
        const data = await this.getProfitLoss(actor, query, context) as { items: Array<Record<string, unknown>> };
        return this.datasetFromRowsWithMetadata("Profit and Loss", data.items, query);
      }
      case "accounting.balance-sheet": {
        const data = await this.getBalanceSheet(actor, query, context) as {
          assets: Array<Record<string, unknown>>;
          liabilities: Array<Record<string, unknown>>;
          equity: Array<Record<string, unknown>>;
        };
        return this.datasetFromRowsWithMetadata(
          "Balance Sheet",
          [
            ...data.assets.map((item) => ({ section: "assets", ...item })),
            ...data.liabilities.map((item) => ({ section: "liabilities", ...item })),
            ...data.equity.map((item) => ({ section: "equity", ...item }))
          ],
          query
        );
      }
      case "accounting.cash-book":
        return this.datasetFromRowsWithMetadata(
          "Cash Book",
          ((await this.getCashBook(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context)) as { rows: Array<Record<string, unknown>> }).rows,
          query
        );
      case "accounting.bank-book":
        return this.datasetFromRowsWithMetadata(
          "Bank Book",
          ((await this.getBankBook(actor, { ...query, page: 1, limit: MAX_EXPORT_ROWS }, context)) as { rows: Array<Record<string, unknown>> }).rows,
          query
        );
      default:
        throw new AppError("Unsupported report type", 400);
    }
  }

  public async exportReport(actor: ReportsActor, query: ExportReportQuery, context: ReportsRequestContext): Promise<ReportFilePayload> {
    const mergedQuery = {
      ...(query.filters ?? {}),
      ...query
    } as ExportReportQuery;

    try {
      const dataset = await this.buildExportDataset(actor, mergedQuery, context);

      if (dataset.rows.length > MAX_EXPORT_ROWS) {
        throw new AppError("Export is too large. Narrow the filters and try again.", 400);
      }

      const file = buildReportFile(dataset, query.format, formatFileBaseName(query.reportType));

      await this.createReportExportSafe({
        companyId: actor.companyId,
        reportType: query.reportType,
        exportFormat: query.format,
        filters: query.filters ?? {},
        fileUrl: null,
        status: "generated",
        generatedBy: actor.id
      });

      await this.safeLogAction(actor, "report_exported", query.reportType, mergedQuery, context);
      return file;
    } catch (error) {
      await this.createReportExportSafe({
        companyId: actor.companyId,
        reportType: query.reportType,
        exportFormat: query.format,
        filters: query.filters ?? {},
        fileUrl: null,
        status: "failed",
        generatedBy: actor.id
      });

      throw error;
    }
  }
}

export const reportsService = new ReportsService();
