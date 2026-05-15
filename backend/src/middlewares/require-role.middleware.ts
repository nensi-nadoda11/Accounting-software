import type { NextFunction, Request, Response } from "express";

import { errorResponse } from "../utils/api-response";

export const requireRole = (roles: Array<"admin" | "accountant" | "staff" | "auditor">) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.currentUser || !roles.includes(request.currentUser.role)) {
      response.status(403).json(errorResponse("You do not have access to this resource"));
      return;
    }

    next();
  };
};
