import { and, eq, isNull, lt } from "drizzle-orm";

import { db } from "../db";
import { otpVerifications, sessions, userInvites } from "../db/schema";

class CleanupService {
  public async run(): Promise<void> {
    const now = new Date();

    await db.delete(otpVerifications).where(
      and(
        lt(otpVerifications.expiresAt, now),
        isNull(otpVerifications.usedAt)
      )
    );

    await db
      .update(userInvites)
      .set({
        status: "expired",
        updatedAt: now
      })
      .where(
        and(
          eq(userInvites.status, "pending"),
          lt(userInvites.expiresAt, now)
        )
      );

    await db.delete(sessions).where(lt(sessions.expiresAt, now));
  }

  public start(): void {
    const timer = setInterval(() => {
      void this.run();
    }, 60 * 60 * 1000);

    timer.unref();
  }
}

export const cleanupService = new CleanupService();
