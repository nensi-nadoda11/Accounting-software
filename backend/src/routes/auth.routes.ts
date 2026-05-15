import { Router } from "express";

import { asyncHandler } from "../utils/async-handler";
import { authController } from "../modules/auth/auth.controller";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resendOtpSchema, resetPasswordSchema, verifyOtpSchema } from "../modules/auth/auth.validator";
import { createRateLimiter } from "../middlewares/rate-limit.middleware";
import { requireAuth } from "../middlewares/require-auth.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";

const router = Router();
const authRateLimit = createRateLimiter({ limit: 15, windowMs: 15 * 60 * 1000, keyPrefix: "auth" });
const loginRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000, keyPrefix: "login" });

router.post("/register", authRateLimit, validateRequest({ body: registerSchema }), asyncHandler(authController.register));
router.post("/verify-otp", authRateLimit, validateRequest({ body: verifyOtpSchema }), asyncHandler(authController.verifyOtp));
router.post("/resend-otp", authRateLimit, validateRequest({ body: resendOtpSchema }), asyncHandler(authController.resendOtp));
router.post("/login", loginRateLimit, validateRequest({ body: loginSchema }), asyncHandler(authController.login));
router.get("/session", requireAuth, asyncHandler(authController.session));
router.post("/logout", requireAuth, asyncHandler(authController.logout));
router.post("/logout-all", requireAuth, asyncHandler(authController.logoutAll));
router.post("/refresh", authRateLimit, asyncHandler(authController.refresh));
router.post("/forgot-password", authRateLimit, validateRequest({ body: forgotPasswordSchema }), asyncHandler(authController.forgotPassword));
router.post("/reset-password", authRateLimit, validateRequest({ body: resetPasswordSchema }), asyncHandler(authController.resetPassword));
router.post("/change-password", requireAuth, validateRequest({ body: changePasswordSchema }), asyncHandler(authController.changePassword));

export default router;
