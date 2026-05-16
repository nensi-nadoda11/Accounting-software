import { Router } from "express";

import authRoutes from "./auth.routes";
import companyRoutes from "../modules/company/company.routes";
import customersRoutes from "../modules/customers/customers.routes";
import profileRoutes from "./profile.routes";
import suppliersRoutes from "../modules/suppliers/suppliers.routes";
import usersRoutes from "./users.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/customers", customersRoutes);
router.use("/suppliers", suppliersRoutes);
router.use("/users", usersRoutes);
router.use("/profile", profileRoutes);

export default router;
