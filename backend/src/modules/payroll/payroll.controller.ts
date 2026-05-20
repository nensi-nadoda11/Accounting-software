import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { payrollService } from "./payroll.service";

export class PayrollController {
  public listEmployees = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.listEmployees({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Employees fetched successfully", data));
  };

  public createEmployee = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.createEmployee(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.status(201).json(successResponse("Employee created successfully", data));
  };

  public getEmployee = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getEmployee({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Employee fetched successfully", data));
  };

  public updateEmployee = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.updateEmployee(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Employee updated successfully", data));
  };

  public deleteEmployee = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.deleteEmployee(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Employee deactivated successfully", data));
  };

  public getEmployeeSalaryStructure = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getEmployeeSalaryStructure(
      { companyId: request.currentUser!.companyId! },
      String(request.params.id)
    );
    response.json(successResponse("Salary structures fetched successfully", data));
  };

  public createSalaryStructure = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.createSalaryStructure(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.status(201).json(successResponse("Salary structure created successfully", data));
  };

  public updateSalaryStructure = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.updateSalaryStructure(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      String(request.params.structureId),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Salary structure updated successfully", data));
  };

  public listAttendance = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.listAttendance({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Attendance fetched successfully", data));
  };

  public createAttendance = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.upsertAttendance(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.status(201).json(successResponse("Attendance saved successfully", data));
  };

  public updateAttendance = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.updateAttendance(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Attendance updated successfully", data));
  };

  public listRuns = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.listRuns({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Payroll runs fetched successfully", data));
  };

  public createRun = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.createRun(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.status(201).json(successResponse("Payroll run created successfully", data));
  };

  public getRun = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getRun({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Payroll run fetched successfully", data));
  };

  public generateRun = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.generateRun(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Payroll generated successfully", data));
  };

  public payRun = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.payRun(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Payroll payment recorded successfully", data));
  };

  public cancelRun = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.cancelRun(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Payroll run cancelled successfully", data));
  };

  public listItems = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.listItems({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Payroll items fetched successfully", data));
  };

  public updateItemBonusDeductions = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.updateItemBonusDeductions(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Payroll bonus/deductions updated successfully", data));
  };

  public payItem = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.payItem(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Payroll item payment recorded successfully", data));
  };

  public getSlip = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getPayrollSlip(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Salary slip fetched successfully", data));
  };

  public getSlipPdf = async (request: Request, response: Response): Promise<void> => {
    const file = await payrollService.getPayrollSlipPdf(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public emailSlip = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.emailPayrollSlip(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.json(successResponse("Salary slip email processed successfully", data));
  };

  public getMonthlyReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getMonthlyReport({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Monthly payroll report fetched successfully", data));
  };

  public getEmployeeReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getEmployeeReport({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Employee payroll report fetched successfully", data));
  };

  public getDepartmentReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getDepartmentReport({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Department payroll report fetched successfully", data));
  };

  public getBonusDeductionsReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getBonusDeductionsReport(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );
    response.json(successResponse("Payroll bonus/deduction report fetched successfully", data));
  };

  public getUnpaidReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getUnpaidReport({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Unpaid payroll report fetched successfully", data));
  };

  public getPaymentReport = async (request: Request, response: Response): Promise<void> => {
    const data = await payrollService.getPaymentReport({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Payroll payment report fetched successfully", data));
  };

  public exportPayroll = async (request: Request, response: Response): Promise<void> => {
    const file = await payrollService.exportPayroll(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.query as never,
      { ipAddress: getRequestIp(request), userAgent: getUserAgent(request) }
    );
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };
}

export const payrollController = new PayrollController();
