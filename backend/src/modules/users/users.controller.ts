import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { usersService } from "./users.service";

export class UsersController {
  public inviteUser = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.inviteUser(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.status(201).json(successResponse("User invited successfully", data));
  };

  public acceptInvite = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.acceptInvite(request.body, {
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    });

    response.status(201).json(successResponse("Invite accepted successfully", data));
  };

  public resendInvite = async (request: Request, response: Response): Promise<void> => {
    await usersService.resendInvite(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!
      },
      request.body.inviteId,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Invite resent successfully", {}));
  };

  public revokeInvite = async (request: Request, response: Response): Promise<void> => {
    await usersService.revokeInvite(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!
      },
      request.body.inviteId,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Invite revoked successfully", {}));
  };

  public listInvites = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.listInvites({
      companyId: request.currentUser!.companyId!
    });

    response.json(successResponse("Invites fetched successfully", data));
  };

  public listUsers = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.listUsers(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Users fetched successfully", data));
  };

  public updateStatus = async (request: Request, response: Response): Promise<void> => {
    await usersService.updateUserStatus(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.body.status,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("User status updated successfully", {}));
  };

  public updateRole = async (request: Request, response: Response): Promise<void> => {
    await usersService.updateUserRole(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.body.role,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("User role updated successfully", {}));
  };

  public updatePermissions = async (request: Request, response: Response): Promise<void> => {
    await usersService.updateUserPermissions(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.body.permissions,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("User permissions updated successfully", {}));
  };

  public getProfile = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.getProfile(request.currentUser!.id);
    response.json(successResponse("Profile fetched successfully", data));
  };

  public updateProfile = async (request: Request, response: Response): Promise<void> => {
    const data = await usersService.updateProfile(request.currentUser!.id, request.body);
    response.json(successResponse("Profile updated successfully", data));
  };
}

export const usersController = new UsersController();
