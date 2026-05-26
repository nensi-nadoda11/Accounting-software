import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Download, FileText, Pencil, ShoppingBag, Star, Trash2, Wallet } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { suppliersApi } from "../../../services/suppliersApi";
import type {
  Supplier,
  SupplierDetailResponse,
  SupplierLedgerResponse,
  SupplierPaymentsResponse,
  SupplierPurchasesResponse,
} from "../../../types/supplier";
import {
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TAX_TYPE_LABELS,
  SUPPLIER_TYPE_LABELS,
} from "../supplierOptions";
import {
  formatAddress,
  formatDate,
  formatDateTime,
  formatInr,
  getPurchaseInvoiceLabel,
  getPurchaseTotalAmount,
  getTaxTypeTone,
  toProfileCards,
} from "../supplierUtils";

export const SupplierDetailDrawer = ({
  open,
  supplierId,
  reloadKey,
  onClose,
  onEdit,
  onOpenLedger,
  onOpenPurchases,
  onOpenPayments,
  onExportLedger,
  onSetStatus,
  onToggleBlacklist,
  onTogglePreferred,
  onDelete,
  canEdit,
  canDelete,
  canViewLedger,
  canViewPurchases,
  canViewPayments,
  canExport,
}: {
  open: boolean;
  supplierId: string | null;
  reloadKey: number;
  onClose: () => void;
  onEdit: (supplier: Supplier) => void;
  onOpenLedger: (supplier: Supplier) => void;
  onOpenPurchases: (supplier: Supplier) => void;
  onOpenPayments: (supplier: Supplier) => void;
  onExportLedger: (supplier: Supplier) => void;
  onSetStatus: (supplier: Supplier, nextStatus: "active" | "inactive" | "blocked") => void;
  onToggleBlacklist: (supplier: Supplier) => void;
  onTogglePreferred: (supplier: Supplier) => Promise<void>;
  onDelete: (supplier: Supplier) => void;
  canEdit: boolean;
  canDelete: boolean;
  canViewLedger: boolean;
  canViewPurchases: boolean;
  canViewPayments: boolean;
  canExport: boolean;
}) => {
  const [detail, setDetail] = useState<SupplierDetailResponse | null>(null);
  const [recentLedger, setRecentLedger] = useState<SupplierLedgerResponse | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<SupplierPurchasesResponse | null>(null);
  const [recentPayments, setRecentPayments] = useState<SupplierPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredLoading, setPreferredLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplierId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [detailResponse, ledgerResponse, purchasesResponse, paymentsResponse] = await Promise.all([
          suppliersApi.get(supplierId),
          canViewLedger ? suppliersApi.getLedger(supplierId, { page: 1, limit: 5 }) : Promise.resolve(null),
          canViewPurchases ? suppliersApi.getPurchases(supplierId, { page: 1, limit: 5 }) : Promise.resolve(null),
          canViewPayments ? suppliersApi.getPayments(supplierId, { page: 1, limit: 5 }) : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(detailResponse.data);
        setRecentLedger(ledgerResponse?.data ?? null);
        setRecentPurchases(purchasesResponse?.data ?? null);
        setRecentPayments(paymentsResponse?.data ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load supplier details"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canViewLedger, canViewPayments, canViewPurchases, open, reloadKey, supplierId]);

  const supplier = detail?.supplier ?? null;
  const outstanding = detail?.outstandingSummary ?? null;

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={supplier ? supplier.name : "Supplier Details"}
      className="max-w-6xl"
    >
      {loading && !detail ? (
        <LoadingState label="Loading supplier details..." />
      ) : error ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !supplier || !outstanding ? (
        <EmptyState title="Supplier details are unavailable" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{supplier.supplierCode}</Badge>
                <StatusBadge status={supplier.status} label={SUPPLIER_STATUS_LABELS[supplier.status]} />
                <Badge tone="neutral">{SUPPLIER_TYPE_LABELS[supplier.supplierType]}</Badge>
                <Badge tone={getTaxTypeTone(supplier.taxType)}>{SUPPLIER_TAX_TYPE_LABELS[supplier.taxType]}</Badge>
                {supplier.isBlacklisted ? <Badge tone="danger">Blacklisted</Badge> : null}
                {supplier.isPreferred ? <Badge tone="warning">Preferred</Badge> : null}
                {supplier.msmeRegistered ? <Badge tone="success">MSME</Badge> : null}
                {supplier.reverseChargeApplicable ? <Badge tone="warning">Reverse Charge</Badge> : null}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{supplier.name}</p>
                <p className="text-sm text-slate-500">
                  {supplier.businessName || SUPPLIER_TYPE_LABELS[supplier.supplierType]} • {SUPPLIER_TAX_TYPE_LABELS[supplier.taxType]}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button type="button" variant="secondary" onClick={() => onEdit(supplier)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              ) : null}
              {canViewLedger ? (
                <Button type="button" variant="secondary" onClick={() => onOpenLedger(supplier)}>
                  <FileText className="mr-2 size-4" />
                  Ledger
                </Button>
              ) : null}
              {canViewPurchases ? (
                <Button type="button" variant="secondary" onClick={() => onOpenPurchases(supplier)}>
                  <ShoppingBag className="mr-2 size-4" />
                  Purchases
                </Button>
              ) : null}
              {canViewPayments ? (
                <Button type="button" variant="secondary" onClick={() => onOpenPayments(supplier)}>
                  <Wallet className="mr-2 size-4" />
                  Payments
                </Button>
              ) : null}
              {canExport && canViewLedger ? (
                <Button type="button" variant="secondary" onClick={() => onExportLedger(supplier)}>
                  <Download className="mr-2 size-4" />
                  Export Ledger
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding Payable</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.outstandingPayable)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue Payable</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.overduePayable)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Limit</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.creditLimit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining Credit</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.remainingCreditLimit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Days</p>
                <p className="text-lg font-semibold text-slate-900">{outstanding.creditDays}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due Invoices</p>
                <p className="text-lg font-semibold text-slate-900">{outstanding.dueInvoicesCount}</p>
              </CardContent>
            </Card>
          </div>

          {outstanding.isCreditLimitExceeded ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              <AlertTriangle className="size-4" />
              Credit limit exceeded
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Profile Summary" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {toProfileCards(supplier).map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="GST / PAN / TAN" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "GST Number", value: supplier.gstNumber || "-" },
                  { label: "PAN Number", value: supplier.panNumber || "-" },
                  { label: "TAN Number", value: supplier.tanNumber || "-" },
                  { label: "GST State", value: supplier.gstState || "-" },
                  { label: "Created", value: formatDateTime(supplier.createdAt) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Address" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatAddress([
                      supplier.billingAddressLine1,
                      supplier.billingAddressLine2,
                      supplier.billingCity,
                      supplier.billingState,
                      supplier.billingPincode,
                      supplier.billingCountry,
                    ])}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatAddress([
                      supplier.shippingAddressLine1,
                      supplier.shippingAddressLine2,
                      supplier.shippingCity,
                      supplier.shippingState,
                      supplier.shippingPincode,
                      supplier.shippingCountry,
                    ])}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Bank Details" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Bank Name", value: supplier.bankName || "-" },
                  { label: "Account Holder", value: supplier.accountHolderName || "-" },
                  { label: "Account Number", value: supplier.accountNumber || "-" },
                  { label: "IFSC Code", value: supplier.ifscCode || "-" },
                  { label: "Branch", value: supplier.bankBranch || "-" },
                  { label: "UPI ID", value: supplier.upiId || "-" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="Recent Purchases" />
              <CardContent className="space-y-3">
                {!recentPurchases?.items.length ? (
                  <EmptyState title="No purchases found" />
                ) : (
                  <TableWrapper className="border-slate-100">
                    <Table>
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Invoice</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {recentPurchases.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">{getPurchaseInvoiceLabel(item)}</td>
                            <td className="px-4 py-3">{formatDate(item.date)}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {getPurchaseTotalAmount(item) ? formatInr(getPurchaseTotalAmount(item)) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Recent Payments" />
              <CardContent className="space-y-3">
                {!recentPayments?.items.length ? (
                  <EmptyState title="No payments found" />
                ) : (
                  <TableWrapper className="border-slate-100">
                    <Table>
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Reference</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {recentPayments.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">{formatDate(item.date)}</td>
                            <td className="px-4 py-3">{item.referenceNo || item.receiptNo || "-"}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{formatInr(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Recent Ledger" />
              <CardContent className="space-y-3">
                {!recentLedger?.items.length ? (
                  <EmptyState title="No ledger entries found" />
                ) : (
                  <TableWrapper className="border-slate-100">
                    <Table>
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {recentLedger.items.map((item, index) => (
                          <tr key={`${item.referenceNo ?? "entry"}-${index}`}>
                            <td className="px-4 py-3">{formatDate(item.date)}</td>
                            <td className="px-4 py-3">{item.description}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{formatInr(item.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>
          </div>

          {supplier.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardContent className="whitespace-pre-wrap text-sm text-slate-700">{supplier.notes}</CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canEdit && supplier.status !== "active" ? (
              <Button type="button" variant="secondary" onClick={() => onSetStatus(supplier, "active")}>
                Set Active
              </Button>
            ) : null}
            {canEdit && supplier.status === "active" ? (
              <Button type="button" variant="secondary" onClick={() => onSetStatus(supplier, "inactive")}>
                Set Inactive
              </Button>
            ) : null}
            {canEdit && supplier.status !== "blocked" ? (
              <Button type="button" variant="secondary" onClick={() => onSetStatus(supplier, "blocked")}>
                Block
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={() => onToggleBlacklist(supplier)}>
                <Ban className="mr-2 size-4" />
                {supplier.isBlacklisted ? "Remove Blacklist" : "Blacklist"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                loading={preferredLoading}
                onClick={async () => {
                  try {
                    setPreferredLoading(true);
                    await onTogglePreferred(supplier);
                  } finally {
                    setPreferredLoading(false);
                  }
                }}
              >
                <Star className="mr-2 size-4" fill={supplier.isPreferred ? "currentColor" : "none"} />
                {supplier.isPreferred ? "Remove Preferred" : "Mark Preferred"}
              </Button>
            ) : null}
            {canDelete ? (
              <Button type="button" variant="danger" onClick={() => onDelete(supplier)}>
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </SideSheet>
  );
};
