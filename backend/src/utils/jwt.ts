import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { parseDurationToSeconds } from "./time";

export interface JwtSessionPayload {
  sub: string;
  sessionId: string;
  companyId: string | null;
  role: string;
  type: "access" | "refresh";
}

export const signAccessToken = (
  payload: Omit<JwtSessionPayload, "type">,
  expiresInSeconds = parseDurationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN)
): string =>
  jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: expiresInSeconds
  });

export const signRefreshToken = (
  payload: Omit<JwtSessionPayload, "type">,
  expiresInSeconds = parseDurationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN)
): string =>
  jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: expiresInSeconds
  });

export const verifyAccessToken = (token: string): JwtSessionPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtSessionPayload;

export const verifyRefreshToken = (token: string): JwtSessionPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtSessionPayload;
