import { runtimeSecurityService } from "./runtime-security.service";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

class LoginAttemptService {
  public async assertNotLocked(key: string): Promise<void> {
    await runtimeSecurityService.assertLoginAllowed(key);
  }

  public async recordFailure(key: string): Promise<void> {
    await runtimeSecurityService.recordLoginFailure({
      key,
      identifier: key,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockDurationMs: LOCK_DURATION_MS
    });
  }

  public async clear(key: string): Promise<void> {
    await runtimeSecurityService.clearLoginFailures(key);
  }
}

export const loginAttemptService = new LoginAttemptService();
