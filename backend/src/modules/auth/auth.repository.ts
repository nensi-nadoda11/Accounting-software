import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "../../db";
import { otpVerifications, sessions } from "../../db/schema";

export class AuthRepository {
  public async expireActiveOtps(userId: string, purpose: "register" | "forgot_password" | "change_email"): Promise<void> {
    await db
      .update(otpVerifications)
      .set({
        usedAt: new Date()
      })
      .where(
        and(
          eq(otpVerifications.userId, userId),
          eq(otpVerifications.purpose, purpose),
          isNull(otpVerifications.usedAt)
        )
      );
  }

  public async createOtp(data: typeof otpVerifications.$inferInsert): Promise<typeof otpVerifications.$inferSelect> {
    const [otp] = await db.insert(otpVerifications).values(data).returning();
    if (!otp) {
      throw new Error("Failed to create OTP");
    }
    return otp;
  }

  public async getLatestActiveOtp(userId: string, purpose: "register" | "forgot_password" | "change_email") {
    const [otp] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.userId, userId),
          eq(otpVerifications.purpose, purpose),
          isNull(otpVerifications.usedAt)
        )
      )
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);

    return otp ?? null;
  }

  public async incrementOtpAttempts(otpId: string): Promise<void> {
    await db
      .update(otpVerifications)
      .set({
        attempts: sql`${otpVerifications.attempts} + 1`
      })
      .where(eq(otpVerifications.id, otpId));
  }

  public async markOtpUsed(otpId: string): Promise<void> {
    await db
      .update(otpVerifications)
      .set({
        usedAt: new Date()
      })
      .where(eq(otpVerifications.id, otpId));
  }

  public async createSession(data: typeof sessions.$inferInsert): Promise<typeof sessions.$inferSelect> {
    const [session] = await db.insert(sessions).values(data).returning();
    if (!session) {
      throw new Error("Failed to create session");
    }
    return session;
  }

  public async findSessionById(sessionId: string): Promise<typeof sessions.$inferSelect | null> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return session ?? null;
  }

  public async findActiveSessionByHash(refreshTokenHash: string): Promise<typeof sessions.$inferSelect | null> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, refreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    return session ?? null;
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await db
      .update(sessions)
      .set({
        revokedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));
  }

  public async revokeAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];

    if (excludeSessionId) {
      conditions.push(sql`${sessions.id} <> ${excludeSessionId}`);
    }

    await db
      .update(sessions)
      .set({
        revokedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .update(sessions)
      .set({
        refreshTokenHash,
        expiresAt
      })
      .where(eq(sessions.id, sessionId));
  }
}

export const authRepository = new AuthRepository();
