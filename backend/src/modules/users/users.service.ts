import { env } from "../../config/env";
import { auditLogService } from "../audit-logs/audit-log.service";
import { companiesRepository } from "../companies/companies.repository";
import { permissionService } from "../permissions/permission.service";
import { emailService } from "../../services/email.service";
import { AppError } from "../../utils/app-error";
import { generateSecureToken, hashToken } from "../../utils/crypto";
import { hashPassword } from "../../utils/password";
import { getPagination } from "../../utils/pagination";
import { usersRepository } from "./users.repository";

type RequestContext = {
  ipAddress: string;
  userAgent: string;
};

class UsersService {
  private normalizeInviteStatus(invite: {
    status: "pending" | "accepted" | "expired" | "revoked";
    expiresAt: Date;
  }) {
    if (invite.status === "pending" && invite.expiresAt <= new Date()) {
      return "expired" as const;
    }

    return invite.status;
  }

  public async inviteUser(
    actor: { id: string; companyId: string; role: "admin" | "accountant" | "staff" | "auditor" },
    input: {
      fullName: string;
      email: string;
      mobileNumber?: string;
      role: "accountant" | "staff" | "auditor";
      permissions: string[];
    },
    context: RequestContext
  ) {
    const company = await companiesRepository.findById(actor.companyId);
    if (!company || !["active", "setup_pending"].includes(company.status)) {
      throw new AppError("Company is not active", 403);
    }

    const existingUser = await usersRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError("A user with this email already exists", 409);
    }

    if (input.mobileNumber) {
      const existingMobileUser = await usersRepository.findByMobileNumber(input.mobileNumber);
      if (existingMobileUser) {
        throw new AppError("A user with this mobile number already exists", 409);
      }
    }

    const customPermissions = permissionService.assertValidPermissions(input.permissions);
    const inviteToken = generateSecureToken(24);
    const invite = await usersRepository.createInvite({
      companyId: actor.companyId,
      invitedByUserId: actor.id,
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber ?? null,
      role: input.role,
      permissions: customPermissions,
      tokenHash: hashToken(inviteToken),
      status: "pending",
      expiresAt: new Date(Date.now() + env.INVITE_EXPIRY_HOURS * 60 * 60 * 1000)
    });

    const inviteLink = `${env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;
    await emailService.sendInviteEmail(invite.email, invite.fullName, inviteLink, invite.role, env.INVITE_EXPIRY_HOURS);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "user_invited",
      entityType: "user_invite",
      entityId: invite.id,
      metadata: {
        email: invite.email,
        role: invite.role
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      id: invite.id,
      fullName: invite.fullName,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt
    };
  }

  public async acceptInvite(input: { token: string; password: string }, context: RequestContext) {
    const invite = await usersRepository.findInviteByTokenHash(hashToken(input.token));
    if (!invite) {
      throw new AppError("Invite is invalid", 400);
    }

    if (invite.status !== "pending") {
      throw new AppError("Invite is no longer active", 400);
    }

    if (invite.expiresAt <= new Date()) {
      await usersRepository.updateInvite(invite.id, { status: "expired" });
      throw new AppError("Invite has expired", 400);
    }

    const company = await companiesRepository.findById(invite.companyId);
    if (!company || !["active", "setup_pending"].includes(company.status)) {
      throw new AppError("Company is not active", 403);
    }

    const existingUser = await usersRepository.findByEmail(invite.email);
    if (existingUser) {
      throw new AppError("A user with this email already exists", 409);
    }

    if (invite.mobileNumber) {
      const existingMobileUser = await usersRepository.findByMobileNumber(invite.mobileNumber);
      if (existingMobileUser) {
        throw new AppError("A user with this mobile number already exists", 409);
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await usersRepository.create({
      companyId: invite.companyId,
      fullName: invite.fullName,
      email: invite.email,
      mobileNumber: invite.mobileNumber,
      passwordHash,
      role: invite.role,
      status: "active",
      emailVerifiedAt: new Date()
    });

    const invitePermissions = permissionService.assertValidPermissions(invite.permissions);
    if (invitePermissions.length > 0) {
      await permissionService.setUserPermissionOverride(invite.companyId, user.id, invitePermissions, user.id);
    }
    await usersRepository.updateInvite(invite.id, {
      status: "accepted",
      acceptedAt: new Date()
    });

    await auditLogService.log({
      companyId: invite.companyId,
      userId: user.id,
      action: "invite_accepted",
      entityType: "user_invite",
      entityId: invite.id,
      metadata: {
        role: user.role
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      user: usersRepository.toSafeUser(user),
      company: companiesRepository.toSafeCompany(company)
    };
  }

  public async resendInvite(
    actor: { id: string; companyId: string },
    inviteId: string,
    context: RequestContext
  ) {
    const invite = await usersRepository.findInviteById(inviteId, actor.companyId);
    if (!invite || invite.status !== "pending") {
      throw new AppError("Pending invite not found", 404);
    }

    const inviteToken = generateSecureToken(24);
    const expiresAt = new Date(Date.now() + env.INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
    await usersRepository.updateInvite(invite.id, {
      tokenHash: hashToken(inviteToken),
      expiresAt
    });

    const inviteLink = `${env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;
    await emailService.sendInviteEmail(invite.email, invite.fullName, inviteLink, invite.role, env.INVITE_EXPIRY_HOURS);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invite_resent",
      entityType: "user_invite",
      entityId: invite.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async revokeInvite(
    actor: { id: string; companyId: string },
    inviteId: string,
    context: RequestContext
  ) {
    const invite = await usersRepository.findInviteById(inviteId, actor.companyId);
    if (!invite || !["pending", "expired"].includes(invite.status)) {
      throw new AppError("Invite not found", 404);
    }

    await usersRepository.updateInvite(invite.id, {
      status: "revoked"
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "invite_revoked",
      entityType: "user_invite",
      entityId: invite.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async listInvites(actor: { companyId: string }) {
    const invites = await usersRepository.listInvitesByCompany({
      companyId: actor.companyId
    });

    const now = new Date();
    const pendingExpiredInviteIds = invites
      .filter((invite) => invite.status === "pending" && invite.expiresAt <= now)
      .map((invite) => invite.id);

    if (pendingExpiredInviteIds.length > 0) {
      await Promise.all(
        pendingExpiredInviteIds.map((inviteId) =>
          usersRepository.updateInvite(inviteId, {
            status: "expired"
          })
        )
      );
    }

    return invites.map((invite) => ({
      id: invite.id,
      fullName: invite.fullName,
      email: invite.email,
      role: invite.role,
      status: this.normalizeInviteStatus({
        status: pendingExpiredInviteIds.includes(invite.id) ? "expired" : invite.status,
        expiresAt: invite.expiresAt
      }),
      expiresAt: invite.expiresAt,
      mobileNumber: invite.mobileNumber,
      permissions: invite.permissions,
      createdAt: invite.createdAt
    }));
  }

  public async listUsers(
    actor: { companyId: string },
    query: {
      page: number;
      limit: number;
      search?: string;
      role?: "admin" | "accountant" | "staff" | "auditor";
      status?: "pending_verification" | "invited" | "active" | "suspended" | "disabled";
    }
  ) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string;
      role?: "admin" | "accountant" | "staff" | "auditor";
      status?: "pending_verification" | "invited" | "active" | "suspended" | "disabled";
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    };

    if (query.search) {
      params.search = query.search;
    }

    if (query.role) {
      params.role = query.role;
    }

    if (query.status) {
      params.status = query.status;
    }

    const result = await usersRepository.listByCompany(params);

    const permissionMap = await permissionService.getEffectivePermissionsForUsers(
      actor.companyId,
      result.rows.map((row) => ({
        id: row.id,
        role: row.role
      }))
    );

    return {
      items: result.rows.map((row) => {
        return {
          ...usersRepository.toSafeUser(row),
          permissions: permissionMap.get(row.id) ?? []
        };
      }),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async updateUserStatus(
    actor: { id: string; companyId: string },
    userId: string,
    status: "active" | "suspended" | "disabled",
    context: RequestContext
  ) {
    if (actor.id === userId) {
      throw new AppError("You cannot modify your own status", 400);
    }

    const user = await usersRepository.findUserByIdAndCompany(userId, actor.companyId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await usersRepository.updateStatus(userId, actor.companyId, status);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "user_status_changed",
      entityType: "user",
      entityId: userId,
      metadata: { status },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async updateUserRole(
    actor: { id: string; companyId: string },
    userId: string,
    role: "admin" | "accountant" | "staff" | "auditor",
    context: RequestContext
  ) {
    if (actor.id === userId) {
      throw new AppError("You cannot modify your own role", 400);
    }

    const user = await usersRepository.findUserByIdAndCompany(userId, actor.companyId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await usersRepository.updateRole(userId, actor.companyId, role);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "user_role_changed",
      entityType: "user",
      entityId: userId,
      metadata: { role },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async updateUserPermissions(
    actor: { companyId: string; id: string },
    userId: string,
    permissions: string[],
    context: RequestContext
  ) {
    const user = await usersRepository.findUserByIdAndCompany(userId, actor.companyId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const validPermissions = permissionService.assertValidPermissions(permissions);
    await permissionService.setUserPermissionOverride(actor.companyId, userId, validPermissions, actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "user_permissions_changed",
      entityType: "user",
      entityId: userId,
      metadata: { permissions: validPermissions },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;
    const permissions = await permissionService.getEffectivePermissions(user.id, user.role, user.companyId);

    return {
      user: usersRepository.toSafeUser(user),
      company: company ? companiesRepository.toSafeCompany(company) : null,
      permissions: Array.from(permissions)
    };
  }

  public async updateProfile(
    userId: string,
    input: {
      fullName: string;
      mobileNumber?: string | null;
    }
  ) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.mobileNumber && input.mobileNumber !== user.mobileNumber) {
      const existing = await usersRepository.findByMobileNumber(input.mobileNumber);
      if (existing && existing.id !== userId) {
        throw new AppError("Mobile number is already in use", 409);
      }
    }

    await usersRepository.updateProfile(userId, {
      fullName: input.fullName,
      mobileNumber: input.mobileNumber ?? null
    });

    const updated = await usersRepository.findById(userId);
    return {
      user: usersRepository.toSafeUser(updated!)
    };
  }
}

export const usersService = new UsersService();
