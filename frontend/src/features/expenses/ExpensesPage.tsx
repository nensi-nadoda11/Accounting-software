import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { accountingApi } from "../../services/accountingApi";
import { bankApi } from "../../services/bankApi";
import { companyApi } from "../../services/companyApi";
import { expensesApi } from "../../services/expensesApi";
import type { Account } from "../../types/accounting";
import type { CompanyBankAccount, CompanyTaxSettings } from "../../types/company";
import type {
  CategoryWiseExpenseReportRow,
  Expense,
  ExpenseCategory,
  ExpenseDetailResponse,
  ExpenseFiltersQuery,
  ExpenseFormInput,
  ExpenseListResponse,
  GstExpenseReportRow,
  MonthlyExpenseReportRow,
  PaymentModeExpenseReportRow,
  RecurringExpense,
  RecurringExpenseListResponse,
} from "../../types/expense";
import { saveDownloadedFile } from "../customers/customerUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import {
  DEFAULT_EXPENSE_PAGE_SIZE,
  EXPENSE_PAYMENT_MODE_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  EXPENSE_TABS,
} from "./expenseOptions";
import {
  expenseCancelSchema,
  type ExpenseCancelInputValues,
  type ExpenseCancelValues,
  type ExpenseCategoryValues,
  type RecurringExpenseValues,
} from "./expenseSchemas";
import {
  buildExpenseFormDefaults,
  downloadLocalPdfTable,
  buildPrintWindow,
  createExpensePayload,
  createRecurringPayload,
  getCategoryName,
  getMonthStartInput,
  getTodayInput,
  sumExpenseTotals,
} from "./expenseUtils";
import { ExpenseAttachmentUploader } from "./components/ExpenseAttachmentUploader";
import { ExpenseCategoryDrawer } from "./components/ExpenseCategoryDrawer";
import { ExpenseCategoriesTable } from "./components/ExpenseCategoriesTable";
import { ExpenseDetailDrawer } from "./components/ExpenseDetailDrawer";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseReportsView } from "./components/ExpenseReportsView";
import { ExpenseTabs } from "./components/ExpenseTabs";
import { ExpensesTable } from "./components/ExpensesTable";
import { RecurringExpenseDrawer } from "./components/RecurringExpenseDrawer";
import { RecurringExpensesTable } from "./components/RecurringExpensesTable";

type ExpenseTab = (typeof EXPENSE_TABS)[number]["id"];
type ReportTab = "category-wise" | "monthly" | "payment-mode" | "gst";
type UploadingFile = { id: string; file: File; progress: number };

const getFirstAvailableTab = (tabs: ExpenseTab[]) => tabs[0] ?? "expenses";

export const ExpensesPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission("expense.view");
  const canCreate = auth.hasPermission("expense.create");
  const canUpdate = auth.hasPermission("expense.update");
  const canDelete = auth.hasPermission("expense.delete");
  const canPost = auth.hasPermission("expense.post");
  const canExport = auth.hasPermission("expense.export");
  const canManageCategories = auth.hasPermission("expense.category.manage");
  const canManageRecurring = auth.hasPermission("expense.recurring.manage");

  const visibleTabs = useMemo(
    () =>
      EXPENSE_TABS.filter((tab) => {
        if (tab.id === "add") {
          return canCreate || canUpdate;
        }

        if (tab.id === "categories") {
          return canView || canManageCategories;
        }

        if (tab.id === "recurring") {
          return canView || canManageRecurring;
        }

        return canView;
      }).map((tab) => tab.id),
    [canCreate, canManageCategories, canManageRecurring, canUpdate, canView],
  );

  const requestedTab = (searchParams.get("tab") as ExpenseTab | null) ?? null;
  const activeTab = visibleTabs.includes(requestedTab as ExpenseTab) ? (requestedTab as ExpenseTab) : getFirstAvailableTab(visibleTabs);

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", activeTab);
        return next;
      }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const [taxSettings, setTaxSettings] = useState<CompanyTaxSettings | null>(null);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [categoryLookup, setCategoryLookup] = useState<ExpenseCategory[]>([]);
  const [recurringLookup, setRecurringLookup] = useState<RecurringExpense[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);

  const [expensesSearch, setExpensesSearch] = useState("");
  const debouncedExpensesSearch = useDebouncedValue(expensesSearch, 350);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesFilters, setExpensesFilters] = useState<{
    categoryId: string;
    paymentMode: string;
    status: string;
    gstApplicable: "" | "true" | "false";
    dateFrom: string;
    dateTo: string;
    recurringExpenseId: string;
  }>({
    categoryId: "",
    paymentMode: "",
    status: "",
    gstApplicable: "",
    dateFrom: getMonthStartInput(),
    dateTo: getTodayInput(),
    recurringExpenseId: "",
  });
  const [expensesData, setExpensesData] = useState<ExpenseListResponse | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesRefreshKey, setExpensesRefreshKey] = useState(0);
  const [exportingList, setExportingList] = useState(false);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseSubmitState, setExpenseSubmitState] = useState<"draft" | "posted" | null>(null);
  const [formUploadingFiles, setFormUploadingFiles] = useState<UploadingFile[]>([]);

  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUploadingFiles, setDetailUploadingFiles] = useState<UploadingFile[]>([]);

  const [postExpenseId, setPostExpenseId] = useState<string | null>(null);
  const [postingExpense, setPostingExpense] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [cancelExpenseTarget, setCancelExpenseTarget] = useState<Expense | null>(null);
  const [cancellingExpense, setCancellingExpense] = useState(false);
  const cancelForm = useForm<ExpenseCancelInputValues, undefined, ExpenseCancelValues>({
    resolver: zodResolver(expenseCancelSchema),
    defaultValues: { cancellationReason: "" },
  });

  const [categorySearch, setCategorySearch] = useState("");
  const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);
  const [categoryStatus, setCategoryStatus] = useState("");
  const [categoriesData, setCategoriesData] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<ExpenseCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const [recurringSearch, setRecurringSearch] = useState("");
  const debouncedRecurringSearch = useDebouncedValue(recurringSearch, 300);
  const [recurringPage, setRecurringPage] = useState(1);
  const [recurringFilters, setRecurringFilters] = useState<{
    status: string;
    frequency: string;
    dateFrom: string;
    dateTo: string;
  }>({
    status: "",
    frequency: "",
    dateFrom: getMonthStartInput(),
    dateTo: getTodayInput(),
  });
  const [recurringData, setRecurringData] = useState<RecurringExpenseListResponse | null>(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringRefreshKey, setRecurringRefreshKey] = useState(0);
  const [recurringDrawerOpen, setRecurringDrawerOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [runningDueRecurring, setRunningDueRecurring] = useState(false);

  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("category-wise");
  const [reportFilters, setReportFilters] = useState({
    dateFrom: getMonthStartInput(),
    dateTo: getTodayInput(),
    categoryId: "",
    paymentMode: "",
    includeDrafts: false,
  });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [categoryWiseReport, setCategoryWiseReport] = useState<CategoryWiseExpenseReportRow[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyExpenseReportRow[]>([]);
  const [paymentModeReport, setPaymentModeReport] = useState<PaymentModeExpenseReportRow[]>([]);
  const [gstReport, setGstReport] = useState<GstExpenseReportRow[]>([]);

  const reportsSummary = useMemo(() => {
    const items =
      activeReportTab === "category-wise"
        ? categoryWiseReport
        : activeReportTab === "monthly"
          ? monthlyReport
          : activeReportTab === "payment-mode"
            ? paymentModeReport
            : gstReport;

    return sumExpenseTotals(items);
  }, [activeReportTab, categoryWiseReport, gstReport, monthlyReport, paymentModeReport]);

  const refreshExpenses = () => setExpensesRefreshKey((value) => value + 1);
  const refreshCategories = () => setCategoriesRefreshKey((value) => value + 1);
  const refreshRecurring = () => setRecurringRefreshKey((value) => value + 1);

  const buildExpensesQuery = (): ExpenseFiltersQuery => ({
    page: expensesPage,
    limit: DEFAULT_EXPENSE_PAGE_SIZE,
    search: debouncedExpensesSearch || undefined,
    categoryId: expensesFilters.categoryId || undefined,
    paymentMode: expensesFilters.paymentMode as ExpenseFiltersQuery["paymentMode"],
    status: expensesFilters.status as ExpenseFiltersQuery["status"],
    gstApplicable:
      expensesFilters.gstApplicable === ""
        ? undefined
        : expensesFilters.gstApplicable === "true",
    dateFrom: expensesFilters.dateFrom || undefined,
    dateTo: expensesFilters.dateTo || undefined,
    recurringExpenseId: expensesFilters.recurringExpenseId || undefined,
  });

  const loadCategoryLookup = async () => {
    if (!canView && !canManageCategories) {
      return;
    }

    const response = await expensesApi.listCategories({});
    setCategoryLookup(response.data.items);
  };

  const loadRecurringLookup = async () => {
    if (!canView && !canManageRecurring) {
      return;
    }

    const response = await expensesApi.listRecurring({
      page: 1,
      limit: 100,
    });
    setRecurringLookup(response.data.items);
  };

  const loadReferences = async () => {
    try {
      setReferencesLoading(true);
      const [taxResult, banksResult, accountsResult] = await Promise.allSettled([
        companyApi.getTaxSettings(),
        bankApi.list({ page: 1, limit: 100, isActive: true }),
        accountingApi.listAccounts({
          page: 1,
          limit: 200,
          type: "expense",
          status: "active",
          hierarchy: false,
        }),
      ]);

      setTaxSettings(taxResult.status === "fulfilled" ? taxResult.value.data : null);
      setBankAccounts(banksResult.status === "fulfilled" ? banksResult.value.data.items.filter((item) => item.isActive) : []);
      setExpenseAccounts(accountsResult.status === "fulfilled" ? accountsResult.value.data.items : []);

      await Promise.all([loadCategoryLookup(), loadRecurringLookup()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load expense references"));
    } finally {
      setReferencesLoading(false);
    }
  };

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    if (activeTab !== "expenses") {
      return;
    }

    const loadExpenses = async () => {
      try {
        setExpensesLoading(true);
        const response = await expensesApi.list(buildExpensesQuery());
        setExpensesData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load expenses"));
      } finally {
        setExpensesLoading(false);
      }
    };

    void loadExpenses();
  }, [activeTab, debouncedExpensesSearch, expensesFilters, expensesPage, expensesRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "categories") {
      return;
    }

    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await expensesApi.listCategories({
          search: debouncedCategorySearch || undefined,
          status: categoryStatus as never,
        });
        setCategoriesData(response.data.items);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load categories"));
      } finally {
        setCategoriesLoading(false);
      }
    };

    void loadCategories();
  }, [activeTab, categoryStatus, categoriesRefreshKey, debouncedCategorySearch, toast]);

  useEffect(() => {
    if (activeTab !== "recurring") {
      return;
    }

    const loadRecurring = async () => {
      try {
        setRecurringLoading(true);
        const response = await expensesApi.listRecurring({
          page: recurringPage,
          limit: DEFAULT_EXPENSE_PAGE_SIZE,
          search: debouncedRecurringSearch || undefined,
          status: recurringFilters.status as never,
          frequency: recurringFilters.frequency as never,
          dateFrom: recurringFilters.dateFrom || undefined,
          dateTo: recurringFilters.dateTo || undefined,
        });
        setRecurringData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load recurring expenses"));
      } finally {
        setRecurringLoading(false);
      }
    };

    void loadRecurring();
  }, [activeTab, debouncedRecurringSearch, recurringFilters, recurringPage, recurringRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "reports") {
      return;
    }

    const loadReports = async () => {
      try {
        setReportsLoading(true);
        const query = {
          dateFrom: reportFilters.dateFrom || undefined,
          dateTo: reportFilters.dateTo || undefined,
          categoryId: reportFilters.categoryId || undefined,
          paymentMode: reportFilters.paymentMode as never,
          includeDrafts: reportFilters.includeDrafts,
        };

        if (activeReportTab === "category-wise") {
          const response = await expensesApi.getCategoryWiseReport(query);
          setCategoryWiseReport(response.data.items);
        } else if (activeReportTab === "monthly") {
          const response = await expensesApi.getMonthlyReport(query);
          setMonthlyReport(response.data.items);
        } else if (activeReportTab === "payment-mode") {
          const response = await expensesApi.getPaymentModeReport(query);
          setPaymentModeReport(response.data.items);
        } else {
          const response = await expensesApi.getGstReport(query);
          setGstReport(response.data.items);
        }
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load reports"));
      } finally {
        setReportsLoading(false);
      }
    };

    void loadReports();
  }, [activeReportTab, activeTab, reportFilters, toast]);

  useEffect(() => {
    if (!detailExpenseId) {
      return;
    }

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const response = await expensesApi.get(detailExpenseId);
        setDetailExpense(response.data.expense);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load expense"));
        setDetailExpenseId(null);
      } finally {
        setDetailLoading(false);
      }
    };

    void loadDetail();
  }, [detailExpenseId, toast]);

  const loadExpenseForEdit = async (expenseId: string) => {
    try {
      const response = await expensesApi.get(expenseId);
      setEditingExpense(response.data.expense);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", "add");
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load expense draft"));
    }
  };

  const syncExpenseEverywhere = (expense: Expense) => {
    setEditingExpense((current) => (current?.id === expense.id ? expense : current));
    setDetailExpense((current) => (current?.id === expense.id ? expense : current));
    refreshExpenses();
  };

  const handleUploadForTarget = async (
    expenseId: string,
    files: File[],
    setUploads: (value: UploadingFile[] | ((current: UploadingFile[]) => UploadingFile[])) => void,
  ) => {
    const entries = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
    }));

    setUploads(entries);

    try {
      await expensesApi.uploadAttachments(expenseId, files, (progress) => {
        setUploads((current) => current.map((item) => ({ ...item, progress })));
      });

      const response = await expensesApi.get(expenseId);
      setEditingExpense((current) => (current?.id === expenseId ? response.data.expense : current));
      setDetailExpense((current) => (current?.id === expenseId ? response.data.expense : current));
      toast.success("Attachments uploaded");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload attachments"));
    } finally {
      setUploads([]);
    }
  };

  const handleRemoveAttachment = async (expenseId: string, attachmentId: string) => {
    try {
      await expensesApi.removeAttachment(expenseId, attachmentId);
      const response = await expensesApi.get(expenseId);
      setEditingExpense((current) => (current?.id === expenseId ? response.data.expense : current));
      setDetailExpense((current) => (current?.id === expenseId ? response.data.expense : current));
      toast.success("Attachment removed");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove attachment"));
    }
  };

  const handleExpenseSubmit = async (values: ExpenseFormInput, status: "draft" | "posted") => {
    try {
      setExpenseSubmitState(status);
      if (editingExpense) {
        const updatePayload = createExpensePayload(values, "draft");
        const updateResponse = await expensesApi.update(editingExpense.id, updatePayload);
        let finalExpense = updateResponse.data.expense;

        if (status === "posted") {
          const postResponse = await expensesApi.post(editingExpense.id);
          finalExpense = postResponse.data.expense;
        }

        toast.success(status === "posted" ? "Expense updated and posted" : "Expense draft updated");
        syncExpenseEverywhere(finalExpense);
        if (status === "posted") {
          setEditingExpense(null);
          setDetailExpenseId(finalExpense.id);
          setDetailExpense(finalExpense);
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set("tab", "expenses");
            return next;
          });
        } else {
          setEditingExpense(finalExpense);
        }
      } else {
        const response = await expensesApi.create(createExpensePayload(values, status));
        const createdExpense = response.data.expense;
        toast.success(status === "posted" ? "Expense created and posted" : "Expense draft created");
        refreshExpenses();
        if (status === "posted") {
          setEditingExpense(null);
          setDetailExpenseId(createdExpense.id);
          setDetailExpense(createdExpense);
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set("tab", "expenses");
            return next;
          });
        } else {
          setEditingExpense(createdExpense);
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save expense"));
    } finally {
      setExpenseSubmitState(null);
    }
  };

  const handlePostExpense = async (expenseId: string) => {
    try {
      setPostingExpense(true);
      const response = await expensesApi.post(expenseId);
      toast.success("Expense posted");
      setPostExpenseId(null);
      syncExpenseEverywhere(response.data.expense);
      setDetailExpense(response.data.expense);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to post expense"));
    } finally {
      setPostingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      setDeletingExpense(true);
      await expensesApi.remove(expenseId);
      toast.success("Expense deleted");
      setDeleteExpenseId(null);
      if (editingExpense?.id === expenseId) {
        setEditingExpense(null);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set("tab", "expenses");
          return next;
        });
      }
      if (detailExpense?.id === expenseId) {
        setDetailExpense(null);
        setDetailExpenseId(null);
      }
      refreshExpenses();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete expense"));
    } finally {
      setDeletingExpense(false);
    }
  };

  const handleCategorySubmit = async (values: ExpenseCategoryValues) => {
    try {
      setCategorySubmitting(true);
      if (categoryEditing) {
        await expensesApi.updateCategory(categoryEditing.id, values);
        toast.success("Category updated");
      } else {
        await expensesApi.createCategory(values);
        toast.success("Category created");
      }

      setCategoryDrawerOpen(false);
      setCategoryEditing(null);
      await Promise.all([loadCategoryLookup()]);
      refreshCategories();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save category"));
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleRecurringSubmit = async (values: RecurringExpenseValues) => {
    try {
      setRecurringSubmitting(true);
      if (editingRecurring) {
        await expensesApi.updateRecurring(editingRecurring.id, createRecurringPayload(values));
        toast.success("Recurring expense updated");
      } else {
        await expensesApi.createRecurring(createRecurringPayload(values));
        toast.success("Recurring expense created");
      }

      setRecurringDrawerOpen(false);
      setEditingRecurring(null);
      await loadRecurringLookup();
      refreshRecurring();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save recurring expense"));
    } finally {
      setRecurringSubmitting(false);
    }
  };

  const handleRecurringRun = async (item: RecurringExpense) => {
    try {
      await expensesApi.runRecurring(item.id);
      toast.success("Recurring expense executed");
      refreshRecurring();
      refreshExpenses();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to run recurring expense"));
    }
  };

  const handleRecurringToggle = async (item: RecurringExpense) => {
    try {
      await expensesApi.updateRecurring(item.id, {
        status: item.status === "paused" ? "active" : "paused",
      });
      toast.success(item.status === "paused" ? "Recurring expense activated" : "Recurring expense paused");
      refreshRecurring();
      await loadRecurringLookup();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update recurring expense"));
    }
  };

  const handleRunDueRecurring = async () => {
    try {
      setRunningDueRecurring(true);
      const response = await expensesApi.runDueRecurring();
      toast.success(`${response.data.total} due recurring expense(s) processed`);
      refreshRecurring();
      refreshExpenses();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to run due recurring expenses"));
    } finally {
      setRunningDueRecurring(false);
    }
  };

  const handlePrintExpense = async (expenseId: string) => {
    try {
      const response: ExpenseDetailResponse = detailExpense?.id === expenseId
        ? { expense: detailExpense }
        : (await expensesApi.get(expenseId)).data;
      buildPrintWindow(response.expense);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to prepare expense print view"));
    }
  };

  const handleExportReports = () => {
    if (activeReportTab === "category-wise") {
      downloadLocalPdfTable(
        "expense-category-wise-report.pdf",
        "Expense Category Wise Report",
        ["Category", "Expense Count", "Taxable Amount", "GST Amount", "Total Amount"],
        categoryWiseReport.map((item) => [item.categoryName, String(item.expenseCount), item.taxableAmount, item.gstAmount, item.totalAmount]),
      );
      return;
    }

    if (activeReportTab === "monthly") {
      downloadLocalPdfTable(
        "expense-monthly-report.pdf",
        "Expense Monthly Report",
        ["Month", "Expense Count", "Taxable Amount", "GST Amount", "Total Amount"],
        monthlyReport.map((item) => [item.month, String(item.expenseCount), item.taxableAmount, item.gstAmount, item.totalAmount]),
      );
      return;
    }

    if (activeReportTab === "payment-mode") {
      downloadLocalPdfTable(
        "expense-payment-mode-report.pdf",
        "Expense Payment Mode Report",
        ["Payment Mode", "Expense Count", "Total Amount"],
        paymentModeReport.map((item) => [item.paymentMode, String(item.expenseCount), item.totalAmount]),
      );
      return;
    }

    downloadLocalPdfTable(
      "expense-gst-report.pdf",
      "Expense GST Report",
      ["GST Applicable", "GST Rate", "Expense Count", "Taxable Amount", "CGST", "SGST", "IGST", "GST Amount", "Total Amount"],
      gstReport.map((item) => [
        item.gstApplicable ? "Yes" : "No",
        item.gstRate,
        String(item.expenseCount),
        item.taxableAmount,
        item.cgstAmount,
        item.sgstAmount,
        item.igstAmount,
        item.gstAmount,
        item.totalAmount,
      ]),
    );
  };

  const currentExpenseDefaults = buildExpenseFormDefaults(editingExpense, taxSettings);

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Expense Management"
          actions={
            activeTab === "expenses" && canCreate ? (
              <Button
                type="button"
                onClick={() => {
                  setEditingExpense(null);
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("tab", "add");
                    return next;
                  });
                }}
              >
                <Plus className="mr-2 size-4" />
                Add Expense
              </Button>
            ) : activeTab === "categories" && canManageCategories ? (
              <Button type="button" onClick={() => { setCategoryEditing(null); setCategoryDrawerOpen(true); }}>
                <Plus className="mr-2 size-4" />
                Add Category
              </Button>
            ) : activeTab === "recurring" && canManageRecurring ? (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" loading={runningDueRecurring} onClick={() => void handleRunDueRecurring()}>
                  <RefreshCw className="mr-2 size-4" />
                  Run Due
                </Button>
                <Button type="button" onClick={() => { setEditingRecurring(null); setRecurringDrawerOpen(true); }}>
                  <Plus className="mr-2 size-4" />
                  Add Recurring
                </Button>
              </div>
            ) : null
          }
        />

        <ExpenseTabs
          tabs={EXPENSE_TABS.filter((tab) => visibleTabs.includes(tab.id)).map((tab) => ({ id: tab.id, label: tab.label }))}
          activeTab={activeTab}
          onChange={(tab) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("tab", tab);
              return next;
            });
          }}
        />

        {activeTab === "expenses" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input placeholder="Search expense no, payee, description, reference" value={expensesSearch} onChange={(event) => { setExpensesSearch(event.target.value); setExpensesPage(1); }} />
                <Select value={expensesFilters.categoryId} onChange={(event) => { setExpensesFilters((current) => ({ ...current, categoryId: event.target.value })); setExpensesPage(1); }}>
                  <option value="">All categories</option>
                  {categoryLookup.filter((item) => item.status === "active").map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Select value={expensesFilters.paymentMode} onChange={(event) => { setExpensesFilters((current) => ({ ...current, paymentMode: event.target.value })); setExpensesPage(1); }}>
                  <option value="">All payment modes</option>
                  {EXPENSE_PAYMENT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select value={expensesFilters.status} onChange={(event) => { setExpensesFilters((current) => ({ ...current, status: event.target.value })); setExpensesPage(1); }}>
                  <option value="">All status</option>
                  {EXPENSE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select value={expensesFilters.gstApplicable} onChange={(event) => { setExpensesFilters((current) => ({ ...current, gstApplicable: event.target.value as "" | "true" | "false" })); setExpensesPage(1); }}>
                  <option value="">GST all</option>
                  <option value="true">GST only</option>
                  <option value="false">Non-GST only</option>
                </Select>
                <Input type="date" value={expensesFilters.dateFrom} onChange={(event) => { setExpensesFilters((current) => ({ ...current, dateFrom: event.target.value })); setExpensesPage(1); }} />
                <Input type="date" value={expensesFilters.dateTo} onChange={(event) => { setExpensesFilters((current) => ({ ...current, dateTo: event.target.value })); setExpensesPage(1); }} />
                <Select value={expensesFilters.recurringExpenseId} onChange={(event) => { setExpensesFilters((current) => ({ ...current, recurringExpenseId: event.target.value })); setExpensesPage(1); }}>
                  <option value="">All recurring templates</option>
                  {recurringLookup.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.templateName}
                    </option>
                  ))}
                </Select>
                <div />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setExpensesSearch("");
                      setExpensesFilters({
                        categoryId: "",
                        paymentMode: "",
                        status: "",
                        gstApplicable: "",
                        dateFrom: getMonthStartInput(),
                        dateTo: getTodayInput(),
                        recurringExpenseId: "",
                      });
                      setExpensesPage(1);
                    }}
                  >
                    Reset
                  </Button>
                  {canExport ? (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={exportingList}
                      onClick={async () => {
                        try {
                          setExportingList(true);
                          const file = await expensesApi.exportList(buildExpensesQuery());
                          saveDownloadedFile(file.blob, file.fileName);
                          toast.success("Expenses exported");
                        } catch (error) {
                          toast.error(getErrorMessage(error, "Failed to export expenses"));
                        } finally {
                          setExportingList(false);
                        }
                      }}
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {expensesData?.summary ? (
              <Card>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Base Amount</p><p className="mt-1 text-lg font-semibold text-slate-900">{expensesData.summary.amount}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Taxable</p><p className="mt-1 text-lg font-semibold text-slate-900">{expensesData.summary.taxableAmount}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">GST</p><p className="mt-1 text-lg font-semibold text-slate-900">{expensesData.summary.gstAmount}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p><p className="mt-1 text-lg font-semibold text-slate-900">{expensesData.summary.totalAmount}</p></div>
                </CardContent>
              </Card>
            ) : null}

            <ExpensesTable
              data={expensesData}
              loading={expensesLoading}
              canUpdate={canUpdate}
              canPost={canPost}
              canDelete={canDelete}
              onPageChange={setExpensesPage}
              onView={(expenseId) => {
                setDetailExpenseId(expenseId);
                setDetailExpense(null);
              }}
              onEdit={(expenseId) => void loadExpenseForEdit(expenseId)}
              onPost={setPostExpenseId}
              onCancel={(expenseId) => {
                const base = expensesData?.items.find((item) => item.id === expenseId);
                setCancelExpenseTarget(base ? ({ id: base.id, expenseNumber: base.expenseNumber } as Expense) : ({ id: expenseId, expenseNumber: "Expense" } as Expense));
                cancelForm.reset({ cancellationReason: "" });
              }}
              onDelete={setDeleteExpenseId}
              onAttachments={(expenseId) => {
                setDetailExpenseId(expenseId);
                setDetailExpense(null);
              }}
              onPrint={(expenseId) => void handlePrintExpense(expenseId)}
            />
          </div>
        ) : null}

        {activeTab === "add" ? (
          canCreate || editingExpense ? (
            <ExpenseForm
              initialValues={currentExpenseDefaults}
              categories={categoryLookup}
              accounts={expenseAccounts}
              bankAccounts={bankAccounts}
              taxSettings={taxSettings}
              companyGstNumber={auth.company?.gstNumber}
              companyState={auth.company?.state}
              editing={Boolean(editingExpense)}
              loadingState={expenseSubmitState}
              attachmentsContent={
                editingExpense ? (
                  <ExpenseAttachmentUploader
                    attachments={editingExpense.attachments}
                    uploadingFiles={formUploadingFiles}
                    onUpload={(files) => void handleUploadForTarget(editingExpense.id, files, setFormUploadingFiles)}
                    onRemove={(attachment) => void handleRemoveAttachment(editingExpense.id, attachment.id)}
                  />
                ) : undefined
              }
              onSubmit={handleExpenseSubmit}
              onBackToList={() => {
                setEditingExpense(null);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("tab", "expenses");
                  return next;
                });
              }}
            />
          ) : (
            <EmptyState title={referencesLoading ? "Loading form..." : "You do not have access to create expenses."} />
          )
        ) : null}

        {activeTab === "categories" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input placeholder="Search categories" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} />
                <Select value={categoryStatus} onChange={(event) => setCategoryStatus(event.target.value)}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="deleted">Deleted</option>
                </Select>
                <div />
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => { setCategorySearch(""); setCategoryStatus(""); }}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ExpenseCategoriesTable
              items={categoriesData}
              loading={categoriesLoading}
              canManage={canManageCategories}
              getParentName={(parentId) => getCategoryName(categoryLookup, parentId)}
              onEdit={(category) => { setCategoryEditing(category); setCategoryDrawerOpen(true); }}
              onDelete={setDeleteCategoryTarget}
            />
          </div>
        ) : null}

        {activeTab === "recurring" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input placeholder="Search template, payee, description" value={recurringSearch} onChange={(event) => { setRecurringSearch(event.target.value); setRecurringPage(1); }} />
                <Select value={recurringFilters.status} onChange={(event) => { setRecurringFilters((current) => ({ ...current, status: event.target.value })); setRecurringPage(1); }}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
                <Select value={recurringFilters.frequency} onChange={(event) => { setRecurringFilters((current) => ({ ...current, frequency: event.target.value })); setRecurringPage(1); }}>
                  <option value="">All frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </Select>
                <Input type="date" value={recurringFilters.dateFrom} onChange={(event) => { setRecurringFilters((current) => ({ ...current, dateFrom: event.target.value })); setRecurringPage(1); }} />
                <Input type="date" value={recurringFilters.dateTo} onChange={(event) => { setRecurringFilters((current) => ({ ...current, dateTo: event.target.value })); setRecurringPage(1); }} />
              </CardContent>
            </Card>

            <RecurringExpensesTable
              data={recurringData}
              loading={recurringLoading}
              canManage={canManageRecurring}
              onPageChange={setRecurringPage}
              onEdit={(item) => { setEditingRecurring(item); setRecurringDrawerOpen(true); }}
              onRun={(item) => void handleRecurringRun(item)}
              onToggleStatus={(item) => void handleRecurringToggle(item)}
            />
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <ExpenseReportsView
            activeTab={activeReportTab}
            filters={reportFilters}
            categories={categoryLookup}
            loading={reportsLoading}
            data={{
              categoryWise: categoryWiseReport,
              monthly: monthlyReport,
              paymentMode: paymentModeReport,
              gst: gstReport,
            }}
            summary={reportsSummary}
            onTabChange={setActiveReportTab}
            onFiltersChange={(updates) => setReportFilters((current) => ({ ...current, ...updates }))}
            onResetFilters={() => setReportFilters({ dateFrom: getMonthStartInput(), dateTo: getTodayInput(), categoryId: "", paymentMode: "", includeDrafts: false })}
            onExport={handleExportReports}
          />
        ) : null}
      </div>

      <ExpenseDetailDrawer
        open={Boolean(detailExpenseId)}
        expense={detailExpense}
        loading={detailLoading}
        canUpdate={canUpdate}
        canPost={canPost}
        uploadingFiles={detailUploadingFiles}
        onClose={() => {
          setDetailExpenseId(null);
          setDetailExpense(null);
          setDetailUploadingFiles([]);
        }}
        onEdit={(expense) => {
          setDetailExpenseId(null);
          setDetailExpense(null);
          setEditingExpense(expense);
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set("tab", "add");
            return next;
          });
        }}
        onPost={(expense) => setPostExpenseId(expense.id)}
        onCancel={(expense) => {
          setCancelExpenseTarget(expense);
          cancelForm.reset({ cancellationReason: "" });
        }}
        onUploadAttachments={(files) => {
          if (!detailExpense) {
            return;
          }

          void handleUploadForTarget(detailExpense.id, files, setDetailUploadingFiles);
        }}
        onRemoveAttachment={(attachment) => {
          if (!detailExpense) {
            return;
          }

          void handleRemoveAttachment(detailExpense.id, attachment.id);
        }}
      />

      <ExpenseCategoryDrawer
        open={categoryDrawerOpen}
        category={categoryEditing}
        categories={categoryLookup}
        accounts={expenseAccounts}
        submitting={categorySubmitting}
        onClose={() => {
          setCategoryDrawerOpen(false);
          setCategoryEditing(null);
        }}
        onSubmit={handleCategorySubmit}
      />

      <RecurringExpenseDrawer
        open={recurringDrawerOpen}
        recurring={editingRecurring}
        categories={categoryLookup}
        accounts={expenseAccounts}
        bankAccounts={bankAccounts}
        taxSettings={taxSettings}
        submitting={recurringSubmitting}
        onClose={() => {
          setRecurringDrawerOpen(false);
          setEditingRecurring(null);
        }}
        onSubmit={handleRecurringSubmit}
      />

      <ConfirmDialog
        open={Boolean(postExpenseId)}
        onClose={() => setPostExpenseId(null)}
        loading={postingExpense}
        title="Post Expense"
        description="Post this expense? Posted entries become read-only."
        onConfirm={() => {
          if (!postExpenseId) {
            return;
          }

          void handlePostExpense(postExpenseId);
        }}
        tone="primary"
      />

      <ConfirmDialog
        open={Boolean(deleteExpenseId)}
        onClose={() => setDeleteExpenseId(null)}
        loading={deletingExpense}
        title="Delete Expense"
        description="Delete this draft expense?"
        onConfirm={() => {
          if (!deleteExpenseId) {
            return;
          }

          void handleDeleteExpense(deleteExpenseId);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteCategoryTarget)}
        onClose={() => setDeleteCategoryTarget(null)}
        loading={deletingCategory}
        title="Delete Category"
        description={deleteCategoryTarget ? `Delete ${deleteCategoryTarget.name}?` : "Delete category?"}
        onConfirm={async () => {
          if (!deleteCategoryTarget) {
            return;
          }

          try {
            setDeletingCategory(true);
            await expensesApi.removeCategory(deleteCategoryTarget.id);
            toast.success("Category deleted");
            setDeleteCategoryTarget(null);
            await loadCategoryLookup();
            refreshCategories();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete category"));
          } finally {
            setDeletingCategory(false);
          }
        }}
      />

      <Modal
        open={Boolean(cancelExpenseTarget)}
        onClose={() => setCancelExpenseTarget(null)}
        title={cancelExpenseTarget ? `Cancel ${cancelExpenseTarget.expenseNumber}` : "Cancel Expense"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCancelExpenseTarget(null)}>
              Close
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={cancellingExpense}
              onClick={cancelForm.handleSubmit(async (values) => {
                if (!cancelExpenseTarget) {
                  return;
                }

                try {
                  setCancellingExpense(true);
                  const response = await expensesApi.cancel(cancelExpenseTarget.id, values);
                  toast.success("Expense cancelled");
                  setCancelExpenseTarget(null);
                  syncExpenseEverywhere(response.data.expense);
                  setDetailExpense(response.data.expense);
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to cancel expense"));
                } finally {
                  setCancellingExpense(false);
                }
              })}
            >
              Cancel Expense
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={4}
          {...cancelForm.register("cancellationReason")}
          error={cancelForm.formState.errors.cancellationReason?.message}
        />
      </Modal>
    </>
  );
};

