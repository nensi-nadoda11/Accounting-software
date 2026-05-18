import { Router } from "express";

import authRoutes from "./auth.routes";
import companyRoutes from "../modules/company/company.routes";
import customersRoutes from "../modules/customers/customers.routes";
import inventoryRoutes from "../modules/inventory/inventory.routes";
import accountingRoutes from "../modules/accounting/accounting.routes";
import paymentsRoutes from "../modules/payments/payments.routes";
import productsRoutes from "../modules/products/products.routes";
import profileRoutes from "./profile.routes";
import purchasesRoutes from "../modules/purchases/purchases.routes";
import suppliersRoutes from "../modules/suppliers/suppliers.routes";
import salesRoutes from "../modules/sales/sales.routes";
import usersRoutes from "./users.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/accounting", accountingRoutes);
router.use("/company", companyRoutes);
router.use("/customers", customersRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/payments", paymentsRoutes);
router.use("/purchases", purchasesRoutes);
router.use("/products", productsRoutes);
router.use("/sales", salesRoutes);
router.use("/suppliers", suppliersRoutes);
router.use("/users", usersRoutes);
router.use("/profile", profileRoutes);

export default router;
