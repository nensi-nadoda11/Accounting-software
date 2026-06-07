import { db } from "../../db";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { calculateAccountBalanceByNormalSide, normalizeMoney } from "../accounting/accounting.calculation";
import { auditLogService } from "../audit-logs/audit-log.service";
import { decimalToScaledBigInt, scaledBigIntToDecimal } from "../inventory/inventory.utils";
import { notificationsRepository } from "../notifications/notifications.repository";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { cashVerificationRepository } from "./cashVerification.repository";
import type {
  CreateCashVerificationInput,
  ExportCashVerificationQuery,
  ListCashVerificationsQuery,
  UpdateCashVerificationInput
} from "./cashVerification.validator";
import type { CashVerificationActor, CashVerificationRequestContext, CashVerificationStatus } from "./cashVerification.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CashVerificationDetailRow = NonNullable<Awaited<ReturnType<typeof cashVerificationRepository.getDetail>>>;
type CashVerificationListRow = Awaited<ReturnType<typeof cashVerificationRepository.list>>["rows"][number];

const DEFAULT_DIFFERENCE_THRESHOLD = 1000;

const toAuditContext = (context: CashVerificationRequestContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null
});

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const normalizeVerificationNo = (previous: string | null) => {
  const previousNumber = previous ? Number(previous.replace("CV-", "")) : 0;
  const next = Number.isFinite(previousNumber) ? previousNumber + 1 : 1;
  return `CV-${String(next).padStart(6, "0")}`;
};

const subtractMoney = (left: string | number, right: string | number) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, 2) - decimalToScaledBigInt(right, 2), 2);

const absoluteMoney = (value: string | number) => {
  const scaled = decimalToScaledBigInt(value, 2);
  return scaled < 0n ? scaledBigIntToDecimal(scaled * -1n, 2) : scaledBigIntToDecimal(scaled, 2);
};

const formatDateLabel = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

class CashVerificationService {
  private mapRow(row: CashVerificationListRow) {
    return {
      id: row.verification.id,
      verificationNo: row.verification.verificationNo,
      verificationDate: row.verification.verificationDate,
      expectedCash: normalizeMoney(row.verification.expectedCash),
      actualCash: normalizeMoney(row.verification.actualCash),
      differenceAmount: normalizeMoney(row.verification.differenceAmount),
      status: row.verification.status,
      remarks: row.verification.remarks,
      recordStatus: row.verification.recordStatus,
      verifiedBy: {
        id: row.verification.verifiedByUserId,
        name: row.verifiedByName
      },
      approvedBy: row.verification.approvedByUserId
        ? {
            id: row.verification.approvedByUserId,
            name: row.approvedByName
          }
        : null,
      approvalDate: row.verification.approvalDate,
      createdAt: row.verification.createdAt,
      updatedAt: row.verification.updatedAt
    };
  }

  private mapDetail(row: CashVerificationDetailRow) {
    return {
      ...this.mapRow(row),
      approvalHistory: [
        {
          status: "created" as const,
          userId: row.verification.verifiedByUserId,
          userName: row.verifiedByName,
          at: row.verification.createdAt
        },
        ...(row.verification.recordStatus === "completed" || row.verification.recordStatus === "approved"
          ? [
              {
                status: "completed" as const,
                userId: row.verification.verifiedByUserId,
                userName: row.verifiedByName,
                at: row.verification.updatedAt
              }
            ]
          : []),
        ...(row.verification.approvedByUserId
          ? [
              {
                status: "approved" as const,
                userId: row.verification.approvedByUserId,
                userName: row.approvedByName,
                at: row.verification.approvalDate ?? row.verification.updatedAt
              }
            ]
          : [])
      ]
    };
  }

  private calculateStatus(differenceAmount: string): CashVerificationStatus {
    const difference = decimalToScaledBigInt(differenceAmount, 2);
    if (difference === 0n) {
      return "matched";
    }

    return difference < 0n ? "short_cash" : "excess_cash";
  }

  private async getExpectedCash(companyId: string, executor?: TransactionClient) {
    const balance = await cashVerificationRepository.getCashLedgerBalance(companyId, executor);
    if (!balance) {
      throw new AppError("Cash ledger account is missing or inactive", 409);
    }

    const ledgerBalance = calculateAccountBalanceByNormalSide(balance.normalBalance, balance.debit, balance.credit);

    return {
      expectedCash: normalizeMoney(ledgerBalance),
      currentCashLedger: {
        accountId: balance.accountId,
        accountCode: balance.accountCode,
        accountName: balance.accountName,
        normalBalance: balance.normalBalance,
        balance: normalizeMoney(ledgerBalance),
        storedBalance: normalizeMoney(balance.currentBalance)
      }
    };
  }

  private async getDetailOrThrow(companyId: string, cashVerificationId: string, executor?: TransactionClient) {
    const detail = await cashVerificationRepository.getDetail(companyId, cashVerificationId, executor);
    if (!detail) {
      throw new AppError("Cash verification not found", 404);
    }

    return detail;
  }

  private async getDifferenceThreshold(companyId: string) {
    const settings = await cashVerificationRepository.getCashVerificationSettings(companyId);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return DEFAULT_DIFFERENCE_THRESHOLD;
    }

    const threshold = (settings as Record<string, unknown>).differenceThreshold;
    return typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0
      ? threshold
      : DEFAULT_DIFFERENCE_THRESHOLD;
  }

  private async createInAppNotifications(
    input: {
      companyId: string;
      actorId: string;
      cashVerificationId: string;
      verificationNo: string;
      title: string;
      message: string;
      priority: "success" | "warning";
      type: "system" | "warning";
    },
    executor: TransactionClient
  ) {
    const recipients = await notificationsRepository.listCompanyUsersWithPreferences(input.companyId);

    for (const recipient of recipients) {
      if (recipient.preference && !recipient.preference.inAppEnabled) {
        continue;
      }

      const notification = await notificationsRepository.createNotification(
        {
          companyId: input.companyId,
          userId: recipient.user.id,
          title: input.title,
          message: input.message,
          type: input.type,
          priority: input.priority,
          channel: "in_app",
          entityType: "cash_verification",
          entityId: input.cashVerificationId,
          actionUrl: `/app/accounting/cash-verification?id=${input.cashVerificationId}`,
          createdBy: input.actorId
        },
        executor
      );

      if (!notification) {
        throw new AppError("Failed to create cash verification notification", 500);
      }

      await notificationsRepository.createLog(
        {
          companyId: input.companyId,
          notificationId: notification.id,
          channel: "in_app",
          recipient: recipient.user.id,
          status: "sent",
          metadata: {
            verificationNo: input.verificationNo
          },
          sentAt: new Date()
        },
        executor
      );
    }
  }

  public async list(actor: Pick<CashVerificationActor, "companyId">, query: ListCashVerificationsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await cashVerificationRepository.list({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      ...pickDefined({
        status: query.status,
        recordStatus: query.recordStatus,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      })
    });

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getById(actor: Pick<CashVerificationActor, "companyId">, cashVerificationId: string) {
    return {
      cashVerification: this.mapDetail(await this.getDetailOrThrow(actor.companyId, cashVerificationId))
    };
  }

  public async getCurrentBalance(actor: Pick<CashVerificationActor, "companyId">) {
    const balance = await this.getExpectedCash(actor.companyId);
    const latest = await cashVerificationRepository.getLatest(actor.companyId);

    return {
      expectedCash: balance.expectedCash,
      currentCashLedger: balance.currentCashLedger,
      lastVerification: latest ? this.mapRow(latest) : null
    };
  }

  public async create(actor: CashVerificationActor, input: CreateCashVerificationInput, context: CashVerificationRequestContext) {
    const actualCash = normalizeMoney(input.actualCash);
    const balance = await this.getExpectedCash(actor.companyId);
    const differenceAmount = subtractMoney(actualCash, balance.expectedCash);
    const status = this.calculateStatus(differenceAmount);

    const created = await db.transaction(async (transaction) => {
      await cashVerificationRepository.acquireScopedLock("cash-verification-sequence", actor.companyId, transaction);
      const verificationNo = normalizeVerificationNo(
        await cashVerificationRepository.findLatestVerificationNo(actor.companyId, transaction)
      );

      const verification = await cashVerificationRepository.create(
        {
          companyId: actor.companyId,
          verificationNo,
          verificationDate: toDateOnly(input.verificationDate),
          expectedCash: balance.expectedCash,
          actualCash,
          differenceAmount,
          status,
          remarks: input.remarks ?? null,
          verifiedByUserId: actor.id,
          recordStatus: "draft"
        },
        transaction
      );

      if (!verification) {
        throw new AppError("Failed to create cash verification", 500);
      }

      return verification;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cash_verification_created",
      module: "cash_verification",
      entityType: "cash_verification",
      entityId: created.id,
      metadata: {
        verificationNo: created.verificationNo,
        expectedCash: created.expectedCash,
        actualCash: created.actualCash,
        differenceAmount: created.differenceAmount,
        status: created.status
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, created.id);
  }

  public async update(
    actor: CashVerificationActor,
    cashVerificationId: string,
    input: UpdateCashVerificationInput,
    context: CashVerificationRequestContext
  ) {
    const existing = await cashVerificationRepository.findById(actor.companyId, cashVerificationId);
    if (!existing) {
      throw new AppError("Cash verification not found", 404);
    }

    if (existing.recordStatus !== "draft") {
      throw new AppError("Only draft cash verifications can be edited", 400);
    }

    const balance = await this.getExpectedCash(actor.companyId);
    const actualCash = normalizeMoney(input.actualCash ?? existing.actualCash);
    const differenceAmount = subtractMoney(actualCash, balance.expectedCash);
    const status = this.calculateStatus(differenceAmount);

    const updated = await cashVerificationRepository.update(actor.companyId, cashVerificationId, {
      verificationDate: input.verificationDate ? toDateOnly(input.verificationDate) : existing.verificationDate,
      expectedCash: balance.expectedCash,
      actualCash,
      differenceAmount,
      status,
      remarks: input.remarks === undefined ? existing.remarks : input.remarks
    });

    if (!updated) {
      throw new AppError("Failed to update cash verification", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cash_verification_updated",
      module: "cash_verification",
      entityType: "cash_verification",
      entityId: cashVerificationId,
      metadata: {
        verificationNo: updated.verificationNo,
        expectedCash: updated.expectedCash,
        actualCash: updated.actualCash,
        differenceAmount: updated.differenceAmount,
        status: updated.status
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, cashVerificationId);
  }

  public async complete(actor: CashVerificationActor, cashVerificationId: string, context: CashVerificationRequestContext) {
    const existing = await cashVerificationRepository.findById(actor.companyId, cashVerificationId);
    if (!existing) {
      throw new AppError("Cash verification not found", 404);
    }

    if (existing.recordStatus === "approved") {
      throw new AppError("Approved cash verifications cannot be completed again", 400);
    }

    if (existing.recordStatus === "draft") {
      await cashVerificationRepository.update(actor.companyId, cashVerificationId, { recordStatus: "completed" });
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cash_verification_completed",
      module: "cash_verification",
      entityType: "cash_verification",
      entityId: cashVerificationId,
      metadata: {
        verificationNo: existing.verificationNo
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, cashVerificationId);
  }

  public async approve(actor: CashVerificationActor, cashVerificationId: string, context: CashVerificationRequestContext) {
    const threshold = await this.getDifferenceThreshold(actor.companyId);

    const result = await db.transaction(async (transaction) => {
      await cashVerificationRepository.acquireScopedLock(`cash-verification-approval:${cashVerificationId}`, actor.companyId, transaction);
      const detail = await this.getDetailOrThrow(actor.companyId, cashVerificationId, transaction);

      if (detail.verification.recordStatus === "approved") {
        throw new AppError("Cash verification is already approved", 409);
      }

      if (detail.verification.recordStatus !== "completed") {
        throw new AppError("Only completed cash verifications can be approved", 400);
      }

      const approved = await cashVerificationRepository.update(
        actor.companyId,
        cashVerificationId,
        {
          recordStatus: "approved",
          approvedByUserId: actor.id,
          approvalDate: new Date()
        },
        transaction
      );

      if (!approved) {
        throw new AppError("Failed to approve cash verification", 500);
      }

      await this.createInAppNotifications(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          cashVerificationId,
          verificationNo: detail.verification.verificationNo,
          title: `Cash verification ${detail.verification.verificationNo} approved`,
          message: `Cash verification ${detail.verification.verificationNo} has been approved.`,
          priority: "success",
          type: "system"
        },
        transaction
      );

      if (Number(absoluteMoney(detail.verification.differenceAmount)) > threshold) {
        await this.createInAppNotifications(
          {
            companyId: actor.companyId,
            actorId: actor.id,
            cashVerificationId,
            verificationNo: detail.verification.verificationNo,
            title: `Cash difference warning in ${detail.verification.verificationNo}`,
            message: `Cash difference ${normalizeMoney(detail.verification.differenceAmount)} exceeds the configured threshold of ${threshold.toFixed(2)}.`,
            priority: "warning",
            type: "warning"
          },
          transaction
        );
      }

      return approved;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cash_verification_approved",
      module: "cash_verification",
      entityType: "cash_verification",
      entityId: cashVerificationId,
      metadata: {
        verificationNo: result.verificationNo,
        expectedCash: result.expectedCash,
        actualCash: result.actualCash,
        differenceAmount: result.differenceAmount,
        status: result.status
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, cashVerificationId);
  }

  public async exportById(
    actor: CashVerificationActor,
    cashVerificationId: string,
    query: ExportCashVerificationQuery,
    context: CashVerificationRequestContext
  ) {
    const detail = this.mapDetail(await this.getDetailOrThrow(actor.companyId, cashVerificationId));

    const dataset: ReportExportDataset = {
      title: `Cash Verification ${detail.verificationNo}`,
      subtitle: "System cash balance vs physical cash count",
      metadata: [
        { label: "Verification No", value: detail.verificationNo },
        { label: "Date", value: formatDateLabel(detail.verificationDate) },
        { label: "Record Status", value: detail.recordStatus },
        { label: "Status", value: detail.status }
      ],
      summary: [
        { label: "Expected Cash", value: detail.expectedCash },
        { label: "Actual Cash", value: detail.actualCash },
        { label: "Difference", value: detail.differenceAmount },
        { label: "Verified By", value: detail.verifiedBy.name ?? "-" },
        { label: "Approved By", value: detail.approvedBy?.name ?? "-" },
        { label: "Remarks", value: detail.remarks ?? "-" }
      ],
      columns: [
        { key: "verificationNo", label: "Verification No" },
        { key: "date", label: "Date", type: "date" },
        { key: "expectedCash", label: "Expected Cash", type: "number" },
        { key: "actualCash", label: "Actual Cash", type: "number" },
        { key: "difference", label: "Difference", type: "number" },
        { key: "status", label: "Status" },
        { key: "verifiedBy", label: "Verified By" },
        { key: "approvedBy", label: "Approved By" },
        { key: "remarks", label: "Remarks" }
      ],
      rows: [
        {
          verificationNo: detail.verificationNo,
          date: detail.verificationDate,
          expectedCash: detail.expectedCash,
          actualCash: detail.actualCash,
          difference: detail.differenceAmount,
          status: detail.status,
          verifiedBy: detail.verifiedBy.name ?? "-",
          approvedBy: detail.approvedBy?.name ?? "-",
          remarks: detail.remarks ?? ""
        }
      ]
    };

    const file = buildReportFile(dataset, query.format, `cash-verification-${detail.verificationNo.toLowerCase()}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cash_verification_exported",
      module: "cash_verification",
      entityType: "cash_verification",
      entityId: cashVerificationId,
      metadata: {
        verificationNo: detail.verificationNo,
        format: query.format
      },
      ...toAuditContext(context)
    });

    return file;
  }
}

export const cashVerificationService = new CashVerificationService();
