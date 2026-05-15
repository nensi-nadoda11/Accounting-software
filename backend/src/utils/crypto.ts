import { createHash, createHmac, randomBytes, randomInt } from "crypto";

import { env } from "../config/env";

export const generateOtp = (): string => `${randomInt(100000, 999999)}`;

export const hashOtp = (otp: string, purpose: string, subject: string): string =>
  createHmac("sha256", env.OTP_HASH_SECRET).update(`${purpose}:${subject}:${otp}`).digest("hex");

export const generateSecureToken = (size = 32): string => randomBytes(size).toString("hex");

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
