import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  ShoppingBag,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { AmountText } from "../../components/ui/AmountText";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIconButton } from "../../components/ui/TableActionIconButton";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { suppliersApi } from "../../services/suppliersApi";
import type {
  SortOrder,
  Supplier,
  SupplierListItem,
  SupplierMutableStatus,
  SupplierSortBy,
  SupplierStatus,
  SupplierType,
  TaxType,
} from "../../types/supplier";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { SupplierDetailDrawer } from "./components/SupplierDetailDrawer";
import { SupplierFilters } from "./components/SupplierFilters";
import { SupplierFormDrawer } from "./components/SupplierFormDrawer";
import { SupplierLedgerDrawer } from "./components/SupplierLedgerDrawer";
import { SupplierPaymentsDrawer } from "./components/SupplierPaymentsDrawer";
import { SupplierPurchasesDrawer } from "./components/SupplierPurchasesDrawer";
import {
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TAX_TYPE_LABELS,
} from "./supplierOptions";
import {
  applyFriendlyFieldErrors,
  createSupplierPayload,
  createSupplierUpdatePayload,
  getTaxTypeTone,
  saveDownloadedFile,
} from "./supplierUtils";

type InternalTab = "suppliers" | "ledger" | "purchases" | "payments";
type SupplierActionTarget = Pick<Supplier, "id" | "name" | "status" | "isBlacklisted" | "isPreferred">;
type ActionDialogState =
  | { type: "delete"; supplier: SupplierActionTarget }
  | { type: "blacklist"; supplier: SupplierActionTarget }
  | { type: "status"; supplier: SupplierActionTarget; nextStatus: SupplierMutableStatus };

const isSupplierStatus = (value: string | null): value is SupplierStatus =>
  value === "active" || value === "inactive" || value === "blocked" || value === "deleted";

const isSupplierType = (value: string | null): value is SupplierType =>
  value === "individual" || value === "business" || value === "manufacturer" || value === "distributor" || value === "wholesaler";

const isTaxType = (value: string | null): value is TaxType =>
  value === "registered" || value === "unregistered" || value === "composition";

const isSortBy = (value: string | null): value is SupplierSortBy =>
  value === "name" || value === "createdAt" || value === "outstandingPayable" || value === "supplierCode";

const isSortOrder = (value: string | null): value is SortOrder => value === "asc" || value === "desc";

const parseBooleanFilter = (value: string | null): "" | "true" | "false" =>
  value === "true" || value === "false" ? value : "";

const SupplierTableSkeleton = () => (
  <Card>
    <TableWrapper className="border-none">
      <Table>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Supplier Code", "Supplier Name", "Mobile", "GST Number", "Type", "Outstanding Payable", "Credit Days", "Status", "Actions"].map((head) => (
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

export const SuppliersPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [data, setData] = useState<Awaited<ReturnType<typeof suppliersApi.list>>["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparingFormId, setPreparingFormId] = useState<string | null>(null);
  const [activeInternalTab, setActiveInternalTab] = useState<InternalTab>("suppliers");
  const [focusedSupplier, setFocusedSupplier] = useState<{ id: string; name: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSupplier, setFormSupplier] = useState<Supplier | null>(null);
  const [detailSupplierId, setDetailSupplierId] = useState<string | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<{ id: string; name: string } | null>(null);
  const [purchasesSupplier, setPurchasesSupplier] = useState<{ id: string; name: string } | null>(null);
  const [paymentsSupplier, setPaymentsSupplier] = useState<{ id: string; name: string } | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [preferredActionId, setPreferredActionId] = useState<string | null>(null);

  const canCreate = auth.hasPermission("supplier.create");
  const canUpdate = auth.hasPermission("supplier.update");
  const canDelete = auth.hasPermission("supplier.delete");
  const canLedgerView = auth.hasPermission("supplier.ledger.view");
  const canExport = auth.hasPermission("supplier.export");
  const canViewPurchases = auth.hasPermission("supplier.view");
  const canViewPayments = auth.hasPermission(["supplier.view", "supplier.ledger.view"]);

  const pageValue = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const statusParam = searchParams.get("status");
  const supplierTypeParam = searchParams.get("supplierType");
  const taxTypeParam = searchParams.get("taxType");
  const sortByParam = searchParams.get("sortBy");
  const sortOrderParam = searchParams.get("sortOrder");
  const status: SupplierStatus | "" = isSupplierStatus(statusParam) ? statusParam : "";
  const supplierType: SupplierType | "" = isSupplierType(supplierTypeParam) ? supplierTypeParam : "";
  const taxType: TaxType | "" = isTaxType(taxTypeParam) ? taxTypeParam : "";
  const hasOutstanding = parseBooleanFilter(searchParams.get("hasOutstanding"));
  const isBlacklisted = parseBooleanFilter(searchParams.get("isBlacklisted"));
  const isPreferred = parseBooleanFilter(searchParams.get("isPreferred"));
  const sortBy: SupplierSortBy = isSortBy(sortByParam) ? sortByParam : "createdAt";
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

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await suppliersApi.list({
        page,
        limit: 20,
        search: searchParams.get("search") || undefined,
        status: status || undefined,
        supplierType: supplierType || undefined,
        taxType: taxType || undefined,
        hasOutstanding: hasOutstanding === "" ? undefined : hasOutstanding === "true",
        isBlacklisted: isBlacklisted === "" ? undefined : isBlacklisted === "true",
        isPreferred: isPreferred === "" ? undefined : isPreferred === "true",
        sortBy,
        sortOrder,
      });
      setData(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load suppliers"));
    } finally {
      setLoading(false);
    }
  }, [hasOutstanding, isBlacklisted, isPreferred, page, searchParams, sortBy, sortOrder, status, supplierType, taxType]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const openCreateForm = () => {
    setFormSupplier(null);
    setFormOpen(true);
  };

  const openEditForm = async (supplierId: string, seededSupplier?: Supplier) => {
    if (seededSupplier) {
      setFormSupplier(seededSupplier);
      setFormOpen(true);
      return;
    }

    try {
      setPreparingFormId(supplierId);
      const response = await suppliersApi.get(supplierId);
      setFormSupplier(response.data.supplier);
      setFormOpen(true);
    } catch (loadError) {
      toast.error(getErrorMessage(loadError, "Failed to load supplier"));
    } finally {
      setPreparingFormId(null);
    }
  };

  const openDetail = (supplier: SupplierListItem) => {
    setFocusedSupplier({ id: supplier.id, name: supplier.name });
    setActiveInternalTab("suppliers");
    setLedgerSupplier(null);
    setPurchasesSupplier(null);
    setPaymentsSupplier(null);
    setDetailSupplierId(supplier.id);
  };

  const openLedger = (supplier: { id: string; name: string }) => {
    setFocusedSupplier({ id: supplier.id, name: supplier.name });
    setActiveInternalTab("ledger");
    setDetailSupplierId(null);
    setPurchasesSupplier(null);
    setPaymentsSupplier(null);
    setLedgerSupplier({ id: supplier.id, name: supplier.name });
  };

  const openPurchases = (supplier: { id: string; name: string }) => {
    setFocusedSupplier({ id: supplier.id, name: supplier.name });
    setActiveInternalTab("purchases");
    setDetailSupplierId(null);
    setLedgerSupplier(null);
    setPaymentsSupplier(null);
    setPurchasesSupplier({ id: supplier.id, name: supplier.name });
  };

  const openPayments = (supplier: { id: string; name: string }) => {
    setFocusedSupplier({ id: supplier.id, name: supplier.name });
    setActiveInternalTab("payments");
    setDetailSupplierId(null);
    setLedgerSupplier(null);
    setPurchasesSupplier(null);
    setPaymentsSupplier({ id: supplier.id, name: supplier.name });
  };

  const closeSecondaryDrawers = () => {
    setDetailSupplierId(null);
    setLedgerSupplier(null);
    setPurchasesSupplier(null);
    setPaymentsSupplier(null);
    setActiveInternalTab("suppliers");
  };

  const refreshAfterMutation = async (supplierId?: string) => {
    await loadSuppliers();

    if (supplierId && detailSupplierId === supplierId) {
      setDetailReloadKey((value) => value + 1);
    }
  };

  const togglePreferred = async (supplier: SupplierActionTarget) => {
    try {
      setPreferredActionId(supplier.id);
      await suppliersApi.updatePreferred(supplier.id, { isPreferred: !supplier.isPreferred });
      toast.success(supplier.isPreferred ? "Supplier removed from preferred" : "Supplier marked preferred");
      await refreshAfterMutation(supplier.id);
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, "Failed to update supplier preference"));
    } finally {
      setPreferredActionId(null);
    }
  };

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
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
                    const file = await suppliersApi.exportList({
                      page,
                      limit: 20,
                      search: searchParams.get("search") || undefined,
                      status: status || undefined,
                      supplierType: supplierType || undefined,
                      taxType: taxType || undefined,
                      hasOutstanding: hasOutstanding === "" ? undefined : hasOutstanding === "true",
                      isBlacklisted: isBlacklisted === "" ? undefined : isBlacklisted === "true",
                      isPreferred: isPreferred === "" ? undefined : isPreferred === "true",
                      sortBy,
                      sortOrder,
                    });
                    saveDownloadedFile(file.blob, file.fileName);
                    toast.success("Supplier list exported");
                  } catch (exportError) {
                    toast.error(getErrorMessage(exportError, "Failed to export supplier list"));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="mr-2 size-4" />
                Export
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" onClick={openCreateForm}>
                <Plus className="mr-2 size-4" />
                Add Supplier
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          {(["suppliers", "ledger", "purchases", "payments"] as InternalTab[]).map((tab) => {
            const disabled =
              tab === "ledger"
                ? !focusedSupplier || !canLedgerView
                : tab === "purchases"
                  ? !focusedSupplier || !canViewPurchases
                  : tab === "payments"
                    ? !focusedSupplier || !canViewPayments
                    : false;

            return (
              <button
                key={tab}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (tab === "suppliers") {
                    closeSecondaryDrawers();
                    return;
                  }

                  if (!focusedSupplier) {
                    return;
                  }

                  if (tab === "ledger") {
                    openLedger(focusedSupplier);
                    return;
                  }

                  if (tab === "purchases") {
                    openPurchases(focusedSupplier);
                    return;
                  }

                  openPayments(focusedSupplier);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeInternalTab === tab
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {tab === "suppliers" ? "Suppliers" : tab === "ledger" ? "Ledger" : tab === "purchases" ? "Purchases" : "Payments"}
              </button>
            );
          })}
          {focusedSupplier ? <span className="text-sm text-slate-500">{focusedSupplier.name}</span> : null}
        </CardContent>
      </Card>

      <SupplierFilters
        search={searchInput}
        values={{
          status: status || "",
          supplierType: supplierType || "",
          taxType: taxType || "",
          hasOutstanding,
          isBlacklisted,
          isPreferred,
          sortBy,
          sortOrder,
        }}
        onSearchChange={setSearchInput}
        onChange={(values) =>
          updateQuery({
            status: values.status !== undefined ? values.status || null : status || null,
            supplierType: values.supplierType !== undefined ? values.supplierType || null : supplierType || null,
            taxType: values.taxType !== undefined ? values.taxType || null : taxType || null,
            hasOutstanding: values.hasOutstanding !== undefined ? values.hasOutstanding || null : hasOutstanding || null,
            isBlacklisted: values.isBlacklisted !== undefined ? values.isBlacklisted || null : isBlacklisted || null,
            isPreferred: values.isPreferred !== undefined ? values.isPreferred || null : isPreferred || null,
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
        <SupplierTableSkeleton />
      ) : error && !data ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
            <Button type="button" variant="secondary" onClick={() => void loadSuppliers()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !rows.length ? (
        <EmptyState
          title="No suppliers found"
          action={
            canCreate ? (
              <Button type="button" onClick={openCreateForm}>
                <Plus className="mr-2 size-4" />
                Add Supplier
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Supplier Code", "Supplier Name", "Mobile", "GST Number", "Type", "Outstanding Payable", "Credit Days", "Status", "Actions"].map((head) => (
                      <th key={head} className="px-5 py-3 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                  {rows.map((item) => {
                    const actionSupplier: SupplierActionTarget = {
                      id: item.id,
                      name: item.name,
                      status: item.status,
                      isBlacklisted: item.isBlacklisted,
                      isPreferred: item.isPreferred,
                    };

                    return (
                      <tr key={item.id} className="cursor-pointer transition hover:bg-slate-50" onDoubleClick={() => openDetail(item)}>
                        <td className="px-5 py-4 font-medium text-slate-900">{item.supplierCode}</td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone={getTaxTypeTone(item.taxType)}>{SUPPLIER_TAX_TYPE_LABELS[item.taxType]}</Badge>
                              {item.isBlacklisted ? <Badge tone="danger">Blacklisted</Badge> : null}
                              {item.isPreferred ? <Badge tone="warning">Preferred</Badge> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.mobile}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.gstNumber || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Badge tone="neutral">{SUPPLIER_TYPE_LABELS[item.supplierType]}</Badge>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <AmountText
                            value={item.outstandingSummary.outstandingPayable}
                            tone={Number(item.outstandingSummary.outstandingPayable) > 0 ? "success" : "default"}
                          />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.creditDays}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={item.status} label={SUPPLIER_STATUS_LABELS[item.status]} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <TableActionIconButton label="View supplier" icon={<Eye className="size-4" />} onClick={() => openDetail(item)} />
                            {canUpdate ? (
                              <TableActionIconButton
                                label="Edit supplier"
                                icon={<Pencil className="size-4" />}
                                disabled={preparingFormId === item.id}
                                onClick={() => void openEditForm(item.id)}
                              />
                            ) : null}
                            {canLedgerView ? (
                              <TableActionIconButton label="View ledger" icon={<FileText className="size-4" />} onClick={() => openLedger(item)} />
                            ) : null}
                            {canViewPurchases ? (
                              <TableActionIconButton
                                label="View purchase history"
                                icon={<ShoppingBag className="size-4" />}
                                onClick={() => openPurchases(item)}
                              />
                            ) : null}
                            {canViewPayments ? (
                              <TableActionIconButton
                                label="View payments"
                                icon={<Wallet className="size-4" />}
                                onClick={() => openPayments(item)}
                              />
                            ) : null}
                            {canUpdate ? (
                              <TableActionIconButton
                                label={item.isBlacklisted ? "Remove blacklist" : "Blacklist supplier"}
                                icon={<Ban className="size-4" />}
                                onClick={() => setActionDialog({ type: "blacklist", supplier: actionSupplier })}
                              />
                            ) : null}
                            {canUpdate ? (
                              <TableActionIconButton
                                label={item.isPreferred ? "Remove preferred" : "Mark preferred"}
                                icon={<Star className="size-4" fill={item.isPreferred ? "currentColor" : "none"} />}
                                disabled={preferredActionId === item.id}
                                onClick={() => void togglePreferred(actionSupplier)}
                              />
                            ) : null}
                            {canDelete ? (
                              <TableActionIconButton
                                label="Delete supplier"
                                tone="danger"
                                icon={<Trash2 className="size-4" />}
                                onClick={() => setActionDialog({ type: "delete", supplier: actionSupplier })}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </TableWrapper>
          {data?.pagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing {rows.length} of {data.pagination.total} suppliers
              </p>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(nextPage) => updateQuery({ page: String(nextPage) })} />
            </div>
          ) : null}
        </Card>
      )}

      <SupplierFormDrawer
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setFormSupplier(null);
        }}
        initialSupplier={formSupplier}
        submitting={submitting}
        onSubmit={async (values, setError) => {
          try {
            setSubmitting(true);

            if (formSupplier) {
              await suppliersApi.update(formSupplier.id, createSupplierUpdatePayload(values));

              if (values.status !== formSupplier.status) {
                await suppliersApi.updateStatus(formSupplier.id, values.status);
              }

              if (values.isBlacklisted !== formSupplier.isBlacklisted) {
                await suppliersApi.updateBlacklist(formSupplier.id, {
                  isBlacklisted: values.isBlacklisted,
                  reason: values.blacklistReason,
                });
              }

              if (values.isPreferred !== formSupplier.isPreferred) {
                await suppliersApi.updatePreferred(formSupplier.id, { isPreferred: values.isPreferred });
              }

              toast.success("Supplier updated");
              await refreshAfterMutation(formSupplier.id);
            } else {
              const response = await suppliersApi.create(createSupplierPayload(values));

              if (values.isBlacklisted) {
                await suppliersApi.updateBlacklist(response.data.supplier.id, {
                  isBlacklisted: true,
                  reason: values.blacklistReason,
                });
              }

              toast.success("Supplier created");
              await refreshAfterMutation(response.data.supplier.id);
            }

            setFormOpen(false);
            setFormSupplier(null);
          } catch (submitError) {
            applyFriendlyFieldErrors(submitError, setError);
            toast.error(getErrorMessage(submitError, "Failed to save supplier"));
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <SupplierDetailDrawer
        open={Boolean(detailSupplierId)}
        supplierId={detailSupplierId}
        reloadKey={detailReloadKey}
        onClose={() => setDetailSupplierId(null)}
        onEdit={(supplier) => void openEditForm(supplier.id, supplier)}
        onOpenLedger={openLedger}
        onOpenPurchases={openPurchases}
        onOpenPayments={openPayments}
        onExportLedger={async (supplier) => {
          try {
            const file = await suppliersApi.exportLedger(supplier.id, {});
            saveDownloadedFile(file.blob, file.fileName);
            toast.success("Ledger exported");
          } catch (exportError) {
            toast.error(getErrorMessage(exportError, "Failed to export ledger"));
          }
        }}
        onSetStatus={(supplier, nextStatus) => setActionDialog({ type: "status", supplier, nextStatus })}
        onToggleBlacklist={(supplier) => setActionDialog({ type: "blacklist", supplier })}
        onTogglePreferred={async (supplier) => {
          await togglePreferred(supplier);
        }}
        onDelete={(supplier) => setActionDialog({ type: "delete", supplier })}
        canEdit={canUpdate}
        canDelete={canDelete}
        canViewLedger={canLedgerView}
        canViewPurchases={canViewPurchases}
        canViewPayments={canViewPayments}
        canExport={canExport}
      />

      <SupplierLedgerDrawer
        open={Boolean(ledgerSupplier)}
        supplierId={ledgerSupplier?.id ?? null}
        supplierName={ledgerSupplier?.name ?? ""}
        onClose={() => {
          setLedgerSupplier(null);
          setActiveInternalTab("suppliers");
        }}
        canExport={canExport}
        onExport={async (filters) => {
          if (!ledgerSupplier) {
            return;
          }

          try {
            const file = await suppliersApi.exportLedger(ledgerSupplier.id, filters);
            saveDownloadedFile(file.blob, file.fileName);
            toast.success("Ledger exported");
          } catch (exportError) {
            toast.error(getErrorMessage(exportError, "Failed to export ledger"));
          }
        }}
      />

      <SupplierPurchasesDrawer
        open={Boolean(purchasesSupplier)}
        supplierId={purchasesSupplier?.id ?? null}
        supplierName={purchasesSupplier?.name ?? ""}
        onClose={() => {
          setPurchasesSupplier(null);
          setActiveInternalTab("suppliers");
        }}
      />

      <SupplierPaymentsDrawer
        open={Boolean(paymentsSupplier)}
        supplierId={paymentsSupplier?.id ?? null}
        supplierName={paymentsSupplier?.name ?? ""}
        onClose={() => {
          setPaymentsSupplier(null);
          setActiveInternalTab("suppliers");
        }}
      />

      <ConfirmDialog
        open={Boolean(actionDialog)}
        loading={actionLoading}
        tone={actionDialog?.type === "delete" ? "danger" : "primary"}
        title={
          actionDialog?.type === "delete"
            ? "Delete Supplier"
            : actionDialog?.type === "status"
              ? `Set Supplier ${actionDialog.nextStatus === "active" ? "Active" : actionDialog.nextStatus === "inactive" ? "Inactive" : "Blocked"}`
              : actionDialog?.supplier.isBlacklisted
                ? "Remove Blacklist"
                : "Blacklist Supplier"
        }
        description={
          actionDialog?.type === "delete"
            ? `Delete ${actionDialog.supplier.name}?`
            : actionDialog?.type === "status"
              ? `Change ${actionDialog.supplier.name} status to ${actionDialog.nextStatus}?`
              : `${actionDialog?.supplier.isBlacklisted ? "Remove blacklist for" : "Blacklist"} ${actionDialog?.supplier.name}?`
        }
        onClose={() => setActionDialog(null)}
        onConfirm={async () => {
          if (!actionDialog) {
            return;
          }

          try {
            setActionLoading(true);

            if (actionDialog.type === "delete") {
              await suppliersApi.remove(actionDialog.supplier.id);
              toast.success("Supplier deleted");
              if (detailSupplierId === actionDialog.supplier.id) {
                setDetailSupplierId(null);
              }
            } else if (actionDialog.type === "status") {
              await suppliersApi.updateStatus(actionDialog.supplier.id, actionDialog.nextStatus);
              toast.success("Supplier status updated");
            } else {
              await suppliersApi.updateBlacklist(actionDialog.supplier.id, {
                isBlacklisted: !actionDialog.supplier.isBlacklisted,
              });
              toast.success(actionDialog.supplier.isBlacklisted ? "Supplier removed from blacklist" : "Supplier blacklisted");
            }

            setActionDialog(null);
            await refreshAfterMutation(actionDialog.supplier.id);
          } catch (actionError) {
            toast.error(getErrorMessage(actionError, "Failed to complete supplier action"));
          } finally {
            setActionLoading(false);
          }
        }}
      />
    </div>
  );
};
