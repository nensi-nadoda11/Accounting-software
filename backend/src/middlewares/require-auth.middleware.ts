import type { NextFunction, Request, Response } from "express";

import { companiesRepository } from "../modules/companies/companies.repository";
import { permissionService } from "../modules/permissions/permission.service";
import { usersRepository } from "../modules/users/users.repository";
import { authRepository } from "../modules/auth/auth.repository";
import { errorResponse } from "../utils/api-response";
import { verifyAccessToken } from "../utils/jwt";

export const requireAuth = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json(errorResponse("Authentication required"));
    return;
  }

  const token = authorization.replace("Bearer ", "");
  let payload: ReturnType<typeof verifyAccessToken>;

  try {
    payload = verifyAccessToken(token);
  } catch (_error) {
    response.status(401).json(errorResponse("Invalid or expired token"));
    return;
  }

  try {
    const session = await authRepository.findSessionById(payload.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      response.status(401).json(errorResponse("Session expired. Please login again."));
      return;
    }

    const user = await usersRepository.findById(payload.sub);
    if (!user || user.status !== "active" || !user.emailVerifiedAt) {
      response.status(401).json(errorResponse("Authentication required"));
      return;
    }

    const company = user.companyId ? await companiesRepository.findById(user.companyId) : null;
    request.auth = payload;
    request.currentUser = usersRepository.toSafeUser(user);
    request.currentCompany = company ? companiesRepository.toSafeCompany(company) : null;
    request.permissions = await permissionService.getEffectivePermissions(user.id, user.role, user.companyId);

    next();
  } catch (error) {
    next(error);
  }
};
