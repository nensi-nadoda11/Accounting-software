import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Download, Eye, FileText, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { AmountText } from "../../components/ui/AmountText";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIconButton } from "../../components/ui/TableActionIconButton";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { customersApi } from "../../services/customersApi";
import type {
  Customer,
  CustomerListItem,
  CustomerMutableStatus,
  CustomerExportFormat,
  CustomerSortBy,
  CustomerStatus,
  CustomerType,
  SortOrder,
  TaxType,
} from "../../types/customer";
import { CustomerDetailDrawer } from "./components/CustomerDetailDrawer";
import { CustomerFilters } from "./components/CustomerFilters";
import { CustomerFormDrawer } from "./components/CustomerFormDrawer";
import { CustomerLedgerDrawer } from "./components/CustomerLedgerDrawer";
import { CustomerPaymentsDrawer } from "./components/CustomerPaymentsDrawer";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS } from "./customerOptions";
import {
  applyFriendlyFieldErrors,
  createCustomerPayload,
  createCustomerUpdatePayload,
  formatInr,
  saveDownloadedFile,
} from "./customerUtils";
import { useDebouncedValue } from "./useDebouncedValue";

type CustomerActionTarget = Pick<Customer, "id" | "name" | "status" | "isBlacklisted">;

const isCustomerStatus = (value: string | null): value is CustomerStatus =>
  value === "active" || value === "inactive" || value === "deleted";

const isCustomerType = (value: string | null): value is CustomerType =>
  value === "individual" || value === "business";

const isTaxType = (value: string | null): value is TaxType =>
  value === "registered" || value === "unregistered" || value === "composition";

const isSortBy = (value: string | null): value is CustomerSortBy =>
  value === "name" || value === "createdAt" || value === "outstandingAmount" || value === "customerCode";

const isSortOrder = (value: string | null): value is SortOrder => value === "asc" || value === "desc";

const parseBooleanFilter = (value: string | null): "" | "true" | "false" =>
  value === "true" || value === "false" ? value : "";

const toneForStatus = (status: CustomerStatus) => {
  if (status === "active") {
    return "success";
  }

  if (status === "inactive") {
    return "warning";
  }

  return "danger";
};

const CustomerTableSkeleton = () => (
  <Card>
    <TableWrapper className="border-none overflow-x-visible">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Customer Code", "Name", "Mobile", "GST Number", "Type", "Outstanding", "Credit Limit", "Status", "Actions"].map((head) => (
              <th key={head} className="px-5 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <tr key={rowIndex} className="animate-pulse">
              {Array.from({ length: 9 }).map((__, cellIndex) => (
                <td key={cellIndex} className="px-5 py-4">
                  <div className="h-4 rounded bg-slate-100" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  </Card>
);

export const CustomersPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [data, setData] = useState<Awaited<ReturnType<typeof customersApi.list>>["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<CustomerExportFormat>("pdf");
  const [submitting, setSubmitting] = useState(false);
  const [preparingFormId, setPreparingFormId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formCustomer, setFormCustomer] = useState<Customer | null>(null);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<{ id: string; name: string } | null>(null);
  const [paymentsCustomer, setPaymentsCustomer] = useState<{ id: string; name: string } | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [actionDialog, setActionDialog] = useState<{ type: "delete" | "status" | "blacklist"; customer: CustomerActionTarget } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canCreate = auth.hasPermission("customer.create");
  const canUpdate = auth.hasPermission("customer.update");
  const canDelete = auth.hasPermission("customer.delete");
  const canLedgerView = auth.hasPermission("customer.ledger.view");
  const canExport = auth.hasPermission("customer.export");
  const canPaymentsView = auth.hasPermission(["customer.view", "customer.ledger.view"]);

  const page = Number(searchParams.get("page") ?? "1") > 0 ? Number(searchParams.get("page") ?? "1") : 1;
  const statusParam = searchParams.get("status");
  const customerTypeParam = searchParams.get("customerType");
  const taxTypeParam = searchParams.get("taxType");
  const sortByParam = searchParams.get("sortBy");
  const sortOrderParam = searchParams.get("sortOrder");
  const status: CustomerStatus | "" = isCustomerStatus(statusParam) ? statusParam : "";
  const customerType: CustomerType | "" = isCustomerType(customerTypeParam) ? customerTypeParam : "";
  const taxType: TaxType | "" = isTaxType(taxTypeParam) ? taxTypeParam : "";
  const hasOutstanding = parseBooleanFilter(searchParams.get("hasOutstanding"));
  const isBlacklisted = parseBooleanFilter(searchParams.get("isBlacklisted"));
  const sortBy: CustomerSortBy = isSortBy(sortByParam) ? sortByParam : "createdAt";
  const sortOrder: SortOrder = isSortOrder(sortOrderParam) ? sortOrderParam : "desc";

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });

      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? "";
    if (debouncedSearch === currentSearch) {
      return;
    }

    updateQuery({
      search: debouncedSearch || null,
      page: "1",
    });
  }, [debouncedSearch, searchParams, updateQuery]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customersApi.list({
        page,
        limit: 20,
        search: searchParams.get("search") || undefined,
        status: status || undefined,
        customerType: customerType || undefined,
        taxType: taxType || undefined,
        hasOutstanding: hasOutstanding === "" ? undefined : hasOutstanding === "true",
        isBlacklisted: isBlacklisted === "" ? undefined : isBlacklisted === "true",
        sortBy,
        sortOrder,
      });
      setData(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  }, [customerType, hasOutstanding, isBlacklisted, page, searchParams, sortBy, sortOrder, status, taxType]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openCreateForm = () => {
    setFormCustomer(null);
    setFormOpen(true);
  };

  const openEditForm = async (customerId: string, seededCustomer?: Customer) => {
    if (seededCustomer) {
      setFormCustomer(seededCustomer);
      setFormOpen(true);
      return;
    }

    try {
      setPreparingFormId(customerId);
      const response = await customersApi.get(customerId);
      setFormCustomer(response.data.customer);
      setFormOpen(true);
    } catch (loadError) {
      toast.error(getErrorMessage(loadError, "Failed to load customer"));
    } finally {
      setPreparingFormId(null);
    }
  };

  const openDetail = (customer: CustomerListItem) => {
    setDetailCustomerId(customer.id);
  };

  const openLedger = (customer: { id: string; name: string }) => {
    setDetailCustomerId(null);
    setPaymentsCustomer(null);
    setLedgerCustomer({ id: customer.id, name: customer.name });
  };

  const openPayments = (customer: { id: string; name: string }) => {
    setDetailCustomerId(null);
    setLedgerCustomer(null);
    setPaymentsCustomer({ id: customer.id, name: customer.name });
  };

  const refreshAfterMutation = async (customerId?: string) => {
    await loadCustomers();

    if (customerId && detailCustomerId === customerId) {
      setDetailReloadKey((value) => value + 1);
    }
  };

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            {canExport ? (
              <>
                <Select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as CustomerExportFormat)}
                  className="w-24 shrink-0"
                >
                  <option value="xlsx">XLSX</option>
                  <option value="pdf">PDF</option>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  loading={exporting}
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const file = await customersApi.exportList({
                        page,
                        limit: 20,
                        search: searchParams.get("search") || undefined,
                        status: status || undefined,
                        customerType: customerType || undefined,
                        taxType: taxType || undefined,
                        hasOutstanding: hasOutstanding === "" ? undefined : hasOutstanding === "true",
                        isBlacklisted: isBlacklisted === "" ? undefined : isBlacklisted === "true",
                        sortBy,
                        sortOrder,
                        format: exportFormat,
                      });
                      saveDownloadedFile(file.blob, file.fileName);
                      toast.success("Customer list exported");
                    } catch (exportError) {
                      toast.error(getErrorMessage(exportError, "Failed to export customer list"));
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
            {canCreate ? (
              <Button type="button" className="min-w-[172px] whitespace-nowrap" onClick={openCreateForm}>
                <Plus className="mr-2 size-4" />
                Add Customer
              </Button>
            ) : null}
          </div>
        }
      />

      <CustomerFilters
        search={searchInput}
        values={{
          status: status || "",
          customerType: customerType || "",
          taxType: taxType || "",
          hasOutstanding,
          isBlacklisted,
          sortBy,
          sortOrder,
        }}
        onSearchChange={setSearchInput}
        onChange={(values) =>
          updateQuery({
            status: values.status !== undefined ? values.status || null : status || null,
            customerType: values.customerType !== undefined ? values.customerType || null : customerType || null,
            taxType: values.taxType !== undefined ? values.taxType || null : taxType || null,
            hasOutstanding: values.hasOutstanding !== undefined ? values.hasOutstanding || null : hasOutstanding || null,
            isBlacklisted: values.isBlacklisted !== undefined ? values.isBlacklisted || null : isBlacklisted || null,
            sortBy: values.sortBy ?? sortBy,
            sortOrder: values.sortOrder ?? sortOrder,
            page: "1",
          })
        }
        onReset={() => {
          setSearchInput("");
          setSearchParams(new URLSearchParams());
        }}
      />

      {loading && !data ? (
        <CustomerTableSkeleton />
      ) : error && !data ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
            <Button type="button" variant="secondary" onClick={() => void loadCustomers()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !rows.length ? (
        <EmptyState
          title="No customers found"
          action={
            canCreate ? (
              <Button type="button" onClick={openCreateForm}>
                <Plus className="mr-2 size-4" />
                Add Customer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <TableWrapper className="border-none overflow-x-visible">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Customer Code", "Name", "Mobile", "GST Number", "Type", "Outstanding", "Credit Limit", "Status", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {rows.map((item) => {
                  const actionCustomer: CustomerActionTarget = {
                    id: item.id,
                    name: item.name,
                    status: item.status,
                    isBlacklisted: item.isBlacklisted,
                  };

                  return (
                    <tr key={item.id} className="cursor-pointer transition hover:bg-slate-50" onDoubleClick={() => openDetail(item)}>
                      <td className="px-5 py-4 font-medium text-slate-900 break-words">{item.customerCode}</td>
                      <td className="px-5 py-4 break-words">
                        <p className="font-medium text-slate-900 break-words">{item.name}</p>
                      </td>
                      <td className="px-5 py-4 break-words">{item.mobile}</td>
                      <td className="px-5 py-4 break-words">{item.gstNumber || "-"}</td>
                      <td className="px-5 py-4 break-words">{CUSTOMER_TYPE_LABELS[item.customerType]}</td>
                      <td className="px-5 py-4">
                        <AmountText value={item.outstandingAmount} tone={Number(item.outstandingAmount) > 0 ? "success" : "default"} />
                      </td>
                      <td className="px-5 py-4">{formatInr(item.creditLimit)}</td>
                      <td className="px-4 py-4">
                        <Badge tone={toneForStatus(item.status)}>{CUSTOMER_STATUS_LABELS[item.status]}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-nowrap items-center justify-start gap-1 whitespace-nowrap">
                          <TableActionIconButton label="View customer" icon={<Eye className="size-4" />} onClick={() => openDetail(item)} />
                          {canUpdate ? (
                            <TableActionIconButton
                              label="Edit customer"
                              icon={<Pencil className="size-4" />}
                              disabled={preparingFormId === item.id}
                              onClick={() => void openEditForm(item.id)}
                            />
                          ) : null}
                          {canLedgerView ? (
                            <TableActionIconButton label="View ledger" icon={<FileText className="size-4" />} onClick={() => openLedger(item)} />
                          ) : null}
                          {canPaymentsView ? (
                            <TableActionIconButton
                              label="View payments"
                              icon={<ReceiptText className="size-4" />}
                              onClick={() => openPayments(item)}
                            />
                          ) : null}
                          {canUpdate ? (
                            <TableActionIconButton
                              label={item.isBlacklisted ? "Remove blacklist" : "Blacklist customer"}
                              icon={<Ban className="size-4" />}
                              onClick={() => setActionDialog({ type: "blacklist", customer: actionCustomer })}
                            />
                          ) : null}
                          {canDelete ? (
                            <TableActionIconButton
                              label="Delete customer"
                              tone="danger"
                              icon={<Trash2 className="size-4" />}
                              onClick={() => setActionDialog({ type: "delete", customer: actionCustomer })}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>
          {data?.pagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing {rows.length} of {data.pagination.total} customers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={data.pagination.page <= 1}
                  onClick={() => updateQuery({ page: String(data.pagination.page - 1) })}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-500">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  onClick={() => updateQuery({ page: String(data.pagination.page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      <CustomerFormDrawer
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setFormCustomer(null);
        }}
        initialCustomer={formCustomer}
        submitting={submitting}
        onSubmit={async (values, setError) => {
          try {
            setSubmitting(true);

            if (formCustomer) {
              await customersApi.update(formCustomer.id, createCustomerUpdatePayload(values));

              if (values.status !== formCustomer.status) {
                await customersApi.updateStatus(formCustomer.id, values.status);
              }

              if (values.isBlacklisted !== formCustomer.isBlacklisted) {
                await customersApi.updateBlacklist(formCustomer.id, {
                  isBlacklisted: values.isBlacklisted,
                  reason: values.blacklistReason,
                });
              }

              toast.success("Customer updated");
              await refreshAfterMutation(formCustomer.id);
            } else {
              const response = await customersApi.create(createCustomerPayload(values));

              if (values.isBlacklisted) {
                await customersApi.updateBlacklist(response.data.customer.id, {
                  isBlacklisted: true,
                  reason: values.blacklistReason,
                });
              }

              toast.success("Customer created");
              await refreshAfterMutation(response.data.customer.id);
            }

            setFormOpen(false);
            setFormCustomer(null);
          } catch (submitError) {
            applyFriendlyFieldErrors(submitError, setError);
            toast.error(getErrorMessage(submitError, "Failed to save customer"));
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <CustomerDetailDrawer
        open={Boolean(detailCustomerId)}
        customerId={detailCustomerId}
        reloadKey={detailReloadKey}
        onClose={() => setDetailCustomerId(null)}
        onEdit={(customer) => void openEditForm(customer.id, customer)}
        onOpenLedger={openLedger}
        onOpenPayments={openPayments}
        onExportLedger={async (customer) => {
          try {
            const file = await customersApi.exportLedger(customer.id, { format: exportFormat });
            saveDownloadedFile(file.blob, file.fileName);
            toast.success("Ledger exported");
          } catch (exportError) {
            toast.error(getErrorMessage(exportError, "Failed to export ledger"));
          }
        }}
        onToggleStatus={(customer) => setActionDialog({ type: "status", customer })}
        onToggleBlacklist={(customer) => setActionDialog({ type: "blacklist", customer })}
        onDelete={(customer) => setActionDialog({ type: "delete", customer })}
        canEdit={canUpdate}
        canDelete={canDelete}
        canViewLedger={canLedgerView}
        canViewPayments={canPaymentsView}
        canExport={canExport}
      />

      <CustomerLedgerDrawer
        open={Boolean(ledgerCustomer)}
        customerId={ledgerCustomer?.id ?? null}
        customerName={ledgerCustomer?.name ?? ""}
        onClose={() => setLedgerCustomer(null)}
        canExport={canExport}
        onExport={async () => {
          if (!ledgerCustomer) {
            return;
          }

          try {
            const file = await customersApi.exportLedger(ledgerCustomer.id, { format: exportFormat });
            saveDownloadedFile(file.blob, file.fileName);
            toast.success("Ledger exported");
          } catch (exportError) {
            toast.error(getErrorMessage(exportError, "Failed to export ledger"));
          }
        }}
      />

      <CustomerPaymentsDrawer
        open={Boolean(paymentsCustomer)}
        customerId={paymentsCustomer?.id ?? null}
        customerName={paymentsCustomer?.name ?? ""}
        onClose={() => setPaymentsCustomer(null)}
      />

      <ConfirmDialog
        open={Boolean(actionDialog)}
        loading={actionLoading}
        tone={actionDialog?.type === "delete" ? "danger" : "primary"}
        title={
          actionDialog?.type === "delete"
            ? "Delete Customer"
            : actionDialog?.type === "status"
              ? actionDialog.customer.status === "active"
                ? "Set Customer Inactive"
                : "Set Customer Active"
              : actionDialog?.customer.isBlacklisted
                ? "Remove Blacklist"
                : "Blacklist Customer"
        }
        description={
          actionDialog?.type === "delete"
            ? `Delete ${actionDialog.customer.name}?`
            : actionDialog?.type === "status"
              ? `Change ${actionDialog.customer.name} status?`
              : `${actionDialog?.customer.isBlacklisted ? "Remove blacklist for" : "Blacklist"} ${actionDialog?.customer.name}?`
        }
        onClose={() => setActionDialog(null)}
        onConfirm={async () => {
          if (!actionDialog) {
            return;
          }

          try {
            setActionLoading(true);

            if (actionDialog.type === "delete") {
              await customersApi.remove(actionDialog.customer.id);
              toast.success("Customer deleted");
              if (detailCustomerId === actionDialog.customer.id) {
                setDetailCustomerId(null);
              }
            } else if (actionDialog.type === "status") {
              const nextStatus: CustomerMutableStatus =
                actionDialog.customer.status === "active" ? "inactive" : "active";
              await customersApi.updateStatus(actionDialog.customer.id, nextStatus);
              toast.success("Customer status updated");
            } else {
              await customersApi.updateBlacklist(actionDialog.customer.id, {
                isBlacklisted: !actionDialog.customer.isBlacklisted,
              });
              toast.success(actionDialog.customer.isBlacklisted ? "Customer removed from blacklist" : "Customer blacklisted");
            }

            setActionDialog(null);
            await refreshAfterMutation(actionDialog.customer.id);
          } catch (actionError) {
            toast.error(getErrorMessage(actionError, "Failed to complete customer action"));
          } finally {
            setActionLoading(false);
          }
        }}
      />
    </div>
  );
};

