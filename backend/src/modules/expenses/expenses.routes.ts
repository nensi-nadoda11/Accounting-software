import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { expensesController } from "./expenses.controller";
import { uploadExpenseAttachments } from "./expenses.upload";
import {
  cancelExpenseSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createRecurringExpenseSchema,
  expenseAttachmentParamSchema,
  expenseCategoryIdParamSchema,
  expenseIdParamSchema,
  exportExpensesQuerySchema,
  listExpenseCategoriesQuerySchema,
  listExpensesQuerySchema,
  listRecurringExpensesQuerySchema,
  recurringExpenseIdParamSchema,
  reportQuerySchema,
  updateExpenseCategorySchema,
  updateExpenseSchema,
  updateRecurringExpenseSchema
} from "./expenses.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["expense.export"]),
  validateRequest({ query: exportExpensesQuerySchema }),
  asyncHandler(expensesController.exportExpenses)
);

router.get(
  "/reports/category-wise",
  requirePermission(["expense.view"]),
  validateRequest({ query: reportQuerySchema }),
  asyncHandler(expensesController.categoryWiseReport)
);

router.get(
  "/reports/monthly",
  requirePermission(["expense.view"]),
  validateRequest({ query: reportQuerySchema }),
  asyncHandler(expensesController.monthlyReport)
);

router.get(
  "/reports/payment-mode",
  requirePermission(["expense.view"]),
  validateRequest({ query: reportQuerySchema }),
  asyncHandler(expensesController.paymentModeReport)
);

router.get(
  "/reports/gst",
  requirePermission(["expense.view"]),
  validateRequest({ query: reportQuerySchema }),
  asyncHandler(expensesController.gstReport)
);

router.get(
  "/categories",
  requirePermission(["expense.view"]),
  validateRequest({ query: listExpenseCategoriesQuerySchema }),
  asyncHandler(expensesController.listCategories)
);

router.post(
  "/categories",
  requirePermission(["expense.category.manage"]),
  validateRequest({ body: createExpenseCategorySchema }),
  asyncHandler(expensesController.createCategory)
);

router.patch(
  "/categories/:id",
  requirePermission(["expense.category.manage"]),
  validateRequest({ params: expenseCategoryIdParamSchema, body: updateExpenseCategorySchema }),
  asyncHandler(expensesController.updateCategory)
);

router.delete(
  "/categories/:id",
  requirePermission(["expense.category.manage"]),
  validateRequest({ params: expenseCategoryIdParamSchema }),
  asyncHandler(expensesController.deleteCategory)
);

router.get(
  "/recurring",
  requirePermission(["expense.view"]),
  validateRequest({ query: listRecurringExpensesQuerySchema }),
  asyncHandler(expensesController.listRecurring)
);

router.post(
  "/recurring",
  requirePermission(["expense.recurring.manage"]),
  validateRequest({ body: createRecurringExpenseSchema }),
  asyncHandler(expensesController.createRecurring)
);

router.post(
  "/recurring/run-due",
  requirePermission(["expense.recurring.manage"]),
  asyncHandler(expensesController.runDueRecurring)
);

router.patch(
  "/recurring/:id",
  requirePermission(["expense.recurring.manage"]),
  validateRequest({ params: recurringExpenseIdParamSchema, body: updateRecurringExpenseSchema }),
  asyncHandler(expensesController.updateRecurring)
);

router.post(
  "/recurring/:id/run",
  requirePermission(["expense.recurring.manage"]),
  validateRequest({ params: recurringExpenseIdParamSchema }),
  asyncHandler(expensesController.runRecurring)
);

router.post(
  "/:id/attachments",
  requirePermission(["expense.create", "expense.update"]),
  validateRequest({ params: expenseIdParamSchema }),
  uploadExpenseAttachments,
  asyncHandler(expensesController.uploadAttachments)
);

router.delete(
  "/:id/attachments/:attachmentId",
  requirePermission(["expense.update"]),
  validateRequest({ params: expenseAttachmentParamSchema }),
  asyncHandler(expensesController.deleteAttachment)
);

router.get(
  "/:id/attachments/:attachmentId/download",
  requirePermission(["expense.view"]),
  validateRequest({ params: expenseAttachmentParamSchema }),
  asyncHandler(expensesController.downloadAttachment)
);

router.post(
  "/:id/post",
  requirePermission(["expense.post"]),
  validateRequest({ params: expenseIdParamSchema }),
  asyncHandler(expensesController.postExpense)
);

router.post(
  "/:id/cancel",
  requirePermission(["expense.delete", "expense.post"]),
  validateRequest({ params: expenseIdParamSchema, body: cancelExpenseSchema }),
  asyncHandler(expensesController.cancelExpense)
);

router.get(
  "/:id",
  requirePermission(["expense.view"]),
  validateRequest({ params: expenseIdParamSchema }),
  asyncHandler(expensesController.getExpense)
);

router.patch(
  "/:id",
  requirePermission(["expense.update"]),
  validateRequest({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(expensesController.updateExpense)
);

router.delete(
  "/:id",
  requirePermission(["expense.delete"]),
  validateRequest({ params: expenseIdParamSchema }),
  asyncHandler(expensesController.deleteExpense)
);

router.get(
  "/",
  requirePermission(["expense.view"]),
  validateRequest({ query: listExpensesQuerySchema }),
  asyncHandler(expensesController.listExpenses)
);

router.post(
  "/",
  requirePermission(["expense.create"]),
  validateRequest({ body: createExpenseSchema }),
  asyncHandler(expensesController.createExpense)
);

export default router;
