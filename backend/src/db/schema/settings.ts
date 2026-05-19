import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const invoiceTemplateTypeEnum = pgEnum("invoice_template_type", [
  "sales",
  "purchase",
  "pos",
  "return"
]);

export const tableDensityEnum = pgEnum("table_density", ["compact", "normal"]);

export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    settingKey: text("setting_key").notNull(),
    settingValue: jsonb("setting_value").$type<Record<string, unknown> | unknown[]>().notNull().default({}),
    settingGroup: text("setting_group").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyKeyUniqueIdx: uniqueIndex("app_settings_company_key_unique_idx").on(table.companyId, table.settingKey),
    companyGroupIdx: index("app_settings_company_group_idx").on(table.companyId, table.settingGroup)
  })
);

export const paymentModes = pgTable(
  "payment_modes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    modeKey: text("mode_key").notNull(),
    modeName: text("mode_name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    requiresReference: boolean("requires_reference").notNull().default(false),
    requiresBankAccount: boolean("requires_bank_account").notNull().default(false),
    chequeWorkflowEnabled: boolean("cheque_workflow_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyModeKeyUniqueIdx: uniqueIndex("payment_modes_company_mode_key_unique_idx").on(table.companyId, table.modeKey),
    companyDefaultEnabledUniqueIdx: uniqueIndex("payment_modes_company_default_enabled_unique_idx")
      .on(table.companyId)
      .where(sql`${table.isDefault} = true AND ${table.isEnabled} = true`),
    companyIdx: index("payment_modes_company_idx").on(table.companyId)
  })
);

export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    templateName: text("template_name").notNull(),
    invoiceType: invoiceTemplateTypeEnum("invoice_type").notNull(),
    layoutConfig: jsonb("layout_config").$type<Record<string, unknown>>().notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyTemplateKeyUniqueIdx: uniqueIndex("invoice_templates_company_template_key_unique_idx").on(
      table.companyId,
      table.templateKey
    ),
    companyTypeDefaultUniqueIdx: uniqueIndex("invoice_templates_company_type_default_unique_idx")
      .on(table.companyId, table.invoiceType)
      .where(sql`${table.isDefault} = true AND ${table.isActive} = true`),
    companyIdx: index("invoice_templates_company_idx").on(table.companyId)
  })
);

export const userUiPreferences = pgTable(
  "user_ui_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accentColor: text("accent_color"),
    compactMode: boolean("compact_mode").notNull().default(true),
    tableDensity: tableDensityEnum("table_density").notNull().default("compact"),
    dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
    currencyFormat: text("currency_format").notNull().default("symbol_first"),
    numberFormat: text("number_format").notNull().default("indian"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyUserUniqueIdx: uniqueIndex("user_ui_preferences_company_user_unique_idx").on(table.companyId, table.userId),
    companyIdx: index("user_ui_preferences_company_idx").on(table.companyId),
    userIdx: index("user_ui_preferences_user_idx").on(table.userId)
  })
);
