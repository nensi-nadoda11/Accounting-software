import path from "path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "./config/env";
import { db, pool } from "./db";
import { logger } from "./config/logger";
import { cleanupService } from "./services/cleanup.service";
import { notificationsScheduler } from "./modules/notifications/notifications.scheduler";
import { app } from "./app";

const startServer = async () => {
  await pool.query("select 1");
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "src/db/migrations"),
  });
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
