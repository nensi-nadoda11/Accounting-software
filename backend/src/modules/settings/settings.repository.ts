import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { db } from "../../db";
import {
  appSettings,
  invoiceTemplates,
  paymentModes,
  userUiPreferences,
  users
} from "../../db/schema";
import type {
  InvoiceTemplateRecord,
  PaymentModeRecord,
  RoleKey,
  UiPreferenceRecord
} from "./settings.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

class SettingsRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  public async findAppSetting(companyId: string, settingKey: string, executor?: DbExecutor) {
    const [setting] = await this
      .getExecutor(executor)
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.companyId, companyId), eq(appSettings.settingKey, settingKey)))
      .limit(1);

    return setting ?? null;
  }

  public async findAppSettings(companyId: string, settingKeys: string[], executor?: DbExecutor) {
    if (settingKeys.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.companyId, companyId), inArray(appSettings.settingKey, settingKeys)));
  }

  public async upsertAppSetting(
    companyId: string,
    settingKey: string,
    settingGroup: string,
    settingValue: Record<string, unknown> | unknown[],
    updatedBy: string,
    executor?: DbExecutor
  ) {
    const [setting] = await this
      .getExecutor(executor)
      .insert(appSettings)
      .values({
        companyId,
        settingKey,
        settingGroup,
        settingValue,
        updatedBy
      })
      .onConflictDoUpdate({
        target: [appSettings.companyId, appSettings.settingKey],
        set: {
          settingGroup,
          settingValue,
          updatedBy,
          updatedAt: new Date()
        }
      })
      .returning();

    return setting ?? null;
  }

  public async listUsersForPermissions(companyId: string) {
    return db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        mobileNumber: users.mobileNumber,
        role: users.role,
        status: users.status
      })
      .from(users)
      .where(and(eq(users.companyId, companyId), isNull(users.deletedAt)))
      .orderBy(asc(users.fullName), asc(users.email));
  }

  public async listPaymentModes(companyId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(paymentModes)
      .where(eq(paymentModes.companyId, companyId))
      .orderBy(desc(paymentModes.isDefault), desc(paymentModes.isEnabled), asc(paymentModes.modeName));
  }

  public async createPaymentModes(
    values: Array<typeof paymentModes.$inferInsert>,
    executor?: DbExecutor
  ) {
    return this.getExecutor(executor).insert(paymentModes).values(values).returning();
  }

  public async createPaymentMode(
    value: typeof paymentModes.$inferInsert,
    executor?: DbExecutor
  ) {
    const [mode] = await this.getExecutor(executor).insert(paymentModes).values(value).returning();
    return mode ?? null;
  }

  public async findPaymentModeById(companyId: string, id: string, executor?: DbExecutor) {
    const [mode] = await this
      .getExecutor(executor)
      .select()
      .from(paymentModes)
      .where(and(eq(paymentModes.companyId, companyId), eq(paymentModes.id, id)))
      .limit(1);

    return mode ?? null;
  }

  public async clearDefaultPaymentModes(companyId: string, excludeId?: string, executor?: DbExecutor) {
    const conditions = [eq(paymentModes.companyId, companyId), eq(paymentModes.isDefault, true)];
    if (excludeId) {
      conditions.push(ne(paymentModes.id, excludeId));
    }

    await this
      .getExecutor(executor)
      .update(paymentModes)
      .set({
        isDefault: false,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async updatePaymentMode(
    companyId: string,
    id: string,
    value: Partial<typeof paymentModes.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [mode] = await this
      .getExecutor(executor)
      .update(paymentModes)
      .set({
        ...value,
        updatedAt: new Date()
      })
      .where(and(eq(paymentModes.companyId, companyId), eq(paymentModes.id, id)))
      .returning();

    return mode ?? null;
  }

  public async deletePaymentMode(companyId: string, id: string, executor?: DbExecutor) {
    const [mode] = await this
      .getExecutor(executor)
      .delete(paymentModes)
      .where(and(eq(paymentModes.companyId, companyId), eq(paymentModes.id, id)))
      .returning();

    return mode ?? null;
  }

  public async listInvoiceTemplates(companyId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.companyId, companyId))
      .orderBy(asc(invoiceTemplates.invoiceType), desc(invoiceTemplates.isDefault), asc(invoiceTemplates.templateName));
  }

  public async createInvoiceTemplates(
    values: Array<typeof invoiceTemplates.$inferInsert>,
    executor?: DbExecutor
  ) {
    return this.getExecutor(executor).insert(invoiceTemplates).values(values).returning();
  }

  public async createInvoiceTemplate(
    value: typeof invoiceTemplates.$inferInsert,
    executor?: DbExecutor
  ) {
    const [template] = await this.getExecutor(executor).insert(invoiceTemplates).values(value).returning();
    return template ?? null;
  }

  public async findInvoiceTemplateById(companyId: string, id: string, executor?: DbExecutor) {
    const [template] = await this
      .getExecutor(executor)
      .select()
      .from(invoiceTemplates)
      .where(and(eq(invoiceTemplates.companyId, companyId), eq(invoiceTemplates.id, id)))
      .limit(1);

    return template ?? null;
  }

  public async clearDefaultInvoiceTemplates(
    companyId: string,
    invoiceType: "sales" | "purchase" | "pos" | "return",
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions = [
      eq(invoiceTemplates.companyId, companyId),
      eq(invoiceTemplates.invoiceType, invoiceType),
      eq(invoiceTemplates.isDefault, true)
    ];

    if (excludeId) {
      conditions.push(ne(invoiceTemplates.id, excludeId));
    }

    await this
      .getExecutor(executor)
      .update(invoiceTemplates)
      .set({
        isDefault: false,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async updateInvoiceTemplate(
    companyId: string,
    id: string,
    value: Partial<typeof invoiceTemplates.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [template] = await this
      .getExecutor(executor)
      .update(invoiceTemplates)
      .set({
        ...value,
        updatedAt: new Date()
      })
      .where(and(eq(invoiceTemplates.companyId, companyId), eq(invoiceTemplates.id, id)))
      .returning();

    return template ?? null;
  }

  public async deleteInvoiceTemplate(companyId: string, id: string, executor?: DbExecutor) {
    const [template] = await this
      .getExecutor(executor)
      .delete(invoiceTemplates)
      .where(and(eq(invoiceTemplates.companyId, companyId), eq(invoiceTemplates.id, id)))
      .returning();

    return template ?? null;
  }

  public async findUiPreferences(companyId: string, userId: string, executor?: DbExecutor) {
    const [preferences] = await this
      .getExecutor(executor)
      .select()
      .from(userUiPreferences)
      .where(and(eq(userUiPreferences.companyId, companyId), eq(userUiPreferences.userId, userId)))
      .limit(1);

    return preferences ?? null;
  }

  public async upsertUiPreferences(
    companyId: string,
    userId: string,
    value: Omit<typeof userUiPreferences.$inferInsert, "companyId" | "userId">,
    executor?: DbExecutor
  ) {
    const [preferences] = await this
      .getExecutor(executor)
      .insert(userUiPreferences)
      .values({
        companyId,
        userId,
        ...value
      })
      .onConflictDoUpdate({
        target: [userUiPreferences.companyId, userUiPreferences.userId],
        set: {
          ...value,
          updatedAt: new Date()
        }
      })
      .returning();

    return preferences ?? null;
  }

  public toPaymentMode(record: typeof paymentModes.$inferSelect): PaymentModeRecord {
    return {
      id: record.id,
      companyId: record.companyId,
      modeKey: record.modeKey as PaymentModeRecord["modeKey"],
      modeName: record.modeName,
      isEnabled: record.isEnabled,
      isDefault: record.isDefault,
      requiresReference: record.requiresReference,
      requiresBankAccount: record.requiresBankAccount,
      chequeWorkflowEnabled: record.chequeWorkflowEnabled,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  public toInvoiceTemplate(record: typeof invoiceTemplates.$inferSelect): InvoiceTemplateRecord {
    return {
      id: record.id,
      companyId: record.companyId,
      templateKey: record.templateKey,
      templateName: record.templateName,
      invoiceType: record.invoiceType,
      layoutConfig: record.layoutConfig as InvoiceTemplateRecord["layoutConfig"],
      isDefault: record.isDefault,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  public toUiPreference(record: typeof userUiPreferences.$inferSelect): UiPreferenceRecord {
    return {
      id: record.id,
      companyId: record.companyId,
      userId: record.userId,
      accentColor: record.accentColor,
      compactMode: record.compactMode,
      tableDensity: record.tableDensity,
      dateFormat: record.dateFormat as UiPreferenceRecord["dateFormat"],
      currencyFormat: record.currencyFormat as UiPreferenceRecord["currencyFormat"],
      numberFormat: record.numberFormat as UiPreferenceRecord["numberFormat"],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}

export const settingsRepository = new SettingsRepository();
