import { db } from "../../db";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { auditLogService } from "../audit-logs/audit-log.service";
import { notificationsRepository } from "../notifications/notifications.repository";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { buildSiteAuditFileUrl } from "./siteAudit.upload";
import { siteAuditRepository, type SiteAuditDbExecutor } from "./siteAudit.repository";
import type {
  CompleteSiteAuditInput,
  CreateSiteAuditInput,
  ExportSiteAuditQuery,
  ListSiteAuditsQuery,
  SiteAuditFindingInput,
  UpdateSiteAuditFindingInput,
  UpdateSiteAuditInput
} from "./siteAudit.validator";
import {
  SITE_AUDIT_CHECKLIST,
  type SiteAuditActor,
  type SiteAuditChecklistKey,
  type SiteAuditRequestContext
} from "./siteAudit.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SiteAuditDetailRow = NonNullable<Awaited<ReturnType<typeof siteAuditRepository.getDetail>>>;
type SiteAuditListRow = Awaited<ReturnType<typeof siteAuditRepository.list>>["rows"][number];

const toAuditContext = (context: SiteAuditRequestContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null
});

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const normalizeAuditNo = (previous: string | null) => {
  const previousNumber = previous ? Number(previous.replace("SA-", "")) : 0;
  const next = Number.isFinite(previousNumber) ? previousNumber + 1 : 1;
  return `SA-${String(next).padStart(6, "0")}`;
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

const normalizeChecklist = (items: CreateSiteAuditInput["checklist"] | UpdateSiteAuditInput["checklist"] | undefined) => {
  const inputByKey = new Map((items ?? []).map((item) => [item.checklistKey, item]));
  return SITE_AUDIT_CHECKLIST.map((definition) => {
    const input = inputByKey.get(definition.key);
    return {
      checklistKey: definition.key,
      checklistLabel: definition.label,
      isChecked: input?.isChecked ?? false,
      remarks: input?.remarks ?? null
    };
  });
};

class SiteAuditService {
  private mapListRow(row: SiteAuditListRow) {
    return {
      id: row.audit.id,
      auditNo: row.audit.auditNo,
      auditDate: row.audit.auditDate,
      warehouse: row.audit.warehouseId
        ? {
            id: row.audit.warehouseId,
            name: row.warehouseName,
            warehouseCode: row.warehouseCode
          }
        : null,
      auditor: {
        id: row.audit.auditorUserId,
        name: row.auditorName
      },
      status: row.audit.status,
      finalResult: row.audit.finalResult,
      findings: {
        total: Number(row.findingCount ?? 0),
        critical: Number(row.criticalFindingCount ?? 0)
      },
      overallRemarks: row.audit.overallRemarks,
      createdAt: row.audit.createdAt,
      updatedAt: row.audit.updatedAt
    };
  }

  private mapDetail(row: SiteAuditDetailRow) {
    const checkedCount = row.checklist.filter((item) => item.isChecked).length;
    return {
      id: row.audit.id,
      auditNo: row.audit.auditNo,
      auditDate: row.audit.auditDate,
      warehouse: row.audit.warehouseId
        ? {
            id: row.audit.warehouseId,
            name: row.warehouseName,
            warehouseCode: row.warehouseCode
          }
        : null,
      auditor: {
        id: row.audit.auditorUserId,
        name: row.auditorName,
        role: row.auditorRole
      },
      linkedStockCheck: row.audit.linkedStockCheckId
        ? {
            id: row.audit.linkedStockCheckId,
            checkNo: row.stockCheckNo,
            status: row.stockCheckStatus,
            summary: {
              totalItems: row.stockCheckTotalItems ?? 0,
              matchedItems: row.stockCheckMatchedItems ?? 0,
              shortItems: row.stockCheckShortItems ?? 0,
              excessItems: row.stockCheckExcessItems ?? 0
            },
            mismatchSummary: {
              shortItems: row.stockCheckShortItems ?? 0,
              excessItems: row.stockCheckExcessItems ?? 0,
              mismatchItems: (row.stockCheckShortItems ?? 0) + (row.stockCheckExcessItems ?? 0)
            }
          }
        : null,
      linkedCashVerification: row.audit.linkedCashVerificationId
        ? {
            id: row.audit.linkedCashVerificationId,
            verificationNo: row.cashVerificationNo,
            status: row.cashVerificationStatus,
            recordStatus: row.cashVerificationRecordStatus,
            expectedCash: row.cashExpectedCash ?? "0.00",
            actualCash: row.cashActualCash ?? "0.00",
            differenceAmount: row.cashDifferenceAmount ?? "0.00"
          }
        : null,
      status: row.audit.status,
      finalResult: row.audit.finalResult,
      overallRemarks: row.audit.overallRemarks,
      approvedBy: row.audit.approvedByUserId
        ? {
            id: row.audit.approvedByUserId,
            name: row.approvedByName
          }
        : null,
      approvedAt: row.audit.approvedAt,
      checklist: row.checklist.map((item) => ({
        id: item.id,
        checklistKey: item.checklistKey as SiteAuditChecklistKey,
        checklistLabel: item.checklistLabel,
        isChecked: item.isChecked,
        remarks: item.remarks,
        createdAt: item.createdAt
      })),
      checklistSummary: {
        checked: checkedCount,
        total: row.checklist.length
      },
      findings: row.findings.map((finding) => ({
        id: finding.id,
        findingTitle: finding.findingTitle,
        findingDescription: finding.findingDescription,
        severity: finding.severity,
        status: finding.status,
        relatedModule: finding.relatedModule,
        relatedReferenceId: finding.relatedReferenceId,
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt
      })),
      attachments: row.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        originalName: attachment.originalName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: attachment.uploadedBy,
        createdAt: attachment.createdAt
      })),
      approvalHistory: [
        {
          status: "created" as const,
          userId: row.audit.auditorUserId,
          userName: row.auditorName,
          at: row.audit.createdAt
        },
        ...(row.audit.status === "completed" || row.audit.status === "approved"
          ? [
              {
                status: "completed" as const,
                userId: row.audit.auditorUserId,
                userName: row.auditorName,
                at: row.audit.updatedAt
              }
            ]
          : []),
        ...(row.audit.approvedByUserId
          ? [
              {
                status: "approved" as const,
                userId: row.audit.approvedByUserId,
                userName: row.approvedByName,
                at: row.audit.approvedAt ?? row.audit.updatedAt
              }
            ]
          : [])
      ],
      createdAt: row.audit.createdAt,
      updatedAt: row.audit.updatedAt
    };
  }

  private async getDetailOrThrow(companyId: string, siteAuditId: string, executor?: SiteAuditDbExecutor) {
    const detail = await siteAuditRepository.getDetail(companyId, siteAuditId, executor);
    if (!detail) {
      throw new AppError("Site audit not found", 404);
    }

    return detail;
  }

  private assertEditable(status: string) {
    if (status === "approved") {
      throw new AppError("Approved audit cannot be edited", 400);
    }

    if (status === "cancelled") {
      throw new AppError("Cancelled audit cannot be edited", 400);
    }
  }

  private async assertReferences(companyId: string, input: {
    warehouseId?: string | null | undefined;
    auditorUserId?: string | null | undefined;
    linkedStockCheckId?: string | null | undefined;
    linkedCashVerificationId?: string | null | undefined;
  }) {
    if (input.warehouseId) {
      const warehouse = await siteAuditRepository.findWarehouseById(companyId, input.warehouseId);
      if (!warehouse) {
        throw new AppError("Warehouse not found", 404);
      }
    }

    if (input.auditorUserId) {
      const auditor = await siteAuditRepository.findUserById(companyId, input.auditorUserId);
      if (!auditor) {
        throw new AppError("Auditor not found", 404);
      }
    }

    if (input.linkedStockCheckId) {
      const stockCheck = await siteAuditRepository.findStockCheckById(companyId, input.linkedStockCheckId);
      if (!stockCheck) {
        throw new AppError("Linked stock check not found", 404);
      }
    }

    if (input.linkedCashVerificationId) {
      const cashVerification = await siteAuditRepository.findCashVerificationById(companyId, input.linkedCashVerificationId);
      if (!cashVerification) {
        throw new AppError("Linked cash verification not found", 404);
      }
    }
  }

  private async createInAppNotifications(
    input: {
      companyId: string;
      actorId: string;
      siteAuditId: string;
      auditNo: string;
      title: string;
      message: string;
      priority: "success" | "warning" | "critical";
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
          entityType: "site_audit",
          entityId: input.siteAuditId,
          actionUrl: `/app/audit/site-audit?id=${input.siteAuditId}`,
          createdBy: input.actorId
        },
        executor
      );

      if (!notification) {
        throw new AppError("Failed to create site audit notification", 500);
      }

      await notificationsRepository.createLog(
        {
          companyId: input.companyId,
          notificationId: notification.id,
          channel: "in_app",
          recipient: recipient.user.id,
          status: "sent",
          metadata: {
            auditNo: input.auditNo
          },
          sentAt: new Date()
        },
        executor
      );
    }
  }

  public async list(actor: Pick<SiteAuditActor, "companyId">, query: ListSiteAuditsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await siteAuditRepository.list({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      ...pickDefined({
        status: query.status,
        finalResult: query.finalResult,
        warehouseId: query.warehouseId,
        auditorId: query.auditorId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      })
    });

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getById(actor: Pick<SiteAuditActor, "companyId">, siteAuditId: string) {
    return {
      siteAudit: this.mapDetail(await this.getDetailOrThrow(actor.companyId, siteAuditId))
    };
  }

  public async create(actor: SiteAuditActor, input: CreateSiteAuditInput, context: SiteAuditRequestContext) {
    await this.assertReferences(actor.companyId, input);
    const checklist = normalizeChecklist(input.checklist);

    const created = await db.transaction(async (transaction) => {
      await siteAuditRepository.acquireScopedLock("site-audit-sequence", actor.companyId, transaction);
      const auditNo = normalizeAuditNo(await siteAuditRepository.findLatestAuditNo(actor.companyId, transaction));
      const audit = await siteAuditRepository.createAudit(
        {
          companyId: actor.companyId,
          auditNo,
          auditDate: toDateOnly(input.auditDate),
          warehouseId: input.warehouseId ?? null,
          auditorUserId: input.auditorUserId,
          linkedStockCheckId: input.linkedStockCheckId ?? null,
          linkedCashVerificationId: input.linkedCashVerificationId ?? null,
          finalResult: input.finalResult,
          overallRemarks: input.overallRemarks ?? null,
          status: "draft"
        },
        transaction
      );

      if (!audit) {
        throw new AppError("Failed to create site audit", 500);
      }

      await siteAuditRepository.replaceChecklist(
        audit.id,
        checklist.map((item) => ({
          siteAuditId: audit.id,
          ...item
        })),
        transaction
      );

      await siteAuditRepository.createFindings(
        (input.findings ?? []).map((finding) => ({
          siteAuditId: audit.id,
          findingTitle: finding.findingTitle,
          findingDescription: finding.findingDescription ?? null,
          severity: finding.severity,
          status: finding.status,
          relatedModule: finding.relatedModule ?? null,
          relatedReferenceId: finding.relatedReferenceId ?? null
        })),
        transaction
      );

      return audit;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_created",
      module: "site_audit",
      entityType: "site_audit",
      entityId: created.id,
      metadata: {
        auditNo: created.auditNo,
        auditorUserId: created.auditorUserId,
        warehouseId: created.warehouseId
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, created.id);
  }

  public async update(actor: SiteAuditActor, siteAuditId: string, input: UpdateSiteAuditInput, context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);
    await this.assertReferences(actor.companyId, {
      warehouseId: input.warehouseId,
      auditorUserId: input.auditorUserId,
      linkedStockCheckId: input.linkedStockCheckId,
      linkedCashVerificationId: input.linkedCashVerificationId
    });

    await db.transaction(async (transaction) => {
      const updated = await siteAuditRepository.updateAudit(
        actor.companyId,
        siteAuditId,
        {
          auditDate: input.auditDate ? toDateOnly(input.auditDate) : existing.auditDate,
          warehouseId: input.warehouseId === undefined ? existing.warehouseId : input.warehouseId,
          auditorUserId: input.auditorUserId ?? existing.auditorUserId,
          linkedStockCheckId: input.linkedStockCheckId === undefined ? existing.linkedStockCheckId : input.linkedStockCheckId,
          linkedCashVerificationId:
            input.linkedCashVerificationId === undefined ? existing.linkedCashVerificationId : input.linkedCashVerificationId,
          finalResult: input.finalResult ?? existing.finalResult,
          overallRemarks: input.overallRemarks === undefined ? existing.overallRemarks : input.overallRemarks
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update site audit", 500);
      }

      if (input.checklist) {
        const checklist = normalizeChecklist(input.checklist);
        await siteAuditRepository.replaceChecklist(
          siteAuditId,
          checklist.map((item) => ({
            siteAuditId,
            ...item
          })),
          transaction
        );
      }
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_updated",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: existing.auditNo
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async complete(actor: SiteAuditActor, siteAuditId: string, input: CompleteSiteAuditInput, context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);
    const checklist = await siteAuditRepository.listChecklist(siteAuditId);
    if (!checklist.some((item) => item.isChecked)) {
      throw new AppError("At least one checklist item should be checked before complete", 400);
    }

    await db.transaction(async (transaction) => {
      const updated = await siteAuditRepository.updateAudit(
        actor.companyId,
        siteAuditId,
        {
          status: "completed",
          finalResult: input.finalResult
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to complete site audit", 500);
      }

      await this.createInAppNotifications(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          siteAuditId,
          auditNo: existing.auditNo,
          title: `Site audit ${existing.auditNo} completed`,
          message: `Site audit ${existing.auditNo} has been completed with result ${input.finalResult.replaceAll("_", " ")}.`,
          priority: input.finalResult === "passed" ? "success" : "warning",
          type: input.finalResult === "passed" ? "system" : "warning"
        },
        transaction
      );
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_completed",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: existing.auditNo,
        finalResult: input.finalResult
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async approve(actor: SiteAuditActor, siteAuditId: string, context: SiteAuditRequestContext) {
    const approved = await db.transaction(async (transaction) => {
      await siteAuditRepository.acquireScopedLock(`site-audit-approval:${siteAuditId}`, actor.companyId, transaction);
      const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId, transaction);
      if (!existing) {
        throw new AppError("Site audit not found", 404);
      }

      if (existing.status === "cancelled") {
        throw new AppError("Cancelled audit cannot be approved", 400);
      }

      if (existing.status === "approved") {
        throw new AppError("Site audit is already approved", 409);
      }

      if (existing.status !== "completed") {
        throw new AppError("Only completed site audits can be approved", 400);
      }

      const row = await siteAuditRepository.updateAudit(
        actor.companyId,
        siteAuditId,
        {
          status: "approved",
          approvedByUserId: actor.id,
          approvedAt: new Date()
        },
        transaction
      );

      if (!row) {
        throw new AppError("Failed to approve site audit", 500);
      }

      await this.createInAppNotifications(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          siteAuditId,
          auditNo: existing.auditNo,
          title: `Site audit ${existing.auditNo} approved`,
          message: `Site audit ${existing.auditNo} has been approved.`,
          priority: "success",
          type: "system"
        },
        transaction
      );

      return row;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_approved",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: approved.auditNo,
        finalResult: approved.finalResult
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async cancel(actor: SiteAuditActor, siteAuditId: string, context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    if (existing.status === "approved") {
      throw new AppError("Approved audit cannot be cancelled", 400);
    }

    const cancelled = await siteAuditRepository.updateAudit(actor.companyId, siteAuditId, { status: "cancelled" });
    if (!cancelled) {
      throw new AppError("Failed to cancel site audit", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_cancelled",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: existing.auditNo
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async addFinding(actor: SiteAuditActor, siteAuditId: string, input: SiteAuditFindingInput, context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);

    const created = await db.transaction(async (transaction) => {
      const finding = await siteAuditRepository.createFinding(
        {
          siteAuditId,
          findingTitle: input.findingTitle,
          findingDescription: input.findingDescription ?? null,
          severity: input.severity,
          status: input.status,
          relatedModule: input.relatedModule ?? null,
          relatedReferenceId: input.relatedReferenceId ?? null
        },
        transaction
      );

      if (!finding) {
        throw new AppError("Failed to add site audit finding", 500);
      }

      if (finding.severity === "critical") {
        await this.createInAppNotifications(
          {
            companyId: actor.companyId,
            actorId: actor.id,
            siteAuditId,
            auditNo: existing.auditNo,
            title: `Critical finding in ${existing.auditNo}`,
            message: finding.findingTitle,
            priority: "critical",
            type: "warning"
          },
          transaction
        );
      }

      return finding;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_finding_added",
      module: "site_audit",
      entityType: "site_audit_finding",
      entityId: created.id,
      metadata: {
        siteAuditId,
        auditNo: existing.auditNo,
        severity: created.severity
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async updateFinding(
    actor: SiteAuditActor,
    siteAuditId: string,
    findingId: string,
    input: UpdateSiteAuditFindingInput,
    context: SiteAuditRequestContext
  ) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);

    const findingPatch: {
      findingTitle?: string;
      findingDescription?: string | null;
      severity?: "low" | "medium" | "high" | "critical";
      status?: "open" | "resolved" | "ignored";
      relatedModule?: string | null;
      relatedReferenceId?: string | null;
    } = {};

    if (input.findingTitle !== undefined) {
      findingPatch.findingTitle = input.findingTitle;
    }
    if (input.findingDescription !== undefined) {
      findingPatch.findingDescription = input.findingDescription;
    }
    if (input.severity !== undefined) {
      findingPatch.severity = input.severity;
    }
    if (input.status !== undefined) {
      findingPatch.status = input.status;
    }
    if (input.relatedModule !== undefined) {
      findingPatch.relatedModule = input.relatedModule;
    }
    if (input.relatedReferenceId !== undefined) {
      findingPatch.relatedReferenceId = input.relatedReferenceId;
    }

    const updated = await siteAuditRepository.updateFinding(siteAuditId, findingId, findingPatch);

    if (!updated) {
      throw new AppError("Site audit finding not found", 404);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_finding_updated",
      module: "site_audit",
      entityType: "site_audit_finding",
      entityId: findingId,
      metadata: {
        siteAuditId,
        auditNo: existing.auditNo
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async uploadAttachments(actor: SiteAuditActor, siteAuditId: string, files: Express.Multer.File[], context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);

    const attachments = await siteAuditRepository.createAttachments(
      files.map((file) => ({
        companyId: actor.companyId,
        siteAuditId,
        fileName: file.filename,
        originalName: file.originalname,
        fileUrl: buildSiteAuditFileUrl(actor.companyId, siteAuditId, file.filename),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: actor.id
      }))
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_attachment_uploaded",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: existing.auditNo,
        attachmentCount: attachments.length
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async deleteAttachment(actor: SiteAuditActor, siteAuditId: string, attachmentId: string, context: SiteAuditRequestContext) {
    const existing = await siteAuditRepository.findById(actor.companyId, siteAuditId);
    if (!existing) {
      throw new AppError("Site audit not found", 404);
    }

    this.assertEditable(existing.status);
    const attachment = await siteAuditRepository.findAttachmentById(actor.companyId, attachmentId);
    if (!attachment || attachment.siteAuditId !== siteAuditId) {
      throw new AppError("Site audit attachment not found", 404);
    }

    await siteAuditRepository.softDeleteAttachment(actor.companyId, attachmentId);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_attachment_deleted",
      module: "site_audit",
      entityType: "site_audit_attachment",
      entityId: attachmentId,
      metadata: {
        siteAuditId,
        auditNo: existing.auditNo,
        fileName: attachment.fileName
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, siteAuditId);
  }

  public async exportById(actor: SiteAuditActor, siteAuditId: string, query: ExportSiteAuditQuery, context: SiteAuditRequestContext) {
    const detail = this.mapDetail(await this.getDetailOrThrow(actor.companyId, siteAuditId));
    const severityCounts = detail.findings.reduce<Record<string, number>>((counts, finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
      return counts;
    }, {});

    const dataset: ReportExportDataset = {
      title: `Site Audit ${detail.auditNo}`,
      subtitle: "Store verification and audit record",
      metadata: [
        { label: "Audit No", value: detail.auditNo },
        { label: "Date", value: formatDateLabel(detail.auditDate) },
        { label: "Warehouse", value: detail.warehouse?.name ?? detail.warehouse?.warehouseCode ?? "-" },
        { label: "Status", value: detail.status },
        { label: "Final Result", value: detail.finalResult }
      ],
      summary: [
        { label: "Checklist", value: `${detail.checklistSummary.checked}/${detail.checklistSummary.total}` },
        { label: "Findings", value: detail.findings.length },
        { label: "Critical", value: severityCounts.critical ?? 0 },
        { label: "Stock Mismatches", value: detail.linkedStockCheck?.mismatchSummary.mismatchItems ?? "-" },
        { label: "Cash Difference", value: detail.linkedCashVerification?.differenceAmount ?? "-" },
        { label: "Attachments", value: detail.attachments.length }
      ],
      columns: [
        { key: "section", label: "Section" },
        { key: "item", label: "Item" },
        { key: "status", label: "Status" },
        { key: "remarks", label: "Remarks" }
      ],
      rows: [
        ...detail.checklist.map((item) => ({
          section: "Checklist",
          item: item.checklistLabel,
          status: item.isChecked ? "Checked" : "Pending",
          remarks: item.remarks ?? ""
        })),
        ...detail.findings.map((finding) => ({
          section: "Finding",
          item: finding.findingTitle,
          status: `${finding.severity} / ${finding.status}`,
          remarks: finding.findingDescription ?? ""
        }))
      ]
    };

    const file = buildReportFile(dataset, query.format, `site-audit-${detail.auditNo.toLowerCase()}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "site_audit_exported",
      module: "site_audit",
      entityType: "site_audit",
      entityId: siteAuditId,
      metadata: {
        auditNo: detail.auditNo,
        format: query.format
      },
      ...toAuditContext(context)
    });

    return file;
  }
}

export const siteAuditService = new SiteAuditService();
