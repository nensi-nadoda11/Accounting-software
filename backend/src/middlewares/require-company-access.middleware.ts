import type { NextFunction, Request, Response } from "express";

import { errorResponse } from "../utils/api-response";

export const requireCompanyAccess = (request: Request, response: Response, next: NextFunction): void => {
  if (!request.currentUser?.companyId || !request.currentCompany) {
    response.status(403).json(errorResponse("Company access is required"));
    return;
  }

  if (!["active", "setup_pending"].includes(request.currentCompany.status)) {
    response.status(403).json(errorResponse("Company is not active"));
    return;
  }

  next();
};
