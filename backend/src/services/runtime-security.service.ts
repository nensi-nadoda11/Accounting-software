import { and, eq, lt, or, sql } from "drizzle-orm";

import { db } from "../db";
import { loginAttemptLocks, requestRateLimits } from "../db/schema";
import { AppError } from "../utils/app-error";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RateLimitOptions = {
  identifier: string;
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type LoginFailureOptions = {
  key: string;
  identifier: string;
  lockDurationMs: number;
  maxAttempts: number;
};

class RuntimeSecurityService {
  private async withKeyLock<T>(key: string, callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      return callback(tx);
    });
  }

  public async consumeRateLimit(options: RateLimitOptions) {
    const key = `${options.keyPrefix}:${options.identifier}`;
    const now = new Date();

    return this.withKeyLock(key, async (tx) => {
      const [bucket] = await tx
        .select()
        .from(requestRateLimits)
        .where(eq(requestRateLimits.key, key))
        .limit(1);

      if (!bucket || bucket.windowEndsAt <= now) {
        const windowEndsAt = new Date(now.getTime() + options.windowMs);
        const nextState = {
          scope: options.keyPrefix,
          identifier: options.identifier,
          hitCount: 1,
          windowStartedAt: now,
          windowEndsAt,
          updatedAt: now
        };

        if (bucket) {
          await tx
            .update(requestRateLimits)
            .set(nextState)
            .where(eq(requestRateLimits.key, key));
        } else {
          await tx.insert(requestRateLimits).values({
            key,
            ...nextState,
            createdAt: now
          });
        }

        return {
          allowed: true,
          remaining: Math.max(options.limit - 1, 0),
          resetAt: windowEndsAt,
          retryAfterMs: 0
        };
      }

      if (bucket.hitCount >= options.limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: bucket.windowEndsAt,
          retryAfterMs: Math.max(bucket.windowEndsAt.getTime() - now.getTime(), 0)
        };
      }

      const nextCount = bucket.hitCount + 1;

      await tx
        .update(requestRateLimits)
        .set({
          hitCount: nextCount,
          updatedAt: now
        })
        .where(eq(requestRateLimits.key, key));

      return {
        allowed: true,
        remaining: Math.max(options.limit - nextCount, 0),
        resetAt: bucket.windowEndsAt,
        retryAfterMs: 0
      };
    });
  }

  public async assertLoginAllowed(key: string): Promise<void> {
    const now = new Date();

    await this.withKeyLock(key, async (tx) => {
      const [state] = await tx
        .select()
        .from(loginAttemptLocks)
        .where(eq(loginAttemptLocks.key, key))
        .limit(1);

      if (!state) {
        return;
      }

      if (state.expiresAt <= now || (state.lockedUntil !== null && state.lockedUntil <= now)) {
        await tx.delete(loginAttemptLocks).where(eq(loginAttemptLocks.key, key));
        return;
      }

      if (state.lockedUntil !== null && state.lockedUntil > now) {
        throw new AppError("Too many failed login attempts. Please try again later.", 429);
      }
    });
  }

  public async recordLoginFailure(options: LoginFailureOptions): Promise<void> {
    const now = new Date();

    await this.withKeyLock(options.key, async (tx) => {
      const [state] = await tx
        .select()
        .from(loginAttemptLocks)
        .where(eq(loginAttemptLocks.key, options.key))
        .limit(1);

      const baseline =
        !state || state.expiresAt <= now || (state.lockedUntil !== null && state.lockedUntil <= now)
          ? null
          : state;

      const failedCount = (baseline?.failedCount ?? 0) + 1;
      const lockedUntil = failedCount >= options.maxAttempts ? new Date(now.getTime() + options.lockDurationMs) : null;
      const expiresAt = lockedUntil ?? new Date(now.getTime() + options.lockDurationMs);
      const nextState = {
        identifier: options.identifier,
        failedCount,
        lockedUntil,
        expiresAt,
        updatedAt: now
      };

      if (baseline) {
        await tx
          .update(loginAttemptLocks)
          .set(nextState)
          .where(eq(loginAttemptLocks.key, options.key));
        return;
      }

      await tx.insert(loginAttemptLocks).values({
        key: options.key,
        ...nextState,
        createdAt: now
      });
    });
  }

  public async clearLoginFailures(key: string): Promise<void> {
    await this.withKeyLock(key, async (tx) => {
      await tx.delete(loginAttemptLocks).where(eq(loginAttemptLocks.key, key));
    });
  }

  public async cleanupExpired(): Promise<void> {
    const now = new Date();

    await db.delete(requestRateLimits).where(lt(requestRateLimits.windowEndsAt, now));
    await db.delete(loginAttemptLocks).where(
      or(
        lt(loginAttemptLocks.expiresAt, now),
        and(sql`${loginAttemptLocks.lockedUntil} is not null`, lt(loginAttemptLocks.lockedUntil, now))
      )
    );
  }
}

export const runtimeSecurityService = new RuntimeSecurityService();
