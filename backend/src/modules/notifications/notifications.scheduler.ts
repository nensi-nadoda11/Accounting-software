import { logger } from "../../config/logger";
import { notificationsService } from "./notifications.service";

class NotificationsScheduler {
  private started = false;

  public start() {
    if (this.started) {
      return;
    }

    this.started = true;
    const timer = setInterval(() => {
      void notificationsService.runAutomaticCycle().catch((error) => {
        logger.error("Notification scheduler cycle failed", error);
      });
    }, 60 * 60 * 1000);

    timer.unref();
  }
}

export const notificationsScheduler = new NotificationsScheduler();
