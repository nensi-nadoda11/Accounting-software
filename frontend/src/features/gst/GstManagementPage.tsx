import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { InlineErrorState } from "../../components/ui/InlineErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { customersApi } from "../../services/customersApi";
import { financialYearApi } from "../../services/financialYearApi";
import { gstApi } from "../../services/gstApi";
import { suppliersApi } from "../../services/suppliersApi";
import type { CompanyFinancialYear } from "../../types/company";
import type {
  GstAdjustment,
  GstExportFormat,
  GstExportType,
  GstFilters,
  GstListResponse,
  GstSummary,
  HsnSacSummaryRow,
  ItcRow,
  OutputTaxSummary,
  PaginationMeta,
  PurchaseGstRow,
  SalesGstRow,
  TaxSummaryRow,
} from "../../types/gst";
import { formatInr } from "../customers/customerUtils";
import { getMonthStartInput, getTodayInput } from "../accounting/accountingUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import {
  GstAdjustmentModal,
} from "./components/GstAdjustmentModal";
import { GstAdjustmentsTable } from "./components/GstAdjustmentsTable";
import { GstExportCenter } from "./components/GstExportCenter";
import { GstFilters as GstFiltersPanel } from "./components/GstFilters";
import { GstPage } from "./components/GstPage";
import { GstSummaryCards } from "./components/GstSummaryCards";
import { HsnSacTable } from "./components/HsnSacTable";
import { ItcStatusModal } from "./components/ItcStatusModal";
import { ItcTable } from "./components/ItcTable";
import { OutputTaxView } from "./components/OutputTaxView";
import { PurchaseGstTable } from "./components/PurchaseGstTable";
import { SalesGstTable } from "./components/SalesGstTable";
import { TaxSummaryTable } from "./components/TaxSummaryTable";
import {
  gstAdjustmentCancelSchema,
  gstExportFiltersSchema,
  gstReportDateRangeSchema,
  type GstAdjustmentCancelFormInputValues,
  type GstAdjustmentCancelFormValues,
  type GstAdjustmentFormValues,
  type GstExportFiltersValues,
  type GstItcStatusFormValues,
} from "./gstSchemas";
import {
  GST_ADJUSTMENT_TYPE_LABELS,
  GST_CLAIM_STATUS_LABELS,
  GST_ELIGIBILITY_LABELS,
  GST_RATE_OPTIONS,
  GST_REPORT_SOURCE_LABELS,
  GST_SOURCE_LABELS,
  GST_TAX_COMPONENT_LABELS,
  formatGstMonth,
  toDownload,
} from "./gstUtils";

type GstTab =
  | "summary"
  | "sales"
  | "purchases"
  | "itc"
  | "output-tax"
  | "hsn-sac"
  | "tax-summary"
  | "adjustments"
  | "exports";

type Option = {
  id: string;
  label: string;
};

const PAGE_LIMIT = 20;
const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  limit: PAGE_LIMIT,
  total: 0,
  totalPages: 1,
};

const TAB_CONFIG: Array<{ id: GstTab; label: string; visible: (permissions: ReturnType<typeof useAuth>["permissions"]) => boolean }> = [
  { id: "summary", label: "GST Summary", visible: (permissions) => permissions.includes("gst.view") },
  { id: "sales", label: "Sales GST", visible: (permissions) => permissions.includes("gst.view") },
  { id: "purchases", label: "Purchase GST", visible: (permissions) => permissions.includes("gst.view") },
  { id: "itc", label: "ITC", visible: (permissions) => permissions.includes("gst.view") },
  { id: "output-tax", label: "Output Tax", visible: (permissions) => permissions.includes("gst.view") },
  { id: "hsn-sac", label: "HSN/SAC", visible: (permissions) => permissions.includes("gst.view") },
  { id: "tax-summary", label: "Tax Summary", visible: (permissions) => permissions.includes("gst.view") },
  { id: "adjustments", label: "Adjustments", visible: (permissions) => permissions.includes("gst.view") },
  { id: "exports", label: "Exports", visible: (permissions) => permissions.includes("gst.export") },
];

export const GstManagementPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission("gst.view");
  const canExport = auth.hasPermission("gst.export");
  const canItcManage = auth.hasPermission("gst.itc.manage");
  const canAdjustmentManage = auth.hasPermission("gst.adjustment.manage");

  const visibleTabs = TAB_CONFIG.filter((tab) => tab.visible(auth.permissions));
  const requestedTab = searchParams.get("tab") as GstTab | null;
  const activeTab = visibleTabs.find((tab) => tab.id === requestedTab)?.id ?? visibleTabs[0]?.id ?? "summary";

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", activeTab);
        return next;
      }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const [financialYears, setFinancialYears] = useState<CompanyFinancialYear[]>([]);
  const [customerOptions, setCustomerOptions] = useState<Option[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Option[]>([]);

  const [summaryFinancialYearId, setSummaryFinancialYearId] = useState<string>("");
  const [summaryDateFrom, setSummaryDateFrom] = useState(getMonthStartInput());
  const [summaryDateTo, setSummaryDateTo] = useState(getTodayInput());
  const [summaryData, setSummaryData] = useState<GstSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  const [salesDateFrom, setSalesDateFrom] = useState(getMonthStartInput());
  const [salesDateTo, setSalesDateTo] = useState(getTodayInput());
  const [salesCustomerId, setSalesCustomerId] = useState("");
  const [salesState, setSalesState] = useState("");
  const [salesInvoiceType, setSalesInvoiceType] = useState("");
  const [salesPartyType, setSalesPartyType] = useState("");
  const [salesGstRate, setSalesGstRate] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [salesData, setSalesData] = useState<GstListResponse<SalesGstRow>>({ items: [], pagination: EMPTY_PAGINATION });
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const debouncedSalesState = useDebouncedValue(salesState, 350);

  const [purchaseDateFrom, setPurchaseDateFrom] = useState(getMonthStartInput());
  const [purchaseDateTo, setPurchaseDateTo] = useState(getTodayInput());
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchaseState, setPurchaseState] = useState("");
  const [purchaseGstRate, setPurchaseGstRate] = useState("");
  const [purchaseEligibilityStatus, setPurchaseEligibilityStatus] = useState("");
  const [purchaseClaimStatus, setPurchaseClaimStatus] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseData, setPurchaseData] = useState<GstListResponse<PurchaseGstRow>>({ items: [], pagination: EMPTY_PAGINATION });
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseRefreshKey, setPurchaseRefreshKey] = useState(0);
  const debouncedPurchaseState = useDebouncedValue(purchaseState, 350);

  const [itcDateFrom, setItcDateFrom] = useState(getMonthStartInput());
  const [itcDateTo, setItcDateTo] = useState(getTodayInput());
  const [itcSourceType, setItcSourceType] = useState("");
  const [itcEligibilityStatus, setItcEligibilityStatus] = useState("");
  const [itcClaimStatus, setItcClaimStatus] = useState("");
  const [itcSupplierSearch, setItcSupplierSearch] = useState("");
  const [itcPage, setItcPage] = useState(1);
  const [itcData, setItcData] = useState<GstListResponse<ItcRow>>({ items: [], pagination: EMPTY_PAGINATION });
  const [itcLoading, setItcLoading] = useState(false);
  const [itcError, setItcError] = useState<string | null>(null);
  const [itcRefreshKey, setItcRefreshKey] = useState(0);
  const debouncedItcSupplierSearch = useDebouncedValue(itcSupplierSearch, 350);
  const [selectedItc, setSelectedItc] = useState<ItcRow | null>(null);
  const [itcSubmitting, setItcSubmitting] = useState(false);

  const [outputDateFrom, setOutputDateFrom] = useState(getMonthStartInput());
  const [outputDateTo, setOutputDateTo] = useState(getTodayInput());
  const [outputState, setOutputState] = useState("");
  const [outputGstRate, setOutputGstRate] = useState("");
  const [outputData, setOutputData] = useState<OutputTaxSummary | null>(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [outputRefreshKey, setOutputRefreshKey] = useState(0);
  const debouncedOutputState = useDebouncedValue(outputState, 350);

  const [hsnDateFrom, setHsnDateFrom] = useState(getMonthStartInput());
  const [hsnDateTo, setHsnDateTo] = useState(getTodayInput());
  const [hsnSource, setHsnSource] = useState<"sales" | "purchase" | "expense" | "all">("all");
  const [hsnData, setHsnData] = useState<HsnSacSummaryRow[]>([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnError, setHsnError] = useState<string | null>(null);
  const [hsnRefreshKey, setHsnRefreshKey] = useState(0);

  const [taxDateFrom, setTaxDateFrom] = useState(getMonthStartInput());
  const [taxDateTo, setTaxDateTo] = useState(getTodayInput());
  const [taxData, setTaxData] = useState<TaxSummaryRow[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);
  const [taxRefreshKey, setTaxRefreshKey] = useState(0);

  const [adjustmentDateFrom, setAdjustmentDateFrom] = useState(getMonthStartInput());
  const [adjustmentDateTo, setAdjustmentDateTo] = useState(getTodayInput());
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState("");
  const [adjustmentComponentFilter, setAdjustmentComponentFilter] = useState("");
  const [adjustmentStatusFilter, setAdjustmentStatusFilter] = useState("");
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const [adjustmentData, setAdjustmentData] = useState<GstListResponse<GstAdjustment>>({ items: [], pagination: EMPTY_PAGINATION });
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentRefreshKey, setAdjustmentRefreshKey] = useState(0);
  const [adjustmentModalMode, setAdjustmentModalMode] = useState<"create" | "view" | null>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<GstAdjustment | null>(null);
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<GstAdjustment | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [exportDateFrom, setExportDateFrom] = useState(getMonthStartInput());
  const [exportDateTo, setExportDateTo] = useState(getTodayInput());
  const [exportSource, setExportSource] = useState<"sales" | "purchase" | "expense" | "all">("all");
  const [exportLoadingType, setExportLoadingType] = useState<GstExportType | null>(null);
  const [exportFormat, setExportFormat] = useState<GstExportFormat>("pdf");

  const cancelForm = useForm<GstAdjustmentCancelFormInputValues, undefined, GstAdjustmentCancelFormValues>({
    resolver: zodResolver(gstAdjustmentCancelSchema),
    defaultValues: {
      cancellationReason: "",
    },
  });

  useEffect(() => {
    const loadReferences = async () => {
      const [yearsResult, customersResult, suppliersResult] = await Promise.allSettled([
        financialYearApi.list(),
        customersApi.list({ page: 1, limit: 100, status: "active" }),
        suppliersApi.list({ page: 1, limit: 100, status: "active", isBlacklisted: false }),
      ]);

      if (yearsResult.status === "fulfilled") {
        setFinancialYears(yearsResult.value.data.items);
        const activeYear = yearsResult.value.data.items.find((year) => year.isActive);
        if (activeYear && !summaryFinancialYearId) {
          setSummaryFinancialYearId(activeYear.id);
        }
      }

      if (customersResult.status === "fulfilled") {
        setCustomerOptions(customersResult.value.data.items.map((item) => ({ id: item.id, label: item.name })));
      }

      if (suppliersResult.status === "fulfilled") {
        setSupplierOptions(suppliersResult.value.data.items.map((item) => ({ id: item.id, label: item.name })));
      }

      if ([yearsResult, customersResult, suppliersResult].some((result) => result.status === "rejected")) {
        toast.error("Some GST reference lists could not be loaded.");
      }
    };

    void loadReferences();
  }, [summaryFinancialYearId, toast]);

  const buildSummaryFilters = (): GstFilters => ({
    financialYearId: summaryFinancialYearId || undefined,
    dateFrom: summaryFinancialYearId ? undefined : summaryDateFrom,
    dateTo: summaryFinancialYearId ? undefined : summaryDateTo,
  });

  const buildSalesFilters = (): GstFilters => ({
    page: salesPage,
    limit: PAGE_LIMIT,
    dateFrom: salesDateFrom,
    dateTo: salesDateTo,
    customerId: salesCustomerId || undefined,
    state: debouncedSalesState || undefined,
    invoiceType: salesInvoiceType ? (salesInvoiceType as "gst_invoice" | "pos") : undefined,
    partyType: salesPartyType ? (salesPartyType as "b2b" | "b2c") : undefined,
    gstRate: salesGstRate ? Number(salesGstRate) : undefined,
  });

  const getSummaryExportRange = () => {
    if (summaryFinancialYearId) {
      const matchingYear = financialYears.find((year) => year.id === summaryFinancialYearId);
      if (matchingYear) {
        return {
          dateFrom: matchingYear.startDate.slice(0, 10),
          dateTo: matchingYear.endDate.slice(0, 10),
        };
      }
    }

    return {
      dateFrom: summaryDateFrom,
      dateTo: summaryDateTo,
    };
  };

  const buildPurchaseFilters = (): GstFilters => ({
    page: purchasePage,
    limit: PAGE_LIMIT,
    dateFrom: purchaseDateFrom,
    dateTo: purchaseDateTo,
    supplierId: purchaseSupplierId || undefined,
    state: debouncedPurchaseState || undefined,
    gstRate: purchaseGstRate ? Number(purchaseGstRate) : undefined,
    eligibilityStatus: purchaseEligibilityStatus ? (purchaseEligibilityStatus as keyof typeof GST_ELIGIBILITY_LABELS) : undefined,
    claimStatus: purchaseClaimStatus ? (purchaseClaimStatus as keyof typeof GST_CLAIM_STATUS_LABELS) : undefined,
  });

  const buildItcFilters = (): GstFilters => ({
    page: itcPage,
    limit: PAGE_LIMIT,
    dateFrom: itcDateFrom,
    dateTo: itcDateTo,
    sourceType: itcSourceType ? (itcSourceType as keyof typeof GST_SOURCE_LABELS) : undefined,
    eligibilityStatus: itcEligibilityStatus ? (itcEligibilityStatus as keyof typeof GST_ELIGIBILITY_LABELS) : undefined,
    claimStatus: itcClaimStatus ? (itcClaimStatus as keyof typeof GST_CLAIM_STATUS_LABELS) : undefined,
    supplier: debouncedItcSupplierSearch || undefined,
  });

  const buildOutputFilters = (): GstFilters => ({
    dateFrom: outputDateFrom,
    dateTo: outputDateTo,
    state: debouncedOutputState || undefined,
    gstRate: outputGstRate ? Number(outputGstRate) : undefined,
  });

  const buildHsnFilters = (): GstFilters => ({
    dateFrom: hsnDateFrom,
    dateTo: hsnDateTo,
    source: hsnSource,
  });

  const buildTaxFilters = (): GstFilters => ({
    dateFrom: taxDateFrom,
    dateTo: taxDateTo,
  });

  const buildAdjustmentFilters = (): GstFilters => ({
    page: adjustmentPage,
    limit: PAGE_LIMIT,
    dateFrom: adjustmentDateFrom,
    dateTo: adjustmentDateTo,
    adjustmentType: adjustmentTypeFilter ? (adjustmentTypeFilter as keyof typeof GST_ADJUSTMENT_TYPE_LABELS) : undefined,
    taxComponent: adjustmentComponentFilter ? (adjustmentComponentFilter as keyof typeof GST_TAX_COMPONENT_LABELS) : undefined,
    status: adjustmentStatusFilter ? (adjustmentStatusFilter as "active" | "cancelled") : undefined,
  });

  useEffect(() => {
    if (!canView || activeTab !== "summary") {
      return;
    }

    const parsed = gstReportDateRangeSchema.safeParse({ dateFrom: summaryDateFrom, dateTo: summaryDateTo });
    if (!summaryFinancialYearId && !parsed.success) {
      setSummaryError(parsed.error.issues[0]?.message ?? "Choose a valid date range");
      setSummaryData(null);
      return;
    }

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        setSummaryError(null);
        const response = await gstApi.getSummary(buildSummaryFilters());
        setSummaryData(response.data);
      } catch (error) {
        setSummaryData(null);
        setSummaryError(getErrorMessage(error, "Failed to load GST summary"));
      } finally {
        setSummaryLoading(false);
      }
    };

    void loadSummary();
  }, [activeTab, canView, summaryDateFrom, summaryDateTo, summaryFinancialYearId, summaryRefreshKey]);

  useEffect(() => {
    if (!canView || activeTab !== "sales") {
      return;
    }

    const loadSales = async () => {
      try {
        setSalesLoading(true);
        setSalesError(null);
        const response = await gstApi.listSales(buildSalesFilters());
        setSalesData(response.data);
      } catch (error) {
        setSalesData({ items: [], pagination: EMPTY_PAGINATION });
        setSalesError(getErrorMessage(error, "Failed to load sales GST"));
      } finally {
        setSalesLoading(false);
      }
    };

    void loadSales();
  }, [activeTab, canView, debouncedSalesState, salesCustomerId, salesDateFrom, salesDateTo, salesGstRate, salesInvoiceType, salesPage, salesPartyType, salesRefreshKey]);

  useEffect(() => {
    if (!canView || activeTab !== "purchases") {
      return;
    }

    const loadPurchases = async () => {
      try {
        setPurchaseLoading(true);
        setPurchaseError(null);
        const response = await gstApi.listPurchases(buildPurchaseFilters());
        setPurchaseData(response.data);
      } catch (error) {
        setPurchaseData({ items: [], pagination: EMPTY_PAGINATION });
        setPurchaseError(getErrorMessage(error, "Failed to load purchase GST"));
      } finally {
        setPurchaseLoading(false);
      }
    };

    void loadPurchases();
  }, [activeTab, canView, debouncedPurchaseState, purchaseClaimStatus, purchaseDateFrom, purchaseDateTo, purchaseEligibilityStatus, purchaseGstRate, purchasePage, purchaseRefreshKey, purchaseSupplierId]);

  useEffect(() => {
    if (!canView || activeTab !== "itc") {
      return;
    }

    const loadItc = async () => {
      try {
        setItcLoading(true);
        setItcError(null);
        const response = await gstApi.listItc(buildItcFilters());
        setItcData(response.data);
      } catch (error) {
        setItcData({ items: [], pagination: EMPTY_PAGINATION });
        setItcError(getErrorMessage(error, "Failed to load ITC"));
      } finally {
        setItcLoading(false);
      }
    };

    void loadItc();
  }, [activeTab, canView, debouncedItcSupplierSearch, itcClaimStatus, itcDateFrom, itcDateTo, itcEligibilityStatus, itcPage, itcRefreshKey, itcSourceType]);

  useEffect(() => {
    if (!canView || activeTab !== "output-tax") {
      return;
    }

    const loadOutput = async () => {
      try {
        setOutputLoading(true);
        setOutputError(null);
        const response = await gstApi.getOutputTax(buildOutputFilters());
        setOutputData(response.data);
      } catch (error) {
        setOutputData(null);
        setOutputError(getErrorMessage(error, "Failed to load output tax"));
      } finally {
        setOutputLoading(false);
      }
    };

    void loadOutput();
  }, [activeTab, canView, debouncedOutputState, outputDateFrom, outputDateTo, outputGstRate, outputRefreshKey]);

  useEffect(() => {
    if (!canView || activeTab !== "hsn-sac") {
      return;
    }

    const loadHsn = async () => {
      try {
        setHsnLoading(true);
        setHsnError(null);
        const response = await gstApi.getHsnSummary(buildHsnFilters());
        setHsnData(response.data.items);
      } catch (error) {
        setHsnData([]);
        setHsnError(getErrorMessage(error, "Failed to load HSN/SAC summary"));
      } finally {
        setHsnLoading(false);
      }
    };

    void loadHsn();
  }, [activeTab, canView, hsnDateFrom, hsnDateTo, hsnRefreshKey, hsnSource]);

  useEffect(() => {
    if (!canView || activeTab !== "tax-summary") {
      return;
    }

    const loadTax = async () => {
      try {
        setTaxLoading(true);
        setTaxError(null);
        const response = await gstApi.getTaxSummary(buildTaxFilters());
        setTaxData(response.data.items);
      } catch (error) {
        setTaxData([]);
        setTaxError(getErrorMessage(error, "Failed to load tax summary"));
      } finally {
        setTaxLoading(false);
      }
    };

    void loadTax();
  }, [activeTab, canView, taxDateFrom, taxDateTo, taxRefreshKey]);

  useEffect(() => {
    if (!canView || activeTab !== "adjustments") {
      return;
    }

    const loadAdjustments = async () => {
      try {
        setAdjustmentLoading(true);
        setAdjustmentError(null);
        const response = await gstApi.listAdjustments(buildAdjustmentFilters());
        setAdjustmentData(response.data);
      } catch (error) {
        setAdjustmentData({ items: [], pagination: EMPTY_PAGINATION });
        setAdjustmentError(getErrorMessage(error, "Failed to load GST adjustments"));
      } finally {
        setAdjustmentLoading(false);
      }
    };

    void loadAdjustments();
  }, [activeTab, adjustmentComponentFilter, adjustmentDateFrom, adjustmentDateTo, adjustmentPage, adjustmentRefreshKey, adjustmentStatusFilter, adjustmentTypeFilter, canView]);

  const refreshActiveTab = () => {
    if (activeTab === "summary") {
      setSummaryRefreshKey((value) => value + 1);
    } else if (activeTab === "sales") {
      setSalesRefreshKey((value) => value + 1);
    } else if (activeTab === "purchases") {
      setPurchaseRefreshKey((value) => value + 1);
    } else if (activeTab === "itc") {
      setItcRefreshKey((value) => value + 1);
    } else if (activeTab === "output-tax") {
      setOutputRefreshKey((value) => value + 1);
    } else if (activeTab === "hsn-sac") {
      setHsnRefreshKey((value) => value + 1);
    } else if (activeTab === "tax-summary") {
      setTaxRefreshKey((value) => value + 1);
    } else if (activeTab === "adjustments") {
      setAdjustmentRefreshKey((value) => value + 1);
    }
  };

  const handleExport = async (type: GstExportType) => {
    const parsed = gstExportFiltersSchema.safeParse({
      dateFrom: exportDateFrom,
      dateTo: exportDateTo,
      source: exportSource,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Choose a valid export range");
      return;
    }

    try {
      setExportLoadingType(type);
      const filters: GstExportFiltersValues = parsed.data;
      const file =
        type === "sales"
          ? await gstApi.exportSales({ ...filters, format: exportFormat })
          : type === "purchases"
          ? await gstApi.exportPurchases({ ...filters, format: exportFormat })
          : type === "itc"
          ? await gstApi.exportItc({ ...filters, format: exportFormat })
          : type === "hsn-summary"
          ? await gstApi.exportHsnSummary({ ...filters, source: filters.source, format: exportFormat })
          : type === "tax-summary"
          ? await gstApi.exportTaxSummary({ ...filters, format: exportFormat })
          : type === "gstr-1"
          ? await gstApi.exportGstr1({ ...filters, format: exportFormat })
          : await gstApi.exportGstr3b({ ...filters, format: exportFormat });
      toDownload(file);
      toast.success("Export downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to export GST report"));
    } finally {
      setExportLoadingType(null);
    }
  };

  const summaryChartData =
    summaryData?.monthWiseTrend.map((row) => ({
      month: formatGstMonth(row.month),
      outputGst: Number(row.outputGst),
      inputGst: Number(row.inputGst),
      netGstPayable: Number(row.netGstPayable),
    })) ?? [];

  return (
    <>
      <GstPage
        title="GST & Tax Management"
        tabs={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set("tab", tab);
            return next;
          });
        }}
        actions={
          <div className="flex items-center gap-2">
            {canExport ? (
              <Select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as GstExportFormat)} className="w-28">
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
              </Select>
            ) : null}
            <Button type="button" variant="secondary" onClick={refreshActiveTab}>
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            {activeTab === "adjustments" && canAdjustmentManage ? (
              <Button
                type="button"
                onClick={() => {
                  setSelectedAdjustment(null);
                  setAdjustmentModalMode("create");
                }}
              >
                <Plus className="mr-2 size-4" />
                Add Adjustment
              </Button>
            ) : null}
          </div>
        }
      >
        {activeTab === "summary" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Select value={summaryFinancialYearId} onChange={(event) => setSummaryFinancialYearId(event.target.value)}>
                <option value="">Custom Date Range</option>
                {financialYears.map((year) => (
                  <option key={year.id} value={year.id}>{year.name}</option>
                ))}
              </Select>
              <Input type="date" value={summaryDateFrom} onChange={(event) => setSummaryDateFrom(event.target.value)} disabled={Boolean(summaryFinancialYearId)} />
              <Input type="date" value={summaryDateTo} onChange={(event) => setSummaryDateTo(event.target.value)} disabled={Boolean(summaryFinancialYearId)} />
              <div className="xl:col-span-3 flex items-end justify-end gap-2">
                {canExport ? (
                  <>
                    <Button type="button" variant="secondary" loading={exportLoadingType === "gstr-1"} onClick={async () => {
                      try {
                        setExportLoadingType("gstr-1");
                        const file = await gstApi.exportGstr1({ ...getSummaryExportRange(), format: exportFormat });
                        toDownload(file);
                        toast.success("GSTR-1 exported");
                      } catch (error) {
                        toast.error(getErrorMessage(error, "Failed to export GSTR-1"));
                      } finally {
                        setExportLoadingType(null);
                      }
                    }}>
                      <Download className="mr-2 size-4" />
                      GSTR-1
                    </Button>
                    <Button type="button" variant="secondary" loading={exportLoadingType === "gstr-3b"} onClick={async () => {
                      try {
                        setExportLoadingType("gstr-3b");
                        const file = await gstApi.exportGstr3b({ ...getSummaryExportRange(), format: exportFormat });
                        toDownload(file);
                        toast.success("GSTR-3B exported");
                      } catch (error) {
                        toast.error(getErrorMessage(error, "Failed to export GSTR-3B"));
                      } finally {
                        setExportLoadingType(null);
                      }
                    }}>
                      <Download className="mr-2 size-4" />
                      GSTR-3B
                    </Button>
                  </>
                ) : null}
              </div>
            </GstFiltersPanel>

            {summaryLoading ? <LoadingState label="Loading GST summary..." /> : null}
            {summaryError ? <InlineErrorState title={summaryError} /> : null}
            {summaryData && !summaryLoading ? (
              <>
                <GstSummaryCards summary={summaryData} />
                <Card>
                  <CardHeader title="Month-wise Trend" />
                  <CardContent className="space-y-4">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={summaryChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                          <YAxis tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(value) => formatInr(value)} />
                          <Tooltip formatter={(value) => formatInr(Number(value ?? 0))} />
                          <Area type="monotone" dataKey="outputGst" stroke="#0F766E" fill="#99F6E4" fillOpacity={0.55} />
                          <Area type="monotone" dataKey="inputGst" stroke="#2563EB" fill="#BFDBFE" fillOpacity={0.4} />
                          <Area type="monotone" dataKey="netGstPayable" stroke="#EA580C" fill="#FED7AA" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            {["Month", "Taxable Sales", "Output GST", "Taxable Purchases", "Input GST", "Net GST Payable", "Net GST Credit"].map((head) => (
                              <th key={head} className="px-3 py-3 font-semibold">{head}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                          {summaryData.monthWiseTrend.map((row) => (
                            <tr key={row.month}>
                              <td className="px-3 py-3 whitespace-nowrap">{formatGstMonth(row.month)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.taxableSales)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.outputGst)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.taxablePurchases)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.inputGst)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.netGstPayable)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatInr(row.netGstCredit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        ) : null}

        {activeTab === "sales" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={salesDateFrom} onChange={(event) => { setSalesDateFrom(event.target.value); setSalesPage(1); }} />
              <Input type="date" value={salesDateTo} onChange={(event) => { setSalesDateTo(event.target.value); setSalesPage(1); }} />
              <Select value={salesCustomerId} onChange={(event) => { setSalesCustomerId(event.target.value); setSalesPage(1); }}>
                <option value="">All Customers</option>
                {customerOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
              <Input placeholder="State" value={salesState} onChange={(event) => { setSalesState(event.target.value); setSalesPage(1); }} />
              <Select value={salesInvoiceType} onChange={(event) => { setSalesInvoiceType(event.target.value); setSalesPage(1); }}>
                <option value="">All Invoice Types</option>
                <option value="gst_invoice">GST Invoice</option>
                <option value="pos">POS</option>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select value={salesPartyType} onChange={(event) => { setSalesPartyType(event.target.value); setSalesPage(1); }}>
                  <option value="">B2B / B2C</option>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                </Select>
                <Select value={salesGstRate} onChange={(event) => { setSalesGstRate(event.target.value); setSalesPage(1); }}>
                  <option value="">GST Rate</option>
                  {GST_RATE_OPTIONS.map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </Select>
              </div>
            </GstFiltersPanel>
            <div className="flex justify-end">
              {canExport ? (
                <Button type="button" variant="secondary" loading={exportLoadingType === "sales"} onClick={async () => {
                  try {
                    setExportLoadingType("sales");
                    const file = await gstApi.exportSales({ ...buildSalesFilters(), format: exportFormat });
                    toDownload(file);
                    toast.success("Sales GST exported");
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to export sales GST"));
                  } finally {
                    setExportLoadingType(null);
                  }
                }}>
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              ) : null}
            </div>
            {salesLoading ? <LoadingState label="Loading sales GST..." /> : null}
            {salesError ? <InlineErrorState title={salesError} /> : null}
            {!salesLoading && !salesError ? (
              <SalesGstTable items={salesData.items} pagination={salesData.pagination} onPageChange={setSalesPage} />
            ) : null}
          </div>
        ) : null}

        {activeTab === "purchases" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={purchaseDateFrom} onChange={(event) => { setPurchaseDateFrom(event.target.value); setPurchasePage(1); }} />
              <Input type="date" value={purchaseDateTo} onChange={(event) => { setPurchaseDateTo(event.target.value); setPurchasePage(1); }} />
              <Select value={purchaseSupplierId} onChange={(event) => { setPurchaseSupplierId(event.target.value); setPurchasePage(1); }}>
                <option value="">All Suppliers</option>
                {supplierOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
              <Input placeholder="State" value={purchaseState} onChange={(event) => { setPurchaseState(event.target.value); setPurchasePage(1); }} />
              <Select value={purchaseGstRate} onChange={(event) => { setPurchaseGstRate(event.target.value); setPurchasePage(1); }}>
                <option value="">GST Rate</option>
                {GST_RATE_OPTIONS.map((rate) => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </Select>
              <Select value={purchaseEligibilityStatus} onChange={(event) => { setPurchaseEligibilityStatus(event.target.value); setPurchasePage(1); }}>
                <option value="">ITC Status</option>
                {Object.entries(GST_ELIGIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={purchaseClaimStatus} onChange={(event) => { setPurchaseClaimStatus(event.target.value); setPurchasePage(1); }}>
                <option value="">Claim Status</option>
                {Object.entries(GST_CLAIM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </GstFiltersPanel>
            <div className="flex justify-end">
              {canExport ? (
                <Button type="button" variant="secondary" loading={exportLoadingType === "purchases"} onClick={async () => {
                  try {
                    setExportLoadingType("purchases");
                    const file = await gstApi.exportPurchases({ ...buildPurchaseFilters(), format: exportFormat });
                    toDownload(file);
                    toast.success("Purchase GST exported");
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to export purchase GST"));
                  } finally {
                    setExportLoadingType(null);
                  }
                }}>
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              ) : null}
            </div>
            {purchaseLoading ? <LoadingState label="Loading purchase GST..." /> : null}
            {purchaseError ? <InlineErrorState title={purchaseError} /> : null}
            {!purchaseLoading && !purchaseError ? (
              <PurchaseGstTable items={purchaseData.items} pagination={purchaseData.pagination} onPageChange={setPurchasePage} />
            ) : null}
          </div>
        ) : null}

        {activeTab === "itc" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={itcDateFrom} onChange={(event) => { setItcDateFrom(event.target.value); setItcPage(1); }} />
              <Input type="date" value={itcDateTo} onChange={(event) => { setItcDateTo(event.target.value); setItcPage(1); }} />
              <Select value={itcSourceType} onChange={(event) => { setItcSourceType(event.target.value); setItcPage(1); }}>
                <option value="">All Sources</option>
                {Object.entries(GST_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={itcEligibilityStatus} onChange={(event) => { setItcEligibilityStatus(event.target.value); setItcPage(1); }}>
                <option value="">Eligibility</option>
                {Object.entries(GST_ELIGIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={itcClaimStatus} onChange={(event) => { setItcClaimStatus(event.target.value); setItcPage(1); }}>
                <option value="">Claim Status</option>
                {Object.entries(GST_CLAIM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Input placeholder="Supplier / GSTIN" value={itcSupplierSearch} onChange={(event) => { setItcSupplierSearch(event.target.value); setItcPage(1); }} />
            </GstFiltersPanel>
            <div className="flex justify-end">
              {canExport ? (
                <Button type="button" variant="secondary" loading={exportLoadingType === "itc"} onClick={async () => {
                  try {
                    setExportLoadingType("itc");
                    const file = await gstApi.exportItc({ ...buildItcFilters(), format: exportFormat });
                    toDownload(file);
                    toast.success("ITC exported");
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to export ITC"));
                  } finally {
                    setExportLoadingType(null);
                  }
                }}>
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              ) : null}
            </div>
            {itcLoading ? <LoadingState label="Loading ITC..." /> : null}
            {itcError ? <InlineErrorState title={itcError} /> : null}
            {!itcLoading && !itcError ? (
              <ItcTable
                items={itcData.items}
                pagination={itcData.pagination}
                onPageChange={setItcPage}
                canManage={canItcManage}
                onEdit={setSelectedItc}
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === "output-tax" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={outputDateFrom} onChange={(event) => setOutputDateFrom(event.target.value)} />
              <Input type="date" value={outputDateTo} onChange={(event) => setOutputDateTo(event.target.value)} />
              <Input placeholder="State" value={outputState} onChange={(event) => setOutputState(event.target.value)} />
              <Select value={outputGstRate} onChange={(event) => setOutputGstRate(event.target.value)}>
                <option value="">GST Rate</option>
                {GST_RATE_OPTIONS.map((rate) => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </Select>
            </GstFiltersPanel>
            {outputLoading ? <LoadingState label="Loading output tax..." /> : null}
            {outputError ? <InlineErrorState title={outputError} /> : null}
            {outputData && !outputLoading ? <OutputTaxView summary={outputData} /> : null}
          </div>
        ) : null}

        {activeTab === "hsn-sac" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={hsnDateFrom} onChange={(event) => setHsnDateFrom(event.target.value)} />
              <Input type="date" value={hsnDateTo} onChange={(event) => setHsnDateTo(event.target.value)} />
              <Select value={hsnSource} onChange={(event) => setHsnSource(event.target.value as "sales" | "purchase" | "expense" | "all")}>
                {Object.entries(GST_REPORT_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <div className="xl:col-span-3 flex items-end justify-end">
                {canExport ? (
                  <Button type="button" variant="secondary" loading={exportLoadingType === "hsn-summary"} onClick={async () => {
                    try {
                      setExportLoadingType("hsn-summary");
                      const file = await gstApi.exportHsnSummary({ ...buildHsnFilters(), format: exportFormat });
                      toDownload(file);
                      toast.success("HSN/SAC exported");
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Failed to export HSN/SAC"));
                    } finally {
                      setExportLoadingType(null);
                    }
                  }}>
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                ) : null}
              </div>
            </GstFiltersPanel>
            {hsnLoading ? <LoadingState label="Loading HSN/SAC..." /> : null}
            {hsnError ? <InlineErrorState title={hsnError} /> : null}
            {!hsnLoading && !hsnError ? <HsnSacTable items={hsnData} /> : null}
          </div>
        ) : null}

        {activeTab === "tax-summary" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={taxDateFrom} onChange={(event) => setTaxDateFrom(event.target.value)} />
              <Input type="date" value={taxDateTo} onChange={(event) => setTaxDateTo(event.target.value)} />
              <div className="xl:col-span-4 flex items-end justify-end">
                {canExport ? (
                  <Button type="button" variant="secondary" loading={exportLoadingType === "tax-summary"} onClick={async () => {
                    try {
                      setExportLoadingType("tax-summary");
                      const file = await gstApi.exportTaxSummary({ ...buildTaxFilters(), format: exportFormat });
                      toDownload(file);
                      toast.success("Tax summary exported");
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Failed to export tax summary"));
                    } finally {
                      setExportLoadingType(null);
                    }
                  }}>
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                ) : null}
              </div>
            </GstFiltersPanel>
            {taxLoading ? <LoadingState label="Loading tax summary..." /> : null}
            {taxError ? <InlineErrorState title={taxError} /> : null}
            {!taxLoading && !taxError ? <TaxSummaryTable items={taxData} /> : null}
          </div>
        ) : null}

        {activeTab === "adjustments" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={adjustmentDateFrom} onChange={(event) => { setAdjustmentDateFrom(event.target.value); setAdjustmentPage(1); }} />
              <Input type="date" value={adjustmentDateTo} onChange={(event) => { setAdjustmentDateTo(event.target.value); setAdjustmentPage(1); }} />
              <Select value={adjustmentTypeFilter} onChange={(event) => { setAdjustmentTypeFilter(event.target.value); setAdjustmentPage(1); }}>
                <option value="">Adjustment Type</option>
                {Object.entries(GST_ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={adjustmentComponentFilter} onChange={(event) => { setAdjustmentComponentFilter(event.target.value); setAdjustmentPage(1); }}>
                <option value="">Tax Component</option>
                {Object.entries(GST_TAX_COMPONENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={adjustmentStatusFilter} onChange={(event) => { setAdjustmentStatusFilter(event.target.value); setAdjustmentPage(1); }}>
                <option value="">Status</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </GstFiltersPanel>
            {adjustmentLoading ? <LoadingState label="Loading adjustments..." /> : null}
            {adjustmentError ? <InlineErrorState title={adjustmentError} /> : null}
            {!adjustmentLoading && !adjustmentError ? (
              <GstAdjustmentsTable
                items={adjustmentData.items}
                pagination={adjustmentData.pagination}
                onPageChange={setAdjustmentPage}
                canManage={canAdjustmentManage}
                onView={(row) => {
                  setSelectedAdjustment(row);
                  setAdjustmentModalMode("view");
                }}
                onCancel={(row) => {
                  setCancelTarget(row);
                  cancelForm.reset({ cancellationReason: "" });
                }}
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === "exports" ? (
          <div className="space-y-4">
            <GstFiltersPanel>
              <Input type="date" value={exportDateFrom} onChange={(event) => setExportDateFrom(event.target.value)} />
              <Input type="date" value={exportDateTo} onChange={(event) => setExportDateTo(event.target.value)} />
              <Select value={exportSource} onChange={(event) => setExportSource(event.target.value as "sales" | "purchase" | "expense" | "all")}>
                {Object.entries(GST_REPORT_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </GstFiltersPanel>
            <GstExportCenter loadingType={exportLoadingType} onExport={handleExport} />
          </div>
        ) : null}
      </GstPage>

      <ItcStatusModal
        open={Boolean(selectedItc)}
        item={selectedItc}
        submitting={itcSubmitting}
        onClose={() => setSelectedItc(null)}
        onSubmit={async (values: GstItcStatusFormValues) => {
          if (!selectedItc) {
            return;
          }

          try {
            setItcSubmitting(true);
            await gstApi.updateItcStatus(selectedItc.id, {
              eligibilityStatus: values.eligibilityStatus,
              claimStatus: values.claimStatus,
              claimedAmount: values.claimedAmount,
              notes: values.notes,
            });
            toast.success("ITC status updated");
            setSelectedItc(null);
            setItcRefreshKey((value) => value + 1);
            setPurchaseRefreshKey((value) => value + 1);
            setSummaryRefreshKey((value) => value + 1);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to update ITC status"));
          } finally {
            setItcSubmitting(false);
          }
        }}
      />

      <GstAdjustmentModal
        open={adjustmentModalMode !== null}
        mode={adjustmentModalMode ?? "create"}
        adjustment={selectedAdjustment}
        submitting={adjustmentSubmitting}
        onClose={() => {
          setAdjustmentModalMode(null);
          setSelectedAdjustment(null);
        }}
        onSubmit={async (values: GstAdjustmentFormValues) => {
          try {
            setAdjustmentSubmitting(true);
            await gstApi.createAdjustment(values);
            toast.success("GST adjustment saved");
            setAdjustmentModalMode(null);
            setAdjustmentRefreshKey((value) => value + 1);
            setSummaryRefreshKey((value) => value + 1);
            setItcRefreshKey((value) => value + 1);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save GST adjustment"));
          } finally {
            setAdjustmentSubmitting(false);
          }
        }}
      />

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel GST Adjustment"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCancelTarget(null)}>
              Close
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={cancelSubmitting}
              onClick={cancelForm.handleSubmit(async (values) => {
                if (!cancelTarget) {
                  return;
                }

                try {
                  setCancelSubmitting(true);
                  await gstApi.cancelAdjustment(cancelTarget.id, values);
                  toast.success("Adjustment cancelled");
                  setCancelTarget(null);
                  setAdjustmentRefreshKey((value) => value + 1);
                  setSummaryRefreshKey((value) => value + 1);
                  setItcRefreshKey((value) => value + 1);
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to cancel adjustment"));
                } finally {
                  setCancelSubmitting(false);
                }
              })}
            >
              Cancel Adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cancelTarget ? (
            <Card className="rounded-xl border-slate-200 bg-slate-50">
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adjustment No</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{cancelTarget.adjustmentNumber}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatInr(cancelTarget.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Textarea
            label="Cancellation Reason"
            rows={4}
            {...cancelForm.register("cancellationReason")}
            error={cancelForm.formState.errors.cancellationReason?.message}
          />
        </div>
      </Modal>
    </>
  );
};

