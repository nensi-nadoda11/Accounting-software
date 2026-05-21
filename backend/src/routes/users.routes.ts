import { Router } from "express";

import { requireAuth } from "../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../middlewares/require-company-access.middleware";
import { requirePermission } from "../middlewares/require-permission.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { asyncHandler } from "../utils/async-handler";
import { usersController } from "../modules/users/users.controller";
import { acceptInviteSchema, inviteUserSchema, resendInviteSchema, revokeInviteSchema, updateProfileSchema, updateUserPermissionsSchema, updateUserRoleSchema, updateUserStatusSchema, userIdParamSchema, usersListQuerySchema } from "../modules/users/users.validator";

const router = Router();

router.post("/accept-invite", validateRequest({ body: acceptInviteSchema }), asyncHandler(usersController.acceptInvite));

router.use(requireAuth, requireCompanyAccess);

router.post("/invite", requirePermission(["user.manage"]), validateRequest({ body: inviteUserSchema }), asyncHandler(usersController.inviteUser));
router.post("/resend-invite", requirePermission(["user.manage"]), validateRequest({ body: resendInviteSchema }), asyncHandler(usersController.resendInvite));
router.post("/revoke-invite", requirePermission(["user.manage"]), validateRequest({ body: revokeInviteSchema }), asyncHandler(usersController.revokeInvite));
router.get("/invites", requirePermission(["user.view", "user.manage"]), asyncHandler(usersController.listInvites));
router.get("/", requirePermission(["user.view", "user.manage"]), validateRequest({ query: usersListQuerySchema }), asyncHandler(usersController.listUsers));
router.patch("/:id/status", requirePermission(["user.manage"]), validateRequest({ params: userIdParamSchema, body: updateUserStatusSchema }), asyncHandler(usersController.updateStatus));
router.patch("/:id/role", requirePermission(["user.manage"]), validateRequest({ params: userIdParamSchema, body: updateUserRoleSchema }), asyncHandler(usersController.updateRole));
router.patch("/:id/permissions", requirePermission(["user.manage"]), validateRequest({ params: userIdParamSchema, body: updateUserPermissionsSchema }), asyncHandler(usersController.updatePermissions));

export default router;
