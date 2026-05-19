import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  gte,
  ne,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  accountingEvents,
  employeeAttendance,
  employeeSalaryStructures,
  employees,
  payrollBonusDeductions,
  payrollItems,
  payrollRuns,
  salaryPayments,
  salarySlipLogs
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type EmployeeListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  status?: typeof employees.$inferSelect.status | undefined;
  department?: string | null | undefined;
  employmentType?: typeof employees.$inferSelect.employmentType | undefined;
};

type AttendanceListFilters = {
  companyId: string;
  page: number;
  limit: number;
  month?: string | undefined;
  employeeId?: string | undefined;
  department?: string | null | undefined;
};

type RunListFilters = {
  companyId: string;
  page: number;
  limit: number;
  month?: string | undefined;
  status?: typeof payrollRuns.$inferSelect.status | undefined;
};

type ItemListFilters = {
  companyId: string;
  page?: number | undefined;
  limit?: number | undefined;
  runId?: string | undefined;
  employeeId?: string | undefined;
  paymentStatus?: typeof payrollItems.$inferSelect.paymentStatus | undefined;
  payrollMonth?: string | undefined;
  department?: string | null | undefined;
};

type ReportFilters = {
  companyId: string;
  payrollMonth?: string | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  department?: string | null | undefined;
  employeeId?: string | undefined;
  runId?: string | undefined;
  includeCancelled?: boolean | undefined;
};

type PaymentReportFilters = ReportFilters & {
  paymentMode?: typeof salaryPayments.$inferSelect.paymentMode | undefined;
};

export class PayrollRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildEmployeeConditions(filters: Omit<EmployeeListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(employees.companyId, filters.companyId), isNull(employees.deletedAt)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(employees.fullName, searchPattern),
          ilike(employees.mobile, searchPattern),
          ilike(employees.email, searchPattern),
          ilike(employees.employeeCode, searchPattern),
          ilike(employees.department, searchPattern),
          ilike(employees.designation, searchPattern)
        )!
      );
    }

    if (filters.status) {
      conditions.push(eq(employees.status, filters.status));
    }

    if (filters.department) {
      conditions.push(eq(employees.department, filters.department));
    }

    if (filters.employmentType) {
      conditions.push(eq(employees.employmentType, filters.employmentType));
    }

    return conditions;
  }

  private buildAttendanceConditions(filters: AttendanceListFilters) {
    const conditions: SQL[] = [eq(employeeAttendance.companyId, filters.companyId)];

    if (filters.month) {
      conditions.push(eq(employeeAttendance.payrollMonth, filters.month));
    }

    if (filters.employeeId) {
      conditions.push(eq(employeeAttendance.employeeId, filters.employeeId));
    }

    if (filters.department) {
      conditions.push(eq(employees.department, filters.department));
    }

    return conditions;
  }

  private buildRunConditions(filters: RunListFilters) {
    const conditions: SQL[] = [eq(payrollRuns.companyId, filters.companyId)];

    if (filters.month) {
      conditions.push(eq(payrollRuns.payrollMonth, filters.month));
    }

    if (filters.status) {
      conditions.push(eq(payrollRuns.status, filters.status));
    }

    return conditions;
  }

  private buildItemConditions(filters: ItemListFilters) {
    const conditions: SQL[] = [eq(payrollItems.companyId, filters.companyId)];

    if (filters.runId) {
      conditions.push(eq(payrollItems.payrollRunId, filters.runId));
    }

    if (filters.employeeId) {
      conditions.push(eq(payrollItems.employeeId, filters.employeeId));
    }

    if (filters.paymentStatus) {
      conditions.push(eq(payrollItems.paymentStatus, filters.paymentStatus));
    }

    if (filters.payrollMonth) {
      conditions.push(eq(payrollRuns.payrollMonth, filters.payrollMonth));
    }

    if (filters.department) {
      conditions.push(eq(payrollItems.departmentSnapshot, filters.department));
    }

    return conditions;
  }

  private buildReportConditions(filters: ReportFilters) {
    const conditions: SQL[] = [eq(payrollRuns.companyId, filters.companyId)];

    if (!filters.includeCancelled) {
      conditions.push(ne(payrollRuns.status, "cancelled"));
    }

    if (filters.payrollMonth) {
      conditions.push(eq(payrollRuns.payrollMonth, filters.payrollMonth));
    }

    if (filters.dateFrom) {
      conditions.push(gte(payrollRuns.periodEnd, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(payrollRuns.periodStart, filters.dateTo));
    }

    if (filters.department) {
      conditions.push(eq(payrollItems.departmentSnapshot, filters.department));
    }

    if (filters.employeeId) {
      conditions.push(eq(payrollItems.employeeId, filters.employeeId));
    }

    if (filters.runId) {
      conditions.push(eq(payrollRuns.id, filters.runId));
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestEmployeeCode(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ employeeCode: employees.employeeCode })
      .from(employees)
      .where(eq(employees.companyId, companyId))
      .orderBy(desc(employees.employeeCode))
      .limit(1);

    return row?.employeeCode ?? null;
  }

  public async findLatestRunNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ runNumber: payrollRuns.runNumber })
      .from(payrollRuns)
      .where(eq(payrollRuns.companyId, companyId))
      .orderBy(desc(payrollRuns.runNumber))
      .limit(1);

    return row?.runNumber ?? null;
  }

  public async listEmployees(filters: EmployeeListFilters) {
    const whereClause = and(...this.buildEmployeeConditions(filters));
    const rows = await db
      .select()
      .from(employees)
      .where(whereClause)
      .orderBy(asc(employees.fullName), desc(employees.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(employees).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findEmployeeById(companyId: string, employeeId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(employees.companyId, companyId), eq(employees.id, employeeId)];
    if (!includeDeleted) {
      conditions.push(isNull(employees.deletedAt));
    }

    const [row] = await this.getExecutor(executor).select().from(employees).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async findEmployeeByMobile(companyId: string, mobile: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(employees.companyId, companyId), eq(employees.mobile, mobile), isNull(employees.deletedAt)];
    if (excludeId) {
      conditions.push(ne(employees.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(employees).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async findEmployeeByEmail(companyId: string, email: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(employees.companyId, companyId), eq(employees.email, email), isNull(employees.deletedAt)];
    if (excludeId) {
      conditions.push(ne(employees.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(employees).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createEmployee(data: typeof employees.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(employees).values(data).returning();
    return row ?? null;
  }

  public async updateEmployee(companyId: string, employeeId: string, data: Partial<typeof employees.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(employees)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(employees.companyId, companyId), eq(employees.id, employeeId)))
      .returning();

    return row ?? null;
  }

  public async hasPayrollHistory(companyId: string, employeeId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(payrollItems)
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.employeeId, employeeId)));

    return (row?.value ?? 0) > 0;
  }

  public async listSalaryStructuresByEmployee(companyId: string, employeeId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(employeeSalaryStructures)
      .where(and(eq(employeeSalaryStructures.companyId, companyId), eq(employeeSalaryStructures.employeeId, employeeId)))
      .orderBy(desc(employeeSalaryStructures.effectiveFrom), desc(employeeSalaryStructures.createdAt));
  }

  public async findSalaryStructureById(companyId: string, employeeId: string, structureId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(employeeSalaryStructures)
      .where(
        and(
          eq(employeeSalaryStructures.companyId, companyId),
          eq(employeeSalaryStructures.employeeId, employeeId),
          eq(employeeSalaryStructures.id, structureId)
        )
      )
      .limit(1);

    return row ?? null;
  }

  public async findActiveSalaryStructure(companyId: string, employeeId: string, effectiveDate: Date, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(employeeSalaryStructures)
      .where(
        and(
          eq(employeeSalaryStructures.companyId, companyId),
          eq(employeeSalaryStructures.employeeId, employeeId),
          eq(employeeSalaryStructures.isActive, true),
          lte(employeeSalaryStructures.effectiveFrom, effectiveDate),
          or(isNull(employeeSalaryStructures.effectiveTo), gte(employeeSalaryStructures.effectiveTo, effectiveDate))!
        )
      )
      .orderBy(desc(employeeSalaryStructures.effectiveFrom), desc(employeeSalaryStructures.createdAt))
      .limit(1);

    return row ?? null;
  }

  public async createSalaryStructure(data: typeof employeeSalaryStructures.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(employeeSalaryStructures).values(data).returning();
    return row ?? null;
  }

  public async updateSalaryStructure(
    companyId: string,
    employeeId: string,
    structureId: string,
    data: Partial<typeof employeeSalaryStructures.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(employeeSalaryStructures)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(employeeSalaryStructures.companyId, companyId),
          eq(employeeSalaryStructures.employeeId, employeeId),
          eq(employeeSalaryStructures.id, structureId)
        )
      )
      .returning();

    return row ?? null;
  }

  public async closeActiveSalaryStructures(
    companyId: string,
    employeeId: string,
    effectiveTo: Date,
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(employeeSalaryStructures.companyId, companyId),
      eq(employeeSalaryStructures.employeeId, employeeId),
      eq(employeeSalaryStructures.isActive, true)
    ];

    if (excludeId) {
      conditions.push(ne(employeeSalaryStructures.id, excludeId));
    }

    await this
      .getExecutor(executor)
      .update(employeeSalaryStructures)
      .set({
        isActive: false,
        effectiveTo,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async listAttendance(filters: AttendanceListFilters) {
    const whereClause = and(...this.buildAttendanceConditions(filters));
    const rows = await db
      .select({
        attendance: employeeAttendance,
        employee: employees
      })
      .from(employeeAttendance)
      .innerJoin(employees, eq(employeeAttendance.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(employeeAttendance.payrollMonth), asc(employees.fullName))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(employeeAttendance)
      .innerJoin(employees, eq(employeeAttendance.employeeId, employees.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findAttendanceById(companyId: string, attendanceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(employeeAttendance)
      .where(and(eq(employeeAttendance.companyId, companyId), eq(employeeAttendance.id, attendanceId)))
      .limit(1);

    return row ?? null;
  }

  public async findAttendanceByEmployeeMonth(companyId: string, employeeId: string, payrollMonth: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(employeeAttendance)
      .where(
        and(
          eq(employeeAttendance.companyId, companyId),
          eq(employeeAttendance.employeeId, employeeId),
          eq(employeeAttendance.payrollMonth, payrollMonth)
        )
      )
      .limit(1);

    return row ?? null;
  }

  public async createAttendance(data: typeof employeeAttendance.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(employeeAttendance).values(data).returning();
    return row ?? null;
  }

  public async updateAttendance(
    companyId: string,
    attendanceId: string,
    data: Partial<typeof employeeAttendance.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(employeeAttendance)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(employeeAttendance.companyId, companyId), eq(employeeAttendance.id, attendanceId)))
      .returning();

    return row ?? null;
  }

  public async findRunById(companyId: string, runId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.id, runId)))
      .limit(1);

    return row ?? null;
  }

  public async findActiveRunByMonth(companyId: string, payrollMonth: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.payrollMonth, payrollMonth), ne(payrollRuns.status, "cancelled")))
      .limit(1);

    return row ?? null;
  }

  public async listRuns(filters: RunListFilters) {
    const whereClause = and(...this.buildRunConditions(filters));
    const rows = await db
      .select()
      .from(payrollRuns)
      .where(whereClause)
      .orderBy(desc(payrollRuns.payrollMonth), desc(payrollRuns.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(payrollRuns).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async createRun(data: typeof payrollRuns.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(payrollRuns).values(data).returning();
    return row ?? null;
  }

  public async updateRun(companyId: string, runId: string, data: Partial<typeof payrollRuns.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(payrollRuns)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.id, runId)))
      .returning();

    return row ?? null;
  }

  public async listPayrollGenerationRows(companyId: string, payrollMonth: string, effectiveDate: Date, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        employee: employees,
        structure: employeeSalaryStructures,
        attendance: employeeAttendance
      })
      .from(employees)
      .innerJoin(
        employeeSalaryStructures,
        and(
          eq(employeeSalaryStructures.employeeId, employees.id),
          eq(employeeSalaryStructures.companyId, companyId),
          eq(employeeSalaryStructures.isActive, true),
          lte(employeeSalaryStructures.effectiveFrom, effectiveDate),
          or(isNull(employeeSalaryStructures.effectiveTo), gte(employeeSalaryStructures.effectiveTo, effectiveDate))!
        )
      )
      .leftJoin(
        employeeAttendance,
        and(
          eq(employeeAttendance.companyId, companyId),
          eq(employeeAttendance.employeeId, employees.id),
          eq(employeeAttendance.payrollMonth, payrollMonth)
        )
      )
      .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"), isNull(employees.deletedAt)))
      .orderBy(asc(employees.fullName), desc(employeeSalaryStructures.effectiveFrom));
  }

  public async deleteItemsByRun(companyId: string, runId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(payrollItems)
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.payrollRunId, runId)));
  }

  public async createPayrollItems(data: Array<typeof payrollItems.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(payrollItems).values(data).returning();
  }

  public async findPayrollItemById(companyId: string, itemId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.id, itemId)))
      .limit(1);

    return row ?? null;
  }

  public async listRunItems(companyId: string, runId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: payrollItems,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.payrollRunId, runId)))
      .orderBy(asc(payrollItems.employeeNameSnapshot));
  }

  public async listItems(filters: ItemListFilters) {
    const whereClause = and(...this.buildItemConditions(filters));
    const query = db
      .select({
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(payrollRuns.payrollMonth), asc(payrollItems.employeeNameSnapshot));

    if (filters.page && filters.limit) {
      const rows = await query.limit(filters.limit).offset((filters.page - 1) * filters.limit);
      const [totalRow] = await db
        .select({ value: count() })
        .from(payrollItems)
        .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
        .where(whereClause);

      return {
        rows,
        total: totalRow?.value ?? 0
      };
    }

    const rows = await query;
    return {
      rows,
      total: rows.length
    };
  }

  public async updatePayrollItem(companyId: string, itemId: string, data: Partial<typeof payrollItems.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(payrollItems)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.id, itemId)))
      .returning();

    return row ?? null;
  }

  public async deleteBonusDeductionsByItem(companyId: string, itemId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(payrollBonusDeductions)
      .where(and(eq(payrollBonusDeductions.companyId, companyId), eq(payrollBonusDeductions.payrollItemId, itemId)));
  }

  public async createBonusDeductions(data: Array<typeof payrollBonusDeductions.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(payrollBonusDeductions).values(data).returning();
  }

  public async listBonusDeductionsByItem(companyId: string, itemId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(payrollBonusDeductions)
      .where(and(eq(payrollBonusDeductions.companyId, companyId), eq(payrollBonusDeductions.payrollItemId, itemId)))
      .orderBy(asc(payrollBonusDeductions.createdAt));
  }

  public async listBonusDeductionsByRun(companyId: string, runId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        bonusDeduction: payrollBonusDeductions,
        itemId: payrollItems.id
      })
      .from(payrollBonusDeductions)
      .innerJoin(payrollItems, eq(payrollBonusDeductions.payrollItemId, payrollItems.id))
      .where(and(eq(payrollBonusDeductions.companyId, companyId), eq(payrollItems.payrollRunId, runId)))
      .orderBy(asc(payrollItems.employeeNameSnapshot), asc(payrollBonusDeductions.createdAt));
  }

  public async createSalaryPayments(data: Array<typeof salaryPayments.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(salaryPayments).values(data).returning();
  }

  public async listSalaryPaymentsByRun(companyId: string, runId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(salaryPayments)
      .where(and(eq(salaryPayments.companyId, companyId), eq(salaryPayments.payrollRunId, runId)))
      .orderBy(desc(salaryPayments.paymentDate), desc(salaryPayments.createdAt));
  }

  public async createSalarySlipLog(data: typeof salarySlipLogs.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(salarySlipLogs).values(data).returning();
    return row ?? null;
  }

  public async createAccountingEvent(data: typeof accountingEvents.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountingEvents).values(data).returning();
    return row ?? null;
  }

  public async listReportItems(filters: ReportFilters, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(...this.buildReportConditions(filters)))
      .orderBy(desc(payrollRuns.payrollMonth), asc(payrollItems.employeeNameSnapshot));
  }

  public async listBonusDeductionReportRows(filters: ReportFilters, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        bonusDeduction: payrollBonusDeductions,
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(payrollBonusDeductions)
      .innerJoin(payrollItems, eq(payrollBonusDeductions.payrollItemId, payrollItems.id))
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(...this.buildReportConditions(filters)))
      .orderBy(desc(payrollRuns.payrollMonth), asc(employees.fullName), asc(payrollBonusDeductions.createdAt));
  }

  public async listPaymentReportRows(filters: PaymentReportFilters, executor?: DbExecutor) {
    const conditions = this.buildReportConditions(filters);
    if (filters.paymentMode) {
      conditions.push(eq(salaryPayments.paymentMode, filters.paymentMode));
    }

    return this
      .getExecutor(executor)
      .select({
        payment: salaryPayments,
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(salaryPayments)
      .innerJoin(payrollRuns, eq(salaryPayments.payrollRunId, payrollRuns.id))
      .leftJoin(payrollItems, eq(salaryPayments.payrollItemId, payrollItems.id))
      .innerJoin(employees, eq(salaryPayments.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(salaryPayments.paymentDate), desc(salaryPayments.createdAt));
  }

  public async listUnpaidItems(filters: ReportFilters & { page: number; limit: number }) {
    const conditions = this.buildReportConditions(filters);
    conditions.push(sql`${payrollItems.paidAmount} < ${payrollItems.netSalary}`);

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        item: payrollItems,
        run: payrollRuns,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(payrollRuns.payrollMonth), asc(employees.fullName))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }
}

export const payrollRepository = new PayrollRepository();
