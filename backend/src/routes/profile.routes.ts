import { Router } from "express";

import { requireAuth } from "../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../middlewares/require-company-access.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { asyncHandler } from "../utils/async-handler";
import { authController } from "../modules/auth/auth.controller";
import { changePasswordSchema } from "../modules/auth/auth.validator";
import { usersController } from "../modules/users/users.controller";
import { updateProfileSchema } from "../modules/users/users.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get("/", asyncHandler(usersController.getProfile));
router.patch("/", validateRequest({ body: updateProfileSchema }), asyncHandler(usersController.updateProfile));
router.post("/change-password", validateRequest({ body: changePasswordSchema }), asyncHandler(authController.changePassword));

export default router;
