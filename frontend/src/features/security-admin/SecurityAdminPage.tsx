import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { getErrorMessage } from "../../lib/errors";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { securityAdminApi } from "../../services/securityAdminApi";
import type {
  AuditFilters,
  AuditLog,
  Backup,
  BackupFilters,
  LoginLog,
  LoginLogFilters,
  PaginationMeta,
  RestoreLog,
  RestoreLogFilters
} from "../../types/securityAdmin";
import { AuditLogDrawer } from "./components/AuditLogDrawer";
import { AuditLogsTable } from "./components/AuditLogsTable";
import { BackupsTable } from "./components/BackupsTable";
import { CreateBackupModal } from "./components/CreateBackupModal";
import { LoginLogsTable } from "./components/LoginLogsTable";
import { RestoreBackupModal } from "./components/RestoreBackupModal";
import { RestoreLogsTable } from "./components/RestoreLogsTable";
import { SecurityTabs, type SecurityAdminTabKey } from "./components/SecurityTabs";

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const SecurityAdminPage = () => {
  const auth = useAuth();
  const toast = useToast();

  const canAuditView = auth.hasPermission("audit.view");
  const canAuditExport = auth.hasPermission("audit.export");
  const canBackupCreate = auth.hasPermission("backup.create");
  const canBackupDownload = auth.hasPermission("backup.download");
  const canBackupRestore = auth.hasPermission("backup.restore");
  const canBackupDelete = auth.hasPermission("backup.delete");
  const canSeeBackups = canBackupCreate || canBackupDownload || canBackupRestore || canBackupDelete;

  const visibleTabs = useMemo<SecurityAdminTabKey[]>(
    () =>
      [
        canAuditView ? "audit" : null,
        canAuditView ? "login" : null,
        canSeeBackups ? "backups" : null,
        canAuditView ? "restore" : null
      ].filter(Boolean) as SecurityAdminTabKey[],
    [canAuditView, canSeeBackups]
  );

  const [activeTab, setActiveTab] = useState<SecurityAdminTabKey>(visibleTabs[0] ?? "audit");
  useEffect(() => {
    if (!visibleTabs.includes(activeTab) && visibleTabs[0]) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

  const [auditFilters, setAuditFilters] = useState<AuditFilters>({ page: 1, limit: 20 });
  const [loginFilters, setLoginFilters] = useState<LoginLogFilters>({ page: 1, limit: 20 });
  const [backupFilters, setBackupFilters] = useState<BackupFilters>({ page: 1, limit: 20 });
  const [restoreFilters, setRestoreFilters] = useState<RestoreLogFilters>({ page: 1, limit: 20 });

  const debouncedAuditFilters = useDebouncedValue(auditFilters);
  const debouncedLoginFilters = useDebouncedValue(loginFilters);
  const debouncedBackupFilters = useDebouncedValue(backupFilters);
  const debouncedRestoreFilters = useDebouncedValue(restoreFilters);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState<PaginationMeta | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loginPagination, setLoginPagination] = useState<PaginationMeta | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupPagination, setBackupPagination] = useState<PaginationMeta | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupCreateOpen, setBackupCreateOpen] = useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [backupDeleteOpen, setBackupDeleteOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(null);
  const [backupReloadKey, setBackupReloadKey] = useState(0);
  const [restoreReloadKey, setRestoreReloadKey] = useState(0);

  const [restoreLogs, setRestoreLogs] = useState<RestoreLog[]>([]);
  const [restorePagination, setRestorePagination] = useState<PaginationMeta | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "audit") {
      return;
    }

    setAuditLoading(true);
    void securityAdminApi
      .listAuditLogs(debouncedAuditFilters)
      .then((response) => {
        setAuditLogs(response.data.items);
        setAuditPagination(response.data.pagination);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Failed to load audit logs"));
      })
      .finally(() => setAuditLoading(false));
  }, [activeTab, debouncedAuditFilters, toast]);

  useEffect(() => {
    if (activeTab !== "login") {
      return;
    }

    setLoginLoading(true);
    void securityAdminApi
      .listLoginLogs(debouncedLoginFilters)
      .then((response) => {
        setLoginLogs(response.data.items);
        setLoginPagination(response.data.pagination);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Failed to load login logs"));
      })
      .finally(() => setLoginLoading(false));
  }, [activeTab, debouncedLoginFilters, toast]);

  useEffect(() => {
    if (activeTab !== "backups") {
      return;
    }

    setBackupLoading(true);
    void securityAdminApi
      .listBackups(debouncedBackupFilters)
      .then((response) => {
        setBackups(response.data.items);
        setBackupPagination(response.data.pagination);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Failed to load backups"));
      })
      .finally(() => setBackupLoading(false));
  }, [activeTab, debouncedBackupFilters, backupReloadKey, toast]);

  useEffect(() => {
    if (activeTab !== "restore") {
      return;
    }

    setRestoreLoading(true);
    void securityAdminApi
      .listRestoreLogs(debouncedRestoreFilters)
      .then((response) => {
        setRestoreLogs(response.data.items);
        setRestorePagination(response.data.pagination);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Failed to load restore logs"));
      })
      .finally(() => setRestoreLoading(false));
  }, [activeTab, debouncedRestoreFilters, restoreReloadKey, toast]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Admin"
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <ShieldCheck className="size-4" />
            Audit-safe controls
          </div>
        }
      />

      <SecurityTabs value={activeTab} onChange={setActiveTab} visibleTabs={visibleTabs} />

      <Card>
        <CardContent className="space-y-4">
          {activeTab === "audit" ? (
            <AuditLogsTable
              filters={auditFilters}
              onFiltersChange={(value) => setAuditFilters((current) => ({ ...current, ...value }))}
              logs={auditLogs}
              pagination={auditPagination}
              loading={auditLoading}
              canExport={canAuditExport}
              exporting={auditExporting}
              onExport={() => {
                const exportFilters = Object.fromEntries(
                  Object.entries(auditFilters).filter(([key]) => key !== "page" && key !== "limit"),
                ) as Omit<AuditFilters, "page" | "limit">;
                setAuditExporting(true);
                void securityAdminApi
                  .exportAuditLogs(exportFilters)
                  .then((file) => {
                    downloadBlob(file.blob, file.fileName);
                    toast.success("Audit logs exported");
                  })
                  .catch((error) => {
                    toast.error(getErrorMessage(error, "Failed to export audit logs"));
                  })
                  .finally(() => setAuditExporting(false));
              }}
              onOpen={setSelectedAuditLog}
            />
          ) : null}

          {activeTab === "login" ? (
            <LoginLogsTable
              filters={loginFilters}
              onFiltersChange={(value) => setLoginFilters((current) => ({ ...current, ...value }))}
              logs={loginLogs}
              pagination={loginPagination}
              loading={loginLoading}
            />
          ) : null}

          {activeTab === "backups" ? (
            <BackupsTable
              filters={backupFilters}
              onFiltersChange={(value) => setBackupFilters((current) => ({ ...current, ...value }))}
              backups={backups}
              pagination={backupPagination}
              loading={backupLoading}
              canCreate={canBackupCreate}
              canDownload={canBackupDownload}
              canRestore={canBackupRestore}
              canDelete={canBackupDelete}
              downloadingId={downloadingBackupId}
              restoringId={restoringBackup ? selectedBackup?.id ?? null : null}
              deletingId={deletingBackup ? selectedBackup?.id ?? null : null}
              onCreate={() => setBackupCreateOpen(true)}
              onDownload={(backup) => {
                setDownloadingBackupId(backup.id);
                void securityAdminApi
                  .downloadBackup(backup.id)
                  .then((file) => {
                    downloadBlob(file.blob, file.fileName);
                    toast.success("Backup downloaded");
                  })
                  .catch((error) => {
                    toast.error(getErrorMessage(error, "Failed to download backup"));
                  })
                  .finally(() => setDownloadingBackupId(null));
              }}
              onRestore={(backup) => {
                setSelectedBackup(backup);
                setBackupRestoreOpen(true);
              }}
              onDelete={(backup) => {
                setSelectedBackup(backup);
                setBackupDeleteOpen(true);
              }}
            />
          ) : null}

          {activeTab === "restore" ? (
            <RestoreLogsTable
              filters={restoreFilters}
              onFiltersChange={(value) => setRestoreFilters((current) => ({ ...current, ...value }))}
              logs={restoreLogs}
              pagination={restorePagination}
              loading={restoreLoading}
            />
          ) : null}
        </CardContent>
      </Card>

      <AuditLogDrawer log={selectedAuditLog} open={Boolean(selectedAuditLog)} onClose={() => setSelectedAuditLog(null)} />

      <CreateBackupModal
        open={backupCreateOpen}
        loading={creatingBackup}
        onClose={() => setBackupCreateOpen(false)}
        onSubmit={async (value) => {
          try {
            setCreatingBackup(true);
            await securityAdminApi.createBackup(value);
            toast.success("Backup created");
            setBackupCreateOpen(false);
            setBackupReloadKey((current) => current + 1);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to create backup"));
          } finally {
            setCreatingBackup(false);
          }
        }}
      />

      <RestoreBackupModal
        open={backupRestoreOpen}
        backup={selectedBackup}
        loading={restoringBackup}
        onClose={() => setBackupRestoreOpen(false)}
        onSubmit={async (value) => {
          if (!selectedBackup) {
            return;
          }

          try {
            setRestoringBackup(true);
            await securityAdminApi.restoreBackup(selectedBackup.id, value);
            toast.success("Backup restored");
            setBackupRestoreOpen(false);
            setBackupReloadKey((current) => current + 1);
            setRestoreReloadKey((current) => current + 1);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to restore backup"));
          } finally {
            setRestoringBackup(false);
          }
        }}
      />

      <ConfirmDialog
        open={backupDeleteOpen}
        onClose={() => setBackupDeleteOpen(false)}
        title="Delete Backup"
        description={`Hide ${selectedBackup?.backupName ?? "this backup"} from the list?`}
        loading={deletingBackup}
        onConfirm={() => {
          if (!selectedBackup) {
            return;
          }

          setDeletingBackup(true);
          void securityAdminApi
            .deleteBackup(selectedBackup.id)
            .then(() => {
              toast.success("Backup deleted");
              setBackupDeleteOpen(false);
              setBackupReloadKey((current) => current + 1);
            })
            .catch((error) => {
              toast.error(getErrorMessage(error, "Failed to delete backup"));
            })
            .finally(() => setDeletingBackup(false));
        }}
      />
    </div>
  );
};

