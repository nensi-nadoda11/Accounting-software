import type { Request, Response } from "express";

import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { authService } from "./auth.service";

export class AuthController {
  public register = async (request: Request, response: Response): Promise<void> => {
    const data = await authService.register(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    response.status(201).json(successResponse("Registration successful. OTP sent to email.", data));
  };

  public verifyOtp = async (request: Request, response: Response): Promise<void> => {
    const data = await authService.verifyOtp(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    response.json(successResponse("OTP verified successfully", data));
  };

  public resendOtp = async (request: Request, response: Response): Promise<void> => {
    await authService.resendOtp(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    response.json(successResponse("If the account exists, OTP has been sent.", {}));
  };

  public login = async (request: Request, response: Response): Promise<void> => {
    const data = await authService.login(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    authService.applyRefreshCookie(response, data.refreshToken, data.refreshExpiresAt, data.rememberMe);
    response.json(
      successResponse("Login successful", {
        accessToken: data.accessToken,
        user: data.user,
        company: data.company,
        permissions: data.permissions
      })
    );
  };

  public session = async (request: Request, response: Response): Promise<void> => {
    const data = await authService.getCurrentSession(request.currentUser!.id);
    response.json(successResponse("Session fetched successfully", data));
  };

  public logout = async (request: Request, response: Response): Promise<void> => {
    await authService.logout(request.auth!.sessionId, request.currentUser!.id, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    authService.clearRefreshCookie(response);
    response.json(successResponse("Logout successful", {}));
  };

  public logoutAll = async (request: Request, response: Response): Promise<void> => {
    await authService.logoutAll(request.currentUser!.id, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    authService.clearRefreshCookie(response);
    response.json(successResponse("All sessions logged out successfully", {}));
  };

  public refresh = async (request: Request, response: Response): Promise<void> => {
    const refreshToken = request.cookies[env.COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      throw new AppError("Refresh token is required", 401);
    }

    const data = await authService.refresh(refreshToken);
    authService.applyRefreshCookie(response, data.refreshToken, data.refreshExpiresAt, true);
    response.json(
      successResponse("Token refreshed successfully", {
        accessToken: data.accessToken,
        user: data.user,
        company: data.company,
        permissions: data.permissions
      })
    );
  };

  public forgotPassword = async (request: Request, response: Response): Promise<void> => {
    await authService.forgotPassword(request.body.identifier, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    response.json(successResponse("If account exists, reset instructions have been sent.", {}));
  };

  public resetPassword = async (request: Request, response: Response): Promise<void> => {
    await authService.resetPassword(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    authService.clearRefreshCookie(response);
    response.json(successResponse("Password reset successful", {}));
  };

  public changePassword = async (request: Request, response: Response): Promise<void> => {
    await authService.changePassword(
      request.currentUser!.id,
      request.auth!.sessionId,
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Password changed successfully", {}));
  };
}

export const authController = new AuthController();
