import { Router } from "express";

import authRoutes from "./auth.routes";
import companyRoutes from "../modules/company/company.routes";
import profileRoutes from "./profile.routes";
import usersRoutes from "./users.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/users", usersRoutes);
router.use("/profile", profileRoutes);

export default router;
