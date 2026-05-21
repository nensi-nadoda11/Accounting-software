import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { getErrorMessage } from "../../lib/errors";
import { useToast } from "../../providers/useToast";
import { customersApi } from "../../services/customersApi";
import { expensesApi } from "../../services/expensesApi";
import { financialYearApi } from "../../services/financialYearApi";
import { payrollApi } from "../../services/payrollApi";
import { productsApi } from "../../services/productsApi";
import { reportsApi } from "../../services/reportsApi";
import { suppliersApi } from "../../services/suppliersApi";
import type {
  CustomerAgingRow,
  CustomerOutstandingRow,
  ExpenseReport,
  GstReport,
  IncomeMonthlyResponse,
  IncomeSummaryReport,
  InventoryCurrentStockResponse,
  InventoryExpiryResponse,
  InventoryLowStockRow,
  AccountingReport,
  PartyLedgerResponse,
  PayrollReport,
  PurchaseDetailedResponse,
  PurchaseSummaryReport,
  ReportExportRecord,
  ReportFilters,
  ReportFormat,
  ReportType,
  ReportsOverviewResponse,
  ReportsTabId,
  SalesDetailedResponse,
  SalesSummaryReport,
  SalesTopCustomerRow,
  SalesTopProductRow,
  SupplierAgingRow,
  SupplierOutstandingRow,
} from "../../types/report";
import type { CompanyFinancialYear } from "../../types/company";
import type { InventoryValuationRow } from "../../types/inventory";
import { formatDate, formatDateTime, saveDownloadedFile } from "../customers/customerUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { AgingBucketTable } from "./components/AgingBucketTable";
import { AmountText } from "./components/AmountText";
import { LoadingState } from "./components/LoadingState";
import { ReportExportCenter } from "./components/ReportExportCenter";
import { ReportFiltersPanel } from "./components/ReportFilters";
import { ReportSummaryCards } from "./components/ReportSummaryCards";
import { ReportTable } from "./components/ReportTable";
import { ReportsTabs, type ReportsTabOption } from "./components/ReportsTabs";
import { StatusBadge } from "./components/StatusBadge";

type Option = { value: string; label: string };

type SalesTabData = {
  summary: SalesSummaryReport;
  detailed: SalesDetailedResponse;
  topCustomers: SalesTopCustomerRow[];
  topProducts: SalesTopProductRow[];
};

type PurchasesTabData = {
  summary: PurchaseSummaryReport;
  detailed: PurchaseDetailedResponse;
};

type CustomersTabData = {
  ledger: PartyLedgerResponse | null;
  outstanding: CustomerOutstandingRow[];
  aging: CustomerAgingRow[];
};

type SuppliersTabData = {
  ledger: PartyLedgerResponse | null;
  outstanding: SupplierOutstandingRow[];
  aging: SupplierAgingRow[];
};

type InventoryTabData = {
  currentStock: InventoryCurrentStockResponse;
  valuation: InventoryValuationRow[];
  expiry: InventoryExpiryResponse;
  movement: { items: Array<Record<string, unknown>>; pagination: InventoryCurrentStockResponse["pagination"] };
  lowStock: InventoryLowStockRow[];
};

type IncomeTabData = {
  summary: IncomeSummaryReport;
  monthly: IncomeMonthlyResponse;
};

type AccountingTabData = AccountingReport;

const TABS: ReportsTabOption[] = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases" },
  { id: "customers", label: "Customers" },
  { id: "suppliers", label: "Suppliers" },
  { id: "inventory", label: "Inventory" },
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "payroll", label: "Payroll" },
  { id: "gst", label: "GST" },
  { id: "accounting", label: "Accounting" },
  { id: "exports", label: "Exports" },
];

const DEFAULT_FILTERS: ReportFilters = {
  dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  dateTo: new Date().toISOString().slice(0, 10),
  financialYearId: "",
  customerId: "",
  supplierId: "",
  productId: "",
  categoryId: "",
  employeeId: "",
  department: "",
  paymentMode: "",
  gstRate: "",
  status: "",
  page: 1,
  limit: 20,
};

const PAYMENT_MODE_OPTIONS: Option[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: Option[] = [
  { value: "posted", label: "Posted" },
  { value: "draft", label: "Draft" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

const TAB_EXPORT_TYPES: Record<Exclude<ReportsTabId, "overview" | "exports">, ReportType> = {
  sales: "sales.detailed",
  purchases: "purchases.detailed",
  customers: "customers.outstanding",
  suppliers: "suppliers.outstanding",
  inventory: "inventory.current-stock",
  expenses: "expenses.category-wise",
  income: "income.monthly",
  payroll: "payroll.monthly",
  gst: "gst.summary",
  accounting: "accounting.trial-balance",
};

export const ReportsPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = searchParams.get("tab") as ReportsTabId | null;
  const activeTab = TABS.find((item) => item.id === requestedTab)?.id ?? "overview";

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const debouncedFilters = useDebouncedValue(JSON.stringify(filters), 250);

  const [financialYears, setFinancialYears] = useState<CompanyFinancialYear[]>([]);
  const [customerOptions, setCustomerOptions] = useState<Option[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Option[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Option[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportCenterFormat, setExportCenterFormat] = useState<ReportFormat>("csv");
  const [exportCenterType, setExportCenterType] = useState<ReportType>("sales.detailed");

  const [overviewData, setOverviewData] = useState<ReportsOverviewResponse | null>(null);
  const [salesData, setSalesData] = useState<SalesTabData | null>(null);
  const [purchasesData, setPurchasesData] = useState<PurchasesTabData | null>(null);
  const [customersData, setCustomersData] = useState<CustomersTabData | null>(null);
  const [suppliersData, setSuppliersData] = useState<SuppliersTabData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryTabData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseReport | null>(null);
  const [incomeData, setIncomeData] = useState<IncomeTabData | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollReport | null>(null);
  const [gstData, setGstData] = useState<GstReport | null>(null);
  const [accountingData, setAccountingData] = useState<AccountingTabData | null>(null);
  const [exportsData, setExportsData] = useState<ReportExportRecord[]>([]);

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", activeTab);
        return next;
      }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  useEffect(() => {
    const loadReferences = async () => {
      try {
        setReferencesLoading(true);
        const [years, customers, suppliers, products, categories, employees] = await Promise.allSettled([
          financialYearApi.list(),
          customersApi.list({ page: 1, limit: 100, status: "active" }),
          suppliersApi.list({ page: 1, limit: 100, status: "active" }),
          productsApi.list({ page: 1, limit: 100, status: "active" }),
          expensesApi.listCategories({ status: "active" }),
          payrollApi.listEmployees({ page: 1, limit: 100, status: "active" }),
        ]);

        const yearItems = years.status === "fulfilled" ? years.value.data.items : [];
        const employeeItems = employees.status === "fulfilled" ? employees.value.data.items : [];

        setFinancialYears(yearItems);
        setCustomerOptions(
          customers.status === "fulfilled" ? customers.value.data.items.map((item) => ({ value: item.id, label: item.name })) : [],
        );
        setSupplierOptions(
          suppliers.status === "fulfilled" ? suppliers.value.data.items.map((item) => ({ value: item.id, label: item.name })) : [],
        );
        setProductOptions(
          products.status === "fulfilled" ? products.value.data.items.map((item) => ({ value: item.id, label: item.name })) : [],
        );
        setCategoryOptions(
          categories.status === "fulfilled" ? categories.value.data.items.map((item) => ({ value: item.id, label: item.name })) : [],
        );
        setEmployeeOptions(employeeItems.map((item) => ({ value: item.id, label: item.fullName })));
        setDepartmentOptions(
          Array.from(new Set(employeeItems.map((item) => item.department).filter((value): value is string => Boolean(value))))
            .sort((left, right) => left.localeCompare(right))
            .map((value) => ({ value, label: value })),
        );
        setFilters((current) => ({
          ...current,
          financialYearId: current.financialYearId || yearItems.find((item) => item.isActive)?.id || "",
        }));
      } catch (referenceError) {
        toast.error(getErrorMessage(referenceError, "Failed to load report references"));
      } finally {
        setReferencesLoading(false);
      }
    };

    void loadReferences();
  }, [toast]);

  const parsedFilters = useMemo(() => JSON.parse(debouncedFilters) as ReportFilters, [debouncedFilters]);

  useEffect(() => {
    if (referencesLoading) {
      return;
    }

    const loadActiveTab = async () => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === "overview") {
          const response = await reportsApi.getOverview(parsedFilters);
          setOverviewData(response.data);
          setExportsData(response.data.recentExports);
          return;
        }

        if (activeTab === "sales") {
          const [summary, detailed, topCustomers, topProducts] = await Promise.all([
            reportsApi.getSalesSummary(parsedFilters),
            reportsApi.getSalesDetailed(parsedFilters),
            reportsApi.getSalesTopCustomers({ ...parsedFilters, limit: 10 }),
            reportsApi.getSalesTopProducts({ ...parsedFilters, limit: 10 }),
          ]);
          setSalesData({
            summary: summary.data,
            detailed: detailed.data,
            topCustomers: topCustomers.data.items,
            topProducts: topProducts.data.items,
          });
          return;
        }

        if (activeTab === "purchases") {
          const [summary, detailed] = await Promise.all([
            reportsApi.getPurchasesSummary(parsedFilters),
            reportsApi.getPurchasesDetailed(parsedFilters),
          ]);
          setPurchasesData({ summary: summary.data, detailed: detailed.data });
          return;
        }

        if (activeTab === "customers") {
          const [ledger, outstanding, aging] = await Promise.all([
            parsedFilters.customerId ? reportsApi.getCustomersLedger(parsedFilters) : Promise.resolve(null),
            reportsApi.getCustomersOutstanding(parsedFilters),
            reportsApi.getCustomersAging(parsedFilters),
          ]);
          setCustomersData({
            ledger: ledger?.data ?? null,
            outstanding: outstanding.data.items,
            aging: aging.data.items,
          });
          return;
        }

        if (activeTab === "suppliers") {
          const [ledger, outstanding, aging] = await Promise.all([
            parsedFilters.supplierId ? reportsApi.getSuppliersLedger(parsedFilters) : Promise.resolve(null),
            reportsApi.getSuppliersOutstanding(parsedFilters),
            reportsApi.getSuppliersAging(parsedFilters),
          ]);
          setSuppliersData({
            ledger: ledger?.data ?? null,
            outstanding: outstanding.data.items,
            aging: aging.data.items,
          });
          return;
        }

        if (activeTab === "inventory") {
          const [currentStock, valuation, expiry, movement, lowStock] = await Promise.all([
            reportsApi.getInventoryCurrentStock(parsedFilters),
            reportsApi.getInventoryValuation(parsedFilters),
            reportsApi.getInventoryExpiry(parsedFilters),
            reportsApi.getInventoryMovement(parsedFilters),
            reportsApi.getInventoryLowStock(parsedFilters),
          ]);
          setInventoryData({
            currentStock: currentStock.data,
            valuation: valuation.data.items,
            expiry: expiry.data,
            movement: movement.data,
            lowStock: lowStock.data.items,
          });
          return;
        }

        if (activeTab === "expenses") {
          const [categoryWise, monthly, paymentMode] = await Promise.all([
            reportsApi.getExpenseCategoryWise(parsedFilters),
            reportsApi.getExpenseMonthly(parsedFilters),
            reportsApi.getExpensePaymentMode(parsedFilters),
          ]);
          setExpenseData({
            categoryWise: categoryWise.data,
            monthly: monthly.data,
            paymentMode: paymentMode.data,
          });
          return;
        }

        if (activeTab === "income") {
          const [summary, monthly] = await Promise.all([
            reportsApi.getIncomeSummary(parsedFilters),
            reportsApi.getIncomeMonthly(parsedFilters),
          ]);
          setIncomeData({ summary: summary.data, monthly: monthly.data });
          return;
        }

        if (activeTab === "payroll") {
          const [monthly, employee, department] = await Promise.all([
            reportsApi.getPayrollMonthly(parsedFilters),
            reportsApi.getPayrollEmployee(parsedFilters),
            reportsApi.getPayrollDepartment(parsedFilters),
          ]);
          setPayrollData({
            monthly: monthly.data.items,
            employee: employee.data.items,
            department: department.data.items,
          });
          return;
        }

        if (activeTab === "gst") {
          const [summary, hsn] = await Promise.all([
            reportsApi.getGstSummary(parsedFilters),
            reportsApi.getGstHsn(parsedFilters),
          ]);
          setGstData({
            summary: summary.data,
            hsn: hsn.data.items,
          });
          return;
        }

        if (activeTab === "accounting") {
          const [trialBalance, profitLoss, balanceSheet, cashBook, bankBook] = await Promise.all([
            reportsApi.getTrialBalance(parsedFilters),
            reportsApi.getProfitLoss(parsedFilters),
            reportsApi.getBalanceSheet(parsedFilters),
            reportsApi.getCashBook(parsedFilters),
            reportsApi.getBankBook(parsedFilters),
          ]);
          setAccountingData({
            trialBalance: trialBalance.data,
            profitLoss: profitLoss.data,
            balanceSheet: balanceSheet.data,
            cashBook: cashBook.data,
            bankBook: bankBook.data,
          });
          return;
        }

        if (activeTab === "exports") {
          const response = await reportsApi.listExports(20);
          setExportsData(response.data.items);
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Failed to load reports"));
      } finally {
        setLoading(false);
      }
    };

    void loadActiveTab();
  }, [activeTab, parsedFilters, referencesLoading]);

  const financialYearOptions = financialYears.map((item) => ({ value: item.id, label: item.name }));

  const handleFilterChange = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((current) => ({
      ...current,
      page: key === "page" ? (typeof value === "number" ? value : current.page) : 1,
      [key]: value,
    }));
  };

  const handleReset = () => setFilters(DEFAULT_FILTERS);

  const handleQuickExport = async () => {
    if (activeTab === "overview" || activeTab === "exports") {
      return;
    }

    const reportType = TAB_EXPORT_TYPES[activeTab];

    try {
      setExporting(true);
      const file = await reportsApi.exportReport(reportType, "csv", filters, reportsApi.toExportPayload(filters));
      saveDownloadedFile(file.blob, file.fileName);
      toast.success("Report exported");
      const exportsResponse = await reportsApi.listExports(20);
      setExportsData(exportsResponse.data.items);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, "Failed to export report"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportCenter = async () => {
    try {
      setExporting(true);
      const file = await reportsApi.exportReport(exportCenterType, exportCenterFormat, filters, reportsApi.toExportPayload(filters));
      saveDownloadedFile(file.blob, file.fileName);
      toast.success("Export generated");
      const response = await reportsApi.listExports(20);
      setExportsData(response.data.items);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, "Failed to generate export"));
    } finally {
      setExporting(false);
    }
  };

  const filterVisibility = useMemo(() => {
    if (activeTab === "sales") return { customer: true, product: true, paymentMode: true, export: true };
    if (activeTab === "purchases") return { supplier: true, paymentMode: true, export: true };
    if (activeTab === "customers") return { customer: true, status: true, export: true };
    if (activeTab === "suppliers") return { supplier: true, status: true, export: true };
    if (activeTab === "inventory") return { product: true, category: true, export: true };
    if (activeTab === "expenses") return { category: true, paymentMode: true, export: true };
    if (activeTab === "income") return { export: true };
    if (activeTab === "payroll") return { employee: true, department: true, paymentMode: true, export: true };
    if (activeTab === "gst") return { customer: true, supplier: true, gstRate: true, export: true };
    if (activeTab === "accounting") return { export: true };
    return {};
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <PageHeader title="Reports Center" />
      <ReportsTabs tabs={TABS} activeTab={activeTab} onChange={(tab) => setSearchParams({ tab })} />
      {referencesLoading ? <LoadingState label="Loading report filters..." /> : null}
      {!referencesLoading ? (
        <ReportFiltersPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
          onExport={activeTab === "overview" || activeTab === "exports" ? undefined : handleQuickExport}
          exportLoading={exporting}
          visibility={filterVisibility}
          financialYears={financialYearOptions}
          customers={customerOptions}
          suppliers={supplierOptions}
          products={productOptions}
          categories={categoryOptions}
          employees={employeeOptions}
          departments={departmentOptions}
          paymentModes={PAYMENT_MODE_OPTIONS}
          statuses={STATUS_OPTIONS}
        />
      ) : null}
      {loading ? <LoadingState label="Loading reports..." /> : null}
      {error && !loading ? <EmptyState title={error} /> : null}
      {!loading && !error ? renderTab({
        activeTab,
        overviewData,
        salesData,
        purchasesData,
        customersData,
        suppliersData,
        inventoryData,
        expenseData,
        incomeData,
        payrollData,
        gstData,
        accountingData,
        exportsData,
        exportCenterFormat,
        exportCenterType,
        onExportCenterFormatChange: setExportCenterFormat,
        onExportCenterTypeChange: setExportCenterType,
        onExportCenter: handleExportCenter,
        exporting,
        onPageChange: (page) => setFilters((current) => ({ ...current, page })),
      }) : null}
    </div>
  );
};

const renderTab = ({
  activeTab,
  overviewData,
  salesData,
  purchasesData,
  customersData,
  suppliersData,
  inventoryData,
  expenseData,
  incomeData,
  payrollData,
  gstData,
  accountingData,
  exportsData,
  exportCenterFormat,
  exportCenterType,
  onExportCenterFormatChange,
  onExportCenterTypeChange,
  onExportCenter,
  exporting,
  onPageChange,
}: {
  activeTab: ReportsTabId;
  overviewData: ReportsOverviewResponse | null;
  salesData: SalesTabData | null;
  purchasesData: PurchasesTabData | null;
  customersData: CustomersTabData | null;
  suppliersData: SuppliersTabData | null;
  inventoryData: InventoryTabData | null;
  expenseData: ExpenseReport | null;
  incomeData: IncomeTabData | null;
  payrollData: PayrollReport | null;
  gstData: GstReport | null;
  accountingData: AccountingTabData | null;
  exportsData: ReportExportRecord[];
  exportCenterFormat: ReportFormat;
  exportCenterType: ReportType;
  onExportCenterFormatChange: (value: ReportFormat) => void;
  onExportCenterTypeChange: (value: ReportType) => void;
  onExportCenter: () => void;
  exporting: boolean;
  onPageChange: (page: number) => void;
}) => {
  if (activeTab === "overview" && overviewData) {
    return (
      <div className="space-y-4">
        <ReportSummaryCards items={overviewData.summaryCards} />
        <ReportTable
          items={overviewData.recentExports}
          columns={[
            { key: "reportType", label: "Report" },
            { key: "exportFormat", label: "Format" },
            { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
            { key: "createdAt", label: "Created", render: (item) => formatDateTime(item.createdAt) },
          ]}
          emptyText="No recent exports"
        />
      </div>
    );
  }

  if (activeTab === "sales" && salesData) {
    return (
      <div className="space-y-4">
        <ReportSummaryCards items={[
          { label: "Gross Sales", value: salesData.summary.grossSales },
          { label: "Collected", value: salesData.summary.collectedAmount },
          { label: "Outstanding", value: salesData.summary.outstandingAmount, tone: "warning" },
          { label: "GST", value: salesData.summary.gstAmount },
        ]} />
        <ReportTable
          items={salesData.detailed.items}
          pagination={salesData.detailed.pagination}
          onPageChange={onPageChange}
          columns={[
            { key: "invoiceNumber", label: "Invoice" },
            { key: "invoiceDate", label: "Date", render: (item) => formatDate(item.invoiceDate) },
            { key: "customerName", label: "Customer" },
            { key: "invoiceStatus", label: "Status", render: (item) => <StatusBadge status={item.invoiceStatus} /> },
            { key: "grandTotal", label: "Total", render: (item) => <AmountText value={item.grandTotal} /> },
            { key: "dueAmount", label: "Due", render: (item) => <AmountText value={item.dueAmount} tone="warning" /> },
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable items={salesData.topCustomers} columns={[
            { key: "customerName", label: "Top Customers" },
            { key: "invoiceCount", label: "Invoices" },
            { key: "totalSales", label: "Sales", render: (item) => <AmountText value={item.totalSales} /> },
          ]} />
          <ReportTable items={salesData.topProducts} columns={[
            { key: "productName", label: "Top Products" },
            { key: "quantitySold", label: "Qty" },
            { key: "netSales", label: "Sales", render: (item) => <AmountText value={item.netSales} /> },
          ]} />
        </div>
      </div>
    );
  }

  if (activeTab === "purchases" && purchasesData) {
    return (
      <div className="space-y-4">
        <ReportSummaryCards items={[
          { label: "Gross Purchases", value: purchasesData.summary.grossPurchases },
          { label: "Paid", value: purchasesData.summary.paidAmount },
          { label: "Outstanding", value: purchasesData.summary.outstandingAmount, tone: "warning" },
          { label: "GST", value: purchasesData.summary.gstAmount },
        ]} />
        <ReportTable
          items={purchasesData.detailed.items}
          pagination={purchasesData.detailed.pagination}
          onPageChange={onPageChange}
          columns={[
            { key: "purchaseNumber", label: "Purchase" },
            { key: "invoiceDate", label: "Date", render: (item) => formatDate(item.invoiceDate) },
            { key: "supplierName", label: "Supplier" },
            { key: "purchaseStatus", label: "Status", render: (item) => <StatusBadge status={item.purchaseStatus} /> },
            { key: "grandTotal", label: "Total", render: (item) => <AmountText value={item.grandTotal} /> },
            { key: "dueAmount", label: "Due", render: (item) => <AmountText value={item.dueAmount} tone="warning" /> },
          ]}
        />
      </div>
    );
  }

  if (activeTab === "customers" && customersData) {
    return (
      <div className="space-y-4">
        <ReportTable items={customersData.outstanding} columns={[
          { key: "customerCode", label: "Code" },
          { key: "customerName", label: "Customer" },
          { key: "invoiceCount", label: "Invoices" },
          { key: "outstandingAmount", label: "Outstanding", render: (item) => <AmountText value={item.outstandingAmount} tone="warning" /> },
        ]} />
        <AgingBucketTable items={customersData.aging} nameKey="customerName" codeKey="customerCode" />
        {customersData.ledger ? (
          <ReportTable
            items={customersData.ledger.items}
            pagination={customersData.ledger.pagination}
            onPageChange={onPageChange}
            columns={[
              { key: "date", label: "Date", render: (item) => formatDate(item.date) },
              { key: "transactionType", label: "Type" },
              { key: "referenceNo", label: "Reference" },
              { key: "debit", label: "Debit", render: (item) => <AmountText value={item.debit} /> },
              { key: "credit", label: "Credit", render: (item) => <AmountText value={item.credit} /> },
            ]}
          />
        ) : null}
      </div>
    );
  }

  if (activeTab === "suppliers" && suppliersData) {
    return (
      <div className="space-y-4">
        <ReportTable items={suppliersData.outstanding} columns={[
          { key: "supplierCode", label: "Code" },
          { key: "supplierName", label: "Supplier" },
          { key: "invoiceCount", label: "Invoices" },
          { key: "outstandingAmount", label: "Payable", render: (item) => <AmountText value={item.outstandingAmount} tone="warning" /> },
        ]} />
        <AgingBucketTable items={suppliersData.aging} nameKey="supplierName" codeKey="supplierCode" />
        {suppliersData.ledger ? (
          <ReportTable
            items={suppliersData.ledger.items}
            pagination={suppliersData.ledger.pagination}
            onPageChange={onPageChange}
            columns={[
              { key: "date", label: "Date", render: (item) => formatDate(item.date) },
              { key: "transactionType", label: "Type" },
              { key: "referenceNo", label: "Reference" },
              { key: "debit", label: "Debit", render: (item) => <AmountText value={item.debit} /> },
              { key: "credit", label: "Credit", render: (item) => <AmountText value={item.credit} /> },
            ]}
          />
        ) : null}
      </div>
    );
  }

  if (activeTab === "inventory" && inventoryData) {
    return (
      <div className="space-y-4">
        <ReportTable
          items={inventoryData.currentStock.items}
          pagination={inventoryData.currentStock.pagination}
          onPageChange={onPageChange}
          columns={[
            { key: "productName", label: "Product", render: (item) => item.product.name },
            { key: "warehouse", label: "Warehouse", render: (item) => item.warehouseName },
            { key: "quantity", label: "Available", render: (item) => item.balance.availableQuantity },
            { key: "stockValue", label: "Value", render: (item) => <AmountText value={item.balance.stockValue} /> },
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable items={inventoryData.valuation} columns={[
            { key: "productName", label: "Product", render: (item) => item.product.name },
            { key: "quantity", label: "Quantity", render: (item) => item.quantity },
            { key: "stockValue", label: "Value", render: (item) => <AmountText value={item.stockValue} /> },
          ]} />
          <ReportTable items={inventoryData.lowStock} columns={[
            { key: "productName", label: "Low Stock Product", render: (item) => item.productName },
            { key: "availableQuantity", label: "Available" },
            { key: "reorderLevel", label: "Reorder" },
          ]} />
        </div>
        <ReportTable items={inventoryData.expiry.items} columns={[
          { key: "productName", label: "Expiry Product" },
          { key: "batchNumber", label: "Batch" },
          { key: "expiryDate", label: "Expiry", render: (item) => formatDate(item.expiryDate) },
          { key: "availableQuantity", label: "Qty" },
        ]} />
      </div>
    );
  }

  if (activeTab === "expenses" && expenseData) {
    return (
      <div className="space-y-4">
        <ReportTable items={expenseData.categoryWise.items} columns={[
          { key: "categoryName", label: "Category" },
          { key: "expenseCount", label: "Count" },
          { key: "totalAmount", label: "Amount", render: (item) => <AmountText value={item.totalAmount} /> },
        ]} />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable items={expenseData.monthly.items} columns={[
            { key: "month", label: "Month" },
            { key: "expenseCount", label: "Count" },
            { key: "totalAmount", label: "Amount", render: (item) => <AmountText value={item.totalAmount} /> },
          ]} />
          <ReportTable items={expenseData.paymentMode.items} columns={[
            { key: "paymentMode", label: "Payment Mode" },
            { key: "expenseCount", label: "Count" },
            { key: "totalAmount", label: "Amount", render: (item) => <AmountText value={item.totalAmount} /> },
          ]} />
        </div>
      </div>
    );
  }

  if (activeTab === "income" && incomeData) {
    return (
      <div className="space-y-4">
        <ReportSummaryCards items={[
          { label: "Net Income", value: incomeData.summary.netIncome },
          { label: "Credits", value: incomeData.summary.totalCredits },
          { label: "Debits", value: incomeData.summary.totalDebits },
          { label: "Accounts", value: incomeData.summary.accountCount },
        ]} />
        <ReportTable items={incomeData.monthly.items} columns={[
          { key: "month", label: "Month" },
          { key: "netIncome", label: "Net Income", render: (item) => <AmountText value={item.netIncome} /> },
          { key: "totalCredits", label: "Credits", render: (item) => <AmountText value={item.totalCredits} /> },
        ]} />
      </div>
    );
  }

  if (activeTab === "payroll" && payrollData) {
    return (
      <div className="space-y-4">
        <ReportTable items={payrollData.monthly} columns={[
          { key: "payrollMonth", label: "Month" },
          { key: "totalEmployees", label: "Employees" },
          { key: "netPayableTotal", label: "Net Payable", render: (item) => <AmountText value={item.netPayableTotal} /> },
        ]} />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable items={payrollData.employee} columns={[
            { key: "fullName", label: "Employee" },
            { key: "department", label: "Department" },
            { key: "netSalaryTotal", label: "Net Salary", render: (item) => <AmountText value={item.netSalaryTotal} /> },
          ]} />
          <ReportTable items={payrollData.department} columns={[
            { key: "department", label: "Department" },
            { key: "totalEmployees", label: "Employees" },
            { key: "netSalaryTotal", label: "Net Salary", render: (item) => <AmountText value={item.netSalaryTotal} /> },
          ]} />
        </div>
      </div>
    );
  }

  if (activeTab === "gst" && gstData) {
    return (
      <div className="space-y-4">
        <ReportSummaryCards items={[
          { label: "Output GST", value: gstData.summary.outputGst },
          { label: "Claimed ITC Used", value: gstData.summary.inputGst },
          { label: "Net Payable", value: gstData.summary.netGstPayable, tone: "warning" },
          { label: "Net Credit", value: gstData.summary.netGstCredit },
        ]} />
        <ReportTable items={gstData.hsn} columns={[
          { key: "hsnSacCode", label: "HSN/SAC" },
          { key: "description", label: "Description" },
          { key: "quantity", label: "Qty" },
          { key: "totalTax", label: "Tax", render: (item) => <AmountText value={item.totalTax} /> },
        ]} />
      </div>
    );
  }

  if (activeTab === "accounting" && accountingData) {
    return (
      <div className="space-y-4">
        <ReportTable items={accountingData.trialBalance.items} columns={[
          { key: "accountCode", label: "Code" },
          { key: "accountName", label: "Account" },
          { key: "debit", label: "Debit", render: (item) => <AmountText value={item.debit} /> },
          { key: "credit", label: "Credit", render: (item) => <AmountText value={item.credit} /> },
        ]} />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold text-slate-900">Profit &amp; Loss</p>
              <ReportSummaryCards items={[
                { label: "Income", value: accountingData.profitLoss.totals.totalIncome },
                { label: "Expense", value: accountingData.profitLoss.totals.totalExpense },
                { label: "Net P/L", value: accountingData.profitLoss.totals.netProfitLoss },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold text-slate-900">Balance Sheet</p>
              <ReportSummaryCards items={[
                { label: "Assets", value: accountingData.balanceSheet.totals.assets },
                { label: "Liabilities", value: accountingData.balanceSheet.totals.liabilities },
                { label: "Equity", value: accountingData.balanceSheet.totals.equity },
                { label: "Right Side", value: accountingData.balanceSheet.totals.rightSide },
              ]} />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportTable items={accountingData.cashBook.rows} columns={[
            { key: "entryDate", label: "Cash Date", render: (item) => formatDate(item.entryDate) },
            { key: "journalNumber", label: "Journal" },
            { key: "debit", label: "Debit", render: (item) => <AmountText value={item.debit} /> },
            { key: "credit", label: "Credit", render: (item) => <AmountText value={item.credit} /> },
          ]} />
          <ReportTable items={accountingData.bankBook.rows} columns={[
            { key: "entryDate", label: "Bank Date", render: (item) => formatDate(item.entryDate) },
            { key: "journalNumber", label: "Journal" },
            { key: "debit", label: "Debit", render: (item) => <AmountText value={item.debit} /> },
            { key: "credit", label: "Credit", render: (item) => <AmountText value={item.credit} /> },
          ]} />
        </div>
      </div>
    );
  }

  if (activeTab === "exports") {
    return (
      <ReportExportCenter
        reportType={exportCenterType}
        format={exportCenterFormat}
        onReportTypeChange={onExportCenterTypeChange}
        onFormatChange={onExportCenterFormatChange}
        onExport={onExportCenter}
        exporting={exporting}
        exports={exportsData}
      />
    );
  }

  return <EmptyState title="No report data available" />;
};

