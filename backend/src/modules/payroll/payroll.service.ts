import { and, eq, gte, lte, ne } from "drizzle-orm";

import { db } from "../../db";
import { companyRepository } from "../company/company.repository";
import { accountingRepository } from "../accounting/accounting.repository";
import { accountingService } from "../accounting/accounting.service";
import { auditLogService } from "../audit-logs/audit-log.service";
import { emailService } from "../../services/email.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { employees, employeeAttendance, financialPeriodLocks, payrollItems } from "../../db/schema";
import { compareDecimals } from "../inventory/inventory.utils";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { buildTextPdfFile } from "../../utils/export-documents";
import {
  calculateGrossSalary,
  calculateNetSalary,
  calculatePayableDays,
  calculatePaymentStatus,
  calculatePayrollRunTotals,
  calculateProratedSalary,
  calculateSalaryStructureTotals,
  calculateTotalDeductions,
  normalizeMoney
} from "./payroll.calculation";
import { payrollRepository } from "./payroll.repository";
import type {
  CancelRunInput,
  CreateAttendanceInput,
  CreateEmployeeInput,
  CreateRunInput,
  CreateSalaryStructureInput,
  ExportPayrollQuery,
  ListAttendanceQuery,
  ListEmployeesQuery,
  ListItemsQuery,
  ListRunsQuery,
  PayItemInput,
  PayRunInput,
  ReportsQuery,
  SalarySlipEmailInput,
  UpdateAttendanceInput,
  UpdateBonusDeductionsInput,
  UpdateEmployeeInput,
  UpdateSalaryStructureInput
} from "./payroll.validator";
import type { PayrollActor, PayrollExportPayload, PayrollRequestContext, SalaryType } from "./payroll.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const formatDateValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().slice(0, 10);
};

const formatDateTimeValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().replace("T", " ").slice(0, 16);
};

const padCell = (value: string | number, width: number, align: "left" | "right" = "left") => {
  const normalized = String(value);
  if (normalized.length >= width) {
    return normalized.slice(0, width);
  }

  return align === "right" ? normalized.padStart(width, " ") : normalized.padEnd(width, " ");
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

class PayrollService {
  private normalizePrefix(prefix: string) {
    return prefix.replace(/-+$/, "");
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string, padding = 6) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${this.normalizePrefix(prefix)}-${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(padding, "0")}`;
  }

  private getMonthBounds(payrollMonth: string) {
    const [yearPart, monthPart] = payrollMonth.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    return { periodStart, periodEnd };
  }

  private getInclusiveDays(startDate: Date, endDate: Date) {
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  }

  private previousDate(value: Date) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() - 1);
    return date;
  }

  private mapEmployee(row: typeof employees.$inferSelect) {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      mobile: row.mobile,
      email: row.email,
      department: row.department,
      designation: row.designation,
      joiningDate: row.joiningDate,
      employmentType: row.employmentType,
      salaryType: row.salaryType,
      panNumber: row.panNumber,
      aadhaarLast4: row.aadhaarLast4,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      emergencyContactName: row.emergencyContactName,
      emergencyContactMobile: row.emergencyContactMobile,
      bankName: row.bankName,
      accountHolderName: row.accountHolderName,
      accountNumber: row.accountNumber,
      ifscCode: row.ifscCode,
      upiId: row.upiId,
      status: row.status,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt
    };
  }

  private mapStructure(row: NonNullable<Awaited<ReturnType<typeof payrollRepository.findSalaryStructureById>>>) {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      basicSalary: normalizeMoney(row.basicSalary),
      hra: normalizeMoney(row.hra),
      conveyanceAllowance: normalizeMoney(row.conveyanceAllowance),
      medicalAllowance: normalizeMoney(row.medicalAllowance),
      otherAllowance: normalizeMoney(row.otherAllowance),
      pfDeduction: normalizeMoney(row.pfDeduction),
      esicDeduction: normalizeMoney(row.esicDeduction),
      professionalTax: normalizeMoney(row.professionalTax),
      tdsDeduction: normalizeMoney(row.tdsDeduction),
      otherDeduction: normalizeMoney(row.otherDeduction),
      grossSalary: normalizeMoney(row.grossSalary),
      totalDeductions: normalizeMoney(row.totalDeductions),
      netSalary: normalizeMoney(row.netSalary),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      isActive: row.isActive,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private mapAttendance(row: NonNullable<Awaited<ReturnType<typeof payrollRepository.findAttendanceById>>>) {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      payrollMonth: row.payrollMonth,
      workingDays: normalizeMoney(row.workingDays),
      presentDays: normalizeMoney(row.presentDays),
      absentDays: normalizeMoney(row.absentDays),
      paidLeaveDays: normalizeMoney(row.paidLeaveDays),
      unpaidLeaveDays: normalizeMoney(row.unpaidLeaveDays),
      halfDays: normalizeMoney(row.halfDays),
      overtimeHours: normalizeMoney(row.overtimeHours),
      remarks: row.remarks,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private mapRun(row: NonNullable<Awaited<ReturnType<typeof payrollRepository.findRunById>>>) {
    return {
      id: row.id,
      companyId: row.companyId,
      runNumber: row.runNumber,
      payrollMonth: row.payrollMonth,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      status: row.status,
      totalEmployees: row.totalEmployees,
      grossTotal: normalizeMoney(row.grossTotal),
      deductionTotal: normalizeMoney(row.deductionTotal),
      bonusTotal: normalizeMoney(row.bonusTotal),
      netPayableTotal: normalizeMoney(row.netPayableTotal),
      paidTotal: normalizeMoney(row.paidTotal),
      notes: row.notes,
      generatedAt: row.generatedAt,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      accountingEventCreated: row.accountingEventCreated,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private mapItemRow(row: Awaited<ReturnType<typeof payrollRepository.listItems>>["rows"][number] | Awaited<ReturnType<typeof payrollRepository.listRunItems>>[number]) {
    return {
      id: row.item.id,
      companyId: row.item.companyId,
      payrollRunId: row.item.payrollRunId,
      employeeId: row.item.employeeId,
      employeeName: row.item.employeeNameSnapshot,
      employeeCode: row.item.employeeCodeSnapshot,
      department: row.item.departmentSnapshot,
      designation: row.item.designationSnapshot,
      workingDays: normalizeMoney(row.item.workingDays),
      payableDays: normalizeMoney(row.item.payableDays),
      basicSalary: normalizeMoney(row.item.basicSalary),
      hra: normalizeMoney(row.item.hra),
      allowancesTotal: normalizeMoney(row.item.allowancesTotal),
      bonusTotal: normalizeMoney(row.item.bonusTotal),
      grossSalary: normalizeMoney(row.item.grossSalary),
      deductionsTotal: normalizeMoney(row.item.deductionsTotal),
      netSalary: normalizeMoney(row.item.netSalary),
      paidAmount: normalizeMoney(row.item.paidAmount),
      paymentStatus: row.item.paymentStatus,
      paymentMode: row.item.paymentMode,
      paymentReference: row.item.paymentReference,
      paidAt: row.item.paidAt,
      status: row.item.status,
      createdAt: row.item.createdAt,
      updatedAt: row.item.updatedAt,
      employee: {
        id: row.employee.id,
        fullName: row.employee.fullName,
        mobile: row.employee.mobile,
        email: row.employee.email,
        status: row.employee.status
      }
    };
  }

  private async assertPeriodUnlocked(companyId: string, periodStart: Date, periodEnd: Date, executor?: TransactionClient) {
    const [startLock, endLock, year] = await Promise.all([
      accountingRepository.findBlockingPeriodLock(companyId, periodStart, executor),
      accountingRepository.findBlockingPeriodLock(companyId, periodEnd, executor),
      companyRepository.findActiveFinancialYear(companyId)
    ]);

    if (startLock || endLock) {
      throw new AppError("The selected payroll period is locked for accounting", 409);
    }

    if (year && year.isLocked && year.startDate <= periodEnd && year.endDate >= periodStart) {
      throw new AppError("The selected financial year is locked for accounting", 409);
    }

    const [overlapLock] = await this.findOverlappingLocks(companyId, periodStart, periodEnd, executor);
    if (overlapLock) {
      throw new AppError("The selected payroll period overlaps a locked accounting period", 409);
    }
  }

  private async findOverlappingLocks(companyId: string, periodStart: Date, periodEnd: Date, executor?: TransactionClient) {
    return this.getDbExecutor(executor)
      .select()
      .from(financialPeriodLocks)
      .where(
        and(
          eq(financialPeriodLocks.companyId, companyId),
          eq(financialPeriodLocks.isLocked, true),
          lte(financialPeriodLocks.periodStart, periodEnd),
          gte(financialPeriodLocks.periodEnd, periodStart)
        )
      )
      .limit(1);
  }

  private getDbExecutor(executor?: TransactionClient) {
    return executor ?? db;
  }

  private async getEmployeeOrThrow(companyId: string, employeeId: string, includeDeleted = false, executor?: TransactionClient) {
    const employee = await payrollRepository.findEmployeeById(companyId, employeeId, includeDeleted, executor);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    return employee;
  }

  private async getRunOrThrow(companyId: string, runId: string, executor?: TransactionClient) {
    const run = await payrollRepository.findRunById(companyId, runId, executor);
    if (!run) {
      throw new AppError("Payroll run not found", 404);
    }

    return run;
  }

  private async getItemOrThrow(companyId: string, itemId: string, executor?: TransactionClient) {
    const row = await payrollRepository.findPayrollItemById(companyId, itemId, executor);
    if (!row) {
      throw new AppError("Payroll item not found", 404);
    }

    return row;
  }

  private async getBankAccountOrThrow(companyId: string, bankAccountId: string) {
    const bankAccount = await companyRepository.findBankAccountById(companyId, bankAccountId);
    if (!bankAccount || !bankAccount.isActive) {
      throw new AppError("Active bank account not found", 404);
    }

    return bankAccount;
  }

  private assertEmployeeEditable(employee: Awaited<ReturnType<typeof payrollRepository.findEmployeeById>>) {
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    if (employee.deletedAt || employee.status === "deleted") {
      throw new AppError("Deleted employee cannot be edited", 400);
    }
  }

  private async assertEmployeeUnique(
    companyId: string,
    input: { mobile?: string | undefined; email?: string | null | undefined },
    excludeId?: string,
    executor?: TransactionClient
  ) {
    if (input.mobile) {
      const mobileOwner = await payrollRepository.findEmployeeByMobile(companyId, input.mobile, excludeId, executor);
      if (mobileOwner) {
        throw new AppError("An employee with this mobile number already exists", 409);
      }
    }

    if (input.email) {
      const emailOwner = await payrollRepository.findEmployeeByEmail(companyId, input.email, excludeId, executor);
      if (emailOwner) {
        throw new AppError("An employee with this email already exists", 409);
      }
    }
  }

  private buildEmployeeMutation(actor: PayrollActor, input: CreateEmployeeInput | UpdateEmployeeInput) {
    return pickDefined({
      fullName: input.fullName?.trim(),
      mobile: input.mobile?.trim(),
      email: input.email ?? undefined,
      department: input.department,
      designation: input.designation,
      joiningDate: input.joiningDate,
      employmentType: input.employmentType,
      salaryType: input.salaryType,
      panNumber: input.panNumber,
      aadhaarLast4: input.aadhaarLast4,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      emergencyContactName: input.emergencyContactName,
      emergencyContactMobile: input.emergencyContactMobile,
      bankName: input.bankName,
      accountHolderName: input.accountHolderName,
      accountNumber: input.accountNumber,
      ifscCode: input.ifscCode,
      upiId: input.upiId,
      status: input.status,
      updatedBy: actor.id
    });
  }

  private async getNextEmployeeCode(companyId: string, executor: TransactionClient) {
    await payrollRepository.acquireScopedLock("employee-code", companyId, executor);
    const latest = await payrollRepository.findLatestEmployeeCode(companyId, executor);
    return this.buildNextSequenceNumber(latest, "EMP", 6);
  }

  private async getNextRunNumber(companyId: string, executor: TransactionClient) {
    await payrollRepository.acquireScopedLock("payroll-run-number", companyId, executor);
    const latest = await payrollRepository.findLatestRunNumber(companyId, executor);
    return this.buildNextSequenceNumber(latest, "PAYRUN", 6);
  }

  private buildStructurePayload(input: CreateSalaryStructureInput | UpdateSalaryStructureInput) {
    return pickDefined({
      basicSalary: input.basicSalary !== undefined ? normalizeMoney(input.basicSalary) : undefined,
      hra: input.hra !== undefined ? normalizeMoney(input.hra) : undefined,
      conveyanceAllowance: input.conveyanceAllowance !== undefined ? normalizeMoney(input.conveyanceAllowance) : undefined,
      medicalAllowance: input.medicalAllowance !== undefined ? normalizeMoney(input.medicalAllowance) : undefined,
      otherAllowance: input.otherAllowance !== undefined ? normalizeMoney(input.otherAllowance) : undefined,
      pfDeduction: input.pfDeduction !== undefined ? normalizeMoney(input.pfDeduction) : undefined,
      esicDeduction: input.esicDeduction !== undefined ? normalizeMoney(input.esicDeduction) : undefined,
      professionalTax: input.professionalTax !== undefined ? normalizeMoney(input.professionalTax) : undefined,
      tdsDeduction: input.tdsDeduction !== undefined ? normalizeMoney(input.tdsDeduction) : undefined,
      otherDeduction: input.otherDeduction !== undefined ? normalizeMoney(input.otherDeduction) : undefined,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? undefined,
      isActive: input.isActive
    });
  }

  private validateStructureMutation(payload: ReturnType<PayrollService["buildStructurePayload"]>) {
    const totals = calculateSalaryStructureTotals({
      basicSalary: payload.basicSalary ?? "0.00",
      hra: payload.hra ?? "0.00",
      conveyanceAllowance: payload.conveyanceAllowance ?? "0.00",
      medicalAllowance: payload.medicalAllowance ?? "0.00",
      otherAllowance: payload.otherAllowance ?? "0.00",
      pfDeduction: payload.pfDeduction ?? "0.00",
      esicDeduction: payload.esicDeduction ?? "0.00",
      professionalTax: payload.professionalTax ?? "0.00",
      tdsDeduction: payload.tdsDeduction ?? "0.00",
      otherDeduction: payload.otherDeduction ?? "0.00"
    });

    if (compareDecimals(totals.netSalary, "0.00", 2) < 0) {
      throw new AppError("Net salary cannot be negative", 400);
    }

    return {
      ...payload,
      grossSalary: totals.grossSalary,
      totalDeductions: totals.totalDeductions,
      netSalary: totals.netSalary
    };
  }

  private buildAttendancePayload(actor: PayrollActor, input: CreateAttendanceInput | UpdateAttendanceInput) {
    return pickDefined({
      employeeId: "employeeId" in input ? input.employeeId : undefined,
      payrollMonth: "payrollMonth" in input ? input.payrollMonth : undefined,
      workingDays: input.workingDays !== undefined ? normalizeMoney(input.workingDays) : undefined,
      presentDays: input.presentDays !== undefined ? normalizeMoney(input.presentDays) : undefined,
      absentDays: input.absentDays !== undefined ? normalizeMoney(input.absentDays) : undefined,
      paidLeaveDays: input.paidLeaveDays !== undefined ? normalizeMoney(input.paidLeaveDays) : undefined,
      unpaidLeaveDays: input.unpaidLeaveDays !== undefined ? normalizeMoney(input.unpaidLeaveDays) : undefined,
      halfDays: input.halfDays !== undefined ? normalizeMoney(input.halfDays) : undefined,
      overtimeHours: input.overtimeHours !== undefined ? normalizeMoney(input.overtimeHours) : undefined,
      remarks: input.remarks,
      updatedBy: actor.id
    });
  }

  private buildDefaultAttendance(payrollMonth: string) {
    const { periodStart, periodEnd } = this.getMonthBounds(payrollMonth);
    const days = this.getInclusiveDays(periodStart, periodEnd);
    const workingDays = normalizeMoney(days);
    return {
      payrollMonth,
      workingDays,
      presentDays: workingDays,
      absentDays: "0.00",
      paidLeaveDays: "0.00",
      unpaidLeaveDays: "0.00",
      halfDays: "0.00",
      overtimeHours: "0.00",
      payableDays: workingDays,
      remarks: null
    };
  }

  private buildAccountingPayload(run: Awaited<ReturnType<typeof payrollRepository.findRunById>>, items: Array<ReturnType<PayrollService["mapItemRow"]>>, reason?: string | null) {
    if (!run) {
      throw new AppError("Payroll run not found", 404);
    }

    return {
      runNumber: run.runNumber,
      payrollMonth: run.payrollMonth,
      totals: {
        grossTotal: normalizeMoney(run.grossTotal),
        deductionTotal: normalizeMoney(run.deductionTotal),
        bonusTotal: normalizeMoney(run.bonusTotal),
        netPayableTotal: normalizeMoney(run.netPayableTotal),
        paidTotal: normalizeMoney(run.paidTotal)
      },
      items: items.map((item) => ({
        payrollItemId: item.id,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeCode: item.employeeCode,
        grossSalary: item.grossSalary,
        bonusTotal: item.bonusTotal,
        deductionsTotal: item.deductionsTotal,
        netSalary: item.netSalary,
        paidAmount: item.paidAmount,
        paymentMode: item.paymentMode,
        paymentReference: item.paymentReference
      })),
      reason: reason ?? null
    };
  }

  private async createAndPostAccountingEvent(
    actor: PayrollActor,
    runId: string,
    eventType: "payroll_generated" | "payroll_paid" | "payroll_adjusted" | "payroll_cancelled",
    executor: TransactionClient,
    reason?: string | null,
    extraPayload?: Record<string, unknown>
  ) {
    const run = await payrollRepository.findRunById(actor.companyId, runId, executor);
    if (!run) {
      throw new AppError("Payroll run not found", 404);
    }

    const items = (await payrollRepository.listRunItems(actor.companyId, runId, executor)).map((row) => this.mapItemRow(row));
    const event = await payrollRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType,
        referenceType: "payroll_run",
        referenceId: run.id,
        payload: {
          ...this.buildAccountingPayload(run, items, reason),
          ...(extraPayload ?? {})
        },
        status: "pending"
      },
      executor
    );

    if (!event) {
      throw new AppError("Failed to create payroll accounting event", 500);
    }

    await accountingService.postEventInTransaction(actor, event.id, executor);
    return event;
  }

  private async calculateAndPersistRunTotals(actor: PayrollActor, runId: string, executor: TransactionClient) {
    const itemRows = await payrollRepository.listRunItems(actor.companyId, runId, executor);
    const totals = calculatePayrollRunTotals(
      itemRows.map((row) => ({
        grossSalary: normalizeMoney(row.item.grossSalary),
        deductionsTotal: normalizeMoney(row.item.deductionsTotal),
        bonusTotal: normalizeMoney(row.item.bonusTotal),
        netSalary: normalizeMoney(row.item.netSalary),
        paidAmount: normalizeMoney(row.item.paidAmount)
      }))
    );

    const run = await payrollRepository.updateRun(
      actor.companyId,
      runId,
      {
        totalEmployees: totals.totalEmployees,
        grossTotal: totals.grossTotal,
        deductionTotal: totals.deductionTotal,
        bonusTotal: totals.bonusTotal,
        netPayableTotal: totals.netPayableTotal,
        paidTotal: totals.paidTotal,
        status:
          totals.totalEmployees > 0 && compareDecimals(totals.paidTotal, totals.netPayableTotal, 2) >= 0 ? "paid" : undefined,
        paidAt:
          totals.totalEmployees > 0 && compareDecimals(totals.paidTotal, totals.netPayableTotal, 2) >= 0 ? new Date() : undefined,
        updatedBy: actor.id
      },
      executor
    );

    if (!run) {
      throw new AppError("Failed to update payroll run totals", 500);
    }

    return run;
  }

  private buildGeneratedItem(
    salaryType: SalaryType,
    employee: Awaited<ReturnType<typeof payrollRepository.listPayrollGenerationRows>>[number]["employee"],
    structure: Awaited<ReturnType<typeof payrollRepository.listPayrollGenerationRows>>[number]["structure"],
    attendance: Awaited<ReturnType<typeof payrollRepository.listPayrollGenerationRows>>[number]["attendance"] | null,
    payrollMonth: string
  ) {
    const fallbackAttendance = this.buildDefaultAttendance(payrollMonth);
    const workingDays = attendance?.workingDays ?? fallbackAttendance.workingDays;
    const presentDays = attendance?.presentDays ?? fallbackAttendance.presentDays;
    const paidLeaveDays = attendance?.paidLeaveDays ?? fallbackAttendance.paidLeaveDays;
    const halfDays = attendance?.halfDays ?? fallbackAttendance.halfDays;
    const overtimeHours = attendance?.overtimeHours ?? fallbackAttendance.overtimeHours;
    const payableDays = calculatePayableDays({
      presentDays,
      paidLeaveDays,
      halfDays
    });
    const allowancesTotal = normalizeMoney(
      Number(structure.conveyanceAllowance) + Number(structure.medicalAllowance) + Number(structure.otherAllowance)
    );
    const prorated = calculateProratedSalary({
      salaryType,
      workingDays,
      payableDays,
      overtimeHours,
      basicSalary: structure.basicSalary,
      hra: structure.hra,
      allowancesTotal,
      deductionsTotal: structure.totalDeductions
    });

    return {
      employeeId: employee.id,
      employeeNameSnapshot: employee.fullName,
      employeeCodeSnapshot: employee.employeeCode,
      departmentSnapshot: employee.department,
      designationSnapshot: employee.designation,
      workingDays: normalizeMoney(workingDays),
      payableDays: prorated.payableDays,
      basicSalary: prorated.basicSalary,
      hra: prorated.hra,
      allowancesTotal: prorated.allowancesTotal,
      bonusTotal: "0.00",
      grossSalary: prorated.grossSalary,
      deductionsTotal: prorated.deductionsTotal,
      netSalary: prorated.netSalary,
      paidAmount: "0.00",
      paymentStatus: "unpaid" as const,
      status: "generated" as const
    };
  }

  private async regenerateAccountingAfterItemAdjustment(actor: PayrollActor, runId: string, executor: TransactionClient) {
    await this.createAndPostAccountingEvent(actor, runId, "payroll_adjusted", executor, "Payroll bonuses/deductions updated");
    await this.createAndPostAccountingEvent(actor, runId, "payroll_generated", executor);
  }

  public async listEmployees(actor: Pick<PayrollActor, "companyId">, query: ListEmployeesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await payrollRepository.listEmployees({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      status: query.status,
      department: query.department ?? null,
      employmentType: query.employmentType
    });

    return {
      items: result.rows.map((row) => this.mapEmployee(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createEmployee(actor: PayrollActor, input: CreateEmployeeInput, context: PayrollRequestContext) {
    const created = await db.transaction(async (transaction) => {
      await this.assertEmployeeUnique(actor.companyId, { mobile: input.mobile, email: input.email ?? null }, undefined, transaction);
      const employeeCode = await this.getNextEmployeeCode(actor.companyId, transaction);
      const employee = await payrollRepository.createEmployee(
        {
          companyId: actor.companyId,
          employeeCode,
          fullName: input.fullName.trim(),
          mobile: input.mobile.trim(),
          email: input.email ?? null,
          department: input.department ?? null,
          designation: input.designation ?? null,
          joiningDate: input.joiningDate,
          employmentType: input.employmentType,
          salaryType: input.salaryType,
          panNumber: input.panNumber ?? null,
          aadhaarLast4: input.aadhaarLast4 ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          pincode: input.pincode ?? null,
          emergencyContactName: input.emergencyContactName ?? null,
          emergencyContactMobile: input.emergencyContactMobile ?? null,
          bankName: input.bankName ?? null,
          accountHolderName: input.accountHolderName ?? null,
          accountNumber: input.accountNumber ?? null,
          ifscCode: input.ifscCode ?? null,
          upiId: input.upiId ?? null,
          status: input.status,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!employee) {
        throw new AppError("Failed to create employee", 500);
      }

      return employee;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "employee_created",
      entityType: "employee",
      entityId: created.id,
      metadata: {
        employeeCode: created.employeeCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      employee: this.mapEmployee(created)
    };
  }

  public async getEmployee(actor: Pick<PayrollActor, "companyId">, employeeId: string) {
    const employee = await this.getEmployeeOrThrow(actor.companyId, employeeId, true);
    const activeStructure = await payrollRepository.findActiveSalaryStructure(actor.companyId, employeeId, new Date());

    return {
      employee: this.mapEmployee(employee),
      activeSalaryStructure: activeStructure ? this.mapStructure(activeStructure) : null
    };
  }

  public async updateEmployee(actor: PayrollActor, employeeId: string, input: UpdateEmployeeInput, context: PayrollRequestContext) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await this.getEmployeeOrThrow(actor.companyId, employeeId, true, transaction);
      this.assertEmployeeEditable(existing);
      await this.assertEmployeeUnique(
        actor.companyId,
        pickDefined({
          mobile: input.mobile,
          email: input.email ?? undefined
        }),
        employeeId,
        transaction
      );

      const employee = await payrollRepository.updateEmployee(
        actor.companyId,
        employeeId,
        this.buildEmployeeMutation(actor, input) as Partial<typeof employees.$inferInsert>,
        transaction
      );
      if (!employee) {
        throw new AppError("Failed to update employee", 500);
      }

      return employee;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "employee_updated",
      entityType: "employee",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      employee: this.mapEmployee(updated)
    };
  }

  public async deleteEmployee(actor: PayrollActor, employeeId: string, context: PayrollRequestContext) {
    const deleted = await db.transaction(async (transaction) => {
      const existing = await this.getEmployeeOrThrow(actor.companyId, employeeId, true, transaction);
      if (existing.deletedAt || existing.status === "deleted") {
        throw new AppError("Employee is already deleted", 400);
      }

      const employee = await payrollRepository.updateEmployee(
        actor.companyId,
        employeeId,
        {
          status: "deleted",
          deletedAt: new Date(),
          updatedBy: actor.id
        },
        transaction
      );

      if (!employee) {
        throw new AppError("Failed to delete employee", 500);
      }

      return employee;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "employee_deactivated",
      entityType: "employee",
      entityId: deleted.id,
      metadata: {
        employeeCode: deleted.employeeCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      employee: this.mapEmployee(deleted)
    };
  }

  public async getEmployeeSalaryStructure(actor: Pick<PayrollActor, "companyId">, employeeId: string) {
    await this.getEmployeeOrThrow(actor.companyId, employeeId, true);
    const structures = await payrollRepository.listSalaryStructuresByEmployee(actor.companyId, employeeId);

    return {
      items: structures.map((row) => this.mapStructure(row))
    };
  }

  public async createSalaryStructure(
    actor: PayrollActor,
    employeeId: string,
    input: CreateSalaryStructureInput,
    context: PayrollRequestContext
  ) {
    const created = await db.transaction(async (transaction) => {
      const employee = await this.getEmployeeOrThrow(actor.companyId, employeeId, false, transaction);
      if (employee.status !== "active") {
        throw new AppError("Salary structure can only be created for active employees", 400);
      }

      const payload = this.validateStructureMutation(this.buildStructurePayload(input));
      const previousDay = this.previousDate(input.effectiveFrom);
      await payrollRepository.closeActiveSalaryStructures(actor.companyId, employeeId, previousDay, undefined, transaction);
      const structure = await payrollRepository.createSalaryStructure(
        {
          companyId: actor.companyId,
          employeeId,
          basicSalary: payload.basicSalary ?? "0.00",
          hra: payload.hra ?? "0.00",
          conveyanceAllowance: payload.conveyanceAllowance ?? "0.00",
          medicalAllowance: payload.medicalAllowance ?? "0.00",
          otherAllowance: payload.otherAllowance ?? "0.00",
          pfDeduction: payload.pfDeduction ?? "0.00",
          esicDeduction: payload.esicDeduction ?? "0.00",
          professionalTax: payload.professionalTax ?? "0.00",
          tdsDeduction: payload.tdsDeduction ?? "0.00",
          otherDeduction: payload.otherDeduction ?? "0.00",
          grossSalary: payload.grossSalary,
          totalDeductions: payload.totalDeductions,
          netSalary: payload.netSalary,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
          isActive: true,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!structure) {
        throw new AppError("Failed to create salary structure", 500);
      }

      return structure;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "salary_structure_created",
      entityType: "employee_salary_structure",
      entityId: created.id,
      metadata: {
        employeeId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      salaryStructure: this.mapStructure(created)
    };
  }

  public async updateSalaryStructure(
    actor: PayrollActor,
    employeeId: string,
    structureId: string,
    input: UpdateSalaryStructureInput,
    context: PayrollRequestContext
  ) {
    const updated = await db.transaction(async (transaction) => {
      await this.getEmployeeOrThrow(actor.companyId, employeeId, false, transaction);
      const existing = await payrollRepository.findSalaryStructureById(actor.companyId, employeeId, structureId, transaction);
      if (!existing) {
        throw new AppError("Salary structure not found", 404);
      }

      const payload = this.validateStructureMutation(
        this.buildStructurePayload({
          basicSalary: input.basicSalary ?? Number(existing.basicSalary),
          hra: input.hra ?? Number(existing.hra),
          conveyanceAllowance: input.conveyanceAllowance ?? Number(existing.conveyanceAllowance),
          medicalAllowance: input.medicalAllowance ?? Number(existing.medicalAllowance),
          otherAllowance: input.otherAllowance ?? Number(existing.otherAllowance),
          pfDeduction: input.pfDeduction ?? Number(existing.pfDeduction),
          esicDeduction: input.esicDeduction ?? Number(existing.esicDeduction),
          professionalTax: input.professionalTax ?? Number(existing.professionalTax),
          tdsDeduction: input.tdsDeduction ?? Number(existing.tdsDeduction),
          otherDeduction: input.otherDeduction ?? Number(existing.otherDeduction),
          effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom,
          effectiveTo: input.effectiveTo ?? existing.effectiveTo,
          isActive: input.isActive ?? existing.isActive
        })
      );

      if ((input.isActive ?? existing.isActive) === true) {
        await payrollRepository.closeActiveSalaryStructures(
          actor.companyId,
          employeeId,
          this.previousDate(input.effectiveFrom ?? existing.effectiveFrom),
          structureId,
          transaction
        );
      }

      const structure = await payrollRepository.updateSalaryStructure(
        actor.companyId,
        employeeId,
        structureId,
        pickDefined({
          ...payload,
          updatedBy: actor.id
        }) as Partial<typeof import("../../db/schema").employeeSalaryStructures.$inferInsert>,
        transaction
      );

      if (!structure) {
        throw new AppError("Failed to update salary structure", 500);
      }

      return structure;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "salary_structure_updated",
      entityType: "employee_salary_structure",
      entityId: updated.id,
      metadata: {
        employeeId,
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      salaryStructure: this.mapStructure(updated)
    };
  }

  public async listAttendance(actor: Pick<PayrollActor, "companyId">, query: ListAttendanceQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await payrollRepository.listAttendance({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      month: query.month,
      employeeId: query.employeeId,
      department: query.department ?? null
    });

    return {
      items: result.rows.map((row) => ({
        ...this.mapAttendance(row.attendance),
        employee: {
          id: row.employee.id,
          employeeCode: row.employee.employeeCode,
          fullName: row.employee.fullName,
          department: row.employee.department,
          designation: row.employee.designation
        }
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async upsertAttendance(
    actor: PayrollActor,
    input: CreateAttendanceInput,
    context: PayrollRequestContext
  ) {
    const attendance = await db.transaction(async (transaction) => {
      const employee = await this.getEmployeeOrThrow(actor.companyId, input.employeeId, false, transaction);
      if (employee.status !== "active") {
        throw new AppError("Attendance can only be recorded for active employees", 400);
      }

      const existingRun = await payrollRepository.findActiveRunByMonth(actor.companyId, input.payrollMonth, transaction);
      if (existingRun && existingRun.status !== "draft") {
        throw new AppError("Attendance cannot be changed after payroll is generated for the month", 409);
      }

      const existing = await payrollRepository.findAttendanceByEmployeeMonth(actor.companyId, input.employeeId, input.payrollMonth, transaction);
      if (existing) {
        const updated = await payrollRepository.updateAttendance(
          actor.companyId,
          existing.id,
          pickDefined({
            ...this.buildAttendancePayload(actor, input),
            updatedBy: actor.id
          }) as Partial<typeof employeeAttendance.$inferInsert>,
          transaction
        );

        if (!updated) {
          throw new AppError("Failed to update attendance", 500);
        }

        return { row: updated, created: false as const };
      }

      const created = await payrollRepository.createAttendance(
        {
          companyId: actor.companyId,
          employeeId: input.employeeId,
          payrollMonth: input.payrollMonth,
          workingDays: normalizeMoney(input.workingDays),
          presentDays: normalizeMoney(input.presentDays),
          absentDays: normalizeMoney(input.absentDays ?? 0),
          paidLeaveDays: normalizeMoney(input.paidLeaveDays ?? 0),
          unpaidLeaveDays: normalizeMoney(input.unpaidLeaveDays ?? 0),
          halfDays: normalizeMoney(input.halfDays ?? 0),
          overtimeHours: normalizeMoney(input.overtimeHours ?? 0),
          remarks: input.remarks ?? null,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create attendance", 500);
      }

      return { row: created, created: true as const };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: attendance.created ? "attendance_created" : "attendance_updated",
      entityType: "employee_attendance",
      entityId: attendance.row.id,
      metadata: {
        employeeId: attendance.row.employeeId,
        payrollMonth: attendance.row.payrollMonth
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      attendance: this.mapAttendance(attendance.row)
    };
  }

  public async updateAttendance(actor: PayrollActor, attendanceId: string, input: UpdateAttendanceInput, context: PayrollRequestContext) {
    const attendance = await db.transaction(async (transaction) => {
      const existing = await payrollRepository.findAttendanceById(actor.companyId, attendanceId, transaction);
      if (!existing) {
        throw new AppError("Attendance not found", 404);
      }

      const existingRun = await payrollRepository.findActiveRunByMonth(actor.companyId, existing.payrollMonth, transaction);
      if (existingRun && existingRun.status !== "draft") {
        throw new AppError("Attendance cannot be changed after payroll is generated for the month", 409);
      }

      await this.getEmployeeOrThrow(actor.companyId, input.employeeId ?? existing.employeeId, false, transaction);
      const updated = await payrollRepository.updateAttendance(
        actor.companyId,
        attendanceId,
        pickDefined({
          ...this.buildAttendancePayload(actor, input),
          employeeId: input.employeeId ?? existing.employeeId,
          payrollMonth: input.payrollMonth ?? existing.payrollMonth,
          updatedBy: actor.id
        }) as Partial<typeof employeeAttendance.$inferInsert>,
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update attendance", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "attendance_updated",
      entityType: "employee_attendance",
      entityId: attendance.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      attendance: this.mapAttendance(attendance)
    };
  }

  public async listRuns(actor: Pick<PayrollActor, "companyId">, query: ListRunsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await payrollRepository.listRuns({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      month: query.month,
      status: query.status
    });

    return {
      items: result.rows.map((row) => this.mapRun(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createRun(actor: PayrollActor, input: CreateRunInput, context: PayrollRequestContext) {
    const created = await db.transaction(async (transaction) => {
      if (await payrollRepository.findActiveRunByMonth(actor.companyId, input.payrollMonth, transaction)) {
        throw new AppError("A non-cancelled payroll run already exists for this month", 409);
      }

      const fallbackPeriod = this.getMonthBounds(input.payrollMonth);
      const periodStart = input.periodStart ?? fallbackPeriod.periodStart;
      const periodEnd = input.periodEnd ?? fallbackPeriod.periodEnd;
      await this.assertPeriodUnlocked(actor.companyId, periodStart, periodEnd, transaction);

      const runNumber = await this.getNextRunNumber(actor.companyId, transaction);
      const run = await payrollRepository.createRun(
        {
          companyId: actor.companyId,
          runNumber,
          payrollMonth: input.payrollMonth,
          periodStart,
          periodEnd,
          status: "draft",
          totalEmployees: 0,
          grossTotal: "0.00",
          deductionTotal: "0.00",
          bonusTotal: "0.00",
          netPayableTotal: "0.00",
          paidTotal: "0.00",
          notes: input.notes ?? null,
          accountingEventCreated: false,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!run) {
        throw new AppError("Failed to create payroll run", 500);
      }

      return run;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_run_created",
      entityType: "payroll_run",
      entityId: created.id,
      metadata: {
        runNumber: created.runNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      run: this.mapRun(created)
    };
  }

  public async getRun(actor: Pick<PayrollActor, "companyId">, runId: string) {
    const run = await this.getRunOrThrow(actor.companyId, runId);
    const itemRows = await payrollRepository.listRunItems(actor.companyId, runId);
    const bonusRows = await payrollRepository.listBonusDeductionsByRun(actor.companyId, runId);
    const paymentRows = await payrollRepository.listSalaryPaymentsByRun(actor.companyId, runId);
    const bonusMap = new Map<string, typeof bonusRows>();

    for (const row of bonusRows) {
      const current = bonusMap.get(row.itemId) ?? [];
      current.push(row);
      bonusMap.set(row.itemId, current);
    }

    return {
      run: this.mapRun(run),
      items: itemRows.map((row) => ({
        ...this.mapItemRow(row),
        bonusDeductions: (bonusMap.get(row.item.id) ?? []).map((bonusRow) => ({
          id: bonusRow.bonusDeduction.id,
          type: bonusRow.bonusDeduction.type,
          name: bonusRow.bonusDeduction.name,
          amount: normalizeMoney(bonusRow.bonusDeduction.amount),
          taxable: bonusRow.bonusDeduction.taxable,
          notes: bonusRow.bonusDeduction.notes
        }))
      })),
      payments: paymentRows.map((row) => ({
        id: row.id,
        payrollItemId: row.payrollItemId,
        employeeId: row.employeeId,
        paymentDate: row.paymentDate,
        amount: normalizeMoney(row.amount),
        paymentMode: row.paymentMode,
        bankAccountId: row.bankAccountId,
        referenceNumber: row.referenceNumber,
        notes: row.notes,
        createdAt: row.createdAt
      }))
    };
  }

  public async generateRun(actor: PayrollActor, runId: string, context: PayrollRequestContext) {
    const generatedRun = await db.transaction(async (transaction) => {
      const run = await this.getRunOrThrow(actor.companyId, runId, transaction);
      if (run.status === "paid") {
        throw new AppError("Paid payroll run is immutable", 400);
      }

      if (run.status === "cancelled") {
        throw new AppError("Cancelled payroll run cannot be generated", 400);
      }

      await this.assertPeriodUnlocked(actor.companyId, run.periodStart, run.periodEnd, transaction);
      const rows = await payrollRepository.listPayrollGenerationRows(actor.companyId, run.payrollMonth, run.periodEnd, transaction);
      if (rows.length === 0) {
        throw new AppError("No active employees with salary structures found for payroll generation", 400);
      }

      await payrollRepository.deleteItemsByRun(actor.companyId, runId, transaction);
      const items = rows.map((row) => this.buildGeneratedItem(row.employee.salaryType, row.employee, row.structure, row.attendance, run.payrollMonth));
      await payrollRepository.createPayrollItems(
        items.map((item) => ({
          companyId: actor.companyId,
          payrollRunId: runId,
          ...item
        })),
        transaction
      );

      const updatedRun = await this.calculateAndPersistRunTotals(actor, runId, transaction);
      const markedGenerated = await payrollRepository.updateRun(
        actor.companyId,
        runId,
        {
          status: "generated",
          generatedAt: new Date(),
          accountingEventCreated: true,
          updatedBy: actor.id
        },
        transaction
      );

      if (!markedGenerated || !updatedRun) {
        throw new AppError("Failed to mark payroll run as generated", 500);
      }

      await this.createAndPostAccountingEvent(actor, runId, "payroll_generated", transaction);
      return markedGenerated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_run_generated",
      entityType: "payroll_run",
      entityId: generatedRun.id,
      metadata: {
        runNumber: generatedRun.runNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getRun({ companyId: actor.companyId }, runId);
  }

  private resolveRunPaymentTargets(
    itemRows: Awaited<ReturnType<typeof payrollRepository.listRunItems>>,
    input: PayRunInput
  ) {
    const byId = new Map(itemRows.map((row) => [row.item.id, row]));
    if (input.payments && input.payments.length > 0) {
      return input.payments.map((entry) => {
        const row = byId.get(entry.payrollItemId);
        if (!row) {
          throw new AppError("One or more payroll items were not found in this run", 404);
        }

        return {
          row,
          amount: normalizeMoney(entry.amount ?? normalizeMoney(Number(row.item.netSalary) - Number(row.item.paidAmount)))
        };
      });
    }

    const targetRows =
      input.payrollItemIds && input.payrollItemIds.length > 0
        ? input.payrollItemIds.map((id) => {
            const row = byId.get(id);
            if (!row) {
              throw new AppError("One or more payroll items were not found in this run", 404);
            }

            return row;
          })
        : itemRows.filter((row) => compareDecimals(row.item.paidAmount, row.item.netSalary, 2) < 0);

    return targetRows.map((row) => ({
      row,
      amount: normalizeMoney(Number(row.item.netSalary) - Number(row.item.paidAmount))
    }));
  }

  public async payRun(actor: PayrollActor, runId: string, input: PayRunInput, context: PayrollRequestContext) {
    const paidRun = await db.transaction(async (transaction) => {
      const run = await this.getRunOrThrow(actor.companyId, runId, transaction);
      if (run.status === "draft") {
        throw new AppError("Generate payroll before recording payments", 400);
      }

      if (run.status === "cancelled") {
        throw new AppError("Cancelled payroll run cannot be paid", 400);
      }

      if (run.status === "paid") {
        throw new AppError("Paid payroll run is immutable", 400);
      }

      await this.assertPeriodUnlocked(actor.companyId, run.periodStart, run.periodEnd, transaction);
      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const itemRows = await payrollRepository.listRunItems(actor.companyId, runId, transaction);
      const targets = this.resolveRunPaymentTargets(itemRows, input);
      if (targets.length === 0) {
        throw new AppError("No unpaid payroll items found for payment", 400);
      }

      for (const target of targets) {
        const unpaidAmount = normalizeMoney(Number(target.row.item.netSalary) - Number(target.row.item.paidAmount));
        if (compareDecimals(target.amount, "0.00", 2) <= 0) {
          throw new AppError("Payment amount must be greater than 0", 400);
        }

        if (compareDecimals(target.amount, unpaidAmount, 2) > 0) {
          throw new AppError("Payment amount cannot exceed unpaid net salary", 400);
        }
      }

      await payrollRepository.createSalaryPayments(
        targets.map((target) => ({
          companyId: actor.companyId,
          payrollRunId: runId,
          payrollItemId: target.row.item.id,
          employeeId: target.row.item.employeeId,
          paymentDate: input.paymentDate,
          amount: target.amount,
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id
        })),
        transaction
      );

      const paymentBatchAmount = targets.reduce((sum, target) => normalizeMoney(Number(sum) + Number(target.amount)), "0.00");

      for (const target of targets) {
        const nextPaidAmount = normalizeMoney(Number(target.row.item.paidAmount) + Number(target.amount));
        const paymentStatus = calculatePaymentStatus(normalizeMoney(target.row.item.netSalary), nextPaidAmount);
        const updated = await payrollRepository.updatePayrollItem(
          actor.companyId,
          target.row.item.id,
          {
            paidAmount: nextPaidAmount,
            paymentStatus,
            paymentMode: input.paymentMode,
            paymentReference: input.referenceNumber ?? null,
            paidAt: paymentStatus === "paid" ? new Date() : target.row.item.paidAt,
            status: paymentStatus === "paid" ? "paid" : target.row.item.status
          },
          transaction
        );

        if (!updated) {
          throw new AppError("Failed to update payroll item payment", 500);
        }
      }

      const updatedRun = await this.calculateAndPersistRunTotals(actor, runId, transaction);
      await this.createAndPostAccountingEvent(actor, runId, "payroll_paid", transaction, null, {
        paymentBatchAmount,
        paymentMode: input.paymentMode,
        bankAccountId: input.bankAccountId ?? null,
        referenceNumber: input.referenceNumber ?? null
      });
      return updatedRun;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_run_paid",
      entityType: "payroll_run",
      entityId: paidRun.id,
      metadata: {
        runNumber: paidRun.runNumber,
        status: paidRun.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getRun({ companyId: actor.companyId }, runId);
  }

  public async cancelRun(actor: PayrollActor, runId: string, input: CancelRunInput, context: PayrollRequestContext) {
    const cancelled = await db.transaction(async (transaction) => {
      const run = await this.getRunOrThrow(actor.companyId, runId, transaction);
      if (run.status === "paid") {
        throw new AppError("Paid payroll run cannot be cancelled without reversal flow", 400);
      }

      if (run.status === "cancelled") {
        throw new AppError("Payroll run is already cancelled", 400);
      }

      if (run.status === "generated" && run.accountingEventCreated) {
        await this.createAndPostAccountingEvent(actor, runId, "payroll_cancelled", transaction, input.cancellationReason);
      }

      await this.getDbExecutor(transaction)
        .update(payrollItems)
        .set({
          status: "cancelled",
          updatedAt: new Date()
        })
        .where(and(eq(payrollItems.companyId, actor.companyId), eq(payrollItems.payrollRunId, runId)));

      const updated = await payrollRepository.updateRun(
        actor.companyId,
        runId,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.cancellationReason,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to cancel payroll run", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_run_cancelled",
      entityType: "payroll_run",
      entityId: cancelled.id,
      metadata: {
        runNumber: cancelled.runNumber,
        reason: input.cancellationReason
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      run: this.mapRun(cancelled)
    };
  }

  public async listItems(actor: Pick<PayrollActor, "companyId">, query: ListItemsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await payrollRepository.listItems({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      runId: query.runId,
      employeeId: query.employeeId,
      paymentStatus: query.paymentStatus,
      payrollMonth: query.month
    });

    return {
      items: result.rows.map((row) => ({
        ...this.mapItemRow(row),
        run: {
          id: row.run.id,
          runNumber: row.run.runNumber,
          payrollMonth: row.run.payrollMonth,
          status: row.run.status
        }
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async updateItemBonusDeductions(
    actor: PayrollActor,
    itemId: string,
    input: UpdateBonusDeductionsInput,
    context: PayrollRequestContext
  ) {
    const item = await db.transaction(async (transaction) => {
      const existing = await this.getItemOrThrow(actor.companyId, itemId, transaction);
      if (existing.run.status === "paid") {
        throw new AppError("Paid payroll is immutable", 400);
      }

      if (existing.run.status === "cancelled") {
        throw new AppError("Cancelled payroll items cannot be changed", 400);
      }

      const bonusTotal = input.entries
        .filter((entry) => entry.type === "bonus")
        .reduce((sum, entry) => normalizeMoney(Number(sum) + entry.amount), "0.00");
      const extraDeductionTotal = input.entries
        .filter((entry) => entry.type === "deduction")
        .reduce((sum, entry) => normalizeMoney(Number(sum) + entry.amount), "0.00");
      const grossSalary = calculateGrossSalary(existing.item.basicSalary, existing.item.hra, existing.item.allowancesTotal, bonusTotal);
      const deductionsTotal = calculateTotalDeductions(existing.item.deductionsTotal, extraDeductionTotal);
      const netSalary = calculateNetSalary(grossSalary, deductionsTotal);
      if (compareDecimals(netSalary, "0.00", 2) < 0) {
        throw new AppError("Net salary cannot be negative", 400);
      }

      await payrollRepository.deleteBonusDeductionsByItem(actor.companyId, itemId, transaction);
      await payrollRepository.createBonusDeductions(
        input.entries.map((entry) => ({
          companyId: actor.companyId,
          payrollItemId: itemId,
          employeeId: existing.item.employeeId,
          type: entry.type,
          name: entry.name,
          amount: normalizeMoney(entry.amount),
          taxable: entry.taxable ?? true,
          notes: entry.notes ?? null,
          createdBy: actor.id
        })),
        transaction
      );

      const paymentStatus = calculatePaymentStatus(netSalary, normalizeMoney(existing.item.paidAmount));
      const updated = await payrollRepository.updatePayrollItem(
        actor.companyId,
        itemId,
        {
          bonusTotal,
          grossSalary,
          deductionsTotal,
          netSalary,
          paymentStatus,
          status: paymentStatus === "paid" ? "paid" : "generated"
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update payroll bonus/deductions", 500);
      }

      await this.calculateAndPersistRunTotals(actor, existing.run.id, transaction);
      if (existing.run.accountingEventCreated && existing.run.status === "generated") {
        await this.regenerateAccountingAfterItemAdjustment(actor, existing.run.id, transaction);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_bonus_deduction_updated",
      entityType: "payroll_item",
      entityId: item.id,
      metadata: {
        entryCount: input.entries.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayrollSlip(actor, itemId, context);
  }

  public async payItem(actor: PayrollActor, itemId: string, input: PayItemInput, context: PayrollRequestContext) {
    const item = await db.transaction(async (transaction) => {
      const existing = await this.getItemOrThrow(actor.companyId, itemId, transaction);
      if (existing.run.status === "draft") {
        throw new AppError("Generate payroll before recording payments", 400);
      }

      if (existing.run.status === "cancelled") {
        throw new AppError("Cancelled payroll cannot be paid", 400);
      }

      if (existing.run.status === "paid" && existing.item.paymentStatus === "paid") {
        throw new AppError("Paid payroll item is immutable", 400);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const unpaidAmount = normalizeMoney(Number(existing.item.netSalary) - Number(existing.item.paidAmount));
      const paymentAmount = normalizeMoney(input.amount ?? Number(unpaidAmount));
      if (compareDecimals(paymentAmount, "0.00", 2) <= 0) {
        throw new AppError("Payment amount must be greater than 0", 400);
      }

      if (compareDecimals(paymentAmount, unpaidAmount, 2) > 0) {
        throw new AppError("Payment amount cannot exceed unpaid net salary", 400);
      }

      await payrollRepository.createSalaryPayments(
        [
          {
            companyId: actor.companyId,
            payrollRunId: existing.run.id,
            payrollItemId: existing.item.id,
            employeeId: existing.item.employeeId,
            paymentDate: input.paymentDate,
            amount: paymentAmount,
            paymentMode: input.paymentMode,
            bankAccountId: input.bankAccountId ?? null,
            referenceNumber: input.referenceNumber ?? null,
            notes: input.notes ?? null,
            createdBy: actor.id
          }
        ],
        transaction
      );

      const nextPaidAmount = normalizeMoney(Number(existing.item.paidAmount) + Number(paymentAmount));
      const paymentStatus = calculatePaymentStatus(normalizeMoney(existing.item.netSalary), nextPaidAmount);
      const updated = await payrollRepository.updatePayrollItem(
        actor.companyId,
        itemId,
        {
          paidAmount: nextPaidAmount,
          paymentStatus,
          paymentMode: input.paymentMode,
          paymentReference: input.referenceNumber ?? null,
          paidAt: paymentStatus === "paid" ? new Date() : existing.item.paidAt,
          status: paymentStatus === "paid" ? "paid" : existing.item.status
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update payroll item payment", 500);
      }

      await this.calculateAndPersistRunTotals(actor, existing.run.id, transaction);
      await this.createAndPostAccountingEvent(actor, existing.run.id, "payroll_paid", transaction, null, {
        paymentBatchAmount: paymentAmount,
        paymentMode: input.paymentMode,
        bankAccountId: input.bankAccountId ?? null,
        referenceNumber: input.referenceNumber ?? null
      });
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_item_paid",
      entityType: "payroll_item",
      entityId: item.id,
      metadata: {
        paymentStatus: item.paymentStatus
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayrollSlip(actor, itemId, context);
  }

  private async buildSlipPayload(actor: Pick<PayrollActor, "companyId">, itemId: string) {
    const row = await this.getItemOrThrow(actor.companyId, itemId);
    const company = await companyRepository.findCompanyById(actor.companyId);
    const attendance = await payrollRepository.findAttendanceByEmployeeMonth(actor.companyId, row.item.employeeId, row.run.payrollMonth);
    const bonusDeductions = await payrollRepository.listBonusDeductionsByItem(actor.companyId, itemId);
    const payments = (await payrollRepository.listSalaryPaymentsByRun(actor.companyId, row.run.id)).filter((payment) => payment.payrollItemId === itemId);

    return {
      payrollItemId: row.item.id,
      payrollRunId: row.run.id,
      runNumber: row.run.runNumber,
      payrollMonth: row.run.payrollMonth,
      periodStart: row.run.periodStart,
      periodEnd: row.run.periodEnd,
      company: company
        ? {
            id: company.id,
            name: company.name,
            legalName: company.legalName,
            email: company.email,
            mobileNumber: company.mobileNumber,
            addressLine1: company.addressLine1,
            addressLine2: company.addressLine2,
            city: company.city,
            state: company.state,
            pincode: company.pincode,
            country: company.country
          }
        : null,
      employee: {
        id: row.employee.id,
        employeeCode: row.employee.employeeCode,
        fullName: row.employee.fullName,
        department: row.employee.department,
        designation: row.employee.designation,
        joiningDate: row.employee.joiningDate,
        employmentType: row.employee.employmentType,
        salaryType: row.employee.salaryType,
        bankName: row.employee.bankName,
        accountHolderName: row.employee.accountHolderName,
        accountNumber: row.employee.accountNumber,
        ifscCode: row.employee.ifscCode,
        upiId: row.employee.upiId
      },
      attendance: attendance
        ? {
            workingDays: normalizeMoney(attendance.workingDays),
            presentDays: normalizeMoney(attendance.presentDays),
            absentDays: normalizeMoney(attendance.absentDays),
            paidLeaveDays: normalizeMoney(attendance.paidLeaveDays),
            unpaidLeaveDays: normalizeMoney(attendance.unpaidLeaveDays),
            halfDays: normalizeMoney(attendance.halfDays),
            overtimeHours: normalizeMoney(attendance.overtimeHours),
            payableDays: calculatePayableDays({
              presentDays: attendance.presentDays,
              paidLeaveDays: attendance.paidLeaveDays,
              halfDays: attendance.halfDays
            }),
            remarks: attendance.remarks
          }
        : this.buildDefaultAttendance(row.run.payrollMonth),
      salary: {
        basicSalary: normalizeMoney(row.item.basicSalary),
        hra: normalizeMoney(row.item.hra),
        allowancesTotal: normalizeMoney(row.item.allowancesTotal),
        bonusTotal: normalizeMoney(row.item.bonusTotal),
        grossSalary: normalizeMoney(row.item.grossSalary),
        deductionsTotal: normalizeMoney(row.item.deductionsTotal),
        netSalary: normalizeMoney(row.item.netSalary),
        paidAmount: normalizeMoney(row.item.paidAmount),
        unpaidAmount: normalizeMoney(Number(row.item.netSalary) - Number(row.item.paidAmount)),
        paymentStatus: row.item.paymentStatus
      },
      bonusDeductions: bonusDeductions.map((entry) => ({
        id: entry.id,
        type: entry.type,
        name: entry.name,
        amount: normalizeMoney(entry.amount),
        taxable: entry.taxable,
        notes: entry.notes
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        paymentDate: payment.paymentDate,
        amount: normalizeMoney(payment.amount),
        paymentMode: payment.paymentMode,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes
      }))
    };
  }

  public async getPayrollSlip(actor: PayrollActor, itemId: string, context: PayrollRequestContext) {
    const slip = await this.buildSlipPayload(actor, itemId);
    await payrollRepository.createSalarySlipLog({
      companyId: actor.companyId,
      payrollItemId: itemId,
      generatedBy: actor.id,
      fileUrl: null
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "salary_slip_generated",
      entityType: "salary_slip",
      entityId: itemId,
      metadata: {
        mode: "data"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      slip
    };
  }

  public async getPayrollSlipPdf(actor: PayrollActor, itemId: string, context: PayrollRequestContext): Promise<PayrollExportPayload> {
    const slip = await this.buildSlipPayload(actor, itemId);
    await payrollRepository.createSalarySlipLog({
      companyId: actor.companyId,
      payrollItemId: itemId,
      generatedBy: actor.id,
      fileUrl: null
    });
    const lines = [
      slip.company?.legalName || slip.company?.name || "Company",
      [slip.company?.addressLine1, slip.company?.addressLine2, slip.company?.city, slip.company?.state, slip.company?.pincode].filter(Boolean).join(", ") || "Address not available",
      "",
      `SALARY SLIP ${slip.runNumber}`,
      `Payroll Month : ${slip.payrollMonth}`,
      `Period        : ${formatDateValue(slip.periodStart)} to ${formatDateValue(slip.periodEnd)}`,
      `Employee      : ${slip.employee.fullName}`,
      `Employee Code : ${slip.employee.employeeCode}`,
      `Department    : ${slip.employee.department ?? "-"}`,
      `Designation   : ${slip.employee.designation ?? "-"}`,
      `Joining Date  : ${formatDateValue(slip.employee.joiningDate)}`,
      "",
      `Working Days  : ${slip.attendance.workingDays}`,
      `Present Days  : ${slip.attendance.presentDays}`,
      `Paid Leaves   : ${slip.attendance.paidLeaveDays}`,
      `Unpaid Leaves : ${slip.attendance.unpaidLeaveDays}`,
      `Payable Days  : ${slip.attendance.payableDays}`,
      `Overtime Hrs  : ${slip.attendance.overtimeHours}`,
      "",
      `Basic Salary  : ${slip.salary.basicSalary}`,
      `HRA           : ${slip.salary.hra}`,
      `Allowances    : ${slip.salary.allowancesTotal}`,
      `Bonus         : ${slip.salary.bonusTotal}`,
      `Gross Salary  : ${slip.salary.grossSalary}`,
      `Deductions    : ${slip.salary.deductionsTotal}`,
      `Net Salary    : ${slip.salary.netSalary}`,
      `Paid Amount   : ${slip.salary.paidAmount}`,
      `Unpaid Amount : ${slip.salary.unpaidAmount}`,
      `Pay Status    : ${slip.salary.paymentStatus}`,
      "",
      "BONUS / DEDUCTIONS",
      [padCell("Type", 12), padCell("Name", 28), padCell("Amount", 12, "right"), padCell("Taxable", 10)].join(" "),
      "-".repeat(66),
      ...(slip.bonusDeductions.length
        ? slip.bonusDeductions.map((entry) =>
            [
              padCell(entry.type, 12),
              padCell(entry.name, 28),
              padCell(entry.amount, 12, "right"),
              padCell(entry.taxable ? "Yes" : "No", 10)
            ].join(" ")
          )
        : ["No bonus or deduction entries"]),
      "",
      "PAYMENTS",
      [padCell("Date", 12), padCell("Mode", 12), padCell("Reference", 20), padCell("Amount", 12, "right")].join(" "),
      "-".repeat(60),
      ...(slip.payments.length
        ? slip.payments.map((payment) =>
            [
              padCell(formatDateValue(payment.paymentDate), 12),
              padCell(payment.paymentMode, 12),
              padCell(payment.referenceNumber ?? "-", 20),
              padCell(payment.amount, 12, "right")
            ].join(" ")
          )
        : ["No salary payments recorded"]),
      "",
      `Generated At  : ${formatDateTimeValue(new Date())}`
    ];
    const file = buildTextPdfFile(`${slip.employee.employeeCode}-${slip.payrollMonth}-salary-slip`, lines);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "salary_slip_generated",
      entityType: "salary_slip",
      entityId: itemId,
      metadata: {
        mode: "pdf"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async emailPayrollSlip(actor: PayrollActor, itemId: string, input: SalarySlipEmailInput, context: PayrollRequestContext) {
    const row = await this.getItemOrThrow(actor.companyId, itemId);
    const targetEmail = input.email ?? row.employee.email ?? null;
    if (!targetEmail) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "salary_slip_emailed",
        entityType: "salary_slip",
        entityId: itemId,
        metadata: {
          status: "skipped",
          reason: "email_missing"
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return {
        sentTo: null,
        status: "skipped",
        errorMessage: "Employee email is not available"
      };
    }

    const slip = await this.buildSlipPayload(actor, itemId);
    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await emailService.sendGenericEmail({
        to: targetEmail,
        subject: input.subject ?? `Salary slip ${slip.runNumber} - ${slip.payrollMonth}`,
        html: `<p>Hello ${slip.employee.fullName},</p><p>Your salary slip for <strong>${slip.payrollMonth}</strong> is ready.</p><p>Net salary: <strong>${slip.salary.netSalary}</strong></p><p>${input.message ?? ""}</p>`,
        text: `Salary slip for ${slip.payrollMonth}. Net salary: ${slip.salary.netSalary}. ${input.message ?? ""}`.trim()
      });
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Salary slip email failed";
    }

    await payrollRepository.createSalarySlipLog({
      companyId: actor.companyId,
      payrollItemId: itemId,
      generatedBy: actor.id,
      fileUrl: null
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "salary_slip_emailed",
      entityType: "salary_slip",
      entityId: itemId,
      metadata: {
        sentTo: targetEmail,
        status,
        errorMessage
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      sentTo: targetEmail,
      status,
      errorMessage
    };
  }

  public async getMonthlyReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const rows = await payrollRepository.listReportItems({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      includeCancelled: query.includeCancelled
    });

    const grouped = rows.reduce<Record<string, { employees: number; gross: string; deductions: string; bonus: string; net: string; paid: string }>>((map, row) => {
      const current = map[row.run.payrollMonth] ?? {
        employees: 0,
        gross: "0.00",
        deductions: "0.00",
        bonus: "0.00",
        net: "0.00",
        paid: "0.00"
      };
      current.employees += 1;
      current.gross = normalizeMoney(Number(current.gross) + Number(row.item.grossSalary));
      current.deductions = normalizeMoney(Number(current.deductions) + Number(row.item.deductionsTotal));
      current.bonus = normalizeMoney(Number(current.bonus) + Number(row.item.bonusTotal));
      current.net = normalizeMoney(Number(current.net) + Number(row.item.netSalary));
      current.paid = normalizeMoney(Number(current.paid) + Number(row.item.paidAmount));
      map[row.run.payrollMonth] = current;
      return map;
    }, {});

    return {
      items: Object.entries(grouped).map(([month, summary]) => ({
        payrollMonth: month,
        totalEmployees: summary.employees,
        grossTotal: summary.gross,
        deductionTotal: summary.deductions,
        bonusTotal: summary.bonus,
        netPayableTotal: summary.net,
        paidTotal: summary.paid
      }))
    };
  }

  public async getEmployeeReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const rows = await payrollRepository.listReportItems({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      includeCancelled: query.includeCancelled
    });

    const grouped = rows.reduce<Record<string, { employeeCode: string; fullName: string; department: string | null; net: string; paid: string; months: number }>>((map, row) => {
      const current = map[row.employee.id] ?? {
        employeeCode: row.employee.employeeCode,
        fullName: row.employee.fullName,
        department: row.employee.department,
        net: "0.00",
        paid: "0.00",
        months: 0
      };
      current.net = normalizeMoney(Number(current.net) + Number(row.item.netSalary));
      current.paid = normalizeMoney(Number(current.paid) + Number(row.item.paidAmount));
      current.months += 1;
      map[row.employee.id] = current;
      return map;
    }, {});

    return {
      items: Object.entries(grouped).map(([employeeId, summary]) => ({
        employeeId,
        employeeCode: summary.employeeCode,
        fullName: summary.fullName,
        department: summary.department,
        payrollEntries: summary.months,
        netSalaryTotal: summary.net,
        paidTotal: summary.paid
      }))
    };
  }

  public async getDepartmentReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const rows = await payrollRepository.listReportItems({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      includeCancelled: query.includeCancelled
    });

    const grouped = rows.reduce<Record<string, { employees: Set<string>; net: string; paid: string; gross: string }>>((map, row) => {
      const key = row.item.departmentSnapshot ?? "Unassigned";
      const current = map[key] ?? {
        employees: new Set<string>(),
        net: "0.00",
        paid: "0.00",
        gross: "0.00"
      };
      current.employees.add(row.employee.id);
      current.net = normalizeMoney(Number(current.net) + Number(row.item.netSalary));
      current.paid = normalizeMoney(Number(current.paid) + Number(row.item.paidAmount));
      current.gross = normalizeMoney(Number(current.gross) + Number(row.item.grossSalary));
      map[key] = current;
      return map;
    }, {});

    return {
      items: Object.entries(grouped).map(([department, summary]) => ({
        department,
        totalEmployees: summary.employees.size,
        grossTotal: summary.gross,
        netSalaryTotal: summary.net,
        paidTotal: summary.paid
      }))
    };
  }

  public async getBonusDeductionsReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const rows = await payrollRepository.listBonusDeductionReportRows({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      includeCancelled: query.includeCancelled
    });

    return {
      items: rows.map((row) => ({
        id: row.bonusDeduction.id,
        payrollMonth: row.run.payrollMonth,
        runNumber: row.run.runNumber,
        employeeId: row.employee.id,
        employeeCode: row.employee.employeeCode,
        employeeName: row.employee.fullName,
        type: row.bonusDeduction.type,
        name: row.bonusDeduction.name,
        amount: normalizeMoney(row.bonusDeduction.amount),
        taxable: row.bonusDeduction.taxable,
        notes: row.bonusDeduction.notes
      }))
    };
  }

  public async getUnpaidReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await payrollRepository.listUnpaidItems({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      includeCancelled: query.includeCancelled,
      page: pagination.page,
      limit: pagination.limit
    });

    return {
      items: result.rows.map((row) => ({
        ...this.mapItemRow(row),
        run: {
          id: row.run.id,
          runNumber: row.run.runNumber,
          payrollMonth: row.run.payrollMonth
        },
        unpaidAmount: normalizeMoney(Number(row.item.netSalary) - Number(row.item.paidAmount))
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getPaymentReport(actor: Pick<PayrollActor, "companyId">, query: ReportsQuery) {
    const rows = await payrollRepository.listPaymentReportRows({
      companyId: actor.companyId,
      payrollMonth: query.month,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      department: query.department ?? null,
      employeeId: query.employeeId,
      runId: query.runId,
      paymentMode: query.paymentMode,
      includeCancelled: query.includeCancelled
    });

    return {
      items: rows.map((row) => ({
        paymentId: row.payment.id,
        payrollMonth: row.run.payrollMonth,
        runNumber: row.run.runNumber,
        employeeId: row.employee.id,
        employeeCode: row.employee.employeeCode,
        employeeName: row.employee.fullName,
        paymentDate: row.payment.paymentDate,
        amount: normalizeMoney(row.payment.amount),
        paymentMode: row.payment.paymentMode,
        referenceNumber: row.payment.referenceNumber,
        payrollItemId: row.payment.payrollItemId
      })),
      summary: rows.reduce(
        (summary, row) => ({
          totalAmount: normalizeMoney(Number(summary.totalAmount) + Number(row.payment.amount)),
          totalPayments: summary.totalPayments + 1
        }),
        {
          totalAmount: "0.00",
          totalPayments: 0
        }
      )
    };
  }

  public async exportPayroll(actor: PayrollActor, query: ExportPayrollQuery, context: PayrollRequestContext): Promise<PayrollExportPayload> {
    const rows = await payrollRepository.listItems({
      companyId: actor.companyId,
      runId: query.runId,
      employeeId: query.employeeId,
      paymentStatus: query.paymentStatus,
      payrollMonth: query.month,
      department: query.department ?? null
    });
    const dataset: ReportExportDataset = {
      title: "Payroll Items",
      columns: [
        { key: "runNumber", label: "Run Number" },
        { key: "payrollMonth", label: "Month" },
        { key: "employeeCode", label: "Employee Code" },
        { key: "employeeName", label: "Employee Name" },
        { key: "department", label: "Department" },
        { key: "grossSalary", label: "Gross", type: "number" },
        { key: "deductionsTotal", label: "Deductions", type: "number" },
        { key: "bonusTotal", label: "Bonus", type: "number" },
        { key: "netSalary", label: "Net", type: "number" },
        { key: "paidAmount", label: "Paid", type: "number" },
        { key: "paymentStatus", label: "Payment Status" }
      ],
      rows: rows.rows.map((row) => ({
        runNumber: row.run.runNumber,
        payrollMonth: row.run.payrollMonth,
        employeeCode: row.item.employeeCodeSnapshot,
        employeeName: row.item.employeeNameSnapshot,
        department: row.item.departmentSnapshot ?? "",
        grossSalary: Number(normalizeMoney(row.item.grossSalary)),
        deductionsTotal: Number(normalizeMoney(row.item.deductionsTotal)),
        bonusTotal: Number(normalizeMoney(row.item.bonusTotal)),
        netSalary: Number(normalizeMoney(row.item.netSalary)),
        paidAmount: Number(normalizeMoney(row.item.paidAmount)),
        paymentStatus: row.item.paymentStatus
      }))
    };
    const file = buildReportFile(dataset, query.format, `payroll-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payroll_exported",
      entityType: "payroll_run",
      metadata: {
        format: query.format,
        rowCount: rows.rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }
}

export const payrollService = new PayrollService();
