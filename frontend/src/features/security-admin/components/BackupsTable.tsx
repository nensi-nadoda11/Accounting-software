import { Database, Download, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatPreferredDateTime } from "../../../lib/date-format";
import type { Backup, BackupFilters, PaginationMeta } from "../../../types/securityAdmin";

const formatBytes = (value: number | null) => {
  if (!value) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const BackupsTable = ({
  filters,
  onFiltersChange,
  backups,
  pagination,
  loading,
  canCreate,
  canDownload,
  canRestore,
  canDelete,
  downloadingId,
  restoringId,
  deletingId,
  onCreate,
  onDownload,
  onRestore,
  onDelete
}: {
  filters: BackupFilters;
  onFiltersChange: (value: Partial<BackupFilters>) => void;
  backups: Backup[];
  pagination: PaginationMeta | null;
  loading: boolean;
  canCreate: boolean;
  canDownload: boolean;
  canRestore: boolean;
  canDelete: boolean;
  downloadingId: string | null;
  restoringId: string | null;
  deletingId: string | null;
  onCreate: () => void;
  onDownload: (backup: Backup) => void;
  onRestore: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="grid gap-3 md:grid-cols-3 xl:w-[720px]">
        <Input value={filters.search ?? ""} onChange={(event) => onFiltersChange({ search: event.target.value, page: 1 })} placeholder="Search backups" />
        <Select value={filters.status ?? ""} onChange={(event) => onFiltersChange({ status: event.target.value as BackupFilters["status"], page: 1 })}>
          <option value="">All status</option>
          <option value="generating">Generating</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="restoring">Restoring</option>
        </Select>
        <Select value={filters.backupType ?? ""} onChange={(event) => onFiltersChange({ backupType: event.target.value as BackupFilters["backupType"], page: 1 })}>
          <option value="">All types</option>
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </Select>
      </div>

      {canCreate ? (
        <Button onClick={onCreate}>
          <Database className="mr-2 size-4" />
          Create Backup
        </Button>
      ) : null}
    </div>

    {loading ? <LoadingState label="Loading backups..." /> : null}
    {!loading && backups.length === 0 ? <EmptyState title="No backups found" /> : null}

    {!loading && backups.length > 0 ? (
      <>
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Backup Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{backup.backupName}</div>
                    <div className="text-xs text-slate-500">{backup.fileName}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{backup.backupType}</td>
                  <td className="px-4 py-3">{formatBytes(backup.sizeBytes)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={backup.status} />
                  </td>
                  <td className="px-4 py-3">{backup.createdByName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPreferredDateTime(backup.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canDownload ? (
                        <TableActionIconButton
                          label="Download backup"
                          icon={<Download className="size-4" />}
                          disabled={downloadingId === backup.id || backup.status !== "completed"}
                          onClick={() => onDownload(backup)}
                        />
                      ) : null}
                      {canRestore ? (
                        <TableActionIconButton
                          label="Restore backup"
                          icon={<RotateCcw className="size-4" />}
                          disabled={restoringId === backup.id}
                          onClick={() => onRestore(backup)}
                        />
                      ) : null}
                      {canDelete ? (
                        <TableActionIconButton
                          label="Delete backup"
                          icon={<Trash2 className="size-4" />}
                          tone="danger"
                          disabled={deletingId === backup.id}
                          onClick={() => onDelete(backup)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
        {pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => onFiltersChange({ page })} /> : null}
      </>
    ) : null}
  </div>
);
