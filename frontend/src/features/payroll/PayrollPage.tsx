import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";

import { AmountText } from "../../components/ui/AmountText";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { bankApi } from "../../services/bankApi";
import { payrollApi } from "../../services/payrollApi";
import type { CompanyBankAccount } from "../../types/company";
import type {
  Attendance,
  Employee,
  PaginationMeta,
  PayrollItem,
  PayrollPaymentMode,
  PayrollRun,
  PayrollRunDetailResponse,
  SalarySlip,
} from "../../types/payroll";
import { saveDownloadedFile } from "../customers/customerUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { AttendanceBulkEntryDrawer } from "./components/AttendanceBulkEntryDrawer";
import { AttendanceTable, type AttendanceDraftMap } from "./components/AttendanceTable";
import { BonusDeductionDrawer } from "./components/BonusDeductionDrawer";
import { EmployeeDrawer } from "./components/EmployeeDrawer";
import { EmployeesTable } from "./components/EmployeesTable";
import { PayrollReportsView } from "./components/PayrollReportsView";
import { PayrollRunDrawer } from "./components/PayrollRunDrawer";
import { PayrollRunsTable } from "./components/PayrollRunsTable";
import { PayrollTabs } from "./components/PayrollTabs";
import { SalaryPaymentDrawer } from "./components/SalaryPaymentDrawer";
import { SalarySlipDrawer } from "./components/SalarySlipDrawer";
import { SalaryStructureDrawer } from "./components/SalaryStructureDrawer";
import {
  DEFAULT_PAYROLL_PAGE_SIZE,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  PAYROLL_ITEM_PAYMENT_STATUS_OPTIONS,
  PAYROLL_REPORT_OPTIONS,
  PAYROLL_RUN_STATUS_OPTIONS,
  PAYROLL_TAB_OPTIONS,
} from "./payrollOptions";
import {
  attendanceFormSchema,
  bonusDeductionFormSchema,
  payrollRunFormSchema,
  type BonusDeductionFormValues,
  type PayrollRunFormValues,
  type SalarySlipEmailFormValues,
} from "./payrollSchemas";
import {
  buildPayrollRunDefaults,
  filterEmployeesBySearch,
  filterPayrollItemsBySearch,
  formatMonthLabel,
  getCurrentPayrollMonth,
  getDepartmentOptions,
  getMonthBoundsForInput,
} from "./payrollUtils";

type PayrollTab = (typeof PAYROLL_TAB_OPTIONS)[number]["id"];
type ReportTab = (typeof PAYROLL_REPORT_OPTIONS)[number]["id"];
type EmployeeDrawerMode = "create" | "edit" | "view";

const getFirstAvailableTab = (tabs: PayrollTab[]) => tabs[0] ?? "employees";

const computeSummary = (rows: Array<Record<string, unknown>>) => {
  const metrics = new Map<string, number>();

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number") {
        metrics.set(key, (metrics.get(key) ?? 0) + value);
        continue;
      }

      if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
        metrics.set(key, (metrics.get(key) ?? 0) + Number(value));
      }
    }
  }

  return Array.from(metrics.entries())
    .slice(0, 4)
    .map(([label, value]) => ({ label, value: value.toFixed(2) }));
};

export const PayrollPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission(["payroll.view", "payroll.manage"]);
  const canManageEmployees = auth.hasPermission(["payroll.employee.manage", "payroll.manage"]);
  const canManageStructures = auth.hasPermission(["payroll.structure.manage", "payroll.manage"]);
  const canGenerate = auth.hasPermission(["payroll.generate", "payroll.manage"]);
  const canPay = auth.hasPermission(["payroll.pay", "payroll.manage"]);
  const canExport = auth.hasPermission(["payroll.export", "payroll.manage"]);
  const canPrintSlip = auth.hasPermission(["payroll.slip.print", "payroll.manage"]);

  const visibleTabs = useMemo(
    () =>
      PAYROLL_TAB_OPTIONS.filter((tab) => {
        if (tab.id === "employees") {
          return canView || canManageEmployees;
        }
        if (tab.id === "salary-structures") {
          return canView || canManageStructures;
        }
        if (tab.id === "attendance" || tab.id === "payroll-runs") {
          return canView || canGenerate || canPay;
        }
        if (tab.id === "salary-payments") {
          return canView || canPay;
        }
        if (tab.id === "salary-slips") {
          return canPrintSlip || canView;
        }
        return canView || canExport;
      }).map((tab) => tab.id),
    [canExport, canGenerate, canManageEmployees, canManageStructures, canPay, canPrintSlip, canView],
  );

  const requestedTab = (searchParams.get("tab") as PayrollTab | null) ?? null;
  const activeTab = visibleTabs.includes(requestedTab as PayrollTab) ? (requestedTab as PayrollTab) : getFirstAvailableTab(visibleTabs);

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", activeTab);
        return next;
      }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const [employeeLookup, setEmployeeLookup] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const debouncedEmployeeSearch = useDebouncedValue(employeeSearch, 350);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeFilters, setEmployeeFilters] = useState({
    status: "",
    department: "",
    employmentType: "",
  });
  const [employeesData, setEmployeesData] = useState<{ items: Employee[]; pagination: PaginationMeta } | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesRefreshKey, setEmployeesRefreshKey] = useState(0);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [employeeDrawerMode, setEmployeeDrawerMode] = useState<EmployeeDrawerMode>("create");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  const [structureEmployeeSearch, setStructureEmployeeSearch] = useState("");
  const [selectedStructureEmployee, setSelectedStructureEmployee] = useState<Employee | null>(null);
  const [salaryStructures, setSalaryStructures] = useState<import("../../types/payroll").SalaryStructure[]>([]);
  const [salaryStructuresLoading, setSalaryStructuresLoading] = useState(false);
  const [salaryStructureDrawerOpen, setSalaryStructureDrawerOpen] = useState(false);
  const [editingSalaryStructure, setEditingSalaryStructure] = useState<import("../../types/payroll").SalaryStructure | null>(null);
  const [salaryStructureSubmitting, setSalaryStructureSubmitting] = useState(false);

  const [attendanceFilters, setAttendanceFilters] = useState({
    month: getCurrentPayrollMonth(),
    employeeId: "",
    department: "",
  });
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceData, setAttendanceData] = useState<{ items: Attendance[]; pagination: PaginationMeta } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDrafts, setAttendanceDrafts] = useState<AttendanceDraftMap>({});
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [attendanceBulkOpen, setAttendanceBulkOpen] = useState(false);
  const [attendanceBulkSubmitting, setAttendanceBulkSubmitting] = useState(false);

  const [runFilters, setRunFilters] = useState({
    month: getCurrentPayrollMonth(),
    status: "",
  });
  const [runPage, setRunPage] = useState(1);
  const [runsData, setRunsData] = useState<{ items: PayrollRun[]; pagination: PaginationMeta } | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [createRunOpen, setCreateRunOpen] = useState(false);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runDetailId, setRunDetailId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<PayrollRunDetailResponse | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [generateRunTarget, setGenerateRunTarget] = useState<PayrollRun | null>(null);
  const [generatingRun, setGeneratingRun] = useState(false);
  const [cancelRunTarget, setCancelRunTarget] = useState<PayrollRun | null>(null);
  const [cancellingRun, setCancellingRun] = useState(false);
  const [cancelRunReason, setCancelRunReason] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const debouncedPaymentSearch = useDebouncedValue(paymentSearch, 350);
  const [paymentFilters, setPaymentFilters] = useState({
    month: getCurrentPayrollMonth(),
    paymentStatus: "",
    paymentMode: "",
    employeeId: "",
  });
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentsData, setPaymentsData] = useState<{ items: PayrollItem[]; pagination: PaginationMeta } | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);

  const [slipFilters, setSlipFilters] = useState({
    month: getCurrentPayrollMonth(),
    employeeId: "",
    department: "",
  });
  const [slipPage, setSlipPage] = useState(1);
  const [salarySlipsData, setSalarySlipsData] = useState<{ items: PayrollItem[]; pagination: PaginationMeta } | null>(null);
  const [salarySlipsLoading, setSalarySlipsLoading] = useState(false);
  const [salarySlipsRefreshKey, setSalarySlipsRefreshKey] = useState(0);

  const [paymentDrawerScope, setPaymentDrawerScope] = useState<
    | { type: "item"; item: PayrollItem }
    | { type: "run"; run: PayrollRun; items: PayrollItem[] }
    | null
  >(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [bonusDrawerItem, setBonusDrawerItem] = useState<PayrollItem | null>(null);
  const [bonusSubmitting, setBonusSubmitting] = useState(false);

  const [slipDrawerOpen, setSlipDrawerOpen] = useState(false);
  const [activeSlipItemId, setActiveSlipItemId] = useState<string | null>(null);
  const [activeSlip, setActiveSlip] = useState<SalarySlip | null>(null);
  const [slipLoading, setSlipLoading] = useState(false);
  const [slipDownloading, setSlipDownloading] = useState(false);
  const [slipEmailing, setSlipEmailing] = useState(false);

  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("monthly");
  const [reportFilters, setReportFilters] = useState({
    month: getCurrentPayrollMonth(),
    dateFrom: "",
    dateTo: "",
    employeeId: "",
    department: "",
    paymentMode: "" as PayrollPaymentMode | "",
    includeCancelled: false,
  });
  const [reportPagination, setReportPagination] = useState<PaginationMeta | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const [reportData, setReportData] = useState<Array<Record<string, unknown>>>([]);
  const [reportSummary, setReportSummary] = useState<Array<{ label: string; value: string | number }>>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  const runForm = useForm<z.input<typeof payrollRunFormSchema>, undefined, PayrollRunFormValues>({
    resolver: zodResolver(payrollRunFormSchema),
    defaultValues: buildPayrollRunDefaults(),
  });

  const structureEmployeeResults = useMemo(
    () => filterEmployeesBySearch(employeeLookup, structureEmployeeSearch),
    [employeeLookup, structureEmployeeSearch],
  );
  const departments = useMemo(() => getDepartmentOptions(employeeLookup), [employeeLookup]);
  const filteredPayments = useMemo(() => {
    const base = filterPayrollItemsBySearch(paymentsData?.items ?? [], debouncedPaymentSearch);
    return base.filter((item) => !paymentFilters.paymentMode || item.paymentMode === paymentFilters.paymentMode);
  }, [debouncedPaymentSearch, paymentFilters.paymentMode, paymentsData?.items]);
  const filteredSalarySlips = useMemo(
    () =>
      (salarySlipsData?.items ?? []).filter(
        (item) => !slipFilters.department || item.department === slipFilters.department,
      ),
    [salarySlipsData?.items, slipFilters.department],
  );

  const refreshEmployees = () => setEmployeesRefreshKey((value) => value + 1);
  const refreshAttendance = () => setAttendanceRefreshKey((value) => value + 1);
  const refreshRuns = () => setRunsRefreshKey((value) => value + 1);
  const refreshPayments = () => setPaymentsRefreshKey((value) => value + 1);
  const refreshSalarySlips = () => setSalarySlipsRefreshKey((value) => value + 1);

  const loadReferenceData = async () => {
    try {
      setReferenceLoading(true);
      const [employeesResult, banksResult] = await Promise.allSettled([
        payrollApi.listEmployees({ page: 1, limit: 100, status: "active" }),
        bankApi.list({ page: 1, limit: 100, isActive: true }),
      ]);

      setEmployeeLookup(employeesResult.status === "fulfilled" ? employeesResult.value.data.items : []);
      setBankAccounts(
        banksResult.status === "fulfilled" ? banksResult.value.data.items.filter((account) => account.isActive) : [],
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load payroll references"));
    } finally {
      setReferenceLoading(false);
    }
  };

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    if (activeTab !== "employees") {
      return;
    }

    const loadEmployees = async () => {
      try {
        setEmployeesLoading(true);
        const response = await payrollApi.listEmployees({
          page: employeePage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          search: debouncedEmployeeSearch || undefined,
          status: (employeeFilters.status || undefined) as never,
          department: employeeFilters.department || undefined,
          employmentType: (employeeFilters.employmentType || undefined) as never,
        });
        setEmployeesData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load employees"));
      } finally {
        setEmployeesLoading(false);
      }
    };

    void loadEmployees();
  }, [activeTab, debouncedEmployeeSearch, employeeFilters, employeePage, employeesRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "salary-structures" || !selectedStructureEmployee) {
      return;
    }

    const loadStructures = async () => {
      try {
        setSalaryStructuresLoading(true);
        const response = await payrollApi.listSalaryStructures(selectedStructureEmployee.id);
        setSalaryStructures(response.data.items);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load salary structures"));
      } finally {
        setSalaryStructuresLoading(false);
      }
    };

    void loadStructures();
  }, [activeTab, selectedStructureEmployee, toast]);

  useEffect(() => {
    if (activeTab !== "attendance") {
      return;
    }

    const loadAttendance = async () => {
      try {
        setAttendanceLoading(true);
        const response = await payrollApi.listAttendance({
          page: attendancePage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          month: attendanceFilters.month || undefined,
          employeeId: attendanceFilters.employeeId || undefined,
          department: attendanceFilters.department || undefined,
        });
        setAttendanceData(response.data);
        setAttendanceDrafts({});
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load attendance"));
      } finally {
        setAttendanceLoading(false);
      }
    };

    void loadAttendance();
  }, [activeTab, attendanceFilters, attendancePage, attendanceRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "payroll-runs") {
      return;
    }

    const loadRuns = async () => {
      try {
        setRunsLoading(true);
        const response = await payrollApi.listRuns({
          page: runPage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          month: runFilters.month || undefined,
          status: (runFilters.status || undefined) as never,
        });
        setRunsData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load payroll runs"));
      } finally {
        setRunsLoading(false);
      }
    };

    void loadRuns();
  }, [activeTab, runFilters, runPage, runsRefreshKey, toast]);

  useEffect(() => {
    if (!runDetailId) {
      return;
    }

    const loadRunDetail = async () => {
      try {
        setRunDetailLoading(true);
        const response = await payrollApi.getRun(runDetailId);
        setRunDetail(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load payroll run"));
        setRunDetailId(null);
      } finally {
        setRunDetailLoading(false);
      }
    };

    void loadRunDetail();
  }, [runDetailId, runsRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "salary-payments") {
      return;
    }

    const loadItems = async () => {
      try {
        setPaymentsLoading(true);
        const response = await payrollApi.listItems({
          page: paymentPage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          month: paymentFilters.month || undefined,
          employeeId: paymentFilters.employeeId || undefined,
          paymentStatus: (paymentFilters.paymentStatus || undefined) as never,
        });
        setPaymentsData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load salary payments"));
      } finally {
        setPaymentsLoading(false);
      }
    };

    void loadItems();
  }, [activeTab, paymentFilters, paymentPage, paymentsRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "salary-slips") {
      return;
    }

    const loadItems = async () => {
      try {
        setSalarySlipsLoading(true);
        const response = await payrollApi.listItems({
          page: slipPage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          month: slipFilters.month || undefined,
          employeeId: slipFilters.employeeId || undefined,
        });
        setSalarySlipsData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load salary slips"));
      } finally {
        setSalarySlipsLoading(false);
      }
    };

    void loadItems();
  }, [activeTab, slipFilters, slipPage, salarySlipsRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "reports") {
      return;
    }

    const loadReports = async () => {
      try {
        setReportsLoading(true);
        const query = {
          page: reportPage,
          limit: DEFAULT_PAYROLL_PAGE_SIZE,
          month: reportFilters.month || undefined,
          dateFrom: reportFilters.dateFrom || undefined,
          dateTo: reportFilters.dateTo || undefined,
          employeeId: reportFilters.employeeId || undefined,
          department: reportFilters.department || undefined,
          paymentMode: reportFilters.paymentMode || undefined,
          includeCancelled: reportFilters.includeCancelled,
        };

        if (activeReportTab === "monthly") {
          const response = await payrollApi.getMonthlyReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary(computeSummary(rows));
          setReportPagination(null);
        } else if (activeReportTab === "employee") {
          const response = await payrollApi.getEmployeeReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary(computeSummary(rows));
          setReportPagination(null);
        } else if (activeReportTab === "department") {
          const response = await payrollApi.getDepartmentReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary(computeSummary(rows));
          setReportPagination(null);
        } else if (activeReportTab === "bonus-deductions") {
          const response = await payrollApi.getBonusDeductionsReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary(computeSummary(rows));
          setReportPagination(null);
        } else if (activeReportTab === "payment") {
          const response = await payrollApi.getPaymentReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary([
            { label: "totalPayments", value: response.data.summary.totalPayments },
            { label: "totalAmount", value: response.data.summary.totalAmount },
          ]);
          setReportPagination(null);
        } else {
          const response = await payrollApi.getUnpaidReport(query);
          const rows = response.data.items.map((item) => ({ ...item }));
          setReportData(rows);
          setReportSummary(computeSummary(rows));
          setReportPagination(response.data.pagination);
        }
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load reports"));
      } finally {
        setReportsLoading(false);
      }
    };

    void loadReports();
  }, [activeReportTab, activeTab, reportFilters, reportPage, toast]);

  useEffect(() => {
    if (!activeSlipItemId) {
      return;
    }

    const loadSlip = async () => {
      try {
        setSlipLoading(true);
        const response = await payrollApi.getSlip(activeSlipItemId);
        setActiveSlip(response.data.slip);
        setSlipDrawerOpen(true);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load salary slip"));
        setActiveSlipItemId(null);
      } finally {
        setSlipLoading(false);
      }
    };

    void loadSlip();
  }, [activeSlipItemId, toast]);

  const handleEmployeeSubmit = async (payload: ReturnType<typeof import("./payrollUtils").mapEmployeeFormToPayload>) => {
    try {
      setEmployeeSubmitting(true);
      if (selectedEmployee && employeeDrawerMode === "edit") {
        await payrollApi.updateEmployee(selectedEmployee.id, payload);
        toast.success("Employee updated");
      } else {
        await payrollApi.createEmployee(payload);
        toast.success("Employee created");
      }

      setEmployeeDrawerOpen(false);
      setSelectedEmployee(null);
      refreshEmployees();
      await loadReferenceData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save employee"));
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleSalaryStructureSubmit = async (payload: ReturnType<typeof import("./payrollUtils").mapStructureFormToPayload>) => {
    if (!selectedStructureEmployee) {
      return;
    }

    try {
      setSalaryStructureSubmitting(true);
      if (editingSalaryStructure) {
        await payrollApi.updateSalaryStructure(selectedStructureEmployee.id, editingSalaryStructure.id, payload);
        toast.success("Salary structure updated");
      } else {
        await payrollApi.createSalaryStructure(selectedStructureEmployee.id, payload);
        toast.success("Salary structure created");
      }

      setSalaryStructureDrawerOpen(false);
      setEditingSalaryStructure(null);
      const response = await payrollApi.listSalaryStructures(selectedStructureEmployee.id);
      setSalaryStructures(response.data.items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save salary structure"));
    } finally {
      setSalaryStructureSubmitting(false);
    }
  };

  const handleAttendanceSave = async (attendance: Attendance) => {
    const parsed = attendanceFormSchema.safeParse({
      employeeId: attendance.employeeId,
      payrollMonth: attendance.payrollMonth,
      workingDays: attendanceDrafts[attendance.id]?.workingDays ?? attendance.workingDays,
      presentDays: attendanceDrafts[attendance.id]?.presentDays ?? attendance.presentDays,
      absentDays: attendance.absentDays,
      paidLeaveDays: attendanceDrafts[attendance.id]?.paidLeaveDays ?? attendance.paidLeaveDays,
      unpaidLeaveDays: attendanceDrafts[attendance.id]?.unpaidLeaveDays ?? attendance.unpaidLeaveDays,
      halfDays: attendanceDrafts[attendance.id]?.halfDays ?? attendance.halfDays,
      overtimeHours: attendanceDrafts[attendance.id]?.overtimeHours ?? attendance.overtimeHours,
      remarks: attendance.remarks,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid attendance");
      return;
    }

    try {
      await payrollApi.updateAttendance(attendance.id, {
        workingDays: parsed.data.workingDays,
        presentDays: parsed.data.presentDays,
        paidLeaveDays: parsed.data.paidLeaveDays,
        unpaidLeaveDays: parsed.data.unpaidLeaveDays,
        halfDays: parsed.data.halfDays,
        overtimeHours: parsed.data.overtimeHours,
      });
      toast.success("Attendance updated");
      refreshAttendance();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update attendance"));
    }
  };

  const handleBulkAttendanceSubmit = async (payloads: import("../../types/payroll").AttendancePayload[]) => {
    try {
      setAttendanceBulkSubmitting(true);
      for (const payload of payloads) {
        await payrollApi.createAttendance(payload);
      }
      toast.success("Attendance saved");
      setAttendanceBulkOpen(false);
      refreshAttendance();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save attendance"));
    } finally {
      setAttendanceBulkSubmitting(false);
    }
  };

  const handleCreateRun = async (values: PayrollRunFormValues) => {
    try {
      setRunSubmitting(true);
      await payrollApi.createRun({
        payrollMonth: values.payrollMonth,
        periodStart: values.periodStart || null,
        periodEnd: values.periodEnd || null,
        notes: values.notes || null,
      });
      toast.success("Payroll run created");
      setCreateRunOpen(false);
      runForm.reset(buildPayrollRunDefaults());
      refreshRuns();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create payroll run"));
    } finally {
      setRunSubmitting(false);
    }
  };

  const openSlip = (itemId: string) => {
    setActiveSlipItemId(itemId);
    setActiveSlip(null);
    setSlipDrawerOpen(true);
  };

  const handleDownloadSlip = async (itemId: string) => {
    try {
      setSlipDownloading(true);
      const response = await payrollApi.getSlipPdf(itemId);
      setActiveSlip(response.data.slip);
      setSlipDrawerOpen(true);
      if (!response.data.pdfAvailable) {
        toast.success("PDF is not available from backend. Opening salary slip preview.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load salary slip PDF"));
    } finally {
      setSlipDownloading(false);
    }
  };

  const handleEmailSlip = async (values: SalarySlipEmailFormValues) => {
    if (!activeSlipItemId) {
      return;
    }

    try {
      setSlipEmailing(true);
      const response = await payrollApi.emailSlip(activeSlipItemId, {
        email: values.email || null,
        subject: values.subject || null,
        message: values.message || null,
      });
      if (response.data.status === "sent") {
        toast.success("Salary slip emailed");
      } else {
        toast.error(response.data.errorMessage || "Salary slip email could not be sent");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to email salary slip"));
    } finally {
      setSlipEmailing(false);
    }
  };

  const handlePayItem = async (payload: import("../../types/payroll").PayPayrollItemPayload) => {
    if (paymentDrawerScope?.type !== "item") {
      return;
    }

    try {
      setPaymentSubmitting(true);
      await payrollApi.payItem(paymentDrawerScope.item.id, payload);
      toast.success("Salary payment recorded");
      setPaymentDrawerScope(null);
      refreshRuns();
      refreshPayments();
      refreshSalarySlips();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to record salary payment"));
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handlePayRun = async (payload: import("../../types/payroll").PayPayrollRunPayload) => {
    if (paymentDrawerScope?.type !== "run") {
      return;
    }

    try {
      setPaymentSubmitting(true);
      await payrollApi.payRun(paymentDrawerScope.run.id, payload);
      toast.success("Payroll payments recorded");
      setPaymentDrawerScope(null);
      refreshRuns();
      refreshPayments();
      refreshSalarySlips();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to record payroll payments"));
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleBonusSubmit = async (values: BonusDeductionFormValues) => {
    if (!bonusDrawerItem) {
      return;
    }

    const parsed = bonusDeductionFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid bonus or deduction entry");
      return;
    }

    try {
      setBonusSubmitting(true);
      await payrollApi.updateBonusDeductions(bonusDrawerItem.id, {
        entries: parsed.data.entries.map((entry) => ({
          type: entry.type,
          name: entry.name,
          amount: entry.amount,
          taxable: entry.taxable,
          notes: entry.notes || null,
        })),
      });
      toast.success("Payroll item updated");
      setBonusDrawerItem(null);
      refreshRuns();
      refreshPayments();
      refreshSalarySlips();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update payroll item"));
    } finally {
      setBonusSubmitting(false);
    }
  };

  const handleExportRun = async (run: PayrollRun) => {
    try {
      const file = await payrollApi.exportPayroll({
        page: 1,
        limit: 100,
        runId: run.id,
        format: "csv",
      });
      saveDownloadedFile(file.blob, file.fileName);
      toast.success("Payroll exported");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to export payroll run"));
    } finally {
    }
  };

  const handleReportExport = async () => {
    try {
      setExportingReport(true);
      const file = await payrollApi.exportPayroll({
        page: 1,
        limit: 100,
        month: reportFilters.month || undefined,
        employeeId: reportFilters.employeeId || undefined,
        department: reportFilters.department || undefined,
        format: "csv",
      });
      saveDownloadedFile(file.blob, file.fileName);
      toast.success("Report exported");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to export report"));
    } finally {
      setExportingReport(false);
    }
  };

  if (!canView && !canManageEmployees && !canManageStructures && !canGenerate && !canPay && !canPrintSlip) {
    return <EmptyState title="You do not have access to payroll." />;
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Payroll"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadReferenceData()} loading={referenceLoading}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
              {activeTab === "employees" && canManageEmployees ? (
                <Button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setEmployeeDrawerMode("create");
                    setEmployeeDrawerOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add Employee
                </Button>
              ) : null}
              {activeTab === "salary-structures" && canManageStructures && selectedStructureEmployee ? (
                <Button
                  onClick={() => {
                    setEditingSalaryStructure(null);
                    setSalaryStructureDrawerOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add Structure
                </Button>
              ) : null}
              {activeTab === "attendance" && canGenerate ? (
                <Button onClick={() => setAttendanceBulkOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Bulk Entry
                </Button>
              ) : null}
              {activeTab === "payroll-runs" && canGenerate ? (
                <Button
                  onClick={() => {
                    const defaults = buildPayrollRunDefaults();
                    runForm.reset(defaults);
                    setCreateRunOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Create Run
                </Button>
              ) : null}
              {activeTab === "reports" && canExport ? (
                <Button variant="secondary" loading={exportingReport} onClick={() => void handleReportExport()}>
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              ) : null}
            </div>
          }
        />

        <PayrollTabs
          tabs={PAYROLL_TAB_OPTIONS.filter((tab) => visibleTabs.includes(tab.id))}
          activeTab={activeTab}
          onChange={(tab) =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("tab", tab);
              return next;
            })
          }
        />

        {activeTab === "employees" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input
                  placeholder="Search name, mobile, email, employee code, department, designation"
                  value={employeeSearch}
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                    setEmployeePage(1);
                  }}
                />
                <Select
                  value={employeeFilters.status}
                  onChange={(event) => {
                    setEmployeeFilters((current) => ({ ...current, status: event.target.value }));
                    setEmployeePage(1);
                  }}
                >
                  <option value="">All status</option>
                  {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={employeeFilters.department}
                  onChange={(event) => {
                    setEmployeeFilters((current) => ({ ...current, department: event.target.value }));
                    setEmployeePage(1);
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
                <Select
                  value={employeeFilters.employmentType}
                  onChange={(event) => {
                    setEmployeeFilters((current) => ({ ...current, employmentType: event.target.value }));
                    setEmployeePage(1);
                  }}
                >
                  <option value="">All employment types</option>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEmployeeSearch("");
                      setEmployeeFilters({ status: "", department: "", employmentType: "" });
                      setEmployeePage(1);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
            <EmployeesTable
              items={employeesData?.items ?? []}
              pagination={employeesData?.pagination ?? null}
              loading={employeesLoading}
              canManage={canManageEmployees}
              onPageChange={setEmployeePage}
              onView={(employee) => {
                setSelectedEmployee(employee);
                setEmployeeDrawerMode("view");
                setEmployeeDrawerOpen(true);
              }}
              onEdit={(employee) => {
                setSelectedEmployee(employee);
                setEmployeeDrawerMode("edit");
                setEmployeeDrawerOpen(true);
              }}
              onDelete={setDeleteEmployeeTarget}
              onSalaryStructure={(employee) => {
                setSelectedStructureEmployee(employee);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("tab", "salary-structures");
                  return next;
                });
              }}
              onAttendance={(employee) => {
                setAttendanceFilters((current) => ({ ...current, employeeId: employee.id }));
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("tab", "attendance");
                  return next;
                });
              }}
              onPayrollHistory={(employee) => {
                setSlipFilters((current) => ({ ...current, employeeId: employee.id }));
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("tab", "salary-slips");
                  return next;
                });
              }}
            />
          </div>
        ) : null}

        {activeTab === "salary-structures" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="space-y-3">
                  <Input
                    placeholder="Search employee"
                    value={structureEmployeeSearch}
                    onChange={(event) => setStructureEmployeeSearch(event.target.value)}
                  />
                  <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
                    {structureEmployeeResults.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => setSelectedStructureEmployee(employee)}
                        className={`flex w-full items-start justify-between border-b border-slate-100 px-3 py-3 text-left last:border-b-0 ${selectedStructureEmployee?.id === employee.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{employee.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {employee.employeeCode} · {employee.department || "-"}
                          </p>
                        </div>
                        <StatusBadge status={employee.status} label={employee.status} />
                      </button>
                    ))}
                  </div>
                </div>

                {!selectedStructureEmployee ? (
                  <EmptyState title="Select an employee to view salary structures." />
                ) : salaryStructuresLoading ? (
                  <EmptyState title="Loading salary structures..." />
                ) : (
                  <TableWrapper>
                    <div className="overflow-x-auto">
                      <Table className="text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Employee</th>
                            <th className="px-4 py-3 font-semibold">Basic</th>
                            <th className="px-4 py-3 font-semibold">Gross</th>
                            <th className="px-4 py-3 font-semibold">Deductions</th>
                            <th className="px-4 py-3 font-semibold">Net</th>
                            <th className="px-4 py-3 font-semibold">Effective From</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {salaryStructures.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                                No salary structures found.
                              </td>
                            </tr>
                          ) : (
                            salaryStructures.map((structure) => (
                              <tr key={structure.id}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-900">{selectedStructureEmployee.fullName}</div>
                                  <div className="text-xs text-slate-500">{selectedStructureEmployee.employeeCode}</div>
                                </td>
                                <td className="px-4 py-3"><AmountText value={structure.basicSalary} tone="default" /></td>
                                <td className="px-4 py-3"><AmountText value={structure.grossSalary} tone="default" /></td>
                                <td className="px-4 py-3"><AmountText value={structure.totalDeductions} tone="default" /></td>
                                <td className="px-4 py-3"><AmountText value={structure.netSalary} tone="default" /></td>
                                <td className="px-4 py-3 text-slate-600">{structure.effectiveFrom.slice(0, 10)}</td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={structure.isActive ? "active" : "inactive"} label={structure.isActive ? "Active" : "Inactive"} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {canManageStructures ? (
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setEditingSalaryStructure(structure);
                                        setSalaryStructureDrawerOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input
                  type="month"
                  value={attendanceFilters.month}
                  onChange={(event) => {
                    setAttendanceFilters((current) => ({ ...current, month: event.target.value }));
                    setAttendancePage(1);
                  }}
                />
                <Select
                  value={attendanceFilters.employeeId}
                  onChange={(event) => {
                    setAttendanceFilters((current) => ({ ...current, employeeId: event.target.value }));
                    setAttendancePage(1);
                  }}
                >
                  <option value="">All employees</option>
                  {employeeLookup.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
                <Select
                  value={attendanceFilters.department}
                  onChange={(event) => {
                    setAttendanceFilters((current) => ({ ...current, department: event.target.value }));
                    setAttendancePage(1);
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
                <div className="flex justify-end xl:col-span-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAttendanceFilters({ month: getCurrentPayrollMonth(), employeeId: "", department: "" });
                      setAttendancePage(1);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
            <AttendanceTable
              items={attendanceData?.items ?? []}
              pagination={attendanceData?.pagination ?? null}
              loading={attendanceLoading}
              drafts={attendanceDrafts}
              canEdit={canGenerate}
              onFieldChange={(attendanceId, field, value) =>
                setAttendanceDrafts((current) => ({
                  ...current,
                  [attendanceId]: { ...current[attendanceId], [field]: value },
                }))
              }
              onSave={handleAttendanceSave}
              onPageChange={setAttendancePage}
            />
          </div>
        ) : null}

        {activeTab === "payroll-runs" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  type="month"
                  value={runFilters.month}
                  onChange={(event) => {
                    setRunFilters((current) => ({ ...current, month: event.target.value }));
                    setRunPage(1);
                  }}
                />
                <Select
                  value={runFilters.status}
                  onChange={(event) => {
                    setRunFilters((current) => ({ ...current, status: event.target.value }));
                    setRunPage(1);
                  }}
                >
                  <option value="">All status</option>
                  {PAYROLL_RUN_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRunFilters({ month: getCurrentPayrollMonth(), status: "" });
                      setRunPage(1);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
            <PayrollRunsTable
              items={runsData?.items ?? []}
              pagination={runsData?.pagination ?? null}
              loading={runsLoading}
              canGenerate={canGenerate}
              canPay={canPay}
              canExport={canExport}
              onPageChange={setRunPage}
              onView={(run) => {
                setRunDetailId(run.id);
                setRunDetail(null);
              }}
              onGenerate={setGenerateRunTarget}
              onPay={(run) =>
                setPaymentDrawerScope({
                  type: "run",
                  run,
                  items: runDetail?.run.id === run.id ? runDetail.items : [],
                })
              }
              onCancel={setCancelRunTarget}
              onExport={(run) => void handleExportRun(run)}
            />
          </div>
        ) : null}

        {activeTab === "salary-payments" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input
                  placeholder="Search employee, run, reference"
                  value={paymentSearch}
                  onChange={(event) => {
                    setPaymentSearch(event.target.value);
                    setPaymentPage(1);
                  }}
                />
                <Input
                  type="month"
                  value={paymentFilters.month}
                  onChange={(event) => {
                    setPaymentFilters((current) => ({ ...current, month: event.target.value }));
                    setPaymentPage(1);
                  }}
                />
                <Select
                  value={paymentFilters.paymentStatus}
                  onChange={(event) => {
                    setPaymentFilters((current) => ({ ...current, paymentStatus: event.target.value }));
                    setPaymentPage(1);
                  }}
                >
                  <option value="">All payment status</option>
                  {PAYROLL_ITEM_PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={paymentFilters.employeeId}
                  onChange={(event) => {
                    setPaymentFilters((current) => ({ ...current, employeeId: event.target.value }));
                    setPaymentPage(1);
                  }}
                >
                  <option value="">All employees</option>
                  {employeeLookup.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
                <Select
                  value={paymentFilters.paymentMode}
                  onChange={(event) => setPaymentFilters((current) => ({ ...current, paymentMode: event.target.value }))}
                >
                  <option value="">All modes</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </Select>
              </CardContent>
            </Card>

            <TableWrapper>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Payroll Run</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Paid Date</th>
                      <th className="px-4 py-3 font-semibold">Mode</th>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentsLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                          Loading salary payments...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                          No salary payment records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{item.employeeName}</div>
                            <div className="text-xs text-slate-500">{item.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.run?.runNumber || "-"}</td>
                          <td className="px-4 py-3"><AmountText value={item.netSalary} tone="default" /></td>
                          <td className="px-4 py-3 text-slate-600">{item.paidAt ? item.paidAt.slice(0, 10) : "-"}</td>
                          <td className="px-4 py-3 capitalize text-slate-600">{item.paymentMode || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{item.paymentReference || "-"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.paymentStatus} label={item.paymentStatus} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  if (item.run?.id) {
                                    setRunDetailId(item.run.id);
                                    setRunDetail(null);
                                  }
                                }}
                              >
                                View
                              </Button>
                              {canPay ? (
                                <Button variant="secondary" onClick={() => setPaymentDrawerScope({ type: "item", item })}>
                                  Pay
                                </Button>
                              ) : null}
                              {canPrintSlip ? (
                                <Button variant="secondary" onClick={() => openSlip(item.id)}>
                                  Slip
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </TableWrapper>
          </div>
        ) : null}

        {activeTab === "salary-slips" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  type="month"
                  value={slipFilters.month}
                  onChange={(event) => {
                    setSlipFilters((current) => ({ ...current, month: event.target.value }));
                    setSlipPage(1);
                  }}
                />
                <Select
                  value={slipFilters.employeeId}
                  onChange={(event) => {
                    setSlipFilters((current) => ({ ...current, employeeId: event.target.value }));
                    setSlipPage(1);
                  }}
                >
                  <option value="">All employees</option>
                  {employeeLookup.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
                <Select
                  value={slipFilters.department}
                  onChange={(event) => {
                    setSlipFilters((current) => ({ ...current, department: event.target.value }));
                    setSlipPage(1);
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSlipFilters({ month: getCurrentPayrollMonth(), employeeId: "", department: "" });
                      setSlipPage(1);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            <TableWrapper>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Payroll Month</th>
                      <th className="px-4 py-3 font-semibold">Net Salary</th>
                      <th className="px-4 py-3 font-semibold">Payment Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salarySlipsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                          Loading salary slips...
                        </td>
                      </tr>
                    ) : filteredSalarySlips.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                          No salary slips found.
                        </td>
                      </tr>
                    ) : (
                      filteredSalarySlips.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{item.employeeName}</div>
                            <div className="text-xs text-slate-500">{item.department || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatMonthLabel(item.run?.payrollMonth || slipFilters.month)}</td>
                          <td className="px-4 py-3"><AmountText value={item.netSalary} tone="default" /></td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.paymentStatus} label={item.paymentStatus} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => openSlip(item.id)}>
                                View Slip
                              </Button>
                              <Button variant="secondary" onClick={() => void handleDownloadSlip(item.id)}>
                                PDF
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  openSlip(item.id);
                                }}
                              >
                                Email
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </TableWrapper>
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <PayrollReportsView
            activeTab={activeReportTab}
            employees={employeeLookup}
            departments={departments}
            filters={reportFilters}
            loading={reportsLoading}
            summary={reportSummary}
            data={reportData}
            pagination={reportPagination}
            onTabChange={(tab) => {
              setActiveReportTab(tab);
              setReportPage(1);
            }}
            onFiltersChange={(updates) => {
              setReportFilters((current) => ({ ...current, ...updates }));
              setReportPage(1);
            }}
            onResetFilters={() => {
              setReportFilters({
                month: getCurrentPayrollMonth(),
                dateFrom: "",
                dateTo: "",
                employeeId: "",
                department: "",
                paymentMode: "",
                includeCancelled: false,
              });
              setReportPage(1);
            }}
            onExport={() => void handleReportExport()}
            onPageChange={setReportPage}
          />
        ) : null}
      </div>

      <EmployeeDrawer
        open={employeeDrawerOpen}
        employee={selectedEmployee}
        mode={employeeDrawerMode}
        submitting={employeeSubmitting}
        onClose={() => {
          setEmployeeDrawerOpen(false);
          setSelectedEmployee(null);
        }}
        onSubmit={handleEmployeeSubmit}
      />

      <SalaryStructureDrawer
        open={salaryStructureDrawerOpen}
        employee={selectedStructureEmployee}
        structure={editingSalaryStructure}
        submitting={salaryStructureSubmitting}
        onClose={() => {
          setSalaryStructureDrawerOpen(false);
          setEditingSalaryStructure(null);
        }}
        onSubmit={handleSalaryStructureSubmit}
      />

      <AttendanceBulkEntryDrawer
        open={attendanceBulkOpen}
        employees={employeeLookup}
        departments={departments}
        submitting={attendanceBulkSubmitting}
        defaultMonth={attendanceFilters.month}
        onClose={() => setAttendanceBulkOpen(false)}
        onSubmit={handleBulkAttendanceSubmit}
      />

      <PayrollRunDrawer
        open={Boolean(runDetailId) || runDetailLoading}
        detail={runDetail}
        loading={runDetailLoading}
        canPay={canPay}
        canAdjust={canGenerate}
        canPrint={canPrintSlip}
        onClose={() => {
          setRunDetailId(null);
          setRunDetail(null);
        }}
        onPayItem={(item) => setPaymentDrawerScope({ type: "item", item })}
        onAdjustItem={setBonusDrawerItem}
        onSlip={(item) => openSlip(item.id)}
        onPdf={(item) => void handleDownloadSlip(item.id)}
        onEmail={(item) => openSlip(item.id)}
      />

      <BonusDeductionDrawer
        open={Boolean(bonusDrawerItem)}
        item={bonusDrawerItem}
        submitting={bonusSubmitting}
        onClose={() => setBonusDrawerItem(null)}
        onSubmit={handleBonusSubmit}
      />

      <SalaryPaymentDrawer
        open={Boolean(paymentDrawerScope)}
        scope={paymentDrawerScope}
        bankAccounts={bankAccounts}
        submitting={paymentSubmitting}
        onClose={() => setPaymentDrawerScope(null)}
        onPayItem={handlePayItem}
        onPayRun={handlePayRun}
      />

      <SalarySlipDrawer
        open={slipDrawerOpen}
        slip={activeSlip}
        loading={slipLoading}
        downloading={slipDownloading}
        emailing={slipEmailing}
        onClose={() => {
          setSlipDrawerOpen(false);
          setActiveSlipItemId(null);
          setActiveSlip(null);
        }}
        onDownloadPdf={() => {
          if (activeSlipItemId) {
            void handleDownloadSlip(activeSlipItemId);
          }
        }}
        onEmail={handleEmailSlip}
      />

      <ConfirmDialog
        open={Boolean(deleteEmployeeTarget)}
        onClose={() => setDeleteEmployeeTarget(null)}
        loading={deletingEmployee}
        title="Deactivate Employee"
        description={deleteEmployeeTarget ? `Deactivate ${deleteEmployeeTarget.fullName}?` : "Deactivate employee?"}
        onConfirm={async () => {
          if (!deleteEmployeeTarget) {
            return;
          }

          try {
            setDeletingEmployee(true);
            await payrollApi.deleteEmployee(deleteEmployeeTarget.id);
            toast.success("Employee deactivated");
            setDeleteEmployeeTarget(null);
            refreshEmployees();
            await loadReferenceData();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to deactivate employee"));
          } finally {
            setDeletingEmployee(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(generateRunTarget)}
        onClose={() => setGenerateRunTarget(null)}
        loading={generatingRun}
        title="Generate Payroll"
        description={generateRunTarget ? `Generate payroll for ${formatMonthLabel(generateRunTarget.payrollMonth)}?` : "Generate payroll?"}
        tone="primary"
        onConfirm={async () => {
          if (!generateRunTarget) {
            return;
          }

          try {
            setGeneratingRun(true);
            await payrollApi.generateRun(generateRunTarget.id);
            toast.success("Payroll generated");
            setGenerateRunTarget(null);
            refreshRuns();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to generate payroll"));
          } finally {
            setGeneratingRun(false);
          }
        }}
      />

      <Modal
        open={createRunOpen}
        onClose={() => setCreateRunOpen(false)}
        title="Create Payroll Run"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateRunOpen(false)}>
              Cancel
            </Button>
            <Button loading={runSubmitting} onClick={runForm.handleSubmit(handleCreateRun)}>
              Create Run
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            type="month"
            label="Payroll Month"
            {...runForm.register("payrollMonth")}
            error={runForm.formState.errors.payrollMonth?.message}
            onChange={(event) => {
              runForm.setValue("payrollMonth", event.target.value);
              const bounds = getMonthBoundsForInput(event.target.value);
              runForm.setValue("periodStart", bounds.periodStart);
              runForm.setValue("periodEnd", bounds.periodEnd);
            }}
          />
          <Input
            type="date"
            label="Period Start"
            {...runForm.register("periodStart")}
            error={runForm.formState.errors.periodStart?.message}
          />
          <Input
            type="date"
            label="Period End"
            {...runForm.register("periodEnd")}
            error={runForm.formState.errors.periodEnd?.message}
          />
          <div className="md:col-span-2">
            <Textarea label="Notes" rows={3} {...runForm.register("notes")} error={runForm.formState.errors.notes?.message} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelRunTarget)}
        onClose={() => setCancelRunTarget(null)}
        title={cancelRunTarget ? `Cancel ${cancelRunTarget.runNumber}` : "Cancel Payroll Run"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelRunTarget(null)}>
              Close
            </Button>
            <Button
              variant="danger"
              loading={cancellingRun}
              onClick={async () => {
                if (!cancelRunTarget || cancelRunReason.trim().length < 3) {
                  toast.error("Enter a valid cancellation reason");
                  return;
                }

                try {
                  setCancellingRun(true);
                  await payrollApi.cancelRun(cancelRunTarget.id, { cancellationReason: cancelRunReason.trim() });
                  toast.success("Payroll run cancelled");
                  setCancelRunTarget(null);
                  setCancelRunReason("");
                  refreshRuns();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to cancel payroll run"));
                } finally {
                  setCancellingRun(false);
                }
              }}
            >
              Cancel Run
            </Button>
          </>
        }
      >
        <Textarea label="Cancellation Reason" rows={4} value={cancelRunReason} onChange={(event) => setCancelRunReason(event.target.value)} />
      </Modal>
    </>
  );
};
