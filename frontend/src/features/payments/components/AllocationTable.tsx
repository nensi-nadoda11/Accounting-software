import { RotateCcw } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { formatDate } from "../../customers/customerUtils";
import type { DueItem, PaymentFormAllocationInput, PaymentType } from "../../../types/payment";
import {
  autoAllocateDueItems,
  findAllocatedAmount,
  getRemainingAmount,
  sortDueItemsOldestFirst,
  sumAllocationInputs,
} from "../paymentUtils";

const isOverdue = (dueDate: string | null) => (dueDate ? new Date(dueDate).getTime() < Date.now() : false);

export const AllocationTable = ({
  dueItems,
  allocations,
  amount,
  paymentDate,
  paymentType,
  disabled,
  error,
  advanceLabel,
  onChange,
}: {
  dueItems: DueItem[];
  allocations: PaymentFormAllocationInput[];
  amount: number;
  paymentDate: string;
  paymentType: PaymentType;
  disabled?: boolean;
  error?: string;
  advanceLabel: string;
  onChange: (nextAllocations: PaymentFormAllocationInput[]) => void;
}) => {
  const totalAllocated = sumAllocationInputs(allocations);
  const remainingAmount = getRemainingAmount(amount, allocations);

  const updateAllocation = (item: DueItem, nextValue: string) => {
    const parsedValue = Number(nextValue || 0);
    const clamped = Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 0;
    const otherAllocated = totalAllocated - findAllocatedAmount(allocations, item.referenceId);
    const nextAmount = Number(Math.min(Number(item.dueAmount), Math.max(amount - otherAllocated, 0), clamped).toFixed(2));
    const nextAllocations = allocations.filter((allocation) => allocation.referenceId !== item.referenceId);

    if (nextAmount > 0) {
      nextAllocations.push({
        allocationType: paymentType === "customer_receive" ? "sales_invoice" : "purchase_invoice",
        referenceId: item.referenceId,
        referenceNumber: item.referenceNumber,
        allocatedAmount: nextAmount,
        allocationDate: paymentDate,
      });
    }

    onChange(sortDueItemsOldestFirst(dueItems).flatMap((dueItem) => nextAllocations.filter((allocation) => allocation.referenceId === dueItem.referenceId)));
  };

  return (
    <Card>
      <CardHeader
        title="Allocations"
        action={
          <Button
            type="button"
            variant="secondary"
            className="h-9 px-3"
            disabled={disabled || !dueItems.length}
            onClick={() => onChange(autoAllocateDueItems(dueItems, amount, paymentType, paymentDate))}
          >
            <RotateCcw className="mr-2 size-4" />
            Auto Allocate
          </Button>
        }
      />
      <CardContent className="space-y-3">
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Payment Amount</p>
            <div className="mt-1">
              <AmountText value={amount} />
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Allocated</p>
            <div className="mt-1">
              <AmountText value={totalAllocated} />
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{advanceLabel}</p>
            <div className="mt-1">
              <AmountText value={remainingAmount} tone="warning" />
            </div>
          </div>
        </div>

        {dueItems.length ? (
          <TableWrapper className="border-slate-200">
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Reference No", "Date", "Due Date", "Total", "Paid", "Due", "Allocate Amount", "Status"].map((head) => (
                      <th key={head} className="px-3 py-2.5 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                  {sortDueItemsOldestFirst(dueItems).map((item) => {
                    const allocatedValue = findAllocatedAmount(allocations, item.referenceId);
                    const overdue = isOverdue(item.dueDate);

                    return (
                      <tr key={item.referenceId} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-900">{item.referenceNumber}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDate(item.invoiceDate)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDate(item.dueDate)}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><AmountText value={item.grandTotal} /></td>
                        <td className="px-3 py-3 whitespace-nowrap"><AmountText value={item.paidAmount} /></td>
                        <td className="px-3 py-3 whitespace-nowrap"><AmountText value={item.dueAmount} tone="danger" /></td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={disabled}
                            value={allocatedValue || ""}
                            className="h-9 w-28 rounded-lg border border-slate-200 px-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-50"
                            onChange={(event) => updateAllocation(item, event.target.value)}
                            aria-label={`Allocate amount for ${item.referenceNumber}`}
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusBadge status={overdue ? "overdue" : "active"} label={overdue ? "Overdue" : "Open"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </TableWrapper>
        ) : (
          <EmptyState title="No due items found" />
        )}

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
};
