import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env";
import * as schema from "./schema";

const poolMax = Math.max(1, Math.min(env.DB_POOL_MAX, 5));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS
});

export const db = drizzle(pool, { schema });
export { pool };
