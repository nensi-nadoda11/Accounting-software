import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(2),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(2),
  COOKIE_NAME: z.string().min(1),
  COOKIE_SECURE: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
  EMAIL_PROVIDER: z.enum(["smtp"]).default("smtp"),
  EMAIL_FROM_NAME: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.email(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive(),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive(),
  OTP_HASH_SECRET: z.string().min(32),
  INVITE_EXPIRY_HOURS: z.coerce.number().int().positive(),
  PASSWORD_RESET_EXPIRY_MINUTES: z.coerce.number().int().positive(),
  INVENTORY_EXPIRY_ALERT_DAYS: z.coerce.number().int().positive().default(30),
  UPLOAD_DIR: z.string().trim().min(1).default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(2),
  EXPENSE_UPLOAD_DIR: z.string().trim().min(1).default("uploads/expenses"),
  EXPENSE_MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  EXPENSE_MAX_ATTACHMENTS: z.coerce.number().int().positive().default(5),
  PUBLIC_UPLOAD_BASE_URL: z.string().trim().min(1).default("/uploads")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");

  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = parsed.data;
