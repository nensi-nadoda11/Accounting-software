import { and, count, desc, eq, ilike, isNull } from "drizzle-orm";
import type { PoolClient } from "pg";

import { db, pool } from "../../db";
import { backupRestoreLogs, backups, users } from "../../db/schema";
import type { BackupIncludeKey, BackupStatus, BackupType, RestoreMode, RestoreLogStatus } from "./audit.types";

type BackupTableDefinition = {
  name: string;
  include: BackupIncludeKey | "core";
  selectSql: string;
  deleteSql?: string | null;
  replaceStrategy?: "delete-and-upsert" | "upsert-only" | "replace-user-permissions";
  userReferenceColumns?: string[];
};

const companyScopedTable = (
  name: string,
  include: BackupIncludeKey,
  options?: Pick<BackupTableDefinition, "replaceStrategy" | "userReferenceColumns">
): BackupTableDefinition => ({
  name,
  include,
  selectSql: `select * from "${name}" where company_id = $1 order by id asc`,
  deleteSql: `delete from "${name}" where company_id = $1`,
  replaceStrategy: options?.replaceStrategy ?? "delete-and-upsert",
  userReferenceColumns: options?.userReferenceColumns ?? []
});

const BACKUP_INCLUDE_DEPENDENCIES: Record<BackupIncludeKey, BackupIncludeKey[]> = {
  settings: [],
  users: [],
  customers: ["users"],
  suppliers: ["users"],
  products: ["users"],
  inventory: ["products", "settings", "users"],
  sales: ["customers", "inventory", "settings", "users"],
  purchases: ["suppliers", "inventory", "settings", "users"],
  payments: ["settings", "users"],
  accounting: ["settings", "users"],
  expenses: ["accounting", "settings", "users"],
  payroll: ["settings", "users"],
  gst: ["users"]
};

const BACKUP_TABLES: BackupTableDefinition[] = [
  {
    name: "companies",
    include: "core",
    selectSql: `select * from "companies" where id = $1`,
    replaceStrategy: "upsert-only"
  },
  companyScopedTable("company_tax_settings", "settings"),
  companyScopedTable("company_financial_years", "settings"),
  companyScopedTable("company_bank_accounts", "settings"),
  companyScopedTable("company_invoice_settings", "settings"),
  companyScopedTable("company_branding", "settings"),
  companyScopedTable("company_branches", "settings"),
  companyScopedTable("company_preferences", "settings"),
  {
    name: "users",
    include: "users",
    selectSql: `
      select
        id,
        company_id,
        full_name,
        email,
        mobile_number,
        role,
        status,
        email_verified_at,
        mobile_verified_at,
        last_login_at,
        deleted_at,
        created_at,
        updated_at
      from "users"
      where company_id = $1
      order by id asc
    `,
    replaceStrategy: "upsert-only"
  },
  {
    name: "user_permissions",
    include: "users",
    selectSql: `
      select up.*
      from "user_permissions" up
      inner join "users" u on u.id = up.user_id
      where u.company_id = $1
      order by up.id asc
    `,
    deleteSql: `
      delete from "user_permissions"
      where user_id in (select id from "users" where company_id = $1)
    `,
    replaceStrategy: "replace-user-permissions"
  },
  companyScopedTable("customers", "customers", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("suppliers", "suppliers", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("product_categories", "products", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("product_units", "products", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("products", "products", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("product_price_history", "products", { userReferenceColumns: ["changed_by"] }),
  companyScopedTable("warehouses", "inventory", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("chart_of_accounts", "accounting", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("product_batches", "inventory", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("stock_balances", "inventory"),
  companyScopedTable("stock_movements", "inventory", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("stock_adjustments", "inventory", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("inventory_alerts", "inventory"),
  companyScopedTable("inventory_valuation_snapshots", "inventory", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("expense_categories", "expenses", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("recurring_expenses", "expenses", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("expenses", "expenses", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("expense_attachments", "expenses", { userReferenceColumns: ["uploaded_by"] }),
  companyScopedTable("purchase_invoices", "purchases", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("purchase_invoice_items", "purchases"),
  companyScopedTable("purchase_payments", "purchases", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("purchase_returns", "purchases", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("purchase_return_items", "purchases"),
  companyScopedTable("sales_invoices", "sales", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("sales_invoice_items", "sales"),
  companyScopedTable("sales_payments", "sales", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("sales_returns", "sales", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("sales_return_items", "sales"),
  companyScopedTable("sales_invoice_send_logs", "sales", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("payments", "payments", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("payment_allocations", "payments", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("payment_receipts", "payments", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("payment_reminders", "payments", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("cheque_transactions", "payments", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("journal_entries", "accounting", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("journal_entry_lines", "accounting"),
  companyScopedTable("account_opening_balances", "accounting", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("financial_period_locks", "accounting", { userReferenceColumns: ["locked_by"] }),
  companyScopedTable("accounting_events", "accounting"),
  companyScopedTable("employees", "payroll", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("employee_salary_structures", "payroll", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("employee_attendance", "payroll", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("payroll_runs", "payroll", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("payroll_items", "payroll"),
  companyScopedTable("payroll_bonus_deductions", "payroll", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("salary_payments", "payroll", { userReferenceColumns: ["created_by"] }),
  companyScopedTable("salary_slip_logs", "payroll", { userReferenceColumns: ["generated_by"] }),
  companyScopedTable("gst_adjustments", "gst", { userReferenceColumns: ["created_by", "updated_by"] }),
  companyScopedTable("gst_itc_status", "gst"),
  companyScopedTable("gst_monthly_summaries", "gst")
];

const toQuotedIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const buildUpsertStatement = (tableName: string, row: Record<string, unknown>) => {
  const columns = Object.keys(row);
  const quotedColumns = columns.map(toQuotedIdentifier);
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updateColumns = columns.filter((column) => column !== "id");
  const updateSet =
    updateColumns.length > 0
      ? updateColumns.map((column) => `${toQuotedIdentifier(column)} = excluded.${toQuotedIdentifier(column)}`).join(", ")
      : `"id" = excluded."id"`;

  return {
    text: `
      insert into ${toQuotedIdentifier(tableName)} (${quotedColumns.join(", ")})
      values (${placeholders.join(", ")})
      on conflict ("id") do update
      set ${updateSet}
    `,
    values
  };
};

const sanitizeRowForRestore = (
  row: Record<string, unknown>,
  availableUserIds: Set<string>,
  userReferenceColumns: string[]
) => {
  if (userReferenceColumns.length === 0) {
    return row;
  }

  const nextRow = { ...row };
  for (const column of userReferenceColumns) {
    const value = nextRow[column];
    if (typeof value === "string" && !availableUserIds.has(value)) {
      nextRow[column] = null;
    }
  }

  return nextRow;
};

export class SecurityAdminBackupRepository {
  public getNormalizedIncludes(requested?: BackupIncludeKey[]) {
    const seed = requested && requested.length > 0 ? requested : (Object.keys(BACKUP_INCLUDE_DEPENDENCIES) as BackupIncludeKey[]);
    const result = new Set<BackupIncludeKey>();

    const visit = (includeKey: BackupIncludeKey) => {
      if (result.has(includeKey)) {
        return;
      }

      result.add(includeKey);
      for (const dependency of BACKUP_INCLUDE_DEPENDENCIES[includeKey]) {
        visit(dependency);
      }
    };

    seed.forEach(visit);
    return Array.from(result);
  }

  public async createBackupRecord(data: typeof backups.$inferInsert) {
    const [row] = await db.insert(backups).values(data).returning();
    return row ?? null;
  }

  public async updateBackupRecord(backupId: string, companyId: string, data: Partial<typeof backups.$inferInsert>) {
    const [row] = await db
      .update(backups)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(backups.id, backupId), eq(backups.companyId, companyId), isNull(backups.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listBackups(params: {
    companyId: string;
    page: number;
    limit: number;
    search?: string;
    status?: BackupStatus;
    backupType?: BackupType;
  }) {
    const conditions = [eq(backups.companyId, params.companyId), isNull(backups.deletedAt)];

    if (params.search) {
      conditions.push(ilike(backups.backupName, `%${params.search}%`));
    }

    if (params.status) {
      conditions.push(eq(backups.status, params.status));
    }

    if (params.backupType) {
      conditions.push(eq(backups.backupType, params.backupType));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        backup: backups,
        createdByName: users.fullName
      })
      .from(backups)
      .leftJoin(users, eq(backups.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(backups.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(backups).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findBackupById(companyId: string, backupId: string) {
    const [row] = await db
      .select()
      .from(backups)
      .where(and(eq(backups.id, backupId), eq(backups.companyId, companyId), isNull(backups.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async softDeleteBackup(companyId: string, backupId: string) {
    const [row] = await db
      .update(backups)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(backups.id, backupId), eq(backups.companyId, companyId), isNull(backups.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async createRestoreLog(data: {
    companyId: string;
    backupId: string;
    restoredBy: string;
    status: RestoreLogStatus;
    restoreMode: RestoreMode;
    errorMessage?: string | null;
  }) {
    const [row] = await db.insert(backupRestoreLogs).values(data).returning();
    return row ?? null;
  }

  public async collectBackupData(companyId: string, includes: BackupIncludeKey[]) {
    const activeIncludes = new Set(includes);
    const tables: Record<string, Record<string, unknown>[]> = {};
    const counts: Record<string, number> = {};

    for (const definition of BACKUP_TABLES) {
      if (definition.include !== "core" && !activeIncludes.has(definition.include)) {
        continue;
      }

      const result = await pool.query(definition.selectSql, [companyId]);
      tables[definition.name] = result.rows as Record<string, unknown>[];
      counts[definition.name] = result.rowCount ?? result.rows.length;
    }

    return {
      includes,
      tables,
      counts
    };
  }

  public async restoreBackupData(
    companyId: string,
    tables: Record<string, Record<string, unknown>[]>,
    restoreMode: RestoreMode
  ) {
    const client = await pool.connect();

    try {
      await client.query("begin");

      const availableUserIds = new Set<string>();
      const backupUsers = tables.users ?? [];
      for (const row of backupUsers) {
        if (typeof row.id === "string") {
          availableUserIds.add(row.id);
        }
      }

      if (availableUserIds.size === 0) {
        const currentUsers = await client.query<{ id: string }>(`select id from "users" where company_id = $1`, [companyId]);
        currentUsers.rows.forEach((row) => availableUserIds.add(row.id));
      }

      if (restoreMode === "replace") {
        for (const definition of [...BACKUP_TABLES].reverse()) {
          const rows = tables[definition.name];
          if (!rows) {
            continue;
          }

          if (!definition.deleteSql || definition.replaceStrategy === "upsert-only") {
            continue;
          }

          await client.query(definition.deleteSql, [companyId]);
        }
      }

      for (const definition of BACKUP_TABLES) {
        const rows = tables[definition.name];
        if (!rows || rows.length === 0) {
          continue;
        }

        if (definition.replaceStrategy === "replace-user-permissions" && definition.deleteSql) {
          await client.query(definition.deleteSql, [companyId]);
        }

        for (const row of rows) {
          const sanitizedRow = sanitizeRowForRestore(row, availableUserIds, definition.userReferenceColumns ?? []);
          const statement = buildUpsertStatement(definition.name, sanitizedRow);
          await client.query(statement.text, statement.values);
        }
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

export const securityAdminBackupRepository = new SecurityAdminBackupRepository();
