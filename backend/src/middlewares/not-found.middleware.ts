import type { Request, Response } from "express";

import { errorResponse } from "../utils/api-response";

export const notFoundHandler = (_request: Request, response: Response): void => {
  response.status(404).json(errorResponse("Route not found"));
};
