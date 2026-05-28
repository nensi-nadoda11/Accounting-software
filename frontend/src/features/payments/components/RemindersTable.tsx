import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { formatDate, formatDateTime } from "../../customers/customerUtils";
import type { PaymentRemindersResponse } from "../../../types/payment";
import { PAYMENT_REMINDER_CHANNEL_LABELS } from "../paymentOptions";

export const RemindersTable = ({
  data,
  loading,
  onPageChange,
}: {
  data: PaymentRemindersResponse | null;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No reminders found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Party", "Reference", "Due Date", "Amount", "Channel", "Status", "Sent At"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading && !data
                ? Array.from({ length: 8 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">{reminder.partyName ?? "-"}</td>
                      <td className="px-4 py-4">{reminder.referenceNumber ?? "-"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(reminder.dueDate)}</td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={reminder.amountDue} tone="danger" /></td>
                      <td className="px-4 py-4 whitespace-nowrap">{PAYMENT_REMINDER_CHANNEL_LABELS[reminder.channel]}</td>
                      <td className="px-4 py-4 whitespace-nowrap"><StatusBadge status={reminder.status} /></td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(reminder.sentAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </Table>
        </div>
      </TableWrapper>
      {data?.pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
          <p className="text-sm text-slate-500">
            Showing {data.items.length} of {data.pagination.total} reminders
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
