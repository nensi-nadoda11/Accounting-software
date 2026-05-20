import path from "path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "./config/env";
import { db, pool } from "./db";
import { logger } from "./config/logger";
import { cleanupService } from "./services/cleanup.service";
import { distributedLockService } from "./services/distributed-lock.service";
import { notificationsScheduler } from "./modules/notifications/notifications.scheduler";
import { app } from "./app";

const MIGRATION_LOCK_KEY = "startup:migrations";
const TRANSIENT_STARTUP_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ECONNRESET"
]);
const STARTUP_DB_CONNECT_ATTEMPTS = env.NODE_ENV === "development" ? 12 : 6;
const STARTUP_RETRY_DELAY_MS = 5000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getNestedCause = (error: unknown): NodeJS.ErrnoException | undefined => {
  const cause = (error as { cause?: unknown } | null)?.cause;

  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return cause as NodeJS.ErrnoException;
};

const getStartupErrorCode = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code ?? getNestedCause(error)?.code;

const isTransientStartupError = (error: unknown) => {
  const code = getStartupErrorCode(error);
  return Boolean(code && TRANSIENT_STARTUP_ERROR_CODES.has(code));
};

const logDatabaseStartupHelp = (error: unknown) => {
  const code = getStartupErrorCode(error);

  if (code === "EAI_AGAIN" || code === "ENOTFOUND") {
    logger.warn(
      "Database hostname lookup failed. Verify your internet/DNS connection and confirm the DATABASE_URL host in backend/.env matches the exact Supabase connection string."
    );
    return;
  }

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH" || code === "ECONNRESET") {
    logger.warn(
      "Database host resolved but the TCP connection failed. Check whether your network, firewall, VPN, or ISP is blocking outbound Postgres traffic on ports 5432/6543."
    );
  }
};

const ensureDatabaseConnection = async () => {
  for (let attempt = 1; attempt <= STARTUP_DB_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await pool.query("select 1");

      if (attempt > 1) {
        logger.info(`Database connection established on attempt ${attempt}`);
      }

      return;
    } catch (error) {
      const code = getStartupErrorCode(error) ?? "UNKNOWN";
      const isLastAttempt = attempt === STARTUP_DB_CONNECT_ATTEMPTS;

      logger.warn(`Database connection attempt ${attempt}/${STARTUP_DB_CONNECT_ATTEMPTS} failed`, {
        code,
        message: error instanceof Error ? error.message : String(error)
      });
      logDatabaseStartupHelp(error);

      if (!isTransientStartupError(error) || isLastAttempt) {
        throw error;
      }

      logger.info(`Retrying database connection in ${STARTUP_RETRY_DELAY_MS / 1000} seconds`);
      await sleep(STARTUP_RETRY_DELAY_MS);
    }
  }
};

const runMigrationsSafely = async () => {
  await distributedLockService.executeWithLock(
    {
      key: MIGRATION_LOCK_KEY,
      wait: true
    },
    async () => {
      logger.info("Running database migrations");
      await migrate(db, {
        migrationsFolder: path.resolve(process.cwd(), "src/db/migrations"),
      });
      logger.info("Database migrations completed");
      return true;
    }
  );
};

const startServer = async () => {
  await ensureDatabaseConnection();
  await runMigrationsSafely();
  cleanupService.start();
  notificationsScheduler.start();

  app.listen(env.PORT, () => {
    logger.info(`Backend server running on port ${env.PORT}`);
  });
};

void startServer().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
