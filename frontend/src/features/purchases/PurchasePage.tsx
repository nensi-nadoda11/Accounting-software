import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { applyFriendlyFieldErrors, saveDownloadedFile } from "../customers/customerUtils";
import { bankApi } from "../../services/bankApi";
import { companyApi } from "../../services/companyApi";
import { inventoryApi } from "../../services/inventoryApi";
import { purchasesApi } from "../../services/purchasesApi";
import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../types/company";
import type { Warehouse } from "../../types/inventory";
import type {
  PaymentStatus,
  PurchaseExportFormat,
  PurchaseInvoice,
  PurchaseInvoiceListItem,
  PurchaseListResponse,
  PurchaseStatus,
  PurchasePaymentsResponse,
  PurchaseReturn,
  PurchaseReturnsResponse,
} from "../../types/purchase";
import { PurchaseDetailDrawer } from "./components/PurchaseDetailDrawer";
import { PurchaseFilters } from "./components/PurchaseFilters";
import { PurchaseForm } from "./components/PurchaseForm";
import { PurchaseListTable } from "./components/PurchaseListTable";
import { PurchasePaymentDrawer } from "./components/PurchasePaymentDrawer";
import { PurchaseReturnDrawer } from "./components/PurchaseReturnDrawer";
import { PurchaseReturnList } from "./components/PurchaseReturnList";
import { PurchaseReturnRefundDrawer } from "./components/PurchaseReturnRefundDrawer";
import { allocateAdvancePayments } from "../payments/advanceAllocation";
import { createPaymentPayload, createPurchaseUpdatePayload, createReturnPayload, createReturnRefundPayload } from "./purchaseUtils";
import type { LookupOption } from "./components/AsyncLookupSelect";

export type PurchasePageTab = "invoices" | "new" | "returns";

type ConfirmState =
  | { type: "delete"; invoice: PurchaseInvoiceListItem | PurchaseInvoice }
  | { type: "post"; invoice: PurchaseInvoiceListItem | PurchaseInvoice }
  | { type: "cancel"; invoice: PurchaseInvoiceListItem | PurchaseInvoice };

const isPurchaseStatus = (value: string): value is PurchaseStatus =>
  value === "draft" || value === "posted" || value === "cancelled" || value === "returned";

const isPaymentStatus = (value: string): value is PaymentStatus =>
  value === "unpaid" || value === "partial" || value === "paid" || value === "overdue";

export const PurchasePage = ({ tab }: { tab: PurchasePageTab }) => {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<CompanyInvoiceSettings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);

  const [listData, setListData] = useState<PurchaseListResponse | null>(null);
  const [returnsData, setReturnsData] = useState<PurchaseReturnsResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<PurchaseExportFormat>("pdf");
  const [pageError, setPageError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<PurchaseInvoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editInvoice, setEditInvoice] = useState<PurchaseInvoice | null>(null);

  const [paymentInvoice, setPaymentInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentData, setPaymentData] = useState<PurchasePaymentsResponse | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [returnMode, setReturnMode] = useState<"create" | "view">("create");
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturn | null>(null);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<PurchaseInvoice | null>(null);
  const [returnInvoiceOptions, setReturnInvoiceOptions] = useState<LookupOption[]>([]);
  const [returnLookupValue, setReturnLookupValue] = useState<LookupOption | null>(null);
  const [loadingReturnInvoice, setLoadingReturnInvoice] = useState(false);
  const [refundDrawerOpen, setRefundDrawerOpen] = useState(false);
  const [refundReturn, setRefundReturn] = useState<PurchaseReturn | null>(null);
  const [submittingReturnRefund, setSubmittingReturnRefund] = useState(false);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const searchQuery = searchParams.get("search") ?? "";
  const searchInput = searchQuery;
  const [search, setSearch] = useState(searchInput);
  const debouncedSearch = useDebouncedValue(search, 350);

  const purchaseId = searchParams.get("purchaseId");
  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const purchaseStatus = searchParams.get("purchaseStatus") ?? "";
  const paymentStatus = searchParams.get("paymentStatus") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const purchaseStatusFilter = isPurchaseStatus(purchaseStatus) ? purchaseStatus : "";
  const paymentStatusFilter = isPaymentStatus(paymentStatus) ? paymentStatus : "";

  const canView = auth.hasPermission("purchase.view");
  const canCreate = auth.hasPermission("purchase.create");
  const canUpdate = auth.hasPermission("purchase.update");
  const canDelete = auth.hasPermission("purchase.delete");
  const canReturn = auth.hasPermission("purchase.return");
  const canExport = auth.hasPermission("purchase.export");
  const canPaymentView = auth.hasPermission("purchase.payment.view");
  const canPaymentManage = auth.hasPermission("purchase.payment.manage");
  const canApprove = auth.hasPermission("purchase.approve");
  const canManageSettings = auth.hasPermission("settings.manage");

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery === debouncedSearch) {
      return;
    }

    updateQuery({
      search: debouncedSearch || null,
      page: "1",
    });
  }, [debouncedSearch, searchQuery]);

  const loadReferenceData = async () => {
    const [warehouseResult] = await Promise.allSettled([
      inventoryApi.listWarehouses({ page: 1, limit: 100, status: "active" }),
    ]);

    setWarehouses(
      warehouseResult.status === "fulfilled"
        ? warehouseResult.value.data.items.filter((warehouse) => warehouse.status === "active")
        : [],
    );

    if (!canManageSettings) {
      return;
    }

    try {
      const [companyResponse, invoiceResponse, bankResponse] = await Promise.all([
        companyApi.getProfile(),
        companyApi.getInvoiceSettings(),
        bankApi.list({ page: 1, limit: 100, isActive: true }),
      ]);

      setCompanyProfile(companyResponse.data);
      setInvoiceSettings(invoiceResponse.data);
      setBankAccounts(bankResponse.data.items.filter((bankAccount) => bankAccount.isActive));
    } catch {
      setCompanyProfile(null);
      setInvoiceSettings(null);
      setBankAccounts([]);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoadingList(true);
      setPageError(null);
      const response = await purchasesApi.list({
        page,
        limit: 20,
        search: searchQuery || undefined,
        purchaseStatus: purchaseStatusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setListData(response.data);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load purchases"));
    } finally {
      setLoadingList(false);
    }
  };

  const loadReturns = async () => {
    try {
      setLoadingReturns(true);
      setPageError(null);
      const response = await purchasesApi.listReturns({
        page,
        limit: 20,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReturnsData(response.data);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load purchase returns"));
    } finally {
      setLoadingReturns(false);
    }
  };

  const loadPurchaseDetail = async (invoiceId: string) => {
    setLoadingDetail(true);
    try {
      const response = await purchasesApi.get(invoiceId);
      setDetailInvoice(response.data.invoice);
      return response.data.invoice;
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadPaymentDrawer = async (invoiceId: string) => {
    try {
      setLoadingPayments(true);
      const [invoiceResponse, paymentsResponse] = await Promise.all([
        purchasesApi.get(invoiceId),
        purchasesApi.listPayments(invoiceId, { page: 1, limit: 20 }),
      ]);
      setPaymentInvoice(invoiceResponse.data.invoice);
      setPaymentData(paymentsResponse.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load payments"));
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadEditInvoice = async (invoiceId: string) => {
    try {
      setLoadingForm(true);
      const response = await purchasesApi.get(invoiceId);
      setEditInvoice(response.data.invoice);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load draft"));
    } finally {
      setLoadingForm(false);
    }
  };

  const loadReturnDetail = async (returnId: string) => {
    try {
      setLoadingReturnInvoice(true);
      const response = await purchasesApi.getReturn(returnId);
      setReturnDetail(response.data.purchaseReturn);
      setReturnMode("view");
      setReturnDrawerOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load purchase return"));
    } finally {
      setLoadingReturnInvoice(false);
    }
  };

  const loadReturnInvoices = async (searchValue: string) => {
    if (!searchValue.trim() && returnInvoiceOptions.length > 0) {
      return;
    }

    try {
      setLoadingReturnInvoice(true);
      const response = await purchasesApi.list({
        page: 1,
        limit: 20,
        search: searchValue || undefined,
        purchaseStatus: "posted",
      });
      setReturnInvoiceOptions(
        response.data.items.map((invoice) => ({
          id: invoice.id,
          label: invoice.purchaseNumber,
          description: `${invoice.supplier.name} · ${invoice.supplierInvoiceNumber ?? "No ref"}`,
          meta: invoice.invoiceDate.slice(0, 10),
        })),
      );
    } catch {
      setReturnInvoiceOptions([]);
    } finally {
      setLoadingReturnInvoice(false);
    }
  };

  useEffect(() => {
    void loadReferenceData();
  }, [canManageSettings]);

  useEffect(() => {
    if (tab === "invoices") {
      void loadInvoices();
    }
    if (tab === "returns") {
      void loadReturns();
    }
  }, [tab, page, purchaseStatusFilter, paymentStatusFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    if (tab !== "new") {
      return;
    }

    if (!purchaseId) {
      setEditInvoice(null);
      return;
    }

    void loadEditInvoice(purchaseId);
  }, [purchaseId, tab]);

  const refreshCurrentTab = async () => {
    if (tab === "returns") {
      await loadReturns();
      return;
    }

    await loadInvoices();
  };

  const openReturnCreate = async (invoice?: PurchaseInvoiceListItem | PurchaseInvoice) => {
    setReturnMode("create");
    setReturnDetail(null);
    setReturnDrawerOpen(true);
    if (!invoice) {
      setSelectedReturnInvoice(null);
      setReturnLookupValue(null);
      void loadReturnInvoices("");
      return;
    }

    try {
      const detail =
        "items" in invoice && invoice.items
          ? invoice
          : (await purchasesApi.get(invoice.id)).data.invoice;
      setSelectedReturnInvoice(detail);
      setReturnLookupValue({
        id: detail.id,
        label: detail.purchaseNumber,
        description: detail.supplier.name,
        meta: detail.invoiceDate.slice(0, 10),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to prepare purchase return"));
    }
  };

  if (!canView && tab !== "new") {
    return <EmptyState title="You do not have access to purchases." />;
  }

  const renderListPage = () => (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Invoices"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
            {canExport ? (
              <>
                <Select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as PurchaseExportFormat)}
                  className="w-28 shrink-0"
                >
                  <option value="xlsx">XLSX</option>
                  <option value="pdf">PDF</option>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  loading={exporting}
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const file = await purchasesApi.exportList({
                        page,
                        limit: 20,
                        search: searchParams.get("search") || undefined,
                        purchaseStatus: purchaseStatusFilter || undefined,
                        paymentStatus: paymentStatusFilter || undefined,
                        dateFrom: dateFrom || undefined,
                        dateTo: dateTo || undefined,
                        format: exportFormat,
                      });
                      saveDownloadedFile(file.blob, file.fileName);
                      toast.success("Purchase export downloaded");
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Failed to export purchases"));
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              </>
            ) : null}
            {canCreate && tab === "invoices" ? (
              <Button type="button" className="shrink-0" onClick={() => navigate("/app/purchases/new")}>
                <Plus className="mr-2 size-4" />
                New Purchase
              </Button>
            ) : null}
          </div>
        }
      />

      <PurchaseFilters
        search={search}
        values={{
          purchaseStatus: purchaseStatusFilter,
          paymentStatus: paymentStatusFilter,
          dateFrom,
          dateTo,
        }}
        onSearchChange={setSearch}
        onChange={(values) => {
          updateQuery({
            purchaseStatus: values.purchaseStatus !== undefined ? values.purchaseStatus || null : purchaseStatusFilter || null,
            paymentStatus: values.paymentStatus !== undefined ? values.paymentStatus || null : paymentStatusFilter || null,
            dateFrom: values.dateFrom !== undefined ? values.dateFrom || null : dateFrom || null,
            dateTo: values.dateTo !== undefined ? values.dateTo || null : dateTo || null,
            page: "1",
          });
        }}
        onReset={() => {
          setSearch("");
          setSearchParams(new URLSearchParams());
        }}
      />

      {pageError && !listData ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{pageError}</div>
            <Button type="button" variant="secondary" onClick={() => void loadInvoices()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PurchaseListTable
          data={listData}
          loading={loadingList}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canApprove={canApprove}
          canPaymentManage={canPaymentManage || canPaymentView}
          canReturnManage={canReturn}
          canExport={canExport}
          onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })}
          onView={(invoice) => {
            setDetailId(invoice.id);
            void loadPurchaseDetail(invoice.id);
          }}
          onEdit={(invoice) => navigate(`/app/purchases/new?purchaseId=${invoice.id}`)}
          onDelete={(invoice) => setConfirmState({ type: "delete", invoice })}
          onPost={(invoice) => setConfirmState({ type: "post", invoice })}
          onCancel={(invoice) => setConfirmState({ type: "cancel", invoice })}
          onPayment={(invoice) => void loadPaymentDrawer(invoice.id)}
          onReturn={(invoice) => void openReturnCreate(invoice)}
          onPdf={async (invoice) => {
            try {
              const file = await purchasesApi.downloadPdf(invoice.id);
              saveDownloadedFile(file.blob, file.fileName);
            } catch (error) {
              toast.error(getErrorMessage(error, "Failed to download purchase PDF"));
            }
          }}
        />
      )}
    </div>
  );

  const renderNewPage = () => {
    if (purchaseId && loadingForm && !editInvoice) {
      return <LoadingState label="Loading draft..." />;
    }

    if (!canCreate && !purchaseId) {
      return <EmptyState title="You do not have access to create purchases." />;
    }

    if (purchaseId && !canUpdate) {
      return <EmptyState title="You do not have access to update purchase drafts." />;
    }

    return (
      <PurchaseForm
        initialInvoice={editInvoice}
        warehouses={warehouses}
        bankAccounts={bankAccounts}
        companyProfile={companyProfile}
        invoiceSettings={invoiceSettings}
        submitting={submittingForm}
        onBack={() => navigate("/app/purchases/invoices")}
        onSubmit={async (values, setError, mode, advanceAdjustmentAmount) => {
          try {
            setSubmittingForm(true);
            let invoiceId = "";
            let invoiceNumber = "";
            if (purchaseId) {
              await purchasesApi.update(purchaseId, createPurchaseUpdatePayload({ ...values, purchaseStatus: mode }));
              if (mode === "posted") {
                const posted = await purchasesApi.post(purchaseId);
                invoiceId = posted.data.invoice.id;
                invoiceNumber = posted.data.invoice.purchaseNumber;
              }
              toast.success("Purchase draft updated");
            } else {
              const created = await purchasesApi.create({ ...values, purchaseStatus: mode });
              invoiceId = created.data.invoice.id;
              invoiceNumber = created.data.invoice.purchaseNumber;
              toast.success(mode === "posted" ? "Purchase saved and posted" : "Purchase draft saved");
            }

            if (mode === "posted" && advanceAdjustmentAmount > 0 && values.supplierId && invoiceId) {
              await allocateAdvancePayments({
                partyType: "supplier",
                paymentType: "supplier_pay",
                partyId: values.supplierId,
                referenceType: "purchase_invoice",
                referenceId: invoiceId,
                referenceNumber: invoiceNumber,
                allocationDate: values.invoiceDate,
                amount: advanceAdjustmentAmount,
              });
            }

            navigate("/app/purchases/invoices");
          } catch (error) {
            applyFriendlyFieldErrors(error, setError);
            toast.error(getErrorMessage(error, "Failed to save purchase"));
          } finally {
            setSubmittingForm(false);
          }
        }}
      />
    );
  };

  const renderReturnsPage = () => (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Returns"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
            {canExport ? (
              <>
                <Select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as PurchaseExportFormat)}
                  className="w-28 shrink-0"
                >
                  <option value="xlsx">XLSX</option>
                  <option value="pdf">PDF</option>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  loading={exporting}
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const file = await purchasesApi.exportReturns({
                        page,
                        limit: 20,
                        search: searchParams.get("search") || undefined,
                        dateFrom: dateFrom || undefined,
                        dateTo: dateTo || undefined,
                        format: exportFormat,
                      });
                      saveDownloadedFile(file.blob, file.fileName);
                      toast.success("Purchase returns exported");
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Failed to export purchase returns"));
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              </>
            ) : null}
            {canReturn ? (
              <Button type="button" className="shrink-0" onClick={() => void openReturnCreate()}>
                <Plus className="mr-2 size-4" />
                New Return
              </Button>
            ) : null}
          </div>
        }
      />

      <PurchaseFilters
        search={search}
        values={{
          purchaseStatus: "",
          paymentStatus: "",
          dateFrom,
          dateTo,
        }}
        showPurchaseStatus={false}
        showPaymentStatus={false}
        onSearchChange={setSearch}
        onChange={(values) => {
          updateQuery({
            dateFrom: values.dateFrom !== undefined ? values.dateFrom || null : dateFrom || null,
            dateTo: values.dateTo !== undefined ? values.dateTo || null : dateTo || null,
            page: "1",
          });
        }}
        onReset={() => {
          setSearch("");
          setSearchParams(new URLSearchParams());
        }}
      />

      {pageError && !returnsData ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{pageError}</div>
            <Button type="button" variant="secondary" onClick={() => void loadReturns()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PurchaseReturnList
          data={returnsData}
          loading={loadingReturns}
          canCreate={canReturn}
          canExport={canExport}
          canManageRefund={canReturn}
          onCreate={() => void openReturnCreate()}
          onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })}
          onView={(purchaseReturn) => void loadReturnDetail(purchaseReturn.id)}
          onRefund={(purchaseReturn) => {
            setRefundReturn(purchaseReturn);
            setRefundDrawerOpen(true);
          }}
          onPdf={async (purchaseReturn) => {
            try {
              const file = await purchasesApi.downloadReturnPdf(purchaseReturn.id);
              saveDownloadedFile(file.blob, file.fileName);
            } catch (error) {
              toast.error(getErrorMessage(error, "Failed to download return PDF"));
            }
          }}
        />
      )}
    </div>
  );

  return (
    <>
      {tab === "new" ? renderNewPage() : tab === "returns" ? renderReturnsPage() : renderListPage()}

      <PurchaseDetailDrawer
        open={Boolean(detailId)}
        invoice={detailInvoice}
        loading={loadingDetail}
        canUpdate={canUpdate}
        canApprove={canApprove}
        canPaymentManage={canPaymentManage}
        canReturnManage={canReturn}
        canExport={canExport}
        onClose={() => {
          setDetailId(null);
          setDetailInvoice(null);
        }}
        onEdit={(invoice) => navigate(`/app/purchases/new?purchaseId=${invoice.id}`)}
        onPost={(invoice) => setConfirmState({ type: "post", invoice })}
        onCancel={(invoice) => setConfirmState({ type: "cancel", invoice })}
        onPayment={(invoice) => void loadPaymentDrawer(invoice.id)}
        onReturn={(invoice) => void openReturnCreate(invoice)}
        onPdf={async (invoice) => {
          try {
            const file = await purchasesApi.downloadPdf(invoice.id);
            saveDownloadedFile(file.blob, file.fileName);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to download purchase PDF"));
          }
        }}
      />

      <PurchasePaymentDrawer
        open={Boolean(paymentInvoice)}
        purchase={paymentInvoice}
        payments={paymentData}
        loading={loadingPayments}
        submitting={submittingPayment}
        bankAccounts={bankAccounts}
        canManage={canPaymentManage}
        onClose={() => {
          setPaymentInvoice(null);
          setPaymentData(null);
        }}
        onSubmit={async (values) => {
          if (!paymentInvoice) {
            return;
          }

          try {
            setSubmittingPayment(true);
            const invoiceId = paymentInvoice.id;
            await purchasesApi.createPayment(invoiceId, createPaymentPayload(values));
            toast.success("Payment recorded");
            setPaymentInvoice(null);
            setPaymentData(null);
            await refreshCurrentTab();
            if (detailId === invoiceId) {
              await loadPurchaseDetail(invoiceId);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to record payment"));
          } finally {
            setSubmittingPayment(false);
          }
        }}
      />

      <PurchaseReturnDrawer
        open={returnDrawerOpen}
        mode={returnMode}
        purchaseReturn={returnDetail}
        selectedInvoice={selectedReturnInvoice}
        invoiceOptions={returnInvoiceOptions}
        invoiceLookupValue={returnLookupValue}
        loadingInvoice={loadingReturnInvoice}
        warehouses={warehouses}
        bankAccounts={bankAccounts}
        submitting={submittingReturn}
        onClose={() => {
          setReturnDrawerOpen(false);
          setReturnDetail(null);
          setSelectedReturnInvoice(null);
          setReturnLookupValue(null);
        }}
        onInvoiceSearch={(value) => void loadReturnInvoices(value)}
        onInvoiceSelect={async (option) => {
          setReturnLookupValue(option);
          try {
            const response = await purchasesApi.get(option.id);
            setSelectedReturnInvoice(response.data.invoice);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to load purchase invoice"));
          }
        }}
        onSubmit={async (values) => {
          try {
            setSubmittingReturn(true);
            const response = await purchasesApi.createReturn(createReturnPayload(values));
            const createdReturn = response.data.purchaseReturn;
            toast.success(
              `Purchase return created. Adjusted ${createdReturn.adjustedAmount} and refundable ${createdReturn.remainingRefundAmount}.`,
            );
            setReturnDrawerOpen(false);
            setReturnDetail(null);
            setSelectedReturnInvoice(null);
            setReturnLookupValue(null);
            await loadReturns();
            await loadInvoices();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to create purchase return"));
          } finally {
            setSubmittingReturn(false);
          }
        }}
        onPdf={async (purchaseReturn) => {
          try {
            const file = await purchasesApi.downloadReturnPdf(purchaseReturn.id);
            saveDownloadedFile(file.blob, file.fileName);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to download return PDF"));
          }
        }}
      />

      <PurchaseReturnRefundDrawer
        open={refundDrawerOpen}
        purchaseReturn={refundReturn}
        bankAccounts={bankAccounts}
        submitting={submittingReturnRefund}
        onClose={() => {
          setRefundDrawerOpen(false);
          setRefundReturn(null);
        }}
        onSubmit={async (values) => {
          if (!refundReturn) {
            return;
          }

          try {
            setSubmittingReturnRefund(true);
            const response = await purchasesApi.recordReturnRefund(refundReturn.id, createReturnRefundPayload(values));
            setRefundReturn(response.data.purchaseReturn);
            setRefundDrawerOpen(false);
            toast.success("Refund entry recorded");
            await loadReturns();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to record refund entry"));
          } finally {
            setSubmittingReturnRefund(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        loading={confirmLoading}
        tone={confirmState?.type === "delete" ? "danger" : "primary"}
        title={
          confirmState?.type === "delete"
            ? "Delete Draft"
            : confirmState?.type === "post"
              ? "Post Purchase"
              : "Cancel Purchase"
        }
        description={
          confirmState?.type === "delete"
            ? `Delete ${confirmState.invoice.purchaseNumber}?`
            : confirmState?.type === "post"
              ? `Post ${confirmState.invoice.purchaseNumber}?`
              : `Cancel ${confirmState?.invoice.purchaseNumber}?`
        }
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState) {
            return;
          }

          try {
            setConfirmLoading(true);
            if (confirmState.type === "delete") {
              await purchasesApi.remove(confirmState.invoice.id);
              toast.success("Purchase draft deleted");
            }

            if (confirmState.type === "post") {
              await purchasesApi.post(confirmState.invoice.id);
              toast.success("Purchase posted");
            }

            if (confirmState.type === "cancel") {
              await purchasesApi.cancel(confirmState.invoice.id);
              toast.success("Purchase cancelled");
            }

            setConfirmState(null);
            await refreshCurrentTab();
            if (detailId === confirmState.invoice.id) {
              await loadPurchaseDetail(confirmState.invoice.id);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to complete purchase action"));
          } finally {
            setConfirmLoading(false);
          }
        }}
      />
    </>
  );
};

