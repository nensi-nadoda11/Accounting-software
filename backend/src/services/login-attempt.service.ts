import { AppError } from "../utils/app-error";

type AttemptState = {
  failedCount: number;
  lockedUntil: number | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptState>();

  public assertNotLocked(key: string): void {
    const current = this.attempts.get(key);

    if (!current || current.lockedUntil === null) {
      return;
    }

    if (current.lockedUntil <= Date.now()) {
      this.attempts.delete(key);
      return;
    }

    throw new AppError("Too many failed login attempts. Please try again later.", 429);
  }

  public recordFailure(key: string): void {
    const current = this.attempts.get(key) ?? { failedCount: 0, lockedUntil: null };
    current.failedCount += 1;

    if (current.failedCount >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCK_DURATION_MS;
    }

    this.attempts.set(key, current);
  }

  public clear(key: string): void {
    this.attempts.delete(key);
  }
}

export const loginAttemptService = new LoginAttemptService();
