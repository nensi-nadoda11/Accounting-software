import { randomUUID } from "crypto";
import type { Response } from "express";

import { env } from "../../config/env";
import { db } from "../../db";
import { companies, otpVerifications, users } from "../../db/schema";
import { auditLogService } from "../audit-logs/audit-log.service";
import { companiesRepository } from "../companies/companies.repository";
import { permissionService } from "../permissions/permission.service";
import { securityAdminAuditService } from "../security-admin/audit.service";
import { usersRepository } from "../users/users.repository";
import { authRepository } from "./auth.repository";
import { emailService } from "../../services/email.service";
import { loginAttemptService } from "../../services/login-attempt.service";
import { AppError } from "../../utils/app-error";
import { generateOtp, hashOtp, hashToken } from "../../utils/crypto";
import { comparePassword, hashPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { parseDurationToMs } from "../../utils/time";

type RequestContext = {
  ipAddress: string;
  userAgent: string;
};

class AuthService {
  private readonly refreshTtlMs = parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN);

  public async register(
    input: {
      fullName: string;
      email: string;
      mobileNumber: string;
      password: string;
      companyName: string;
      gstNumber?: string;
      city?: string;
      state?: string;
    },
    context: RequestContext
  ) {
    const existingByEmail = await usersRepository.findByEmail(input.email);
    if (existingByEmail) {
      throw new AppError("Email is already registered", 409);
    }

    const existingByMobile = await usersRepository.findByMobileNumber(input.mobileNumber);
    if (existingByMobile) {
      throw new AppError("Mobile number is already registered", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    const created = await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          name: input.companyName,
          gstNumber: input.gstNumber || null,
          city: input.city || null,
          state: input.state || null,
          status: "setup_pending"
        })
        .returning();

      if (!company) {
        throw new Error("Failed to create company");
      }

      const [user] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          fullName: input.fullName,
          email: input.email,
          mobileNumber: input.mobileNumber,
          passwordHash,
          role: "admin",
          status: "pending_verification"
        })
        .returning();

      if (!user) {
        throw new Error("Failed to create user");
      }

      await tx.insert(otpVerifications).values({
        userId: user.id,
        channel: "email",
        purpose: "register",
        otpHash: hashOtp(otp, "register", user.email),
        expiresAt,
        attempts: 0,
        maxAttempts: 5
      });

      return { company, user };
    });

    await emailService.sendOtpEmail(input.email, otp, "register", env.OTP_EXPIRY_MINUTES);
    await auditLogService.log({
      companyId: created.company.id,
      userId: created.user.id,
      action: "register",
      entityType: "user",
      entityId: created.user.id,
      metadata: {
        email: created.user.email,
        role: created.user.role
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await auditLogService.log({
      companyId: created.company.id,
      userId: created.user.id,
      action: "otp_sent",
      entityType: "otp_verification",
      entityId: created.user.id,
      metadata: {
        purpose: "register"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      user: usersRepository.toSafeUser(created.user),
      company: companiesRepository.toSafeCompany(created.company)
    };
  }

  public async verifyOtp(input: { email: string; otp: string; purpose: "register" | "forgot_password" | "change_email" }, context: RequestContext) {
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid OTP", 400);
    }

    const otpRecord = await authRepository.getLatestActiveOtp(user.id, input.purpose);
    if (!otpRecord) {
      throw new AppError("OTP not found or already used", 400);
    }

    if (otpRecord.expiresAt <= new Date()) {
      throw new AppError("OTP has expired", 400);
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new AppError("OTP attempts exceeded", 429);
    }

    const expectedHash = hashOtp(input.otp, input.purpose, user.email);
    if (otpRecord.otpHash !== expectedHash) {
      await authRepository.incrementOtpAttempts(otpRecord.id);
      throw new AppError("Invalid OTP", 400);
    }

    if (input.purpose === "register") {
      await authRepository.markOtpUsed(otpRecord.id);
      await usersRepository.markEmailVerifiedAndActivate(user.id);

      if (user.companyId) {
        await companiesRepository.updateStatus(user.companyId, "setup_pending");
      }
    }

    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "otp_verified",
      entityType: "otp_verification",
      entityId: otpRecord.id,
      metadata: {
        purpose: input.purpose
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const freshUser = await usersRepository.findById(user.id);

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;

    return {
      user: freshUser ? usersRepository.toSafeUser(freshUser) : null,
      company: company ? companiesRepository.toSafeCompany(company) : null
    };
  }

  public async resendOtp(input: { email: string; purpose: "register" | "forgot_password" | "change_email" }, context: RequestContext) {
    const user = await usersRepository.findByEmail(input.email);

    if (!user) {
      return;
    }

    const latest = await authRepository.getLatestActiveOtp(user.id, input.purpose);
    if (latest) {
      const cooldownEndsAt = latest.createdAt.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
      if (cooldownEndsAt > Date.now()) {
        throw new AppError("OTP resend cooldown is active. Please try again shortly.", 429);
      }
    }

    const otp = generateOtp();
    await authRepository.expireActiveOtps(user.id, input.purpose);
    await authRepository.createOtp({
      userId: user.id,
      channel: "email",
      purpose: input.purpose,
      otpHash: hashOtp(otp, input.purpose, user.email),
      expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      maxAttempts: 5
    });

    await emailService.sendOtpEmail(user.email, otp, input.purpose, env.OTP_EXPIRY_MINUTES);
    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "otp_sent",
      entityType: "otp_verification",
      entityId: user.id,
      metadata: {
        purpose: input.purpose,
        resent: true
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async login(
    input: {
      identifier: string;
      password: string;
      rememberMe?: boolean;
    },
    context: RequestContext
  ) {
    const attemptKey = `${input.identifier.toLowerCase()}:${context.ipAddress}`;
    await loginAttemptService.assertNotLocked(attemptKey);

    const user = await usersRepository.findByIdentifier(input.identifier);
    const invalidCredentials = new AppError("Invalid credentials", 401);

    if (!user || !user.passwordHash) {
      await loginAttemptService.recordFailure(attemptKey);
      await securityAdminAuditService.logLoginEvent({
        email: input.identifier.toLowerCase(),
        loginType: "failed_login",
        success: false,
        failureReason: "not_found",
        context
      });
      await auditLogService.log({
        action: "login_failed",
        entityType: "user",
        metadata: { identifier: input.identifier, reason: "not_found" },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
      throw invalidCredentials;
    }

    const passwordMatches = await comparePassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      await loginAttemptService.recordFailure(attemptKey);
      await securityAdminAuditService.logLoginEvent({
        companyId: user.companyId,
        userId: user.id,
        email: user.email,
        loginType: "failed_login",
        success: false,
        failureReason: "invalid_password",
        context
      });
      await auditLogService.log({
        companyId: user.companyId,
        userId: user.id,
        action: "login_failed",
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "invalid_password" },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
      throw invalidCredentials;
    }

    if (user.status !== "active" || !user.emailVerifiedAt) {
      throw new AppError("Account is not active", 403);
    }

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;
    if (!company || !["active", "setup_pending"].includes(company.status)) {
      throw new AppError("Company is not active", 403);
    }

    await loginAttemptService.clear(attemptKey);

    const sessionExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const sessionSeedToken = signRefreshToken({
      sub: user.id,
      sessionId: randomUUID(),
      companyId: user.companyId,
      role: user.role
    });

    const decodedSeed = verifyRefreshToken(sessionSeedToken);
    const session = await authRepository.createSession({
      id: decodedSeed.sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(sessionSeedToken),
      rememberMe: input.rememberMe ?? false,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: sessionExpiresAt
    });

    const tokens = await this.buildTokens(user.id, user.companyId, user.role, session.id);
    if (tokens.refreshToken !== sessionSeedToken) {
      await authRepository.rotateSession(session.id, hashToken(tokens.refreshToken), sessionExpiresAt);
    }

    await usersRepository.updateLastLogin(user.id);
    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "login_success",
      entityType: "session",
      entityId: session.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await securityAdminAuditService.logLoginEvent({
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      loginType: "login",
      success: true,
      context
    });

    const permissions = await permissionService.getEffectivePermissions(user.id, user.role, user.companyId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: sessionExpiresAt,
      rememberMe: input.rememberMe ?? false,
      user: usersRepository.toSafeUser(user),
      company: companiesRepository.toSafeCompany(company),
      permissions: Array.from(permissions)
    };
  }

  public async getCurrentSession(userId: string) {
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

  public async logout(sessionId: string, userId: string, context: RequestContext): Promise<void> {
    const user = await usersRepository.findById(userId);
    await authRepository.revokeSession(sessionId);
    await auditLogService.log({
      userId,
      action: "logout",
      entityType: "session",
      entityId: sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    if (user) {
      await securityAdminAuditService.logLoginEvent({
        companyId: user.companyId,
        userId: user.id,
        email: user.email,
        loginType: "logout",
        success: true,
        context
      });
    }
  }

  public async logoutAll(userId: string, context: RequestContext): Promise<void> {
    const user = await usersRepository.findById(userId);
    await authRepository.revokeAllUserSessions(userId);
    await auditLogService.log({
      userId,
      action: "logout",
      entityType: "session",
      metadata: { scope: "all" },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    if (user) {
      await securityAdminAuditService.logLoginEvent({
        companyId: user.companyId,
        userId: user.id,
        email: user.email,
        loginType: "logout",
        success: true,
        context
      });
    }
  }

  public async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const session = await authRepository.findActiveSessionByHash(hashToken(refreshToken));

    if (!session || session.id !== payload.sessionId || session.userId !== payload.sub) {
      throw new AppError("Invalid session", 401);
    }

    const user = await usersRepository.findById(payload.sub);
    if (!user || user.status !== "active") {
      throw new AppError("Invalid session", 401);
    }

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;
    if (!company || !["active", "setup_pending"].includes(company.status)) {
      throw new AppError("Company is not active", 403);
    }

    const tokens = await this.buildTokens(user.id, user.companyId, user.role, session.id);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await authRepository.rotateSession(session.id, hashToken(tokens.refreshToken), expiresAt);

    const permissions = await permissionService.getEffectivePermissions(user.id, user.role, user.companyId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: expiresAt,
      rememberMe: session.rememberMe,
      user: usersRepository.toSafeUser(user),
      company: companiesRepository.toSafeCompany(company),
      permissions: Array.from(permissions)
    };
  }

  public async forgotPassword(identifier: string, context: RequestContext): Promise<void> {
    const user = await usersRepository.findByIdentifier(identifier);

    if (!user?.emailVerifiedAt) {
      return;
    }

    const otp = generateOtp();
    await authRepository.expireActiveOtps(user.id, "forgot_password");
    await authRepository.createOtp({
      userId: user.id,
      channel: "email",
      purpose: "forgot_password",
      otpHash: hashOtp(otp, "forgot_password", user.email),
      expiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      maxAttempts: 5
    });

    await emailService.sendPasswordResetEmail(user.email, otp, env.PASSWORD_RESET_EXPIRY_MINUTES);
    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "password_reset_requested",
      entityType: "otp_verification",
      metadata: { identifier },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await securityAdminAuditService.logLoginEvent({
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      loginType: "password_reset",
      success: true,
      context
    });
  }

  public async resetPassword(input: { email: string; otp: string; newPassword: string }, context: RequestContext): Promise<void> {
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid reset request", 400);
    }

    const otpRecord = await authRepository.getLatestActiveOtp(user.id, "forgot_password");
    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      throw new AppError("Reset OTP is invalid or expired", 400);
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new AppError("Reset OTP attempts exceeded", 429);
    }

    const expectedHash = hashOtp(input.otp, "forgot_password", user.email);
    if (expectedHash !== otpRecord.otpHash) {
      await authRepository.incrementOtpAttempts(otpRecord.id);
      throw new AppError("Reset OTP is invalid or expired", 400);
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.markOtpUsed(otpRecord.id);
    await usersRepository.updatePassword(user.id, passwordHash);
    await authRepository.revokeAllUserSessions(user.id);
    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "password_reset_success",
      entityType: "user",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async changePassword(
    userId: string,
    currentSessionId: string,
    input: { currentPassword: string; newPassword: string },
    context: RequestContext
  ): Promise<void> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.passwordHash) {
      throw new AppError("User not found", 404);
    }

    const matches = await comparePassword(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw new AppError("Current password is incorrect", 400);
    }

    const samePassword = await comparePassword(input.newPassword, user.passwordHash);
    if (samePassword) {
      throw new AppError("New password must be different from current password", 400);
    }

    const passwordHash = await hashPassword(input.newPassword);
    await usersRepository.updatePassword(user.id, passwordHash);
    await authRepository.revokeAllUserSessions(user.id, currentSessionId);
    await auditLogService.log({
      companyId: user.companyId,
      userId: user.id,
      action: "password_changed",
      entityType: "user",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public applyRefreshCookie(response: Response, refreshToken: string, expiresAt: Date, rememberMe = true): void {
    response.cookie(env.COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      path: "/",
      maxAge: rememberMe ? expiresAt.getTime() - Date.now() : undefined
    });
  }

  public clearRefreshCookie(response: Response): void {
    response.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      path: "/"
    });
  }

  private async buildTokens(userId: string, companyId: string | null, role: string, sessionId: string) {
    const accessToken = signAccessToken({
      sub: userId,
      sessionId,
      companyId,
      role
    });

    const refreshToken = signRefreshToken({
      sub: userId,
      sessionId,
      companyId,
      role
    });

    return {
      accessToken,
      refreshToken
    };
  }
}

export const authService = new AuthService();
