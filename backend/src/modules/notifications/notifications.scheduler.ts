import { logger } from "../../config/logger";
import { distributedLockService } from "../../services/distributed-lock.service";
import { notificationsService } from "./notifications.service";

class NotificationsScheduler {
  private started = false;
  private readonly lockKey = "jobs:notifications";

  public start() {
    if (this.started) {
      return;
    }

    this.started = true;
    const timer = setInterval(() => {
      void distributedLockService.executeWithLock(
        {
          key: this.lockKey,
          onLockUnavailable: () => {
            logger.info("Skipping notification cycle because another instance is already running it");
          }
        },
        async () => {
          await notificationsService.runAutomaticCycle();
          return true;
        }
      ).catch((error) => {
        logger.error("Notification scheduler cycle failed", error);
      });
    }, 60 * 60 * 1000);

    timer.unref();
  }
}

export const notificationsScheduler = new NotificationsScheduler();
