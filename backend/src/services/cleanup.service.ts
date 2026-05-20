import { and, eq, isNull, lt } from "drizzle-orm";

import { logger } from "../config/logger";
import { db } from "../db";
import { otpVerifications, sessions, userInvites } from "../db/schema";
import { distributedLockService } from "./distributed-lock.service";
import { runtimeSecurityService } from "./runtime-security.service";

class CleanupService {
  private started = false;
  private readonly lockKey = "jobs:cleanup";

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
    await runtimeSecurityService.cleanupExpired();
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    const timer = setInterval(() => {
      void distributedLockService.executeWithLock(
        {
          key: this.lockKey,
          onLockUnavailable: () => {
            logger.info("Skipping cleanup cycle because another instance is already running it");
          }
        },
        async () => {
          await this.run();
          return true;
        }
      );
    }, 60 * 60 * 1000);

    timer.unref();
  }
}

export const cleanupService = new CleanupService();
