import { Eye, Play } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { TableActionIcons } from "../../../components/ui/TableActionIcons";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { AccountingEvent, AccountingEventsResponse } from "../../../types/accounting";
import { formatAccountingDateTime } from "../accountingUtils";

export const AccountingEventsTable = ({
  data,
  loading,
  canPost,
  postingId,
  onViewPayload,
  onPost,
  onPageChange,
}: {
  data: AccountingEventsResponse | null;
  loading: boolean;
  canPost: boolean;
  postingId: string | null;
  onViewPayload: (event: AccountingEvent) => void;
  onPost: (event: AccountingEvent) => void;
  onPageChange: (page: number) => void;
}) => {
  if (loading) {
    return <LoadingState label="Loading accounting events..." />;
  }

  if (!data) {
    return <EmptyState title="Events will appear here." />;
  }

  if (!data.items.length) {
    return <EmptyState title="No accounting events found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Event Type", "Reference", "Status", "Created At", "Posted At", "Error", "Actions"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.items.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{event.eventType}</td>
                <td className="px-4 py-3">{event.referenceType}</td>
                <td className="px-4 py-3"><Badge tone={event.status === "posted" ? "success" : event.status === "failed" ? "danger" : event.status === "ignored" ? "info" : "warning"}>{event.status}</Badge></td>
                <td className="px-4 py-3">{formatAccountingDateTime(event.createdAt)}</td>
                <td className="px-4 py-3">{formatAccountingDateTime(event.postedAt)}</td>
                <td className="max-w-56 px-4 py-3">{event.errorMessage ?? "-"}</td>
                <td className="px-4 py-3">
                  <TableActionIcons
                    actions={[
                      {
                        label: "View payload",
                        icon: <Eye className="size-4" />,
                        onClick: () => onViewPayload(event),
                      },
                      {
                        label: "Post event",
                        icon: <Play className="size-4" />,
                        onClick: () => onPost(event),
                        disabled: !canPost || event.status === "posted" || postingId === event.id,
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
