import { db } from "../../db";
import { authService } from "../auth/auth.service";
import { auditLogService } from "../audit-logs/audit-log.service";
import { companiesRepository } from "../companies/companies.repository";
import { companyRepository } from "../company/company.repository";
import { permissionService } from "../permissions/permission.service";
import { usersRepository } from "../users/users.repository";
import { AppError } from "../../utils/app-error";
import type { PermissionKey } from "../permissions/permission.constants";
import { ALL_PERMISSIONS } from "../permissions/permission.constants";
import { settingsRepository } from "./settings.repository";
import type {
  CurrencyFormatValue,
  DateFormatValue,
  GstFilingFrequency,
  InvoiceLayoutConfig,
  InvoiceType,
  NumberFormatValue,
  OverviewSection,
  PaymentModeKey,
  RoleKey,
  SettingsActor,
  SettingsRequestContext,
  TableDensity,
  TaxSettings,
  UiPreferenceRecord
} from "./settings.types";
import {
  DEFAULT_INVOICE_LAYOUT,
  DEFAULT_INVOICE_TEMPLATE_SEED,
  DEFAULT_PAYMENT_MODE_SEED,
  DEFAULT_TAX_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  GST_RATE_VALUES
} from "./settings.types";

const TAX_SETTINGS_KEY = "tax_settings";
const CRITICAL_ADMIN_PERMISSIONS: PermissionKey[] = [
  "settings.view",
  "settings.manage",
  "permissions.manage",
  "profile.manage"
];

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  customer: "Customer",
  supplier: "Supplier",
  product: "Product",
  category: "Category",
  unit: "Unit",
  inventory: "Inventory",
  warehouse: "Warehouse",
  batch: "Batch",
  purchase: "Purchase",
  sales: "Sales",
  payment: "Payment",
  expense: "Expense",
  accounting: "Accounting",
  chart: "Accounting",
  ledger: "Accounting",
  cashbook: "Accounting",
  bankbook: "Accounting",
  gst: "GST",
  payroll: "Payroll",
  notifications: "Notifications",
  report: "Reports",
  reports: "Reports",
  user: "Users",
  settings: "Settings",
  permissions: "Settings",
  invoice: "Settings",
  tax: "Settings",
  profile: "Settings",
  audit: "Audit",
  backup: "Backup"
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toPermissionArray = (permissions: Iterable<PermissionKey>) => Array.from(new Set(permissions));

const hasAllPermissions = (permissions: PermissionKey[], required: PermissionKey[]) =>
  required.every((permission) => permissions.includes(permission));

const normalizeTextKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

class SettingsService {
  private buildPermissionGroups() {
    const grouped = ALL_PERMISSIONS.reduce<Map<string, PermissionKey[]>>((map, permission) => {
      const key = permission.split(".")[0] ?? "general";
      const list = map.get(key) ?? [];
      list.push(permission);
      map.set(key, list);
      return map;
    }, new Map());

    return Array.from(grouped.entries())
      .map(([key, permissions]) => ({
        key,
        label: PERMISSION_GROUP_LABELS[key] ?? key,
        permissions
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  private normalizeTaxSettings(value: unknown): TaxSettings {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_TAX_SETTINGS };
    }

    const raw = value as Partial<TaxSettings>;
    const normalizedRate = GST_RATE_VALUES.includes(raw.defaultGstRate as (typeof GST_RATE_VALUES)[number])
      ? (raw.defaultGstRate as (typeof GST_RATE_VALUES)[number])
      : DEFAULT_TAX_SETTINGS.defaultGstRate;

    return {
      gstEnabled: raw.gstEnabled ?? DEFAULT_TAX_SETTINGS.gstEnabled,
      defaultGstRate: normalizedRate,
      taxInclusiveDefault: raw.taxInclusiveDefault ?? DEFAULT_TAX_SETTINGS.taxInclusiveDefault,
      roundOffEnabled: raw.roundOffEnabled ?? DEFAULT_TAX_SETTINGS.roundOffEnabled,
      hsnSacRequired: raw.hsnSacRequired ?? DEFAULT_TAX_SETTINGS.hsnSacRequired,
      gstFilingFrequency: raw.gstFilingFrequency ?? DEFAULT_TAX_SETTINGS.gstFilingFrequency,
      compositionScheme: raw.compositionScheme ?? DEFAULT_TAX_SETTINGS.compositionScheme
    };
  }

  private normalizeLayoutConfig(value: unknown): InvoiceLayoutConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_INVOICE_LAYOUT };
    }

    const raw = value as Partial<InvoiceLayoutConfig>;
    return {
      showLogo: raw.showLogo ?? DEFAULT_INVOICE_LAYOUT.showLogo,
      showSignature: raw.showSignature ?? DEFAULT_INVOICE_LAYOUT.showSignature,
      showBankDetails: raw.showBankDetails ?? DEFAULT_INVOICE_LAYOUT.showBankDetails,
      showQrCode: raw.showQrCode ?? DEFAULT_INVOICE_LAYOUT.showQrCode,
      termsFooter: raw.termsFooter ?? DEFAULT_INVOICE_LAYOUT.termsFooter,
      footerNote: raw.footerNote ?? DEFAULT_INVOICE_LAYOUT.footerNote
    };
  }

  private ensureCriticalAdminPermissions(role: RoleKey, permissions: PermissionKey[], message: string) {
    if (role === "admin" && !hasAllPermissions(permissions, CRITICAL_ADMIN_PERMISSIONS)) {
      throw new AppError(message, 400);
    }
  }

  private async getTaxSettingsRecord(companyId: string) {
    const existing = await settingsRepository.findAppSetting(companyId, TAX_SETTINGS_KEY);
    if (existing) {
      return this.normalizeTaxSettings(existing.settingValue);
    }

    const companyTaxSettings = await companyRepository.findTaxSettingsByCompanyId(companyId);
    const invoiceSettings = await companyRepository.findInvoiceSettingsByCompanyId(companyId);

    if (!companyTaxSettings && !invoiceSettings) {
      return { ...DEFAULT_TAX_SETTINGS };
    }

    return this.normalizeTaxSettings({
      gstEnabled: companyTaxSettings?.gstEnabled ?? DEFAULT_TAX_SETTINGS.gstEnabled,
      defaultGstRate:
        companyTaxSettings?.defaultGstRate !== null && companyTaxSettings?.defaultGstRate !== undefined
          ? Number(companyTaxSettings.defaultGstRate)
          : DEFAULT_TAX_SETTINGS.defaultGstRate,
      taxInclusiveDefault:
        companyTaxSettings?.taxInclusivePricing ?? DEFAULT_TAX_SETTINGS.taxInclusiveDefault,
      roundOffEnabled: invoiceSettings?.roundOffEnabled ?? DEFAULT_TAX_SETTINGS.roundOffEnabled,
      hsnSacRequired: companyTaxSettings?.hsnSacEnabled ?? DEFAULT_TAX_SETTINGS.hsnSacRequired,
      gstFilingFrequency:
        (companyTaxSettings?.gstFilingFrequency as GstFilingFrequency | undefined) ??
        DEFAULT_TAX_SETTINGS.gstFilingFrequency,
      compositionScheme:
        companyTaxSettings?.compositionScheme ?? DEFAULT_TAX_SETTINGS.compositionScheme
    });
  }

  private async ensurePaymentModesSeeded(companyId: string) {
    const existing = await settingsRepository.listPaymentModes(companyId);
    if (existing.length > 0) {
      return existing.map((record) => settingsRepository.toPaymentMode(record));
    }

    const seeded = await settingsRepository.createPaymentModes(
      DEFAULT_PAYMENT_MODE_SEED.map((mode) => ({
        companyId,
        ...mode
      }))
    );

    return seeded.map((record) => settingsRepository.toPaymentMode(record));
  }

  private async ensureInvoiceTemplatesSeeded(companyId: string) {
    const existing = await settingsRepository.listInvoiceTemplates(companyId);
    if (existing.length > 0) {
      return existing.map((record) => settingsRepository.toInvoiceTemplate(record));
    }

    const seeded = await settingsRepository.createInvoiceTemplates(
      DEFAULT_INVOICE_TEMPLATE_SEED.map((template) => ({
        companyId,
        ...template
      }))
    );

    return seeded.map((record) => settingsRepository.toInvoiceTemplate(record));
  }

  private async ensureSingleDefaultPaymentMode(
    companyId: string,
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
    preferredId?: string
  ) {
    const paymentModeRows = await settingsRepository.listPaymentModes(companyId, executor);
    const activeModes = paymentModeRows.filter((record) => record.isEnabled);
    const currentDefault = activeModes.find((record) => record.isDefault);

    if (currentDefault) {
      return settingsRepository.toPaymentMode(currentDefault);
    }

    const replacement =
      activeModes.find((record) => record.id === preferredId) ??
      activeModes[0];

    if (!replacement) {
      return null;
    }

    const updated = await settingsRepository.updatePaymentMode(
      companyId,
      replacement.id,
      {
        isDefault: true
      },
      executor
    );

    return updated ? settingsRepository.toPaymentMode(updated) : null;
  }

  private async ensureSingleDefaultInvoiceTemplate(
    companyId: string,
    invoiceType: InvoiceType,
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
    preferredId?: string
  ) {
    const templateRows = await settingsRepository.listInvoiceTemplates(companyId, executor);
    const relevant = templateRows.filter((record) => record.invoiceType === invoiceType && record.isActive);
    const currentDefault = relevant.find((record) => record.isDefault);

    if (currentDefault) {
      return settingsRepository.toInvoiceTemplate(currentDefault);
    }

    const replacement =
      relevant.find((record) => record.id === preferredId) ??
      relevant[0];

    if (!replacement) {
      return null;
    }

    const updated = await settingsRepository.updateInvoiceTemplate(
      companyId,
      replacement.id,
      {
        isDefault: true
      },
      executor
    );

    return updated ? settingsRepository.toInvoiceTemplate(updated) : null;
  }

  private buildUiPreferences(value: UiPreferenceRecord | null, companyId: string, userId: string) {
    return value ?? DEFAULT_UI_PREFERENCES(companyId, userId);
  }

  private canAccess(actor: SettingsActor, required: PermissionKey[]) {
    return required.some((permission) => actor.permissions.includes(permission));
  }

  public async getOverview(actor: SettingsActor) {
    const users = await settingsRepository.listUsersForPermissions(actor.companyId);
    const paymentModeRows = await settingsRepository.listPaymentModes(actor.companyId);
    const templateRows = await settingsRepository.listInvoiceTemplates(actor.companyId);
    const taxSettings = await this.getTaxSettingsRecord(actor.companyId);
    const uiPreferences = await settingsRepository.findUiPreferences(actor.companyId, actor.id);
    const profile = await this.getProfileSettings(actor);

    const sections: OverviewSection[] = [
      {
        key: "permissions",
        label: "Permissions",
        status: this.canAccess(actor, ["settings.view", "permissions.manage"]) ? "configured" : "restricted",
        summary: `${users.length} users across 4 roles`,
        accessible: this.canAccess(actor, ["settings.view", "permissions.manage"]),
        missingItems: []
      },
      {
        key: "invoiceTemplates",
        label: "Invoice Templates",
        status: templateRows.length > 0 ? "configured" : this.canAccess(actor, ["invoice.settings.manage"]) ? "attention" : "restricted",
        summary: templateRows.length > 0 ? `${templateRows.length} templates configured` : "No invoice template configured yet",
        accessible: this.canAccess(actor, ["invoice.settings.manage"]),
        missingItems: templateRows.length > 0 ? [] : ["Create at least one active default template"]
      },
      {
        key: "taxSettings",
        label: "Tax Settings",
        status: this.canAccess(actor, ["tax.settings.manage"])
          ? taxSettings.gstEnabled || taxSettings.compositionScheme
            ? "configured"
            : "attention"
          : "restricted",
        summary: taxSettings.gstEnabled
          ? `GST enabled at ${taxSettings.defaultGstRate}% default rate`
          : "GST is currently disabled",
        accessible: this.canAccess(actor, ["tax.settings.manage"]),
        missingItems: taxSettings.gstEnabled ? [] : ["Review GST defaults before go-live"]
      },
      {
        key: "paymentModes",
        label: "Payment Modes",
        status: paymentModeRows.length > 0 ? "configured" : this.canAccess(actor, ["payment.settings.manage"]) ? "attention" : "restricted",
        summary: paymentModeRows.length > 0 ? `${paymentModeRows.filter((row) => row.isEnabled).length} enabled modes` : "No payment mode configured yet",
        accessible: this.canAccess(actor, ["payment.settings.manage"]),
        missingItems: paymentModeRows.some((row) => row.isDefault && row.isEnabled) ? [] : ["Set one enabled default payment mode"]
      },
      {
        key: "theme",
        label: "Theme",
        status: this.canAccess(actor, ["profile.manage", "settings.manage"]) ? "configured" : "restricted",
        summary: uiPreferences ? "Custom UI preferences saved" : "Using system defaults",
        accessible: this.canAccess(actor, ["profile.manage", "settings.manage"]),
        missingItems: []
      },
      {
        key: "profile",
        label: "Profile",
        status: profile.user.fullName && profile.user.email ? "configured" : "attention",
        summary: profile.user.mobileNumber ? "Profile contact details are set" : "Mobile number can be added for contact clarity",
        accessible: this.canAccess(actor, ["profile.manage"]),
        missingItems: profile.user.mobileNumber ? [] : ["Add a mobile number"]
      },
      {
        key: "systemPolish",
        label: "System Polish",
        status: "configured",
        summary: "Shared states and responsive helpers are available app-wide",
        accessible: true,
        missingItems: []
      }
    ];

    return {
      sections,
      generatedAt: new Date()
    };
  }

  public async getPermissionsMatrix(actor: SettingsActor) {
    const roleMap = await permissionService.getRolePermissionMap(actor.companyId);
    const users = await settingsRepository.listUsersForPermissions(actor.companyId);

    const permissionMap = await permissionService.getEffectivePermissionsForUsers(
      actor.companyId,
      users.map((user) => ({
        id: user.id,
        role: user.role
      }))
    );

    return {
      roles: (["admin", "accountant", "staff", "auditor"] as RoleKey[]).map((role) => ({
        role,
        permissions: roleMap[role]
      })),
      users: users.map((user) => ({
        ...user,
        permissions: permissionMap.get(user.id) ?? []
      })),
      groups: this.buildPermissionGroups(),
      allPermissions: [...ALL_PERMISSIONS]
    };
  }

  public async updateUserPermissions(
    actor: SettingsActor,
    userId: string,
    permissions: PermissionKey[],
    context: SettingsRequestContext
  ) {
    const user = await usersRepository.findUserByIdAndCompany(userId, actor.companyId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const validPermissions = permissionService.assertValidPermissions(permissions);
    this.ensureCriticalAdminPermissions(
      user.role,
      validPermissions,
      "Admin users must retain critical settings permissions"
    );

    if (actor.id === userId && actor.role === "admin" && !hasAllPermissions(validPermissions, CRITICAL_ADMIN_PERMISSIONS)) {
      throw new AppError("You cannot remove your own critical admin permissions", 400);
    }

    const roleDefaults = await permissionService.getDefaultPermissionsByRole(user.role, actor.companyId);
    const isSameAsRoleDefault =
      roleDefaults.length === validPermissions.length &&
      roleDefaults.every((permission) => validPermissions.includes(permission));

    if (isSameAsRoleDefault) {
      await permissionService.clearUserPermissionOverride(actor.companyId, userId);
      await permissionService.replacePermissions(userId, []);
    } else {
      await permissionService.setUserPermissionOverride(actor.companyId, userId, validPermissions, actor.id);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      userNameSnapshot: actor.email,
      userRoleSnapshot: actor.role,
      action: "permissions_updated",
      module: "settings",
      entityType: "user_permission_override",
      entityId: userId,
      newValues: {
        permissions: validPermissions
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      userId,
      permissions: validPermissions
    };
  }

  public async updateRolePermissions(
    actor: SettingsActor,
    role: RoleKey,
    permissions: PermissionKey[],
    context: SettingsRequestContext
  ) {
    const validPermissions = permissionService.assertValidPermissions(permissions);
    this.ensureCriticalAdminPermissions(
      role,
      validPermissions,
      "Admin role must retain critical settings permissions"
    );

    if (actor.role === role && actor.role === "admin" && !hasAllPermissions(validPermissions, CRITICAL_ADMIN_PERMISSIONS)) {
      throw new AppError("You cannot remove your own critical admin permissions", 400);
    }

    const updatedRoleMap = await permissionService.setRolePermissions(actor.companyId, role, validPermissions, actor.id);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      userRoleSnapshot: actor.role,
      action: "permissions_updated",
      module: "settings",
      entityType: "role_permission_override",
      entityId: role,
      newValues: {
        permissions: validPermissions
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      role,
      permissions: updatedRoleMap[role]
    };
  }

  public async listInvoiceTemplates(companyId: string) {
    return this.ensureInvoiceTemplatesSeeded(companyId);
  }

  public async createInvoiceTemplate(
    actor: SettingsActor,
    input: {
      templateKey?: string;
      templateName: string;
      invoiceType: InvoiceType;
      layoutConfig: InvoiceLayoutConfig;
      isDefault: boolean;
      isActive: boolean;
    },
    context: SettingsRequestContext
  ) {
    if (input.isDefault && !input.isActive) {
      throw new AppError("A default invoice template must be active", 400);
    }

    const template = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.listInvoiceTemplates(actor.companyId, transaction);
      const existingForType = existing.filter((record) => record.invoiceType === input.invoiceType);
      const shouldBeDefault = input.isDefault || existingForType.length === 0;

      if (shouldBeDefault) {
        await settingsRepository.clearDefaultInvoiceTemplates(actor.companyId, input.invoiceType, undefined, transaction);
      }

      const created = await settingsRepository.createInvoiceTemplate(
        {
          companyId: actor.companyId,
          templateKey: input.templateKey
            ? normalizeTextKey(input.templateKey)
            : `${input.invoiceType}_${normalizeTextKey(input.templateName)}`,
          templateName: input.templateName,
          invoiceType: input.invoiceType,
          layoutConfig: input.layoutConfig,
          isDefault: shouldBeDefault,
          isActive: input.isActive
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create invoice template", 500);
      }

      await this.ensureSingleDefaultInvoiceTemplate(actor.companyId, input.invoiceType, transaction, created.id);
      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invoice_template_created",
      module: "settings",
      entityType: "invoice_template",
      entityId: template.id,
      newValues: {
        templateName: template.templateName,
        invoiceType: template.invoiceType
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toInvoiceTemplate(template);
  }

  public async updateInvoiceTemplate(
    actor: SettingsActor,
    id: string,
    input: {
      templateKey?: string;
      templateName?: string;
      invoiceType?: InvoiceType;
      layoutConfig?: InvoiceLayoutConfig;
      isDefault?: boolean;
      isActive?: boolean;
    },
    context: SettingsRequestContext
  ) {
    const template = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findInvoiceTemplateById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Invoice template not found", 404);
      }

      const nextInvoiceType = input.invoiceType ?? existing.invoiceType;
      const nextIsActive = input.isActive ?? existing.isActive;
      const nextIsDefault = input.isDefault ?? existing.isDefault;

      if (nextIsDefault && !nextIsActive) {
        throw new AppError("A default invoice template must be active", 400);
      }

      if (nextIsDefault) {
        await settingsRepository.clearDefaultInvoiceTemplates(actor.companyId, nextInvoiceType, id, transaction);
      }

      const updated = await settingsRepository.updateInvoiceTemplate(
        actor.companyId,
        id,
        {
          templateKey: input.templateKey ? normalizeTextKey(input.templateKey) : existing.templateKey,
          templateName: input.templateName ?? existing.templateName,
          invoiceType: nextInvoiceType,
          layoutConfig: input.layoutConfig ?? (existing.layoutConfig as InvoiceLayoutConfig),
          isDefault: nextIsDefault,
          isActive: nextIsActive
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update invoice template", 500);
      }

      await this.ensureSingleDefaultInvoiceTemplate(actor.companyId, nextInvoiceType, transaction, updated.id);
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invoice_template_updated",
      module: "settings",
      entityType: "invoice_template",
      entityId: template.id,
      newValues: pickDefined(input),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toInvoiceTemplate(template);
  }

  public async setDefaultInvoiceTemplate(actor: SettingsActor, id: string, context: SettingsRequestContext) {
    const template = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findInvoiceTemplateById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Invoice template not found", 404);
      }

      if (!existing.isActive) {
        throw new AppError("Only active invoice templates can be set as default", 400);
      }

      await settingsRepository.clearDefaultInvoiceTemplates(actor.companyId, existing.invoiceType, id, transaction);
      const updated = await settingsRepository.updateInvoiceTemplate(
        actor.companyId,
        id,
        { isDefault: true },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update invoice template", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invoice_template_default_changed",
      module: "settings",
      entityType: "invoice_template",
      entityId: template.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toInvoiceTemplate(template);
  }

  public async deleteInvoiceTemplate(actor: SettingsActor, id: string, context: SettingsRequestContext) {
    await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findInvoiceTemplateById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Invoice template not found", 404);
      }

      await settingsRepository.deleteInvoiceTemplate(actor.companyId, id, transaction);
      await this.ensureSingleDefaultInvoiceTemplate(actor.companyId, existing.invoiceType, transaction);
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invoice_template_deleted",
      module: "settings",
      entityType: "invoice_template",
      entityId: id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async getTaxSettings(companyId: string) {
    return this.getTaxSettingsRecord(companyId);
  }

  public async updateTaxSettings(
    actor: SettingsActor,
    input: Partial<TaxSettings>,
    context: SettingsRequestContext
  ) {
    const existing = await this.getTaxSettingsRecord(actor.companyId);
    const merged = this.normalizeTaxSettings({
      ...existing,
      ...pickDefined(input)
    });

    await settingsRepository.upsertAppSetting(
      actor.companyId,
      TAX_SETTINGS_KEY,
      "tax",
      merged,
      actor.id
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "tax_settings_updated",
      module: "settings",
      entityType: "app_setting",
      entityId: TAX_SETTINGS_KEY,
      newValues: merged,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return merged;
  }

  public async listPaymentModes(companyId: string) {
    return this.ensurePaymentModesSeeded(companyId);
  }

  public async createPaymentMode(
    actor: SettingsActor,
    input: {
      modeKey: PaymentModeKey;
      modeName: string;
      isEnabled: boolean;
      isDefault: boolean;
      requiresReference: boolean;
      requiresBankAccount: boolean;
      chequeWorkflowEnabled: boolean;
    },
    context: SettingsRequestContext
  ) {
    if (input.isDefault && !input.isEnabled) {
      throw new AppError("A default payment mode must be enabled", 400);
    }

    const paymentMode = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.listPaymentModes(actor.companyId, transaction);
      const shouldBeDefault = input.isDefault || existing.filter((record) => record.isEnabled).length === 0;

      if (shouldBeDefault) {
        await settingsRepository.clearDefaultPaymentModes(actor.companyId, undefined, transaction);
      }

      const created = await settingsRepository.createPaymentMode(
        {
          companyId: actor.companyId,
          modeKey: input.modeKey,
          modeName: input.modeName,
          isEnabled: input.isEnabled,
          isDefault: shouldBeDefault,
          requiresReference: input.requiresReference,
          requiresBankAccount: input.requiresBankAccount,
          chequeWorkflowEnabled: input.chequeWorkflowEnabled
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create payment mode", 500);
      }

      await this.ensureSingleDefaultPaymentMode(actor.companyId, transaction, created.id);
      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_mode_created",
      module: "settings",
      entityType: "payment_mode",
      entityId: paymentMode.id,
      newValues: {
        modeKey: paymentMode.modeKey,
        modeName: paymentMode.modeName
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toPaymentMode(paymentMode);
  }

  public async updatePaymentMode(
    actor: SettingsActor,
    id: string,
    input: {
      modeKey?: PaymentModeKey;
      modeName?: string;
      isEnabled?: boolean;
      isDefault?: boolean;
      requiresReference?: boolean;
      requiresBankAccount?: boolean;
      chequeWorkflowEnabled?: boolean;
    },
    context: SettingsRequestContext
  ) {
    const paymentMode = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findPaymentModeById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Payment mode not found", 404);
      }

      const nextIsEnabled = input.isEnabled ?? existing.isEnabled;
      const nextIsDefault = input.isDefault ?? existing.isDefault;
      if (nextIsDefault && !nextIsEnabled) {
        throw new AppError("A default payment mode must be enabled", 400);
      }

      if (nextIsDefault) {
        await settingsRepository.clearDefaultPaymentModes(actor.companyId, id, transaction);
      }

      const updated = await settingsRepository.updatePaymentMode(
        actor.companyId,
        id,
        {
          modeKey: input.modeKey ?? (existing.modeKey as PaymentModeKey),
          modeName: input.modeName ?? existing.modeName,
          isEnabled: nextIsEnabled,
          isDefault: nextIsDefault,
          requiresReference: input.requiresReference ?? existing.requiresReference,
          requiresBankAccount: input.requiresBankAccount ?? existing.requiresBankAccount,
          chequeWorkflowEnabled: input.chequeWorkflowEnabled ?? existing.chequeWorkflowEnabled
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update payment mode", 500);
      }

      await this.ensureSingleDefaultPaymentMode(actor.companyId, transaction, updated.id);
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_mode_updated",
      module: "settings",
      entityType: "payment_mode",
      entityId: paymentMode.id,
      newValues: pickDefined(input),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toPaymentMode(paymentMode);
  }

  public async setDefaultPaymentMode(actor: SettingsActor, id: string, context: SettingsRequestContext) {
    const paymentMode = await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findPaymentModeById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Payment mode not found", 404);
      }

      if (!existing.isEnabled) {
        throw new AppError("Only enabled payment modes can be set as default", 400);
      }

      await settingsRepository.clearDefaultPaymentModes(actor.companyId, id, transaction);
      const updated = await settingsRepository.updatePaymentMode(
        actor.companyId,
        id,
        {
          isDefault: true
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update payment mode", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_mode_default_changed",
      module: "settings",
      entityType: "payment_mode",
      entityId: paymentMode.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toPaymentMode(paymentMode);
  }

  public async deletePaymentMode(actor: SettingsActor, id: string, context: SettingsRequestContext) {
    await db.transaction(async (transaction) => {
      const existing = await settingsRepository.findPaymentModeById(actor.companyId, id, transaction);
      if (!existing) {
        throw new AppError("Payment mode not found", 404);
      }

      await settingsRepository.deletePaymentMode(actor.companyId, id, transaction);
      await this.ensureSingleDefaultPaymentMode(actor.companyId, transaction);
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_mode_deleted",
      module: "settings",
      entityType: "payment_mode",
      entityId: id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async getUiPreferences(actor: SettingsActor) {
    const preferences = await settingsRepository.findUiPreferences(actor.companyId, actor.id);
    return this.buildUiPreferences(
      preferences ? settingsRepository.toUiPreference(preferences) : null,
      actor.companyId,
      actor.id
    );
  }

  public async updateUiPreferences(
    actor: SettingsActor,
    input: {
      accentColor?: string | null;
      compactMode?: boolean;
      tableDensity?: TableDensity;
      dateFormat?: DateFormatValue;
      currencyFormat?: CurrencyFormatValue;
      numberFormat?: NumberFormatValue;
    },
    context: SettingsRequestContext
  ) {
    const existing = await this.getUiPreferences(actor);
    const merged = {
      ...existing,
      ...pickDefined(input)
    };

    const updated = await settingsRepository.upsertUiPreferences(actor.companyId, actor.id, {
      accentColor: merged.accentColor,
      compactMode: merged.compactMode,
      tableDensity: merged.tableDensity,
      dateFormat: merged.dateFormat,
      currencyFormat: merged.currencyFormat,
      numberFormat: merged.numberFormat
    });

    if (!updated) {
      throw new AppError("Failed to update UI preferences", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "ui_preferences_updated",
      module: "settings",
      entityType: "user_ui_preferences",
      entityId: updated.id,
      newValues: pickDefined(input),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return settingsRepository.toUiPreference(updated);
  }

  public async getProfileSettings(actor: SettingsActor) {
    const user = await usersRepository.findById(actor.id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role
      },
      company: company
        ? {
            id: company.id,
            name: company.name
          }
        : null,
      session: {
        lastLoginAt: user.lastLoginAt
      }
    };
  }

  public async updateProfileSettings(
    actor: SettingsActor,
    input: {
      fullName: string;
      mobileNumber?: string | null;
    },
    context: SettingsRequestContext
  ) {
    const user = await usersRepository.findById(actor.id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.mobileNumber && input.mobileNumber !== user.mobileNumber) {
      const existingMobileUser = await usersRepository.findByMobileNumber(input.mobileNumber);
      if (existingMobileUser && existingMobileUser.id !== actor.id) {
        throw new AppError("Mobile number is already in use", 409);
      }
    }

    await usersRepository.updateProfile(actor.id, {
      fullName: input.fullName,
      mobileNumber: input.mobileNumber ?? null
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "profile_updated",
      module: "settings",
      entityType: "user",
      entityId: actor.id,
      newValues: pickDefined(input),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getProfileSettings(actor);
  }

  public async changePassword(
    actor: SettingsActor,
    sessionId: string,
    input: {
      currentPassword: string;
      newPassword: string;
    },
    context: SettingsRequestContext
  ) {
    await authService.changePassword(actor.id, sessionId, input, context);
  }

  public async logoutAll(actor: SettingsActor, context: SettingsRequestContext) {
    await authService.logoutAll(actor.id, context);
  }
}

export const settingsService = new SettingsService();
