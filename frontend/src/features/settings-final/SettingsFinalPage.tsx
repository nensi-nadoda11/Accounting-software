import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Palette, RefreshCw, ShieldCheck, UserRoundCog, WalletCards } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { z } from "zod";

import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { PermissionDeniedState } from "../../components/ui/PermissionDeniedState";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { getErrorMessage } from "../../lib/errors";
import { applyUiPreferencesToDocument, settingsApi } from "../../services/settingsApi";
import type { PermissionKey } from "../../types/auth";
import type {
  InvoiceTemplate,
  PaymentMode,
  PermissionMatrix as PermissionMatrixData,
  ProfileSettings,
  SettingsOverview,
  TaxSettings,
  UiPreference,
} from "../../types/settings";
import { InvoiceTemplateEditor } from "./components/InvoiceTemplateEditor";
import { InvoiceTemplatePreview } from "./components/InvoiceTemplatePreview";
import { PaymentModeModal } from "./components/PaymentModeModal";
import { PaymentModesTable } from "./components/PaymentModesTable";
import { PermissionMatrix } from "./components/PermissionMatrix";
import { ProfileSettingsForm } from "./components/ProfileSettingsForm";
import { SettingsFinalTabs } from "./components/SettingsFinalTabs";
import { SystemPolishPanel } from "./components/SystemPolishPanel";
import { TaxSettingsForm } from "./components/TaxSettingsForm";
import { ThemeSettingsForm } from "./components/ThemeSettingsForm";
import {
  invoiceTemplateSchema,
  passwordChangeSchema,
  paymentModeSchema,
  profileSettingsSchema,
  type SettingsTabKey,
  taxSettingsSchema,
  uiPreferencesSchema,
} from "./settingsFinalSchemas";

type InvoiceTemplateValues = z.infer<typeof invoiceTemplateSchema>;
type PaymentModeValues = z.infer<typeof paymentModeSchema>;
type TaxSettingsValues = z.infer<typeof taxSettingsSchema>;
type ThemeValues = z.infer<typeof uiPreferencesSchema>;
type ProfileValues = z.infer<typeof profileSettingsSchema>;
type PasswordValues = z.infer<typeof passwordChangeSchema>;

const ROUTE_PERMISSIONS: PermissionKey[] = [
  "settings.view",
  "settings.manage",
  "permissions.manage",
  "invoice.settings.manage",
  "tax.settings.manage",
  "payment.settings.manage",
  "profile.manage",
];

const tabDefinitions: Array<{
  key: SettingsTabKey;
  label: string;
  canAccess: (hasPermission: (permission: PermissionKey | PermissionKey[]) => boolean) => boolean;
}> = [
  { key: "overview", label: "Overview", canAccess: (hasPermission) => hasPermission(ROUTE_PERMISSIONS) },
  { key: "permissions", label: "Permissions", canAccess: (hasPermission) => hasPermission(["settings.view", "permissions.manage"]) },
  { key: "invoice-templates", label: "Invoice Templates", canAccess: (hasPermission) => hasPermission("invoice.settings.manage") },
  { key: "tax-settings", label: "Tax Settings", canAccess: (hasPermission) => hasPermission("tax.settings.manage") },
  { key: "payment-modes", label: "Payment Modes", canAccess: (hasPermission) => hasPermission("payment.settings.manage") },
  { key: "theme", label: "Theme", canAccess: (hasPermission) => hasPermission(["profile.manage", "settings.manage"]) },
  { key: "profile", label: "Profile", canAccess: (hasPermission) => hasPermission("profile.manage") },
  { key: "system-polish", label: "System Polish", canAccess: () => true },
];

export const SettingsFinalPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrixData | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [userPermissionSaving, setUserPermissionSaving] = useState(false);
  const [rolePermissionSaving, setRolePermissionSaving] = useState(false);

  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[] | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceEditorOpen, setInvoiceEditorOpen] = useState(false);
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState<InvoiceTemplate | null>(null);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);
  const [taxSaving, setTaxSaving] = useState(false);

  const [paymentModes, setPaymentModes] = useState<PaymentMode[] | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [uiPreferences, setUiPreferences] = useState<UiPreference | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);

  const [profileSettings, setProfileSettings] = useState<ProfileSettings | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const [confirmState, setConfirmState] = useState<
    | { type: "deleteInvoice"; item: InvoiceTemplate }
    | { type: "deletePayment"; item: PaymentMode }
    | null
  >(null);

  const availableTabs = useMemo(
    () => tabDefinitions.filter((tab) => tab.canAccess(auth.hasPermission)),
    [auth.hasPermission],
  );

  const requestedTab = searchParams.get("tab") as SettingsTabKey | null;
  const activeTab = availableTabs.find((tab) => tab.key === requestedTab)?.key ?? availableTabs[0]?.key ?? "overview";

  useEffect(() => {
    if (!requestedTab || !availableTabs.some((tab) => tab.key === requestedTab)) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, availableTabs, requestedTab, setSearchParams]);

  const loadOverview = async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const response = await settingsApi.getOverview();
      setOverview(response.data);
    } catch (error) {
      setOverviewError(getErrorMessage(error, "Failed to load settings overview"));
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      setPermissionLoading(true);
      setPermissionError(null);
      const response = await settingsApi.getPermissions();
      setPermissionMatrix(response.data);
    } catch (error) {
      setPermissionError(getErrorMessage(error, "Failed to load permission matrix"));
    } finally {
      setPermissionLoading(false);
    }
  };

  const loadInvoiceTemplates = async () => {
    try {
      setInvoiceLoading(true);
      setInvoiceError(null);
      const response = await settingsApi.listInvoiceTemplates();
      setInvoiceTemplates(response.data);
    } catch (error) {
      setInvoiceError(getErrorMessage(error, "Failed to load invoice templates"));
    } finally {
      setInvoiceLoading(false);
    }
  };

  const loadTaxSettings = async () => {
    try {
      setTaxLoading(true);
      setTaxError(null);
      const response = await settingsApi.getTaxSettings();
      setTaxSettings(response.data);
    } catch (error) {
      setTaxError(getErrorMessage(error, "Failed to load tax settings"));
    } finally {
      setTaxLoading(false);
    }
  };

  const loadPaymentModes = async () => {
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      const response = await settingsApi.listPaymentModes();
      setPaymentModes(response.data);
    } catch (error) {
      setPaymentError(getErrorMessage(error, "Failed to load payment modes"));
    } finally {
      setPaymentLoading(false);
    }
  };

  const loadTheme = async () => {
    try {
      setThemeLoading(true);
      setThemeError(null);
      const response = await settingsApi.getUiPreferences();
      setUiPreferences(response.data);
      applyUiPreferencesToDocument(response.data);
    } catch (error) {
      setThemeError(getErrorMessage(error, "Failed to load theme preferences"));
    } finally {
      setThemeLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const response = await settingsApi.getProfileSettings();
      setProfileSettings(response.data);
    } catch (error) {
      setProfileError(getErrorMessage(error, "Failed to load profile settings"));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === "permissions" && !permissionMatrix && !permissionLoading) {
      void loadPermissions();
    }
    if (activeTab === "invoice-templates" && !invoiceTemplates && !invoiceLoading) {
      void loadInvoiceTemplates();
    }
    if (activeTab === "tax-settings" && !taxSettings && !taxLoading) {
      void loadTaxSettings();
    }
    if (activeTab === "payment-modes" && !paymentModes && !paymentLoading) {
      void loadPaymentModes();
    }
    if (activeTab === "theme" && !uiPreferences && !themeLoading) {
      void loadTheme();
    }
    if (activeTab === "profile" && !profileSettings && !profileLoading) {
      void loadProfile();
    }
  }, [activeTab, invoiceLoading, invoiceTemplates, paymentLoading, paymentModes, permissionLoading, permissionMatrix, profileLoading, profileSettings, taxLoading, taxSettings, themeLoading, uiPreferences]);

  const refreshOverview = async () => {
    await loadOverview();
  };

  const handleInvoiceSubmit = async (value: InvoiceTemplateValues) => {
    try {
      setInvoiceSaving(true);
      if (selectedInvoiceTemplate) {
        await settingsApi.updateInvoiceTemplate(selectedInvoiceTemplate.id, value);
        toast.success("Invoice template updated");
      } else {
        await settingsApi.createInvoiceTemplate({
          ...value,
          templateKey: value.templateKey || `${value.invoiceType}_${value.templateName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        });
        toast.success("Invoice template created");
      }
      setInvoiceEditorOpen(false);
      setSelectedInvoiceTemplate(null);
      await Promise.all([loadInvoiceTemplates(), refreshOverview()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save invoice template"));
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handlePaymentModeSubmit = async (value: PaymentModeValues) => {
    try {
      setPaymentSaving(true);
      if (selectedPaymentMode) {
        await settingsApi.updatePaymentMode(selectedPaymentMode.id, value);
        toast.success("Payment mode updated");
      } else {
        await settingsApi.createPaymentMode(value);
        toast.success("Payment mode created");
      }
      setPaymentModalOpen(false);
      setSelectedPaymentMode(null);
      await Promise.all([loadPaymentModes(), refreshOverview()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save payment mode"));
    } finally {
      setPaymentSaving(false);
    }
  };

  const renderOverview = () => {
    if (overviewLoading && !overview) {
      return <LoadingState label="Loading settings overview..." />;
    }

    if (overviewError && !overview) {
      return <ErrorState title={overviewError} action={<Button variant="secondary" onClick={() => void loadOverview()}>Retry</Button>} />;
    }

    if (!overview) {
      return <EmptyState title="No overview available" />;
    }

    const iconMap = {
      permissions: ShieldCheck,
      invoiceTemplates: FilePlus2,
      taxSettings: FilePlus2,
      paymentModes: WalletCards,
      theme: Palette,
      profile: UserRoundCog,
      systemPolish: RefreshCw,
    } as const;

    return (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {overview.sections.map((section) => {
          const Icon = iconMap[section.key];
          return (
            <Card key={section.key}>
              <CardHeader title={section.label} action={<StatusBadge status={section.status} label={section.status} />} />
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="app-accent-text rounded-2xl bg-slate-50 p-3">
                    <Icon className="size-5" />
                  </div>
                  <p className="text-sm text-slate-600">{section.summary}</p>
                </div>
                {section.missingItems.length ? (
                  <div className="space-y-1">
                    {section.missingItems.map((item) => (
                      <p key={item} className="text-xs text-amber-700">{item}</p>
                    ))}
                  </div>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={!section.accessible}
                  onClick={() => setSearchParams({ tab: (section.key === "invoiceTemplates" ? "invoice-templates" : section.key === "taxSettings" ? "tax-settings" : section.key === "paymentModes" ? "payment-modes" : section.key) as SettingsTabKey })}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderInvoiceTemplates = () => {
    if (invoiceLoading && !invoiceTemplates) {
      return <LoadingState label="Loading invoice templates..." />;
    }
    if (invoiceError && !invoiceTemplates) {
      return <ErrorState title={invoiceError} action={<Button variant="secondary" onClick={() => void loadInvoiceTemplates()}>Retry</Button>} />;
    }
    if (!invoiceTemplates) {
      return <EmptyState title="No invoice templates found" />;
    }
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setSelectedInvoiceTemplate(null);
              setInvoiceEditorOpen(true);
            }}
          >
            Add Template
          </Button>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {invoiceTemplates.map((template) => (
            <div key={template.id} className="space-y-3">
              <InvoiceTemplatePreview
                templateName={template.templateName}
                invoiceType={template.invoiceType}
                layoutConfig={template.layoutConfig}
                companyName={auth.company?.name}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedInvoiceTemplate(template);
                    setInvoiceEditorOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  disabled={template.isDefault}
                  onClick={async () => {
                    try {
                      await settingsApi.setDefaultInvoiceTemplate(template.id);
                      toast.success("Default template updated");
                      await Promise.all([loadInvoiceTemplates(), refreshOverview()]);
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Unable to update default template"));
                    }
                  }}
                >
                  Set Default
                </Button>
                <Button variant="danger" onClick={() => setConfirmState({ type: "deleteInvoice", item: template })}>
                  Delete
                </Button>
                <StatusBadge status={template.isDefault ? "default" : template.isActive ? "active" : "inactive"} label={template.isDefault ? "Default" : template.isActive ? "Active" : "Inactive"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!auth.hasPermission(ROUTE_PERMISSIONS)) {
    return <PermissionDeniedState title="You do not have access to final settings." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Final Polishing"
        actions={
          <Button variant="secondary" onClick={() => void refreshOverview()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />

      <SettingsFinalTabs tabs={availableTabs.map((tab) => ({ key: tab.key, label: tab.label }))} activeTab={activeTab} onChange={(tab) => setSearchParams({ tab })} />

      {activeTab === "overview" ? renderOverview() : null}

      {activeTab === "permissions" ? (
        auth.hasPermission(["settings.view", "permissions.manage"]) ? (
          permissionLoading && !permissionMatrix ? (
            <LoadingState label="Loading permission matrix..." />
          ) : permissionError && !permissionMatrix ? (
            <ErrorState title={permissionError} action={<Button variant="secondary" onClick={() => void loadPermissions()}>Retry</Button>} />
          ) : permissionMatrix ? (
            <PermissionMatrix
              matrix={permissionMatrix}
              currentUserId={auth.user?.id}
              userSaving={userPermissionSaving}
              roleSaving={rolePermissionSaving}
              onSaveUser={async (userId, permissions) => {
                try {
                  setUserPermissionSaving(true);
                  await settingsApi.updateUserPermissions(userId, permissions);
                  toast.success("User permissions updated");
                  await Promise.all([loadPermissions(), refreshOverview()]);
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to save user permissions"));
                } finally {
                  setUserPermissionSaving(false);
                }
              }}
              onSaveRole={async (role, permissions) => {
                try {
                  setRolePermissionSaving(true);
                  await settingsApi.updateRolePermissions(role, permissions);
                  toast.success("Role permissions updated");
                  await Promise.all([loadPermissions(), refreshOverview()]);
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to save role permissions"));
                } finally {
                  setRolePermissionSaving(false);
                }
              }}
            />
          ) : (
            <EmptyState title="No permission data available" />
          )
        ) : (
          <PermissionDeniedState />
        )
      ) : null}

      {activeTab === "invoice-templates" ? (
        auth.hasPermission("invoice.settings.manage") ? renderInvoiceTemplates() : <PermissionDeniedState />
      ) : null}

      {activeTab === "tax-settings" ? (
        auth.hasPermission("tax.settings.manage") ? (
          taxLoading && !taxSettings ? (
            <LoadingState label="Loading tax settings..." />
          ) : taxError && !taxSettings ? (
            <ErrorState title={taxError} action={<Button variant="secondary" onClick={() => void loadTaxSettings()}>Retry</Button>} />
          ) : taxSettings ? (
            <TaxSettingsForm
              value={taxSettings}
              loading={taxSaving}
              onSubmit={async (value: TaxSettingsValues) => {
                try {
                  setTaxSaving(true);
                  const response = await settingsApi.updateTaxSettings(value);
                  setTaxSettings(response.data);
                  toast.success("Tax settings saved");
                  await refreshOverview();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to save tax settings"));
                } finally {
                  setTaxSaving(false);
                }
              }}
            />
          ) : (
            <EmptyState title="No tax settings available" />
          )
        ) : (
          <PermissionDeniedState />
        )
      ) : null}

      {activeTab === "payment-modes" ? (
        auth.hasPermission("payment.settings.manage") ? (
          paymentLoading && !paymentModes ? (
            <LoadingState label="Loading payment modes..." />
          ) : paymentError && !paymentModes ? (
            <ErrorState title={paymentError} action={<Button variant="secondary" onClick={() => void loadPaymentModes()}>Retry</Button>} />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setSelectedPaymentMode(null);
                    setPaymentModalOpen(true);
                  }}
                >
                  Add Payment Mode
                </Button>
              </div>
              <PaymentModesTable
                items={paymentModes || []}
                onEdit={(item) => {
                  setSelectedPaymentMode(item);
                  setPaymentModalOpen(true);
                }}
                onDefault={async (item) => {
                  try {
                    await settingsApi.setDefaultPaymentMode(item.id);
                    toast.success("Default payment mode updated");
                    await Promise.all([loadPaymentModes(), refreshOverview()]);
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Unable to update default payment mode"));
                  }
                }}
                onDelete={(item) => setConfirmState({ type: "deletePayment", item })}
              />
            </div>
          )
        ) : (
          <PermissionDeniedState />
        )
      ) : null}

      {activeTab === "theme" ? (
        auth.hasPermission(["profile.manage", "settings.manage"]) ? (
          themeLoading && !uiPreferences ? (
            <LoadingState label="Loading theme preferences..." />
          ) : themeError && !uiPreferences ? (
            <ErrorState title={themeError} action={<Button variant="secondary" onClick={() => void loadTheme()}>Retry</Button>} />
          ) : uiPreferences ? (
            <ThemeSettingsForm
              value={uiPreferences}
              loading={themeSaving}
              onSubmit={async (value: ThemeValues) => {
                try {
                  setThemeSaving(true);
                  const response = await settingsApi.updateUiPreferences(value);
                  setUiPreferences(response.data);
                  applyUiPreferencesToDocument(response.data);
                  toast.success("Theme preferences saved");
                  await refreshOverview();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to save theme preferences"));
                } finally {
                  setThemeSaving(false);
                }
              }}
            />
          ) : (
            <EmptyState title="No theme settings available" />
          )
        ) : (
          <PermissionDeniedState />
        )
      ) : null}

      {activeTab === "profile" ? (
        auth.hasPermission("profile.manage") ? (
          profileLoading && !profileSettings ? (
            <LoadingState label="Loading profile settings..." />
          ) : profileError && !profileSettings ? (
            <ErrorState title={profileError} action={<Button variant="secondary" onClick={() => void loadProfile()}>Retry</Button>} />
          ) : profileSettings ? (
            <ProfileSettingsForm
              value={profileSettings}
              saving={profileSaving}
              passwordSaving={passwordSaving}
              logoutAllLoading={logoutAllLoading}
              onSubmit={async (value: ProfileValues) => {
                try {
                  setProfileSaving(true);
                  const response = await settingsApi.updateProfileSettings({
                    fullName: value.fullName,
                    mobileNumber: value.mobileNumber || null,
                  });
                  setProfileSettings(response.data);
                  if (auth.user) {
                    auth.updateUser({
                      ...auth.user,
                      fullName: response.data.user.fullName,
                      mobileNumber: response.data.user.mobileNumber,
                    });
                  }
                  toast.success("Profile updated");
                  await refreshOverview();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to update profile"));
                } finally {
                  setProfileSaving(false);
                }
              }}
              onChangePassword={async (value: PasswordValues) => {
                try {
                  setPasswordSaving(true);
                  await settingsApi.changePassword(value);
                  toast.success("Password updated");
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to change password"));
                } finally {
                  setPasswordSaving(false);
                }
              }}
              onLogoutAll={async () => {
                try {
                  setLogoutAllLoading(true);
                  await settingsApi.logoutAll();
                  await auth.logout();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to logout all devices"));
                } finally {
                  setLogoutAllLoading(false);
                }
              }}
            />
          ) : (
            <EmptyState title="No profile settings available" />
          )
        ) : (
          <PermissionDeniedState />
        )
      ) : null}

      {activeTab === "system-polish" ? <SystemPolishPanel /> : null}

      <InvoiceTemplateEditor
        open={invoiceEditorOpen}
        initialValue={selectedInvoiceTemplate}
        loading={invoiceSaving}
        companyName={auth.company?.name}
        onClose={() => {
          setInvoiceEditorOpen(false);
          setSelectedInvoiceTemplate(null);
        }}
        onSubmit={handleInvoiceSubmit}
      />

      <PaymentModeModal
        open={paymentModalOpen}
        initialValue={selectedPaymentMode}
        loading={paymentSaving}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentMode(null);
        }}
        onSubmit={handlePaymentModeSubmit}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState) {
            return;
          }

          try {
            if (confirmState.type === "deleteInvoice") {
              await settingsApi.deleteInvoiceTemplate(confirmState.item.id);
              toast.success("Invoice template deleted");
              await Promise.all([loadInvoiceTemplates(), refreshOverview()]);
            }

            if (confirmState.type === "deletePayment") {
              await settingsApi.deletePaymentMode(confirmState.item.id);
              toast.success("Payment mode deleted");
              await Promise.all([loadPaymentModes(), refreshOverview()]);
            }
          } catch (error) {
            toast.error(getErrorMessage(error, "Unable to complete this action"));
          } finally {
            setConfirmState(null);
          }
        }}
        title={confirmState?.type === "deleteInvoice" ? "Delete invoice template?" : "Delete payment mode?"}
        description={
          confirmState?.type === "deleteInvoice"
            ? `This will remove ${confirmState.item.templateName}.`
            : confirmState?.type === "deletePayment"
              ? `This will remove ${confirmState.item.modeName}.`
              : ""
        }
      />
    </div>
  );
};

