export type EmploymentType = "full_time" | "part_time" | "contract";
export type SalaryType = "monthly" | "daily" | "hourly";
export type EmployeeStatus = "active" | "inactive" | "resigned" | "deleted";
export type PayrollRunStatus = "draft" | "generated" | "paid" | "cancelled";
export type PayrollItemPaymentStatus = "unpaid" | "partial" | "paid";
export type PayrollPaymentMode = "cash" | "bank" | "upi" | "cheque" | "other";
export type PayrollItemStatus = "generated" | "paid" | "cancelled";
export type PayrollBonusDeductionType = "bonus" | "deduction";
export type PayrollExportFormat = "csv" | "xlsx" | "pdf";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Employee {
  id: string;
  companyId: string;
  employeeCode: string;
  fullName: string;
  mobile: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
  salaryType: SalaryType;
  panNumber: string | null;
  aadhaarLast4: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  emergencyContactName: string | null;
  emergencyContactMobile: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  upiId: string | null;
  status: EmployeeStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SalaryStructure {
  id: string;
  companyId: string;
  employeeId: string;
  basicSalary: string;
  hra: string;
  conveyanceAllowance: string;
  medicalAllowance: string;
  otherAllowance: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  tdsDeduction: string;
  otherDeduction: string;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEmployeeSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
}

export interface Attendance {
  id: string;
  companyId: string;
  employeeId: string;
  payrollMonth: string;
  workingDays: string;
  presentDays: string;
  absentDays: string;
  paidLeaveDays: string;
  unpaidLeaveDays: string;
  halfDays: string;
  overtimeHours: string;
  remarks: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: AttendanceEmployeeSummary;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  runNumber: string;
  payrollMonth: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
  totalEmployees: number;
  grossTotal: string;
  deductionTotal: string;
  bonusTotal: string;
  netPayableTotal: string;
  paidTotal: string;
  notes: string | null;
  generatedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  accountingEventCreated: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEmployeeSnapshot {
  id: string;
  fullName: string;
  mobile: string;
  email: string | null;
  status: EmployeeStatus;
}

export interface PayrollItemRunSummary {
  id: string;
  runNumber: string;
  payrollMonth: string;
  status?: PayrollRunStatus;
}

export interface PayrollBonusDeduction {
  id?: string;
  type: PayrollBonusDeductionType;
  name: string;
  amount: string;
  taxable: boolean;
  notes: string | null;
}

export interface PayrollItem {
  id: string;
  companyId: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  workingDays: string;
  payableDays: string;
  basicSalary: string;
  hra: string;
  allowancesTotal: string;
  bonusTotal: string;
  grossSalary: string;
  deductionsTotal: string;
  netSalary: string;
  paidAmount: string;
  paymentStatus: PayrollItemPaymentStatus;
  paymentMode: PayrollPaymentMode | null;
  paymentReference: string | null;
  paidAt: string | null;
  status: PayrollItemStatus;
  createdAt: string;
  updatedAt: string;
  employee: PayrollEmployeeSnapshot;
  run?: PayrollItemRunSummary;
  bonusDeductions?: PayrollBonusDeduction[];
}

export interface SalaryPayment {
  id: string;
  payrollItemId: string | null;
  employeeId: string;
  paymentDate: string;
  amount: string;
  paymentMode: PayrollPaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SalarySlipCompany {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  mobileNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
}

export interface SalarySlipEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
  salaryType: SalaryType;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  upiId: string | null;
}

export interface SalarySlipAttendance {
  workingDays: string;
  presentDays: string;
  absentDays: string;
  paidLeaveDays: string;
  unpaidLeaveDays: string;
  halfDays: string;
  overtimeHours: string;
  payableDays: string;
  remarks: string | null;
}

export interface SalarySlipSalary {
  basicSalary: string;
  hra: string;
  allowancesTotal: string;
  bonusTotal: string;
  grossSalary: string;
  deductionsTotal: string;
  netSalary: string;
  paidAmount: string;
  unpaidAmount: string;
  paymentStatus: PayrollItemPaymentStatus;
}

export interface SalarySlipPayment {
  id: string;
  paymentDate: string;
  amount: string;
  paymentMode: PayrollPaymentMode;
  referenceNumber: string | null;
  notes: string | null;
}

export interface SalarySlip {
  payrollItemId: string;
  payrollRunId: string;
  runNumber: string;
  payrollMonth: string;
  periodStart: string;
  periodEnd: string;
  company: SalarySlipCompany | null;
  employee: SalarySlipEmployee;
  attendance: SalarySlipAttendance;
  salary: SalarySlipSalary;
  bonusDeductions: PayrollBonusDeduction[];
  payments: SalarySlipPayment[];
}

export interface MonthlyPayrollReportItem {
  payrollMonth: string;
  totalEmployees: number;
  grossTotal: string;
  deductionTotal: string;
  bonusTotal: string;
  netPayableTotal: string;
  paidTotal: string;
}

export interface EmployeePayrollReportItem {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  payrollEntries: number;
  netSalaryTotal: string;
  paidTotal: string;
}

export interface DepartmentPayrollReportItem {
  department: string;
  totalEmployees: number;
  grossTotal: string;
  netSalaryTotal: string;
  paidTotal: string;
}

export interface BonusDeductionReportItem {
  id: string;
  payrollMonth: string;
  runNumber: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  type: PayrollBonusDeductionType;
  name: string;
  amount: string;
  taxable: boolean;
  notes: string | null;
}

export interface UnpaidSalaryReportItem extends PayrollItem {
  run: PayrollItemRunSummary;
  unpaidAmount: string;
}

export interface PaymentReportItem {
  paymentId: string;
  payrollMonth: string;
  runNumber: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  paymentDate: string;
  amount: string;
  paymentMode: PayrollPaymentMode;
  referenceNumber: string | null;
  payrollItemId: string | null;
}

export interface PaymentReportSummary {
  totalAmount: string;
  totalPayments: number;
}

export interface EmployeeListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: EmployeeStatus;
  department?: string;
  employmentType?: EmploymentType;
}

export interface AttendanceListQuery {
  page: number;
  limit: number;
  month?: string;
  employeeId?: string;
  department?: string;
}

export interface PayrollRunListQuery {
  page: number;
  limit: number;
  month?: string;
  status?: PayrollRunStatus;
}

export interface PayrollItemListQuery {
  page: number;
  limit: number;
  runId?: string;
  employeeId?: string;
  paymentStatus?: PayrollItemPaymentStatus;
  month?: string;
}

export interface PayrollReportsQuery {
  page?: number;
  limit?: number;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  employeeId?: string;
  runId?: string;
  paymentMode?: PayrollPaymentMode;
  includeCancelled?: boolean;
}

export interface CreateEmployeePayload {
  fullName: string;
  mobile: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
  salaryType: SalaryType;
  panNumber?: string | null;
  aadhaarLast4?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactMobile?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  status?: EmployeeStatus;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export interface SalaryStructurePayload {
  basicSalary: number;
  hra?: number;
  conveyanceAllowance?: number;
  medicalAllowance?: number;
  otherAllowance?: number;
  pfDeduction?: number;
  esicDeduction?: number;
  professionalTax?: number;
  tdsDeduction?: number;
  otherDeduction?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
}

export interface AttendancePayload {
  employeeId: string;
  payrollMonth: string;
  workingDays: number;
  presentDays: number;
  absentDays?: number;
  paidLeaveDays?: number;
  unpaidLeaveDays?: number;
  halfDays?: number;
  overtimeHours?: number;
  remarks?: string | null;
}

export type UpdateAttendancePayload = Partial<AttendancePayload>;

export interface CreatePayrollRunPayload {
  payrollMonth: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
}

export interface PayPayrollRunPayload {
  paymentDate: string;
  paymentMode: PayrollPaymentMode;
  bankAccountId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  payrollItemIds?: string[];
  payments?: Array<{
    payrollItemId: string;
    amount?: number;
  }>;
}

export interface PayPayrollItemPayload {
  paymentDate: string;
  amount?: number;
  paymentMode: PayrollPaymentMode;
  bankAccountId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface UpdateBonusDeductionsPayload {
  entries: Array<{
    type: PayrollBonusDeductionType;
    name: string;
    amount: number;
    taxable?: boolean;
    notes?: string | null;
  }>;
}

export interface CancelPayrollRunPayload {
  cancellationReason: string;
}

export interface SalarySlipEmailPayload {
  email?: string | null;
  subject?: string | null;
  message?: string | null;
}

export interface PayrollRunDetailResponse {
  run: PayrollRun;
  items: PayrollItem[];
  payments: SalaryPayment[];
}

export interface SalarySlipResponse {
  slip: SalarySlip;
}

export interface SalarySlipPdfResponse {
  pdfAvailable: boolean;
  slip: SalarySlip;
}

export interface SalarySlipEmailResponse {
  sentTo: string | null;
  status: "sent" | "failed" | "skipped";
  errorMessage: string | null;
}

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}
