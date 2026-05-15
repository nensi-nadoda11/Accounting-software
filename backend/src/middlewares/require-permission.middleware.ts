import type { NextFunction, Request, Response } from "express";

import type { PermissionKey } from "../modules/permissions/permission.constants";
import { errorResponse } from "../utils/api-response";

export const requirePermission = (permissions: PermissionKey[]) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.permissions) {
      response.status(403).json(errorResponse("You do not have access to this resource"));
      return;
    }

    const hasPermission = permissions.some((permission) => request.permissions?.has(permission));

    if (!hasPermission) {
      response.status(403).json(errorResponse("You do not have access to this resource"));
      return;
    }

    next();
  };
};
