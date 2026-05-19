import { endOfMonth, format, startOfMonth } from "date-fns";

import type { Attendance, AttendancePayload, Employee, PayrollItem, SalaryPayment, SalaryStructure } from "../../types/payroll";
import type {
  AttendanceFormValues,
  BonusDeductionFormValues,
  EmployeeFormValues,
  PayrollRunFormValues,
  SalaryPaymentFormValues,
  SalaryStructureFormValues,
} from "./payrollSchemas";

export const formatNullable = (value: string | null | undefined) => value || "-";

export const formatMonthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) {
    return value;
  }

  return format(new Date(year, month - 1, 1), "MMMM yyyy");
};

export const getCurrentPayrollMonth = () => format(new Date(), "yyyy-MM");
export const getTodayInput = () => format(new Date(), "yyyy-MM-dd");

export const getMonthBoundsForInput = (payrollMonth: string) => {
  const [year, month] = payrollMonth.split("-").map(Number);
  if (!year || !month) {
    const today = new Date();
    return {
      periodStart: format(startOfMonth(today), "yyyy-MM-dd"),
      periodEnd: format(endOfMonth(today), "yyyy-MM-dd"),
    };
  }

  const date = new Date(year, month - 1, 1);
  return {
    periodStart: format(startOfMonth(date), "yyyy-MM-dd"),
    periodEnd: format(endOfMonth(date), "yyyy-MM-dd"),
  };
};

export const toInputDate = (value: string | null | undefined) => (value ? format(new Date(value), "yyyy-MM-dd") : "");

export const getEmployeeOptionLabel = (employee: Employee) =>
  `${employee.employeeCode} - ${employee.fullName}${employee.department ? ` / ${employee.department}` : ""}`;

export const buildEmployeeDefaults = (employee?: Employee | null): EmployeeFormValues => ({
  fullName: employee?.fullName ?? "",
  mobile: employee?.mobile ?? "",
  email: employee?.email ?? "",
  department: employee?.department ?? "",
  designation: employee?.designation ?? "",
  joiningDate: toInputDate(employee?.joiningDate),
  employmentType: employee?.employmentType ?? "full_time",
  salaryType: employee?.salaryType ?? "monthly",
  panNumber: employee?.panNumber ?? "",
  aadhaarLast4: employee?.aadhaarLast4 ?? "",
  addressLine1: employee?.addressLine1 ?? "",
  addressLine2: employee?.addressLine2 ?? "",
  city: employee?.city ?? "",
  state: employee?.state ?? "",
  pincode: employee?.pincode ?? "",
  emergencyContactName: employee?.emergencyContactName ?? "",
  emergencyContactMobile: employee?.emergencyContactMobile ?? "",
  bankName: employee?.bankName ?? "",
  accountHolderName: employee?.accountHolderName ?? "",
  accountNumber: employee?.accountNumber ?? "",
  ifscCode: employee?.ifscCode ?? "",
  upiId: employee?.upiId ?? "",
  status: employee?.status ?? "active",
});

export const buildSalaryStructureDefaults = (structure?: SalaryStructure | null): SalaryStructureFormValues => ({
  basicSalary: Number(structure?.basicSalary ?? 0),
  hra: Number(structure?.hra ?? 0),
  conveyanceAllowance: Number(structure?.conveyanceAllowance ?? 0),
  medicalAllowance: Number(structure?.medicalAllowance ?? 0),
  otherAllowance: Number(structure?.otherAllowance ?? 0),
  pfDeduction: Number(structure?.pfDeduction ?? 0),
  esicDeduction: Number(structure?.esicDeduction ?? 0),
  professionalTax: Number(structure?.professionalTax ?? 0),
  tdsDeduction: Number(structure?.tdsDeduction ?? 0),
  otherDeduction: Number(structure?.otherDeduction ?? 0),
  effectiveFrom: toInputDate(structure?.effectiveFrom) || getTodayInput(),
  effectiveTo: toInputDate(structure?.effectiveTo),
  isActive: structure?.isActive ?? true,
});

export const calculateStructureTotals = (values: Pick<
  SalaryStructureFormValues,
  | "basicSalary"
  | "hra"
  | "conveyanceAllowance"
  | "medicalAllowance"
  | "otherAllowance"
  | "pfDeduction"
  | "esicDeduction"
  | "professionalTax"
  | "tdsDeduction"
  | "otherDeduction"
>) => {
  const gross =
    Number(values.basicSalary || 0) +
    Number(values.hra || 0) +
    Number(values.conveyanceAllowance || 0) +
    Number(values.medicalAllowance || 0) +
    Number(values.otherAllowance || 0);
  const deductions =
    Number(values.pfDeduction || 0) +
    Number(values.esicDeduction || 0) +
    Number(values.professionalTax || 0) +
    Number(values.tdsDeduction || 0) +
    Number(values.otherDeduction || 0);

  return {
    gross,
    deductions,
    net: gross - deductions,
  };
};

export const buildAttendanceDefaults = (attendance?: Attendance | null): AttendanceFormValues => ({
  employeeId: attendance?.employeeId ?? "",
  payrollMonth: attendance?.payrollMonth ?? getCurrentPayrollMonth(),
  workingDays: Number(attendance?.workingDays ?? 0),
  presentDays: Number(attendance?.presentDays ?? 0),
  absentDays: Number(attendance?.absentDays ?? 0),
  paidLeaveDays: Number(attendance?.paidLeaveDays ?? 0),
  unpaidLeaveDays: Number(attendance?.unpaidLeaveDays ?? 0),
  halfDays: Number(attendance?.halfDays ?? 0),
  overtimeHours: Number(attendance?.overtimeHours ?? 0),
  remarks: attendance?.remarks ?? null,
});

export const buildPayrollRunDefaults = (): PayrollRunFormValues => {
  const payrollMonth = getCurrentPayrollMonth();
  const bounds = getMonthBoundsForInput(payrollMonth);

  return {
    payrollMonth,
    periodStart: bounds.periodStart,
    periodEnd: bounds.periodEnd,
    notes: "",
  };
};

export const buildSalaryPaymentDefaults = (amount: number): SalaryPaymentFormValues => ({
  amount,
  paymentDate: getTodayInput(),
  paymentMode: "bank",
  bankAccountId: "",
  referenceNumber: "",
  notes: "",
});

export const mapEmployeeFormToPayload = (values: EmployeeFormValues) => ({
  fullName: values.fullName.trim(),
  mobile: values.mobile.trim(),
  email: values.email || null,
  department: values.department || null,
  designation: values.designation || null,
  joiningDate: values.joiningDate,
  employmentType: values.employmentType,
  salaryType: values.salaryType,
  panNumber: values.panNumber || null,
  aadhaarLast4: values.aadhaarLast4 || null,
  addressLine1: values.addressLine1 || null,
  addressLine2: values.addressLine2 || null,
  city: values.city || null,
  state: values.state || null,
  pincode: values.pincode || null,
  emergencyContactName: values.emergencyContactName || null,
  emergencyContactMobile: values.emergencyContactMobile || null,
  bankName: values.bankName || null,
  accountHolderName: values.accountHolderName || null,
  accountNumber: values.accountNumber || null,
  ifscCode: values.ifscCode || null,
  upiId: values.upiId || null,
  status: values.status,
});

export const mapStructureFormToPayload = (values: SalaryStructureFormValues) => ({
  basicSalary: values.basicSalary,
  hra: values.hra,
  conveyanceAllowance: values.conveyanceAllowance,
  medicalAllowance: values.medicalAllowance,
  otherAllowance: values.otherAllowance,
  pfDeduction: values.pfDeduction,
  esicDeduction: values.esicDeduction,
  professionalTax: values.professionalTax,
  tdsDeduction: values.tdsDeduction,
  otherDeduction: values.otherDeduction,
  effectiveFrom: values.effectiveFrom,
  effectiveTo: values.effectiveTo || null,
  isActive: values.isActive,
});

export const mapAttendanceFormToPayload = (values: AttendanceFormValues): AttendancePayload => ({
  employeeId: values.employeeId,
  payrollMonth: values.payrollMonth,
  workingDays: values.workingDays,
  presentDays: values.presentDays,
  absentDays: values.absentDays,
  paidLeaveDays: values.paidLeaveDays,
  unpaidLeaveDays: values.unpaidLeaveDays,
  halfDays: values.halfDays,
  overtimeHours: values.overtimeHours,
  remarks: values.remarks || null,
});

export const mapRunFormToPayload = (values: PayrollRunFormValues) => ({
  payrollMonth: values.payrollMonth,
  periodStart: values.periodStart || null,
  periodEnd: values.periodEnd || null,
  notes: values.notes || null,
});

export const getDepartmentOptions = (employees: Employee[]) =>
  Array.from(
    new Set(employees.map((employee) => employee.department).filter((department): department is string => Boolean(department))),
  ).sort();

export const filterEmployeesBySearch = (employees: Employee[], search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) {
    return employees;
  }

  return employees.filter((employee) =>
    [
      employee.fullName,
      employee.employeeCode,
      employee.mobile,
      employee.email,
      employee.department,
      employee.designation,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
};

export const filterPayrollItemsBySearch = (items: PayrollItem[], search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) {
    return items;
  }

  return items.filter((item) =>
    [
      item.employeeName,
      item.employeeCode,
      item.run?.runNumber,
      item.paymentReference,
      item.department,
      item.designation,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
};

export const maskAccountNumber = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const smallNumbers = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tensNumbers = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const convertBelowThousand = (value: number): string => {
  if (value < 20) {
    return smallNumbers[value] ?? "";
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return `${tensNumbers[tens]}${remainder ? ` ${convertBelowThousand(remainder)}` : ""}`;
  }

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return `${smallNumbers[hundreds]} Hundred${remainder ? ` ${convertBelowThousand(remainder)}` : ""}`;
};

const convertIndianNumber = (value: number): string => {
  if (value === 0) {
    return "Zero";
  }

  const units: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [1, ""],
  ];

  let remainder = Math.floor(value);
  const parts: string[] = [];

  for (const [size, label] of units) {
    if (remainder >= size) {
      const chunk = Math.floor(remainder / size);
      remainder %= size;
      const text = size >= 1000 ? convertIndianNumber(chunk) : convertBelowThousand(chunk);
      parts.push(label ? `${text} ${label}` : text);
    }
  }

  return parts.join(" ").trim();
};

export const amountToWords = (value: string | number) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  const rupees = Math.floor(numericValue);
  const paise = Math.round((numericValue - rupees) * 100);
  const rupeesText = `${convertIndianNumber(rupees)} Rupees`;
  if (!paise) {
    return `${rupeesText} Only`;
  }

  return `${rupeesText} and ${convertBelowThousand(paise)} Paise Only`;
};

export const getUnpaidAmount = (item: Pick<PayrollItem, "netSalary" | "paidAmount">) =>
  Math.max(0, Number(item.netSalary) - Number(item.paidAmount));

export const getLatestPayment = (payments: SalaryPayment[], payrollItemId: string) =>
  payments
    .filter((payment) => payment.payrollItemId === payrollItemId)
    .sort((left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime())[0] ?? null;

export const calculateBonusDeductionTotals = (
  baseItem: Pick<PayrollItem, "basicSalary" | "hra" | "allowancesTotal" | "deductionsTotal">,
  entries: BonusDeductionFormValues["entries"],
) => {
  const bonus = entries
    .filter((entry) => entry.type === "bonus")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const extraDeduction = entries
    .filter((entry) => entry.type === "deduction")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const gross =
    Number(baseItem.basicSalary) +
    Number(baseItem.hra) +
    Number(baseItem.allowancesTotal) +
    bonus;
  const deductions = Number(baseItem.deductionsTotal) + extraDeduction;

  return {
    bonus,
    deductions,
    net: gross - deductions,
    gross,
  };
};
