import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env";
import { logger } from "../config/logger";
import * as schema from "./schema";

const poolMax = Math.max(1, Math.min(env.DB_POOL_MAX, 5));
const poolMin = Math.max(0, Math.min(env.DB_POOL_MIN, poolMax));
const databaseHost = (() => {
  try {
    return new URL(env.DATABASE_URL).hostname;
  } catch {
    return null;
  }
})();

const isLocalDatabaseHost = (host: string | null) =>
  !host || host === "localhost" || host === "127.0.0.1" || host === "::1";

const shouldUseSsl =
  env.DB_SSL_MODE === "require" ||
  (env.DB_SSL_MODE === "auto" && !isLocalDatabaseHost(databaseHost));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: poolMin,
  max: poolMax,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  keepAlive: true,
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

export const db = drizzle(pool, { schema });
export { pool };
