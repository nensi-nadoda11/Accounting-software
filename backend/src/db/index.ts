import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env";
import { logger } from "../config/logger";
import * as schema from "./schema";

const poolMax = Math.max(1, Math.min(env.DB_POOL_MAX, 5));
const poolMin = Math.max(0, Math.min(env.DB_POOL_MIN, poolMax));
const TRANSIENT_DB_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ECONNRESET"
]);
const TRANSIENT_DB_MESSAGE_PATTERNS = [
  "timeout exceeded when trying to connect",
  "connection terminated due to connection timeout",
  "connection terminated unexpectedly",
  "server closed the connection unexpectedly",
  "terminating connection due to administrator command",
  "max clients reached in session mode"
];
const QUERY_RETRY_ATTEMPTS = 3;
const QUERY_RETRY_BASE_DELAY_MS = 250;
const databaseUrl = (() => {
  try {
    return new URL(env.DATABASE_URL);
  } catch {
    return null;
  }
})();
const databaseHost = databaseUrl?.hostname ?? null;
const databasePort = databaseUrl?.port ? Number(databaseUrl.port) : null;

const isLocalDatabaseHost = (host: string | null) =>
  !host || host === "localhost" || host === "127.0.0.1" || host === "::1";

const shouldUseSsl =
  env.DB_SSL_MODE === "require" ||
  (env.DB_SSL_MODE === "auto" && !isLocalDatabaseHost(databaseHost));

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isTransientDatabaseError = (error: unknown) => {
  const systemError = error as NodeJS.ErrnoException & {
    cause?: NodeJS.ErrnoException;
    message?: string;
  };
  const codes = [systemError?.code, systemError?.cause?.code].filter(Boolean);
  const message = [systemError?.message, systemError?.cause?.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    codes.some((code) => TRANSIENT_DB_ERROR_CODES.has(code as string)) ||
    TRANSIENT_DB_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))
  );
};

const extractQueryText = (query: unknown) => {
  if (typeof query === "string") {
    return query;
  }

  if (query && typeof query === "object" && "text" in query) {
    const text = (query as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }

  return "";
};

const isRetryableQueryText = (queryText: string) => {
  const normalized = queryText.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith("select") ||
    normalized.startsWith("with") ||
    normalized.startsWith("show") ||
    normalized.startsWith("explain") ||
    normalized.startsWith("values")
  );
};

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: poolMin,
  max: poolMax,
  maxUses: 7500,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED
      }
    : undefined
});

pool.on("error", (error) => {
  const pgError = error as NodeJS.ErrnoException;

  logger.error("Unexpected PostgreSQL pool error", {
    code: pgError.code,
    message: error.message,
    host: databaseHost,
    ssl: shouldUseSsl
  });
});

const originalPoolQuery = pool.query.bind(pool);

pool.query = (async (...args: Parameters<typeof originalPoolQuery>) => {
  const queryText = extractQueryText(args[0]);
  const canRetry = isRetryableQueryText(queryText);

  for (let attempt = 1; attempt <= QUERY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await originalPoolQuery(...args);
    } catch (error) {
      if (!canRetry || !isTransientDatabaseError(error) || attempt === QUERY_RETRY_ATTEMPTS) {
        throw error;
      }

      logger.warn("Retrying transient database query", {
        attempt,
        maxAttempts: QUERY_RETRY_ATTEMPTS,
        query: queryText.slice(0, 80),
        code: (error as NodeJS.ErrnoException | undefined)?.code
      });
      await sleep(QUERY_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw new Error("Database query retry exhausted unexpectedly");
}) as typeof pool.query;

export const db = drizzle(pool, { schema });
export const dbConnectionTarget = {
  host: databaseHost,
  port: databasePort,
  ssl: shouldUseSsl
};
export { pool };
