import { useEffect, useMemo, useState } from "react";
import { Send, Zap } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { notificationsApi } from "../../services/notificationsApi";
import type {
  Notification,
  NotificationListQuery,
  NotificationLogsQuery,
  NotificationPreference,
  NotificationTemplate,
  NotificationType,
  SchedulerJobResult,
} from "../../types/notification";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { ManualNotificationModal } from "./components/ManualNotificationModal";
import { NotificationFilters } from "./components/NotificationFilters";
import { NotificationLogsTable } from "./components/NotificationLogsTable";
import { NotificationPreferences } from "./components/NotificationPreferences";
import { NotificationTabs, type NotificationTabId } from "./components/NotificationTabs";
import { NotificationTemplateModal } from "./components/NotificationTemplateModal";
import { NotificationTemplatesTable } from "./components/NotificationTemplatesTable";
import { NotificationsList } from "./components/NotificationsList";
import { NOTIFICATIONS_UPDATED_EVENT, notificationTypeOptions } from "./notificationMeta";

const listTabs: NotificationTabId[] = ["all", "unread", "payment", "inventory", "gst", "payroll"];

const defaultListQuery: NotificationListQuery = {
  page: 1,
  limit: 20,
  type: "",
  priority: "",
  channel: "",
  unread: undefined,
  dateFrom: "",
  dateTo: "",
};

const defaultLogsQuery: NotificationLogsQuery = {
  page: 1,
  limit: 20,
  channel: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

const emptyPreference: NotificationPreference = {
  userId: "",
  inAppEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  smsEnabled: false,
  paymentReminders: true,
  supplierReminders: true,
  lowStockAlerts: true,
  expiryAlerts: true,
  invoiceReminders: true,
  payrollAlerts: true,
  gstAlerts: true,
  frequency: "instant",
};

const getTypeOptionsForTab = (tab: NotificationTabId) => {
  if (tab === "payment") {
    return notificationTypeOptions.filter((item) => ["payment_due", "supplier_due", "invoice"].includes(item.value));
  }

  if (tab === "inventory") {
    return notificationTypeOptions.filter((item) => ["low_stock", "expiry"].includes(item.value));
  }

  if (tab === "gst") {
    return notificationTypeOptions.filter((item) => item.value === "gst");
  }

  if (tab === "payroll") {
    return notificationTypeOptions.filter((item) => item.value === "payroll");
  }

  return notificationTypeOptions;
};

const normalizeListQuery = (tab: NotificationTabId, query: NotificationListQuery): NotificationListQuery => {
  if (tab === "unread") {
    return { ...query, unread: true };
  }

  if (tab === "payment") {
    return { ...query, type: (query.type as NotificationType | "") || "payment_due" };
  }

  if (tab === "inventory") {
    return { ...query, type: (query.type as NotificationType | "") || "low_stock" };
  }

  if (tab === "gst") {
    return { ...query, type: "gst" };
  }

  if (tab === "payroll") {
    return { ...query, type: "payroll" };
  }

  return query;
};

export const NotificationsPage = () => {
  const toast = useToast();
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as NotificationTabId | null) ?? "all";
  const [listQuery, setListQuery] = useState<NotificationListQuery>(defaultListQuery);
  const [logsQuery, setLogsQuery] = useState<NotificationLogsQuery>(defaultLogsQuery);
  const [notifications, setNotifications] = useState<{ items: Notification[]; pagination: { page: number; limit: number; total: number; totalPages: number } } | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference>(emptyPreference);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [logs, setLogs] = useState<{ items: Array<import("../../types/notification").NotificationLog>; pagination: { page: number; limit: number; total: number; totalPages: number } } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSending, setManualSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [jobLoadingKey, setJobLoadingKey] = useState<string | null>(null);

  const canManage = auth.hasPermission("notifications.manage");
  const canSend = auth.hasPermission("notifications.send");
  const canManageSettings = auth.hasPermission("notifications.settings.manage");
  const canDelete = auth.hasPermission("notifications.view");

  const debouncedListQuery = useDebouncedValue(JSON.stringify(listQuery), 250);
  const normalizedListQuery = useMemo(
    () => normalizeListQuery(activeTab, JSON.parse(debouncedListQuery) as NotificationListQuery),
    [activeTab, debouncedListQuery],
  );
  const debouncedLogsQuery = useDebouncedValue(JSON.stringify(logsQuery), 250);
  const parsedLogsQuery = useMemo(() => JSON.parse(debouncedLogsQuery) as NotificationLogsQuery, [debouncedLogsQuery]);

  const loadNotifications = async (query: NotificationListQuery) => {
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const response = await notificationsApi.list(query);
      setNotifications(response.data);
    } catch (error) {
      setNotificationsError(getErrorMessage(error, "Failed to load notifications"));
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      setPreferencesLoading(true);
      const response = await notificationsApi.getPreferences();
      setPreferences(response.data.preference);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load preferences"));
    } finally {
      setPreferencesLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await notificationsApi.listTemplates();
      setTemplates(response.data.items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load templates"));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadLogs = async (query: NotificationLogsQuery) => {
    try {
      setLogsLoading(true);
      const response = await notificationsApi.listLogs(query);
      setLogs(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load logs"));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (listTabs.includes(activeTab)) {
      void loadNotifications(normalizedListQuery);
    }

    if (activeTab === "preferences") {
      void loadPreferences();
    }

    if (activeTab === "templates") {
      void loadTemplates();
    }

    if (activeTab === "logs") {
      void loadLogs(parsedLogsQuery);
    }
  }, [activeTab, normalizedListQuery, parsedLogsQuery]);

  const dispatchUpdated = () => window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));

  const runJob = async (label: string, execute: () => Promise<{ data: SchedulerJobResult }>) => {
    try {
      setJobLoadingKey(label);
      const response = await execute();
      toast.success(`${response.data.sent} items sent, ${response.data.skipped} skipped`);
      dispatchUpdated();
      if (listTabs.includes(activeTab)) {
        await loadNotifications(normalizedListQuery);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, `Failed to run ${label}`));
    } finally {
      setJobLoadingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notification Center"
        actions={
          <div className="flex flex-wrap gap-2">
            {canSend ? (
              <Button variant="secondary" onClick={() => setManualModalOpen(true)}>
                <Send className="mr-2 size-4" />
                Manual Send
              </Button>
            ) : null}
            {canManage ? (
              <>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "due"}
                  onClick={() => void runJob("due", notificationsApi.runDueReminders)}
                >
                  <Zap className="mr-2 size-4" />
                  Due Reminders
                </Button>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "stock"}
                  onClick={() => void runJob("stock", notificationsApi.runLowStockCheck)}
                >
                  Low Stock Check
                </Button>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "expiry"}
                  onClick={() => void runJob("expiry", notificationsApi.runExpiryCheck)}
                >
                  Expiry Check
                </Button>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "invoice"}
                  onClick={() => void runJob("invoice", notificationsApi.runInvoiceReminders)}
                >
                  Invoice Reminders
                </Button>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "gst"}
                  onClick={() => void runJob("gst", notificationsApi.runGstReminders)}
                >
                  GST Reminders
                </Button>
                <Button
                  variant="secondary"
                  loading={jobLoadingKey === "payroll"}
                  onClick={() => void runJob("payroll", notificationsApi.runPayrollReminders)}
                >
                  Payroll Reminders
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <NotificationTabs
        activeTab={activeTab}
        onChange={(tab) => setSearchParams({ tab })}
      />

      {listTabs.includes(activeTab) ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <NotificationFilters
              filters={listQuery}
              typeOptions={getTypeOptionsForTab(activeTab)}
              hideReadFilter={activeTab === "unread"}
              onChange={(patch) => setListQuery((current) => ({ ...current, ...patch }))}
            />
            {notificationsLoading ? <LoadingState label="Loading notifications..." /> : null}
            {notificationsError && !notificationsLoading ? <EmptyState title={notificationsError} /> : null}
            {!notificationsLoading && !notificationsError && notifications ? (
              <NotificationsList
                items={notifications.items}
                pagination={notifications.pagination}
                onPageChange={(page) => setListQuery((current) => ({ ...current, page }))}
                onOpen={async (notification) => {
                  if (!notification.isRead) {
                    try {
                      await notificationsApi.markRead(notification.id);
                      dispatchUpdated();
                      await loadNotifications(normalizedListQuery);
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Failed to update notification"));
                    }
                  }

                  if (notification.actionUrl) {
                    window.location.assign(notification.actionUrl);
                  }
                }}
                onMarkRead={async (notification) => {
                  try {
                    await notificationsApi.markRead(notification.id);
                    dispatchUpdated();
                    await loadNotifications(normalizedListQuery);
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to mark notification as read"));
                  }
                }}
                onDelete={(notification) => setDeleteTarget(notification)}
                onMarkAllRead={async () => {
                  try {
                    await notificationsApi.markAllRead();
                    dispatchUpdated();
                    await loadNotifications(normalizedListQuery);
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to mark notifications as read"));
                  }
                }}
                canDelete={canDelete}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "preferences" ? (
        preferencesLoading ? (
          <LoadingState label="Loading preferences..." />
        ) : (
          <NotificationPreferences
            value={preferences}
            onChange={setPreferences}
            saving={preferencesSaving}
            onSave={async () => {
              try {
                setPreferencesSaving(true);
                await notificationsApi.updatePreferences(preferences);
                toast.success("Preferences saved");
              } catch (error) {
                toast.error(getErrorMessage(error, "Failed to save preferences"));
              } finally {
                setPreferencesSaving(false);
              }
            }}
          />
        )
      ) : null}

      {activeTab === "templates" ? (
        <div className="space-y-4">
          {canManageSettings ? (
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateModalOpen(true);
                }}
              >
                Add Template
              </Button>
            </div>
          ) : null}
          {templatesLoading ? <LoadingState label="Loading templates..." /> : null}
          {!templatesLoading ? (
            <NotificationTemplatesTable
              items={templates}
              canEdit={canManageSettings}
              onEdit={(template) => {
                setEditingTemplate(template);
                setTemplateModalOpen(true);
              }}
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === "logs" ? (
        logsLoading || !logs ? (
          <LoadingState label="Loading logs..." />
        ) : (
          <NotificationLogsTable
            items={logs.items}
            pagination={logs.pagination}
            query={logsQuery}
            onQueryChange={(patch) => setLogsQuery((current) => ({ ...current, ...patch }))}
            onPageChange={(page) => setLogsQuery((current) => ({ ...current, page }))}
          />
        )
      ) : null}

      <NotificationTemplateModal
        open={templateModalOpen}
        template={editingTemplate}
        saving={templateSaving}
        onClose={() => setTemplateModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            setTemplateSaving(true);
            if (editingTemplate) {
              const { body, isActive, subject, variables } = payload as Partial<import("../../types/notification").NotificationTemplateInput>;
              await notificationsApi.updateTemplate(editingTemplate.id, { body, isActive, subject, variables });
              toast.success("Template updated");
            } else {
              await notificationsApi.createTemplate(payload as import("../../types/notification").NotificationTemplateInput);
              toast.success("Template created");
            }
            setTemplateModalOpen(false);
            await loadTemplates();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save template"));
          } finally {
            setTemplateSaving(false);
          }
        }}
      />

      <ManualNotificationModal
        open={manualModalOpen}
        saving={manualSending}
        onClose={() => setManualModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            setManualSending(true);
            await notificationsApi.send(payload);
            toast.success("Notification processed");
            setManualModalOpen(false);
            dispatchUpdated();
            if (listTabs.includes(activeTab)) {
              await loadNotifications(normalizedListQuery);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to send notification"));
          } finally {
            setManualSending(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Notification"
        description="This notification will be removed from your center."
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) {
            return;
          }

          try {
            setDeleteLoading(true);
            await notificationsApi.remove(deleteTarget.id);
            toast.success("Notification deleted");
            setDeleteTarget(null);
            dispatchUpdated();
            await loadNotifications(normalizedListQuery);
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete notification"));
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </div>
  );
};

