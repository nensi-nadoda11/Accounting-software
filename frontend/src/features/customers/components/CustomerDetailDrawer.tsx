import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Download, FileText, Pencil, ReceiptText, ShieldAlert, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { customersApi } from "../../../services/customersApi";
import type { Customer, CustomerDetailResponse, CustomerLedgerResponse, CustomerPaymentsResponse } from "../../../types/customer";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS, TAX_TYPE_LABELS } from "../customerOptions";
import { formatAddress, formatDate, formatDateTime, formatInr, formatPercent, toSummaryCards } from "../customerUtils";
import { CustomerSideSheet } from "./CustomerSideSheet";

const toneForStatus = (status: Customer["status"]) => {
  if (status === "active") {
    return "success";
  }

  if (status === "inactive") {
    return "warning";
  }

  return "danger";
};

export const CustomerDetailDrawer = ({
  open,
  customerId,
  reloadKey,
  onClose,
  onEdit,
  onOpenLedger,
  onOpenPayments,
  onExportLedger,
  onToggleStatus,
  onToggleBlacklist,
  onDelete,
  canEdit,
  canDelete,
  canViewLedger,
  canViewPayments,
  canExport,
}: {
  open: boolean;
  customerId: string | null;
  reloadKey: number;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onOpenLedger: (customer: Customer) => void;
  onOpenPayments: (customer: Customer) => void;
  onExportLedger: (customer: Customer) => void;
  onToggleStatus: (customer: Customer) => void;
  onToggleBlacklist: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  canEdit: boolean;
  canDelete: boolean;
  canViewLedger: boolean;
  canViewPayments: boolean;
  canExport: boolean;
}) => {
  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null);
  const [recentLedger, setRecentLedger] = useState<CustomerLedgerResponse | null>(null);
  const [recentPayments, setRecentPayments] = useState<CustomerPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customerId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [detailResponse, ledgerResponse, paymentsResponse] = await Promise.all([
          customersApi.get(customerId),
          canViewLedger
            ? customersApi.getLedger(customerId, { page: 1, limit: 5 })
            : Promise.resolve(null),
          canViewPayments
            ? customersApi.getPayments(customerId, { page: 1, limit: 5 })
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(detailResponse.data);
        setRecentLedger(ledgerResponse?.data ?? null);
        setRecentPayments(paymentsResponse?.data ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load customer details"));
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
  }, [canViewLedger, canViewPayments, customerId, open, reloadKey]);

  const customer = detail?.customer ?? null;
  const outstanding = detail?.outstandingSummary ?? null;

  return (
    <CustomerSideSheet
      open={open}
      onClose={onClose}
      title={customer ? customer.name : "Customer Details"}
      className="max-w-5xl"
    >
      {loading && !detail ? (
        <LoadingState label="Loading customer details..." />
      ) : error ? (
        <div className="space-y-4">
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !customer || !outstanding ? (
        <EmptyState title="Customer details are unavailable" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{customer.customerCode}</Badge>
                <Badge tone={toneForStatus(customer.status)}>{CUSTOMER_STATUS_LABELS[customer.status]}</Badge>
                <Badge tone="neutral">{CUSTOMER_TYPE_LABELS[customer.customerType]}</Badge>
                <Badge tone={customer.isBlacklisted ? "danger" : "success"}>
                  {customer.isBlacklisted ? "Blacklisted" : "Clear"}
                </Badge>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{customer.name}</p>
                <p className="text-sm text-slate-500">
                  {customer.businessName || CUSTOMER_TYPE_LABELS[customer.customerType]} • {TAX_TYPE_LABELS[customer.taxType]}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button type="button" variant="secondary" onClick={() => onEdit(customer)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              ) : null}
              {canViewLedger ? (
                <Button type="button" variant="secondary" onClick={() => onOpenLedger(customer)}>
                  <FileText className="mr-2 size-4" />
                  Ledger
                </Button>
              ) : null}
              {canViewPayments ? (
                <Button type="button" variant="secondary" onClick={() => onOpenPayments(customer)}>
                  <ReceiptText className="mr-2 size-4" />
                  Payments
                </Button>
              ) : null}
              {canExport && canViewLedger ? (
                <Button type="button" variant="secondary" onClick={() => onExportLedger(customer)}>
                  <Download className="mr-2 size-4" />
                  Export Ledger
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.outstandingAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.overdueAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Used</p>
                <p className="text-lg font-semibold text-slate-900">{formatPercent(outstanding.creditUsedPercentage)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining Credit</p>
                <p className="text-lg font-semibold text-slate-900">{formatInr(outstanding.remainingCreditLimit)}</p>
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
              <CardHeader title="Contact" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {toSummaryCards(customer).map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Credit Summary" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Limit</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatInr(outstanding.creditLimit)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Days</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{customer.creditDays}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(customer.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Billing Address" />
              <CardContent className="text-sm text-slate-700">
                {formatAddress([
                  customer.billingAddressLine1,
                  customer.billingAddressLine2,
                  customer.billingCity,
                  customer.billingState,
                  customer.billingPincode,
                  customer.billingCountry,
                ])}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Shipping Address" />
              <CardContent className="text-sm text-slate-700">
                {formatAddress([
                  customer.shippingAddressLine1,
                  customer.shippingAddressLine2,
                  customer.shippingCity,
                  customer.shippingState,
                  customer.shippingPincode,
                  customer.shippingCountry,
                ])}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
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
          </div>

          {customer.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardContent className="whitespace-pre-wrap text-sm text-slate-700">{customer.notes}</CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={() => onToggleStatus(customer)}>
                <ShieldAlert className="mr-2 size-4" />
                {customer.status === "active" ? "Set Inactive" : "Set Active"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={() => onToggleBlacklist(customer)}>
                <Ban className="mr-2 size-4" />
                {customer.isBlacklisted ? "Remove Blacklist" : "Blacklist"}
              </Button>
            ) : null}
            {canDelete ? (
              <Button type="button" variant="danger" onClick={() => onDelete(customer)}>
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </CustomerSideSheet>
  );
};
