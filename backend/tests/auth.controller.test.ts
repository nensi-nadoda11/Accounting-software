import assert from "node:assert/strict";
import { after, test } from "node:test";

const applyTestEnv = () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "4000";
  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/accounting_test";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.JWT_ACCESS_SECRET = "access-secret-access-secret-access";
  process.env.JWT_REFRESH_SECRET = "refresh-secret-refresh-secret-123";
  process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
  process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
  process.env.COOKIE_NAME = "refresh_token";
  process.env.COOKIE_SECURE = "false";
  process.env.COOKIE_SAME_SITE = "lax";
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.EMAIL_FROM_NAME = "Accounting Software";
  process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "your_smtp_username";
  process.env.SMTP_PASS = "your_smtp_password";
  process.env.OTP_EXPIRY_MINUTES = "10";
  process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";
  process.env.OTP_HASH_SECRET = "otp-hash-secret-otp-hash-secret-12";
  process.env.INVITE_EXPIRY_HOURS = "24";
  process.env.PASSWORD_RESET_EXPIRY_MINUTES = "15";
  process.env.INVENTORY_EXPIRY_ALERT_DAYS = "30";
  process.env.DB_POOL_MAX = "1";
  process.env.DB_POOL_IDLE_TIMEOUT_MS = "1000";
  process.env.UPLOAD_DIR = "uploads";
  process.env.MAX_UPLOAD_MB = "2";
  process.env.EXPENSE_UPLOAD_DIR = "uploads/expenses";
  process.env.EXPENSE_MAX_UPLOAD_MB = "5";
  process.env.EXPENSE_MAX_ATTACHMENTS = "5";
  process.env.PUBLIC_UPLOAD_BASE_URL = "/uploads";
};

applyTestEnv();

after(async () => {
  const { pool } = await import("../src/db/index.js");
  await pool.end();
});

test("refresh preserves rememberMe when rewriting the refresh cookie", async () => {
  const { AuthController } = await import("../src/modules/auth/auth.controller.js");
  const { authService } = await import("../src/modules/auth/auth.service.js");

  const controller = new AuthController();
  const refreshExpiresAt = new Date("2030-01-01T00:00:00.000Z");
  const request = {
    cookies: {
      refresh_token: "existing-refresh-token"
    }
  } as never;
  let responseBody: unknown;
  const response = {
    json(body: unknown) {
      responseBody = body;
      return this;
    }
  } as never;

  const originalRefresh = authService.refresh.bind(authService);
  const originalApplyRefreshCookie = authService.applyRefreshCookie.bind(authService);
  let receivedRefreshToken: string | undefined;
  let appliedRememberMe: boolean | undefined;

  authService.refresh = (async (refreshToken: string) => {
    receivedRefreshToken = refreshToken;

    return {
      accessToken: "next-access-token",
      refreshToken: "next-refresh-token",
      refreshExpiresAt,
      rememberMe: false,
      user: { id: "user-1" },
      company: { id: "company-1" },
      permissions: ["dashboard.view"]
    };
  }) as typeof authService.refresh;

  authService.applyRefreshCookie = ((targetResponse, refreshToken, expiresAt, rememberMe) => {
    assert.equal(targetResponse, response);
    assert.equal(refreshToken, "next-refresh-token");
    assert.equal(expiresAt, refreshExpiresAt);
    appliedRememberMe = rememberMe;
  }) as typeof authService.applyRefreshCookie;

  try {
    await controller.refresh(request, response);
  } finally {
    authService.refresh = originalRefresh;
    authService.applyRefreshCookie = originalApplyRefreshCookie;
  }

  assert.equal(receivedRefreshToken, "existing-refresh-token");
  assert.equal(appliedRememberMe, false);
  assert.deepEqual(responseBody, {
    success: true,
    message: "Token refreshed successfully",
    data: {
      accessToken: "next-access-token",
      user: { id: "user-1" },
      company: { id: "company-1" },
      permissions: ["dashboard.view"]
    }
  });
});
