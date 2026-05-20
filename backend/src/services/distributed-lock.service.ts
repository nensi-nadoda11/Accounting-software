import type { PoolClient, QueryResult } from "pg";

import { logger } from "../config/logger";
import { pool } from "../db";

type LockExecutionOptions = {
  key: string;
  wait?: boolean;
  onLockUnavailable?: () => void;
};

class DistributedLockService {
  private async acquire(client: PoolClient, key: string, wait: boolean): Promise<boolean> {
    const statement = wait
      ? "select pg_advisory_lock(hashtext($1)) as locked"
      : "select pg_try_advisory_lock(hashtext($1)) as locked";

    const result: QueryResult<{ locked: boolean | null }> = await client.query(statement, [key]);
    return wait ? true : Boolean(result.rows[0]?.locked);
  }

  private async release(client: PoolClient, key: string): Promise<void> {
    await client.query("select pg_advisory_unlock(hashtext($1))", [key]);
  }

  public async executeWithLock<T>(options: LockExecutionOptions, task: () => Promise<T>): Promise<T | null> {
    const client = await pool.connect();

    try {
      const acquired = await this.acquire(client, options.key, options.wait ?? false);
      if (!acquired) {
        options.onLockUnavailable?.();
        return null;
      }

      return await task();
    } finally {
      try {
        await this.release(client, options.key);
      } catch (error) {
        logger.error(`Failed to release distributed lock: ${options.key}`, error);
      }

      client.release();
    }
  }
}

export const distributedLockService = new DistributedLockService();
