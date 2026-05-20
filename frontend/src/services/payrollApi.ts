import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  Attendance,
  AttendanceListQuery,
  AttendancePayload,
  BonusDeductionReportItem,
  CancelPayrollRunPayload,
  CreateEmployeePayload,
  CreatePayrollRunPayload,
  DepartmentPayrollReportItem,
  DownloadFileResult,
  Employee,
  EmployeeListQuery,
  EmployeePayrollReportItem,
  MonthlyPayrollReportItem,
  PaginationMeta,
  PayPayrollItemPayload,
  PayPayrollRunPayload,
  PaymentReportItem,
  PaymentReportSummary,
  PayrollExportFormat,
  PayrollItem,
  PayrollItemListQuery,
  PayrollReportsQuery,
  PayrollRun,
  PayrollRunDetailResponse,
  PayrollRunListQuery,
  SalarySlipEmailPayload,
  SalarySlipEmailResponse,
  SalarySlipResponse,
  SalaryStructure,
  SalaryStructurePayload,
  UnpaidSalaryReportItem,
  UpdateAttendancePayload,
  UpdateBonusDeductionsPayload,
  UpdateEmployeePayload,
} from "../types/payroll";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (
  request: Promise<AxiosResponse<Blob>>,
  fallbackFileName: string,
): Promise<DownloadFileResult> => {
  const response = await request;

  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream",
  };
};

type Paginated<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export const payrollApi = {
  listEmployees: async (query: EmployeeListQuery) =>
    (
      await client.get<ApiResponse<Paginated<Employee>>>("/payroll/employees", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          department: query.department || undefined,
          employmentType: query.employmentType || undefined,
        },
      })
    ).data,

  createEmployee: async (payload: CreateEmployeePayload) =>
    (await client.post<ApiResponse<{ employee: Employee }>>("/payroll/employees", payload)).data,

  getEmployee: async (employeeId: string) =>
    (await client.get<ApiResponse<{ employee: Employee; activeSalaryStructure: SalaryStructure | null }>>(`/payroll/employees/${employeeId}`)).data,

  updateEmployee: async (employeeId: string, payload: UpdateEmployeePayload) =>
    (await client.patch<ApiResponse<{ employee: Employee }>>(`/payroll/employees/${employeeId}`, payload)).data,

  deleteEmployee: async (employeeId: string) =>
    (await client.delete<ApiResponse<{ employee: Employee }>>(`/payroll/employees/${employeeId}`)).data,

  listSalaryStructures: async (employeeId: string) =>
    (await client.get<ApiResponse<{ items: SalaryStructure[] }>>(`/payroll/employees/${employeeId}/salary-structure`)).data,

  createSalaryStructure: async (employeeId: string, payload: SalaryStructurePayload) =>
    (await client.post<ApiResponse<{ salaryStructure: SalaryStructure }>>(`/payroll/employees/${employeeId}/salary-structure`, payload)).data,

  updateSalaryStructure: async (employeeId: string, structureId: string, payload: Partial<SalaryStructurePayload>) =>
    (await client.patch<ApiResponse<{ salaryStructure: SalaryStructure }>>(`/payroll/employees/${employeeId}/salary-structure/${structureId}`, payload)).data,

  listAttendance: async (query: AttendanceListQuery) =>
    (
      await client.get<ApiResponse<Paginated<Attendance>>>("/payroll/attendance", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          employeeId: query.employeeId || undefined,
          department: query.department || undefined,
        },
      })
    ).data,

  createAttendance: async (payload: AttendancePayload) =>
    (await client.post<ApiResponse<{ attendance: Attendance }>>("/payroll/attendance", payload)).data,

  updateAttendance: async (attendanceId: string, payload: UpdateAttendancePayload) =>
    (await client.patch<ApiResponse<{ attendance: Attendance }>>(`/payroll/attendance/${attendanceId}`, payload)).data,

  listRuns: async (query: PayrollRunListQuery) =>
    (
      await client.get<ApiResponse<Paginated<PayrollRun>>>("/payroll/runs", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          status: query.status || undefined,
        },
      })
    ).data,

  createRun: async (payload: CreatePayrollRunPayload) =>
    (await client.post<ApiResponse<{ run: PayrollRun }>>("/payroll/runs", payload)).data,

  getRun: async (runId: string) =>
    (await client.get<ApiResponse<PayrollRunDetailResponse>>(`/payroll/runs/${runId}`)).data,

  generateRun: async (runId: string) =>
    (await client.post<ApiResponse<PayrollRunDetailResponse | { run: PayrollRun }>>(`/payroll/runs/${runId}/generate`)).data,

  payRun: async (runId: string, payload: PayPayrollRunPayload) =>
    (await client.post<ApiResponse<PayrollRunDetailResponse>>(`/payroll/runs/${runId}/pay`, payload)).data,

  cancelRun: async (runId: string, payload: CancelPayrollRunPayload) =>
    (await client.post<ApiResponse<{ run: PayrollRun }>>(`/payroll/runs/${runId}/cancel`, payload)).data,

  listItems: async (query: PayrollItemListQuery) =>
    (
      await client.get<ApiResponse<Paginated<PayrollItem>>>("/payroll/items", {
        params: {
          page: query.page,
          limit: query.limit,
          runId: query.runId || undefined,
          employeeId: query.employeeId || undefined,
          paymentStatus: query.paymentStatus || undefined,
          month: query.month || undefined,
        },
      })
    ).data,

  updateBonusDeductions: async (itemId: string, payload: UpdateBonusDeductionsPayload) =>
    (await client.patch<ApiResponse<SalarySlipResponse>>(`/payroll/items/${itemId}/bonus-deductions`, payload)).data,

  payItem: async (itemId: string, payload: PayPayrollItemPayload) =>
    (await client.post<ApiResponse<SalarySlipResponse>>(`/payroll/items/${itemId}/pay`, payload)).data,

  getSlip: async (itemId: string) =>
    (await client.get<ApiResponse<SalarySlipResponse>>(`/payroll/items/${itemId}/slip`)).data,

  getSlipPdf: async (itemId: string) =>
    extractDownload(
      client.get(`/payroll/items/${itemId}/slip/pdf`, {
        responseType: "blob",
      }),
      `salary-slip-${itemId}.pdf`,
    ),

  emailSlip: async (itemId: string, payload: SalarySlipEmailPayload) =>
    (await client.post<ApiResponse<SalarySlipEmailResponse>>(`/payroll/items/${itemId}/slip/email`, payload)).data,

  getMonthlyReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<{ items: MonthlyPayrollReportItem[] }>>("/payroll/reports/monthly", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  getEmployeeReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<{ items: EmployeePayrollReportItem[] }>>("/payroll/reports/employee", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  getDepartmentReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<{ items: DepartmentPayrollReportItem[] }>>("/payroll/reports/department", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  getBonusDeductionsReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<{ items: BonusDeductionReportItem[] }>>("/payroll/reports/bonus-deductions", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  getUnpaidReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<Paginated<UnpaidSalaryReportItem>>>("/payroll/reports/unpaid", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  getPaymentReport: async (query: PayrollReportsQuery) =>
    (
      await client.get<ApiResponse<{ items: PaymentReportItem[]; summary: PaymentReportSummary }>>("/payroll/reports/payment", {
        params: {
          page: query.page,
          limit: query.limit,
          month: query.month || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          department: query.department || undefined,
          employeeId: query.employeeId || undefined,
          runId: query.runId || undefined,
          paymentMode: query.paymentMode || undefined,
          includeCancelled: query.includeCancelled,
        },
      })
    ).data,

  exportPayroll: async (
    query: PayrollItemListQuery & {
      department?: string;
      format?: PayrollExportFormat;
    },
  ) =>
    extractDownload(
      client.get("/payroll/export", {
        params: {
          page: query.page,
          limit: query.limit,
          runId: query.runId || undefined,
          employeeId: query.employeeId || undefined,
          paymentStatus: query.paymentStatus || undefined,
          month: query.month || undefined,
          department: query.department || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "payroll.csv",
    ),
};
