import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { notFoundHandler } from "./middlewares/not-found.middleware";
import apiRoutes from "./routes";
import { ensureUploadDirectory, getUploadRootPath } from "./utils/upload";

export const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

ensureUploadDirectory(getUploadRootPath());

app.get("/health", (_request, response) => {
  response.json({
    success: true,
    message: "Backend is healthy",
    data: {}
  });
});

app.use("/api/v1", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
