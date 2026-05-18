import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SideSheet } from "../../components/ui/SideSheet";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { applyFriendlyFieldErrors, saveDownloadedFile } from "../customers/customerUtils";
import { bankApi } from "../../services/bankApi";
import { companyApi } from "../../services/companyApi";
import { customersApi } from "../../services/customersApi";
import { inventoryApi } from "../../services/inventoryApi";
import { salesApi } from "../../services/salesApi";
import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../types/company";
import type { CustomerListItem } from "../../types/customer";
import type { Warehouse } from "../../types/inventory";
import type {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
  SalesInvoice,
  SalesInvoiceListItem,
  SalesListResponse,
  SalesPaymentsResponse,
  SalesReturn,
  SalesReturnsResponse,
} from "../../types/sales";
import { POSBilling } from "./components/POSBilling";
import { SalesDetailDrawer } from "./components/SalesDetailDrawer";
import { SalesFilters } from "./components/SalesFilters";
import { SalesInvoiceForm } from "./components/SalesInvoiceForm";
import { SalesListTable } from "./components/SalesListTable";
import { SalesPaymentDrawer } from "./components/SalesPaymentDrawer";
import { SalesReturnDrawer } from "./components/SalesReturnDrawer";
import { SalesReturnList } from "./components/SalesReturnList";
import { SendInvoiceModal } from "./components/SendInvoiceModal";
import { createPaymentPayload, createReturnPayload, createSalesUpdatePayload } from "./salesUtils";
import type { LookupOption } from "./components/AsyncLookupSelect";

type SalesPageTab = "invoices" | "pos" | "returns" | "payments";

type ConfirmState =
  | { type: "delete"; invoice: SalesInvoiceListItem | SalesInvoice }
  | { type: "post"; invoice: SalesInvoiceListItem | SalesInvoice }
  | { type: "cancel"; invoice: SalesInvoiceListItem | SalesInvoice };

const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  value === "draft" || value === "posted" || value === "cancelled" || value === "returned" || value === "partially_returned";

const isPaymentStatus = (value: string): value is PaymentStatus =>
  value === "unpaid" || value === "partial" || value === "paid" || value === "overdue";

const isInvoiceType = (value: string): value is InvoiceType => value === "gst_invoice" || value === "pos";

const buildPrintHtml = (invoice: SalesInvoice) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${invoice.invoiceNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1,h2,h3,p { margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin: 16px 0 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; }
      th { background: #f8fafc; }
      .totals { margin-top: 24px; width: 320px; margin-left: auto; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .strong { font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 8px; }
    </style>
  </head>
  <body>
    <h1>${invoice.invoiceNumber}</h1>
    <p>${invoice.customer?.name ?? invoice.walkInName ?? "Walk-in Customer"} · ${invoice.invoiceType}</p>
    <div class="grid">
      <div><strong>Date</strong><br />${invoice.invoiceDate.slice(0, 10)}</div>
      <div><strong>Place of Supply</strong><br />${invoice.placeOfSupply}</div>
      <div><strong>Warehouse</strong><br />${invoice.warehouse.name ?? "-"}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Taxable</th>
          <th>GST</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${(invoice.items ?? [])
          .map(
            (item) => `<tr>
              <td>${item.productNameSnapshot}</td>
              <td>${item.quantity}</td>
              <td>${item.saleRate}</td>
              <td>${item.taxableAmount}</td>
              <td>${(Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount) + Number(item.cessAmount)).toFixed(2)}</td>
              <td>${item.lineTotal}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${invoice.subtotal}</span></div>
      <div><span>GST</span><span>${invoice.gstTotal}</span></div>
      <div><span>Paid</span><span>${invoice.paidAmount}</span></div>
      <div><span>Due</span><span>${invoice.dueAmount}</span></div>
      <div class="strong"><span>Grand Total</span><span>${invoice.grandTotal}</span></div>
    </div>
  </body>
</html>`;

export const SalesPage = ({ tab }: { tab: SalesPageTab }) => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<CompanyInvoiceSettings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [filterCustomers, setFilterCustomers] = useState<CustomerListItem[]>([]);

  const [listData, setListData] = useState<SalesListResponse | null>(null);
  const [returnsData, setReturnsData] = useState<SalesReturnsResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [submittingSend, setSubmittingSend] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<SalesInvoice | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<SalesInvoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [paymentInvoice, setPaymentInvoice] = useState<SalesInvoice | null>(null);
  const [paymentData, setPaymentData] = useState<SalesPaymentsResponse | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [returnMode, setReturnMode] = useState<"create" | "view">("create");
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [returnDetail, setReturnDetail] = useState<SalesReturn | null>(null);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<SalesInvoice | null>(null);
  const [returnInvoiceOptions, setReturnInvoiceOptions] = useState<LookupOption[]>([]);
  const [returnLookupValue, setReturnLookupValue] = useState<LookupOption | null>(null);
  const [loadingReturnInvoice, setLoadingReturnInvoice] = useState(false);

  const [sendMode, setSendMode] = useState<"email" | "whatsapp" | null>(null);
  const [sendInvoice, setSendInvoice] = useState<SalesInvoice | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const searchInput = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchInput);
  const debouncedSearch = useDebouncedValue(search, 350);

  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const invoiceStatus = searchParams.get("invoiceStatus") ?? "";
  const paymentStatus = searchParams.get("paymentStatus") ?? "";
  const customerId = searchParams.get("customerId") ?? "";
  const warehouseId = searchParams.get("warehouseId") ?? "";
  const invoiceType = searchParams.get("invoiceType") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const invoiceStatusFilter = isInvoiceStatus(invoiceStatus) ? invoiceStatus : "";
  const paymentStatusFilter = isPaymentStatus(paymentStatus) ? paymentStatus : "";
  const invoiceTypeFilter = isInvoiceType(invoiceType) ? invoiceType : "";

  const canView = auth.hasPermission("sales.view");
  const canCreate = auth.hasPermission("sales.create");
  const canUpdate = auth.hasPermission("sales.update");
  const canDelete = auth.hasPermission("sales.delete");
  const canReturn = auth.hasPermission("sales.return");
  const canExport = auth.hasPermission("sales.export");
  const canPaymentView = auth.hasPermission("sales.payment.view");
  const canPaymentManage = auth.hasPermission("sales.payment.manage");
  const canSend = auth.hasPermission("sales.invoice.send");
  const canPosAccess = auth.hasPermission("sales.pos.access");
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
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if ((searchParams.get("search") ?? "") === debouncedSearch) {
      return;
    }

    updateQuery({
      search: debouncedSearch || null,
      page: "1",
    });
  }, [debouncedSearch]);

  const loadReferenceData = async () => {
    const [warehouseResult, customerResult] = await Promise.allSettled([
      inventoryApi.listWarehouses({ page: 1, limit: 100, status: "active" }),
      customersApi.list({ page: 1, limit: 100, status: "active" }),
    ]);

    setWarehouses(
      warehouseResult.status === "fulfilled"
        ? warehouseResult.value.data.items.filter((warehouse) => warehouse.status === "active")
        : [],
    );
    setFilterCustomers(
      customerResult.status === "fulfilled"
        ? customerResult.value.data.items.filter((customer) => customer.status === "active")
        : [],
    );

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
      if (!canManageSettings) {
        return;
      }
      setCompanyProfile(null);
      setInvoiceSettings(null);
      setBankAccounts([]);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoadingList(true);
      setPageError(null);
      const response = await salesApi.list({
        page,
        limit: 20,
        search: searchParams.get("search") || undefined,
        invoiceStatus: tab === "payments" ? undefined : invoiceStatusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        customerId: customerId || undefined,
        warehouseId: warehouseId || undefined,
        invoiceType: invoiceTypeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setListData(response.data);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load sales invoices"));
    } finally {
      setLoadingList(false);
    }
  };

  const loadReturns = async () => {
    try {
      setLoadingReturns(true);
      setPageError(null);
      const response = await salesApi.listReturns({
        page,
        limit: 20,
        search: searchParams.get("search") || undefined,
        customerId: customerId || undefined,
        warehouseId: warehouseId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReturnsData(response.data);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load sales returns"));
    } finally {
      setLoadingReturns(false);
    }
  };

  const loadSalesDetail = async (invoiceId: string) => {
    setLoadingDetail(true);
    try {
      const response = await salesApi.get(invoiceId);
      setDetailInvoice(response.data.invoice);
      return response.data.invoice;
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadEditInvoice = async (invoiceId: string) => {
    try {
      setLoadingForm(true);
      const response = await salesApi.get(invoiceId);
      setEditInvoice(response.data.invoice);
      setFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load draft"));
    } finally {
      setLoadingForm(false);
    }
  };

  const loadPaymentDrawer = async (invoiceId: string) => {
    try {
      setLoadingPayments(true);
      const [invoiceResponse, paymentsResponse] = await Promise.all([
        salesApi.get(invoiceId),
        salesApi.listPayments(invoiceId, { page: 1, limit: 20 }),
      ]);
      setPaymentInvoice(invoiceResponse.data.invoice);
      setPaymentData(paymentsResponse.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load payments"));
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadReturnDetail = async (returnId: string) => {
    try {
      setLoadingReturnInvoice(true);
      const response = await salesApi.getReturn(returnId);
      setReturnDetail(response.data.salesReturn);
      setReturnMode("view");
      setReturnDrawerOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load sales return"));
    } finally {
      setLoadingReturnInvoice(false);
    }
  };

  const loadReturnInvoices = async (searchValue: string) => {
    try {
      setLoadingReturnInvoice(true);
      const response = await salesApi.list({
        page: 1,
        limit: 20,
        search: searchValue || undefined,
        invoiceStatus: "posted",
      });
      setReturnInvoiceOptions(
        response.data.items.map((invoice) => ({
          id: invoice.id,
          label: invoice.invoiceNumber,
          description: invoice.customerName || invoice.walkInName || "Walk-in Customer",
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
    if (tab === "invoices" || tab === "payments") {
      void loadInvoices();
    }
    if (tab === "returns") {
      void loadReturns();
    }
  }, [tab, page, invoiceStatus, paymentStatus, customerId, warehouseId, invoiceType, dateFrom, dateTo, searchParams]);

  const refreshCurrentTab = async () => {
    if (tab === "returns") {
      await loadReturns();
      return;
    }

    await loadInvoices();
  };

  const openReturnCreate = async (invoice?: SalesInvoiceListItem | SalesInvoice) => {
    setReturnMode("create");
    setReturnDetail(null);
    setReturnDrawerOpen(true);
    if (!invoice) {
      setSelectedReturnInvoice(null);
      setReturnLookupValue(null);
      return;
    }

    try {
      const detail = "items" in invoice && invoice.items ? invoice : await salesApi.get(invoice.id).then((response) => response.data.invoice);
      setSelectedReturnInvoice(detail);
      setReturnLookupValue({
        id: detail.id,
        label: detail.invoiceNumber,
        description: detail.customer?.name ?? detail.walkInName ?? "Walk-in Customer",
        meta: detail.invoiceDate.slice(0, 10),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to prepare sales return"));
    }
  };

  const printInvoice = async (invoiceId: string) => {
    try {
      const response = await salesApi.getPdfPayload(invoiceId);
      const invoice = response.data.invoice;
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=780");
      if (!printWindow) {
        toast.error("Unable to open print window");
        return;
      }

      printWindow.document.write(buildPrintHtml(invoice));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load print preview"));
    }
  };

  const openSendModal = async (invoiceId: string, mode: "email" | "whatsapp") => {
    try {
      const invoice = detailInvoice?.id === invoiceId ? detailInvoice : (await salesApi.get(invoiceId)).data.invoice;
      setSendInvoice(invoice);
      setSendMode(mode);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load invoice"));
    }
  };

  if (!canView && tab !== "pos") {
    return <EmptyState title="You do not have access to sales." />;
  }

  return (
    <>
      {tab === "pos" ? (
        !canCreate || !canPosAccess ? (
          <EmptyState title="You do not have access to POS billing." />
        ) : (
          <POSBilling
            warehouses={warehouses}
            bankAccounts={bankAccounts}
            companyProfile={companyProfile}
            invoiceSettings={invoiceSettings}
            submitting={submittingForm}
            onSubmit={async (values, setError) => {
              try {
                setSubmittingForm(true);
                const response = await salesApi.createPos({ ...values, invoiceType: "pos", invoiceStatus: "posted" });
                toast.success("POS invoice saved");
                await printInvoice(response.data.invoice.id);
              } catch (error) {
                applyFriendlyFieldErrors(error, setError);
                toast.error(getErrorMessage(error, "Failed to save POS invoice"));
              } finally {
                setSubmittingForm(false);
              }
            }}
          />
        )
      ) : tab === "returns" ? (
        <div className="space-y-5">
          <PageHeader
            title="Sales Returns"
            actions={
              <div className="flex flex-wrap gap-2">
                {canExport ? (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={exporting}
                    onClick={async () => {
                      try {
                        setExporting(true);
                        const file = await salesApi.exportReturns({
                          page,
                          limit: 20,
                          search: searchParams.get("search") || undefined,
                          customerId: customerId || undefined,
                          warehouseId: warehouseId || undefined,
                          dateFrom: dateFrom || undefined,
                          dateTo: dateTo || undefined,
                        });
                        saveDownloadedFile(file.blob, file.fileName);
                        toast.success("Sales returns exported");
                      } catch (error) {
                        toast.error(getErrorMessage(error, "Failed to export sales returns"));
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                ) : null}
                {canReturn ? (
                  <Button type="button" onClick={() => void openReturnCreate()}>
                    <Plus className="mr-2 size-4" />
                    New Return
                  </Button>
                ) : null}
              </div>
            }
          />

          <SalesFilters
            search={search}
            values={{
              invoiceStatus: "",
              paymentStatus: "",
              customerId,
              warehouseId,
              invoiceType: "",
              dateFrom,
              dateTo,
            }}
            customers={filterCustomers}
            warehouses={warehouses}
            onSearchChange={setSearch}
            onChange={(values) => {
              updateQuery({
                customerId: values.customerId !== undefined ? values.customerId || null : customerId || null,
                warehouseId: values.warehouseId !== undefined ? values.warehouseId || null : warehouseId || null,
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
            <SalesReturnList
              data={returnsData}
              loading={loadingReturns}
              canCreate={canReturn}
              onCreate={() => void openReturnCreate()}
              onView={(salesReturn) => void loadReturnDetail(salesReturn.id)}
              onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })}
            />
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <PageHeader
            title={tab === "payments" ? "Sales Payments" : "Sales Invoices"}
            actions={
              <div className="flex flex-wrap gap-2">
                {canExport ? (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={exporting}
                    onClick={async () => {
                      try {
                        setExporting(true);
                        const file = await salesApi.exportList({
                          page,
                          limit: 20,
                          search: searchParams.get("search") || undefined,
                          invoiceStatus: invoiceStatusFilter || undefined,
                          paymentStatus: paymentStatusFilter || undefined,
                          customerId: customerId || undefined,
                          warehouseId: warehouseId || undefined,
                          invoiceType: invoiceTypeFilter || undefined,
                          dateFrom: dateFrom || undefined,
                          dateTo: dateTo || undefined,
                        });
                        saveDownloadedFile(file.blob, file.fileName);
                        toast.success("Sales export downloaded");
                      } catch (error) {
                        toast.error(getErrorMessage(error, "Failed to export sales"));
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                ) : null}
                {canCreate && tab === "invoices" ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditInvoice(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    New Invoice
                  </Button>
                ) : null}
              </div>
            }
          />

          <SalesFilters
            search={search}
            values={{
              invoiceStatus: invoiceStatusFilter,
              paymentStatus: paymentStatusFilter,
              customerId,
              warehouseId,
              invoiceType: invoiceTypeFilter,
              dateFrom,
              dateTo,
            }}
            customers={filterCustomers}
            warehouses={warehouses}
            onSearchChange={setSearch}
            onChange={(values) => {
              updateQuery({
                invoiceStatus: values.invoiceStatus !== undefined ? values.invoiceStatus || null : invoiceStatusFilter || null,
                paymentStatus: values.paymentStatus !== undefined ? values.paymentStatus || null : paymentStatusFilter || null,
                customerId: values.customerId !== undefined ? values.customerId || null : customerId || null,
                warehouseId: values.warehouseId !== undefined ? values.warehouseId || null : warehouseId || null,
                invoiceType: values.invoiceType !== undefined ? values.invoiceType || null : invoiceTypeFilter || null,
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
            <SalesListTable
              data={listData}
              loading={loadingList}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canPost={canCreate}
              canPaymentManage={canPaymentManage || canPaymentView}
              canReturnManage={canReturn}
              canSend={canSend}
              onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })}
              onView={(invoice) => {
                setDetailId(invoice.id);
                void loadSalesDetail(invoice.id);
              }}
              onEdit={(invoice) => void loadEditInvoice(invoice.id)}
              onDelete={(invoice) => setConfirmState({ type: "delete", invoice })}
              onPost={(invoice) => setConfirmState({ type: "post", invoice })}
              onCancel={(invoice) => setConfirmState({ type: "cancel", invoice })}
              onPayment={(invoice) => void loadPaymentDrawer(invoice.id)}
              onReturn={(invoice) => void openReturnCreate(invoice)}
              onPdf={(invoice) => void printInvoice(invoice.id)}
              onEmail={(invoice) => void openSendModal(invoice.id, "email")}
              onWhatsapp={(invoice) => void openSendModal(invoice.id, "whatsapp")}
            />
          )}
        </div>
      )}

      <SideSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditInvoice(null);
        }}
        title={tab === "invoices" ? (editInvoice ? "Edit Sales Draft" : "New Sales Invoice") : "Sales Form"}
        className="max-w-[92vw]"
      >
        {loadingForm && !editInvoice ? (
          <LoadingState label="Loading draft..." />
        ) : (
          <SalesInvoiceForm
            initialInvoice={editInvoice}
            warehouses={warehouses}
            bankAccounts={bankAccounts}
            companyProfile={companyProfile}
            invoiceSettings={invoiceSettings}
            submitting={submittingForm}
            onBack={() => {
              setFormOpen(false);
              setEditInvoice(null);
            }}
            onPrint={(invoice) => void printInvoice(invoice.id)}
            onSubmit={async (values, setError, mode) => {
              try {
                setSubmittingForm(true);
                if (editInvoice) {
                  await salesApi.update(editInvoice.id, createSalesUpdatePayload(values));
                  if (mode === "posted") {
                    await salesApi.post(editInvoice.id);
                  }
                  toast.success(mode === "posted" ? "Sales draft posted" : "Sales draft updated");
                } else {
                  await salesApi.create(values);
                  toast.success(mode === "posted" ? "Sales invoice saved and posted" : "Sales draft saved");
                }

                setFormOpen(false);
                setEditInvoice(null);
                await loadInvoices();
              } catch (error) {
                applyFriendlyFieldErrors(error, setError);
                toast.error(getErrorMessage(error, "Failed to save sales invoice"));
              } finally {
                setSubmittingForm(false);
              }
            }}
          />
        )}
      </SideSheet>

      <SalesDetailDrawer
        open={Boolean(detailId)}
        invoice={detailInvoice}
        loading={loadingDetail}
        canUpdate={canUpdate}
        canPost={canCreate}
        canPaymentManage={canPaymentManage}
        canReturnManage={canReturn}
        canSend={canSend}
        onClose={() => {
          setDetailId(null);
          setDetailInvoice(null);
        }}
        onEdit={(invoice) => {
          setDetailId(null);
          setDetailInvoice(null);
          void loadEditInvoice(invoice.id);
        }}
        onPost={(invoice) => setConfirmState({ type: "post", invoice })}
        onCancel={(invoice) => setConfirmState({ type: "cancel", invoice })}
        onPayment={(invoice) => void loadPaymentDrawer(invoice.id)}
        onReturn={(invoice) => void openReturnCreate(invoice)}
        onPdf={(invoice) => void printInvoice(invoice.id)}
        onEmail={(invoice) => void openSendModal(invoice.id, "email")}
        onWhatsapp={(invoice) => void openSendModal(invoice.id, "whatsapp")}
      />

      <SalesPaymentDrawer
        open={Boolean(paymentInvoice)}
        invoice={paymentInvoice}
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
            await salesApi.createPayment(paymentInvoice.id, createPaymentPayload(values));
            toast.success("Payment recorded");
            await loadPaymentDrawer(paymentInvoice.id);
            await refreshCurrentTab();
            if (detailId === paymentInvoice.id) {
              await loadSalesDetail(paymentInvoice.id);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to record payment"));
          } finally {
            setSubmittingPayment(false);
          }
        }}
      />

      <SalesReturnDrawer
        open={returnDrawerOpen}
        mode={returnMode}
        salesReturn={returnDetail}
        selectedInvoice={selectedReturnInvoice}
        invoiceOptions={returnInvoiceOptions}
        invoiceLookupValue={returnLookupValue}
        loadingInvoice={loadingReturnInvoice}
        warehouses={warehouses}
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
            const response = await salesApi.get(option.id);
            setSelectedReturnInvoice(response.data.invoice);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to load sales invoice"));
          }
        }}
        onSubmit={async (values) => {
          try {
            setSubmittingReturn(true);
            await salesApi.createReturn(createReturnPayload(values));
            toast.success("Sales return created");
            setReturnDrawerOpen(false);
            setReturnDetail(null);
            setSelectedReturnInvoice(null);
            setReturnLookupValue(null);
            await loadReturns();
            await loadInvoices();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to create sales return"));
          } finally {
            setSubmittingReturn(false);
          }
        }}
      />

      <SendInvoiceModal
        open={Boolean(sendMode && sendInvoice)}
        mode={sendMode ?? "email"}
        defaultRecipient={
          sendMode === "email"
            ? sendInvoice?.customer?.email ?? ""
            : sendInvoice?.walkInMobile ?? sendInvoice?.customer?.mobile ?? ""
        }
        submitting={submittingSend}
        onClose={() => {
          setSendMode(null);
          setSendInvoice(null);
        }}
        onSubmit={async (values) => {
          if (!sendMode || !sendInvoice) {
            return;
          }

          try {
            setSubmittingSend(true);
            if (sendMode === "email") {
              const response = await salesApi.sendEmail(sendInvoice.id, { email: values.recipient, message: values.message });
              toast.success(response.message || "Email processed");
            } else {
              const response = await salesApi.sendWhatsapp(sendInvoice.id, { mobile: values.recipient, message: values.message });
              toast.success(response.message || "WhatsApp request processed");
            }

            if (detailId === sendInvoice.id) {
              await loadSalesDetail(sendInvoice.id);
            }

            setSendMode(null);
            setSendInvoice(null);
          } catch (error) {
            toast.error(getErrorMessage(error, `Failed to send via ${sendMode === "email" ? "email" : "WhatsApp"}`));
          } finally {
            setSubmittingSend(false);
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
              ? "Post Invoice"
              : "Cancel Invoice"
        }
        description={
          confirmState?.type === "delete"
            ? `Delete ${confirmState.invoice.invoiceNumber}?`
            : confirmState?.type === "post"
              ? `Post ${confirmState.invoice.invoiceNumber}?`
              : `Cancel ${confirmState?.invoice.invoiceNumber}?`
        }
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState) {
            return;
          }

          try {
            setConfirmLoading(true);
            if (confirmState.type === "delete") {
              await salesApi.remove(confirmState.invoice.id);
              toast.success("Sales draft deleted");
            }

            if (confirmState.type === "post") {
              await salesApi.post(confirmState.invoice.id);
              toast.success("Sales invoice posted");
            }

            if (confirmState.type === "cancel") {
              await salesApi.cancel(confirmState.invoice.id);
              toast.success("Sales invoice cancelled");
            }

            setConfirmState(null);
            await refreshCurrentTab();
            if (detailId === confirmState.invoice.id) {
              await loadSalesDetail(confirmState.invoice.id);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to complete sales action"));
          } finally {
            setConfirmLoading(false);
          }
        }}
      />
    </>
  );
};
