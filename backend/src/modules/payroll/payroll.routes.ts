import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { payrollController } from "./payroll.controller";
import {
  attendanceIdParamSchema,
  cancelRunSchema,
  createAttendanceSchema,
  createEmployeeSchema,
  createRunSchema,
  createSalaryStructureSchema,
  employeeIdParamSchema,
  employeeStructureParamSchema,
  exportPayrollQuerySchema,
  itemIdParamSchema,
  listAttendanceQuerySchema,
  listEmployeesQuerySchema,
  listItemsQuerySchema,
  listRunsQuerySchema,
  payItemSchema,
  payRunSchema,
  reportsQuerySchema,
  runIdParamSchema,
  salarySlipEmailSchema,
  updateAttendanceSchema,
  updateBonusDeductionsSchema,
  updateEmployeeSchema,
  updateSalaryStructureSchema
} from "./payroll.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["payroll.export"]),
  validateRequest({ query: exportPayrollQuerySchema }),
  asyncHandler(payrollController.exportPayroll)
);

router.get(
  "/reports/monthly",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getMonthlyReport)
);

router.get(
  "/reports/employee",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getEmployeeReport)
);

router.get(
  "/reports/department",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getDepartmentReport)
);

router.get(
  "/reports/bonus-deductions",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getBonusDeductionsReport)
);

router.get(
  "/reports/unpaid",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getUnpaidReport)
);

router.get(
  "/reports/payment",
  requirePermission(["payroll.view"]),
  validateRequest({ query: reportsQuerySchema }),
  asyncHandler(payrollController.getPaymentReport)
);

router.get(
  "/employees",
  requirePermission(["payroll.view"]),
  validateRequest({ query: listEmployeesQuerySchema }),
  asyncHandler(payrollController.listEmployees)
);

router.post(
  "/employees",
  requirePermission(["payroll.employee.manage"]),
  validateRequest({ body: createEmployeeSchema }),
  asyncHandler(payrollController.createEmployee)
);

router.get(
  "/employees/:id/salary-structure",
  requirePermission(["payroll.view"]),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(payrollController.getEmployeeSalaryStructure)
);

router.post(
  "/employees/:id/salary-structure",
  requirePermission(["payroll.structure.manage"]),
  validateRequest({ params: employeeIdParamSchema, body: createSalaryStructureSchema }),
  asyncHandler(payrollController.createSalaryStructure)
);

router.patch(
  "/employees/:id/salary-structure/:structureId",
  requirePermission(["payroll.structure.manage"]),
  validateRequest({ params: employeeStructureParamSchema, body: updateSalaryStructureSchema }),
  asyncHandler(payrollController.updateSalaryStructure)
);

router.get(
  "/employees/:id",
  requirePermission(["payroll.view"]),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(payrollController.getEmployee)
);

router.patch(
  "/employees/:id",
  requirePermission(["payroll.employee.manage"]),
  validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  asyncHandler(payrollController.updateEmployee)
);

router.delete(
  "/employees/:id",
  requirePermission(["payroll.employee.manage"]),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(payrollController.deleteEmployee)
);

router.get(
  "/attendance",
  requirePermission(["payroll.view"]),
  validateRequest({ query: listAttendanceQuerySchema }),
  asyncHandler(payrollController.listAttendance)
);

router.post(
  "/attendance",
  requirePermission(["payroll.generate", "payroll.employee.manage"]),
  validateRequest({ body: createAttendanceSchema }),
  asyncHandler(payrollController.createAttendance)
);

router.patch(
  "/attendance/:id",
  requirePermission(["payroll.generate", "payroll.employee.manage"]),
  validateRequest({ params: attendanceIdParamSchema, body: updateAttendanceSchema }),
  asyncHandler(payrollController.updateAttendance)
);

router.get(
  "/runs",
  requirePermission(["payroll.view"]),
  validateRequest({ query: listRunsQuerySchema }),
  asyncHandler(payrollController.listRuns)
);

router.post(
  "/runs",
  requirePermission(["payroll.generate"]),
  validateRequest({ body: createRunSchema }),
  asyncHandler(payrollController.createRun)
);

router.get(
  "/runs/:id",
  requirePermission(["payroll.view"]),
  validateRequest({ params: runIdParamSchema }),
  asyncHandler(payrollController.getRun)
);

router.post(
  "/runs/:id/generate",
  requirePermission(["payroll.generate"]),
  validateRequest({ params: runIdParamSchema }),
  asyncHandler(payrollController.generateRun)
);

router.post(
  "/runs/:id/pay",
  requirePermission(["payroll.pay"]),
  validateRequest({ params: runIdParamSchema, body: payRunSchema }),
  asyncHandler(payrollController.payRun)
);

router.post(
  "/runs/:id/cancel",
  requirePermission(["payroll.generate"]),
  validateRequest({ params: runIdParamSchema, body: cancelRunSchema }),
  asyncHandler(payrollController.cancelRun)
);

router.get(
  "/items",
  requirePermission(["payroll.view"]),
  validateRequest({ query: listItemsQuerySchema }),
  asyncHandler(payrollController.listItems)
);

router.patch(
  "/items/:id/bonus-deductions",
  requirePermission(["payroll.generate"]),
  validateRequest({ params: itemIdParamSchema, body: updateBonusDeductionsSchema }),
  asyncHandler(payrollController.updateItemBonusDeductions)
);

router.post(
  "/items/:id/pay",
  requirePermission(["payroll.pay"]),
  validateRequest({ params: itemIdParamSchema, body: payItemSchema }),
  asyncHandler(payrollController.payItem)
);

router.get(
  "/items/:id/slip/pdf",
  requirePermission(["payroll.slip.print"]),
  validateRequest({ params: itemIdParamSchema }),
  asyncHandler(payrollController.getSlipPdf)
);

router.post(
  "/items/:id/slip/email",
  requirePermission(["payroll.slip.print"]),
  validateRequest({ params: itemIdParamSchema, body: salarySlipEmailSchema }),
  asyncHandler(payrollController.emailSlip)
);

router.get(
  "/items/:id/slip",
  requirePermission(["payroll.slip.print"]),
  validateRequest({ params: itemIdParamSchema }),
  asyncHandler(payrollController.getSlip)
);

export default router;
