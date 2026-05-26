import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Download, Eye, Lock, Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import { AmountText } from "../../components/ui/AmountText";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { InlineErrorState } from "../../components/ui/InlineErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIcons } from "../../components/ui/TableActionIcons";
import { Textarea } from "../../components/ui/Textarea";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { bankApi } from "../../services/bankApi";
import { customersApi } from "../../services/customersApi";
import { financialYearApi } from "../../services/financialYearApi";
import { accountingApi } from "../../services/accountingApi";
import { suppliersApi } from "../../services/suppliersApi";
import type {
  Account,
  AccountType,
  AccountingEvent,
  AccountingEventsResponse,
  BalanceSheetReport,
  JournalEntry,
  JournalEntrySummary,
  JournalStatus,
  JournalVoucherType,
  LedgerResponse,
  OpeningBalance,
  PeriodLock,
  ProfitLossReport,
  TrialBalanceResponse,
} from "../../types/accounting";
import type { CompanyBankAccount, CompanyFinancialYear } from "../../types/company";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { AccountingPage } from "./components/AccountingPage";
import { AccountsTable } from "./components/AccountsTable";
import { AccountingEventsTable } from "./components/AccountingEventsTable";
import { AccountFormDrawer } from "./components/AccountFormDrawer";
import { BalanceSheetView } from "./components/BalanceSheetView";
import { BankBookTable } from "./components/BankBookTable";
import { CashBookTable } from "./components/CashBookTable";
import { JournalFormDrawer } from "./components/JournalFormDrawer";
import { LedgerTable } from "./components/LedgerTable";
import { OpeningBalanceDrawer } from "./components/OpeningBalanceDrawer";
import { PeriodLockModal } from "./components/PeriodLockModal";
import { ProfitLossView } from "./components/ProfitLossView";
import { TrialBalanceTable } from "./components/TrialBalanceTable";
import {
  balanceSheetFilterSchema,
  dateRangeSchema,
  journalReasonSchema,
  reportRangeSchema,
  type AccountFormValues,
  type JournalFormValues,
  type JournalReasonFormInputValues,
  type JournalReasonFormValues,
  type OpeningBalanceFormValues,
  type PeriodLockFormValues,
} from "./accountingSchemas";
import {
  accountTypeLabels,
  downloadBlobFile,
  flattenAccounts,
  formatAccountingDate,
  formatAccountingDateTime,
  getMonthStartInput,
  getTodayInput,
  journalVoucherLabels,
} from "./accountingUtils";

type AccountingCoreTab =
  | "accounts"
  | "journals"
  | "ledger"
  | "cash-book"
  | "bank-book"
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "events"
  | "period-locks";

type PartyOption = { id: string; label: string };

const PAGE_LIMIT = 20;
const LEDGER_LIMIT = 25;
const CORE_TAB_CONFIG: Array<{
  id: AccountingCoreTab;
  label: string;
  permissions: string[];
}> = [
  { id: "accounts", label: "Chart of Accounts", permissions: ["accounting.view", "chart.manage", "accounting.manage"] },
  { id: "journals", label: "Journals", permissions: ["accounting.view", "accounting.journal.create", "accounting.journal.post"] },
  { id: "ledger", label: "Ledger", permissions: ["ledger.view"] },
  { id: "cash-book", label: "Cash Book", permissions: ["cashbook.view"] },
  { id: "bank-book", label: "Bank Book", permissions: ["bankbook.view"] },
  { id: "trial-balance", label: "Trial Balance", permissions: ["accounting.reports.view"] },
  { id: "profit-loss", label: "Profit & Loss", permissions: ["accounting.reports.view"] },
  { id: "balance-sheet", label: "Balance Sheet", permissions: ["accounting.reports.view"] },
  { id: "events", label: "Events", permissions: ["accounting.manage", "accounting.journal.post"] },
  { id: "period-locks", label: "Period Locks", permissions: ["accounting.manage"] },
];

const needsAccountLookup = (tab: AccountingCoreTab) =>
  tab === "accounts" || tab === "journals" || tab === "ledger" || tab === "cash-book" || tab === "bank-book";

export const AccountingCorePage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManageAccounting = auth.hasPermission("accounting.manage");
  const canManageChart = auth.hasPermission("chart.manage");
  const canCreateJournal = auth.hasPermission("accounting.journal.create");
  const canPostJournal = auth.hasPermission("accounting.journal.post");
  const canCancelJournal = auth.hasPermission("accounting.journal.cancel");
  const canExport = auth.hasPermission("accounting.export");

  const visibleTabs = CORE_TAB_CONFIG.filter((tab) => auth.hasPermission(tab.permissions as never));
  const requestedTab = searchParams.get("tab") as AccountingCoreTab | null;
  const activeTab = visibleTabs.find((tab) => tab.id === requestedTab)?.id ?? visibleTabs[0]?.id ?? "accounts";

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", activeTab);
        return next;
      }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const [financialYears, setFinancialYears] = useState<CompanyFinancialYear[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [customerOptions, setCustomerOptions] = useState<PartyOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<PartyOption[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);

  const [accountLookup, setAccountLookup] = useState<Account[]>([]);
  const [accountLookupLoading, setAccountLookupLoading] = useState(false);
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null);

  const [accountsData, setAccountsData] = useState<{ items: Account[]; pagination: { page: number; limit: number; total: number; totalPages: number } } | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountsSearch, setAccountsSearch] = useState("");
  const debouncedAccountsSearch = useDebouncedValue(accountsSearch, 350);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsHierarchy] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType | "">("");
  const [accountStatusFilter, setAccountStatusFilter] = useState<"active" | "inactive" | "">("");
  const [accountParentFilter, setAccountParentFilter] = useState("");
  const [accountRefreshKey, setAccountRefreshKey] = useState(0);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountDrawerMode, setAccountDrawerMode] = useState<"create" | "edit" | "view">("create");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [openingBalancesData, setOpeningBalancesData] = useState<{ items: OpeningBalance[]; pagination: { page: number; limit: number; total: number; totalPages: number } } | null>(null);
  const [openingBalancesLoading, setOpeningBalancesLoading] = useState(false);
  const [openingBalancesError, setOpeningBalancesError] = useState<string | null>(null);
  const [openingBalancesPage, setOpeningBalancesPage] = useState(1);
  const [openingBalanceDrawerOpen, setOpeningBalanceDrawerOpen] = useState(false);
  const [openingBalanceDrawerMode, setOpeningBalanceDrawerMode] = useState<"create" | "edit">("create");
  const [selectedOpeningBalance, setSelectedOpeningBalance] = useState<OpeningBalance | null>(null);
  const [openingBalanceSaving, setOpeningBalanceSaving] = useState(false);
  const [lockOpeningTarget, setLockOpeningTarget] = useState<OpeningBalance | null>(null);
  const [lockingOpening, setLockingOpening] = useState(false);
  const [openingBalanceRefreshKey, setOpeningBalanceRefreshKey] = useState(0);

  const [journalsData, setJournalsData] = useState<{ items: JournalEntrySummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } } | null>(null);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalsError, setJournalsError] = useState<string | null>(null);
  const [journalsSearch, setJournalsSearch] = useState("");
  const debouncedJournalsSearch = useDebouncedValue(journalsSearch, 350);
  const [journalsPage, setJournalsPage] = useState(1);
  const [journalVoucherFilter, setJournalVoucherFilter] = useState<JournalVoucherType | "">("");
  const [journalStatusFilter, setJournalStatusFilter] = useState<JournalStatus | "">("");
  const [journalDateFrom, setJournalDateFrom] = useState(getMonthStartInput());
  const [journalDateTo, setJournalDateTo] = useState(getTodayInput());
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [journalDrawerOpen, setJournalDrawerOpen] = useState(false);
  const [journalDrawerMode, setJournalDrawerMode] = useState<"create" | "edit" | "view">("create");
  const [journalDetailLoading, setJournalDetailLoading] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [postJournalTarget, setPostJournalTarget] = useState<JournalEntrySummary | null>(null);
  const [postingJournal, setPostingJournal] = useState(false);
  const [journalReasonTarget, setJournalReasonTarget] = useState<{ type: "cancel" | "reverse"; journal: JournalEntrySummary } | null>(null);
  const [journalReasonSubmitting, setJournalReasonSubmitting] = useState(false);
  const journalReasonForm = useForm<JournalReasonFormInputValues, undefined, JournalReasonFormValues>({
    resolver: zodResolver(journalReasonSchema),
    defaultValues: {
      reason: "",
      reversalDate: null,
    },
  });

  const [ledgerScope, setLedgerScope] = useState<"account" | "customer" | "supplier">("account");
  const [ledgerTargetId, setLedgerTargetId] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(getMonthStartInput());
  const [ledgerDateTo, setLedgerDateTo] = useState(getTodayInput());
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [cashBookDateFrom, setCashBookDateFrom] = useState(getMonthStartInput());
  const [cashBookDateTo, setCashBookDateTo] = useState(getTodayInput());
  const [cashBookPage, setCashBookPage] = useState(1);
  const [cashBookData, setCashBookData] = useState<LedgerResponse | null>(null);
  const [cashBookLoading, setCashBookLoading] = useState(false);
  const [cashBookError, setCashBookError] = useState<string | null>(null);

  const [bankBookDateFrom, setBankBookDateFrom] = useState(getMonthStartInput());
  const [bankBookDateTo, setBankBookDateTo] = useState(getTodayInput());
  const [bankBookPage, setBankBookPage] = useState(1);
  const [bankBookAccountId, setBankBookAccountId] = useState("");
  const [bankBookData, setBankBookData] = useState<LedgerResponse | null>(null);
  const [bankBookLoading, setBankBookLoading] = useState(false);
  const [bankBookError, setBankBookError] = useState<string | null>(null);

  const [trialFinancialYearId, setTrialFinancialYearId] = useState<string | null>(null);
  const [trialDateFrom, setTrialDateFrom] = useState(getMonthStartInput());
  const [trialDateTo, setTrialDateTo] = useState(getTodayInput());
  const [trialData, setTrialData] = useState<TrialBalanceResponse | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const [profitLossFinancialYearId, setProfitLossFinancialYearId] = useState<string | null>(null);
  const [profitLossDateFrom, setProfitLossDateFrom] = useState(getMonthStartInput());
  const [profitLossDateTo, setProfitLossDateTo] = useState(getTodayInput());
  const [profitLossData, setProfitLossData] = useState<ProfitLossReport | null>(null);
  const [profitLossLoading, setProfitLossLoading] = useState(false);
  const [profitLossError, setProfitLossError] = useState<string | null>(null);

  const [balanceSheetFinancialYearId, setBalanceSheetFinancialYearId] = useState<string | null>(null);
  const [balanceSheetAsOfDate, setBalanceSheetAsOfDate] = useState(getTodayInput());
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetReport | null>(null);
  const [balanceSheetLoading, setBalanceSheetLoading] = useState(false);
  const [balanceSheetError, setBalanceSheetError] = useState<string | null>(null);

  const [eventsData, setEventsData] = useState<AccountingEventsResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventStatusFilter, setEventStatusFilter] = useState<"pending" | "posted" | "failed" | "ignored" | "">("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventReferenceTypeFilter, setEventReferenceTypeFilter] = useState("");
  const [postingEventId, setPostingEventId] = useState<string | null>(null);
  const [payloadEvent, setPayloadEvent] = useState<AccountingEvent | null>(null);
  const [postPendingLoading, setPostPendingLoading] = useState(false);
  const [postPendingResult, setPostPendingResult] = useState<{ total: number; posted: number; failed: number; ignored: number } | null>(null);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);

  const [periodLocksData, setPeriodLocksData] = useState<PeriodLock[]>([]);
  const [periodLocksLoading, setPeriodLocksLoading] = useState(false);
  const [periodLocksError, setPeriodLocksError] = useState<string | null>(null);
  const [periodLocksFinancialYearId, setPeriodLocksFinancialYearId] = useState("");
  const [periodLockModalOpen, setPeriodLockModalOpen] = useState(false);
  const [periodLockSaving, setPeriodLockSaving] = useState(false);
  const [deletePeriodLockTarget, setDeletePeriodLockTarget] = useState<PeriodLock | null>(null);
  const [deletingPeriodLock, setDeletingPeriodLock] = useState(false);
  const [periodLockRefreshKey, setPeriodLockRefreshKey] = useState(0);

  const activeFinancialYearId = financialYears.find((item) => item.isActive)?.id ?? null;

  useEffect(() => {
    const loadReferences = async () => {
      try {
        setReferencesLoading(true);
        const [yearsResult, banksResult, customersResult, suppliersResult] = await Promise.allSettled([
          financialYearApi.list(),
          bankApi.list({ page: 1, limit: 100, isActive: true }),
          customersApi.list({ page: 1, limit: 100, status: "active" }),
          suppliersApi.list({ page: 1, limit: 100, status: "active" }),
        ]);

        setFinancialYears(yearsResult.status === "fulfilled" ? yearsResult.value.data.items : []);
        setBankAccounts(
          banksResult.status === "fulfilled"
            ? banksResult.value.data.items.filter((item) => item.isActive)
            : [],
        );
        setCustomerOptions(
          customersResult.status === "fulfilled"
            ? customersResult.value.data.items.map((item) => ({ id: item.id, label: item.name }))
            : [],
        );
        setSupplierOptions(
          suppliersResult.status === "fulfilled"
            ? suppliersResult.value.data.items.map((item) => ({ id: item.id, label: item.name }))
            : [],
        );
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load accounting references"));
      } finally {
        setReferencesLoading(false);
      }
    };

    void loadReferences();
  }, [toast]);

  useEffect(() => {
    if (!activeFinancialYearId) {
      return;
    }

    setTrialFinancialYearId((current) => current ?? activeFinancialYearId);
    setProfitLossFinancialYearId((current) => current ?? activeFinancialYearId);
    setBalanceSheetFinancialYearId((current) => current ?? activeFinancialYearId);
  }, [activeFinancialYearId]);

  useEffect(() => {
    if (!balanceSheetFinancialYearId) {
      return;
    }

    const selectedYear = financialYears.find((year) => year.id === balanceSheetFinancialYearId);
    if (!selectedYear) {
      return;
    }

    const asOfDateValue = balanceSheetAsOfDate ? new Date(balanceSheetAsOfDate) : null;
    const yearStart = new Date(selectedYear.startDate);
    const yearEnd = new Date(selectedYear.endDate);

    if (!asOfDateValue || Number.isNaN(asOfDateValue.getTime()) || asOfDateValue < yearStart || asOfDateValue > yearEnd) {
      setBalanceSheetAsOfDate(selectedYear.endDate.slice(0, 10));
    }
  }, [balanceSheetAsOfDate, balanceSheetFinancialYearId, financialYears]);

  const loadAccountLookup = async (force = false) => {
    if (accountLookupLoading || (!force && accountLookup.length > 0)) {
      return;
    }

    try {
      setAccountLookupLoading(true);
      setAccountLookupError(null);
      const response = await accountingApi.listAccounts({
        page: 1,
        limit: 200,
        hierarchy: false,
      });
      setAccountLookup(flattenAccounts(response.data.items));
    } catch (error) {
      setAccountLookup([]);
      setAccountLookupError(getErrorMessage(error, "Failed to load account list"));
    } finally {
      setAccountLookupLoading(false);
    }
  };

  useEffect(() => {
    if (needsAccountLookup(activeTab)) {
      void loadAccountLookup();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "accounts") {
      return;
    }

    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        setAccountsError(null);
        const response = await accountingApi.listAccounts({
          page: accountsPage,
          limit: PAGE_LIMIT,
          search: debouncedAccountsSearch || undefined,
          type: accountTypeFilter || undefined,
          status: accountStatusFilter || undefined,
          parentId: accountParentFilter || undefined,
          hierarchy: accountsHierarchy,
          excludeSystem: true,
        });
        setAccountsData(response.data);
      } catch (error) {
        setAccountsData(null);
        setAccountsError(getErrorMessage(error, "Failed to load accounts"));
      } finally {
        setAccountsLoading(false);
      }
    };

    void loadAccounts();
  }, [activeTab, accountsPage, debouncedAccountsSearch, accountTypeFilter, accountStatusFilter, accountParentFilter, accountsHierarchy, accountRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "accounts") {
      return;
    }

    const loadOpeningBalances = async () => {
      try {
        setOpeningBalancesLoading(true);
        setOpeningBalancesError(null);
        const response = await accountingApi.listOpeningBalances({
          page: openingBalancesPage,
          limit: 8,
        });
        setOpeningBalancesData(response.data);
      } catch (error) {
        setOpeningBalancesData(null);
        setOpeningBalancesError(getErrorMessage(error, "Failed to load opening balances"));
      } finally {
        setOpeningBalancesLoading(false);
      }
    };

    void loadOpeningBalances();
  }, [activeTab, openingBalancesPage, openingBalanceRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "journals") {
      return;
    }

    const parsed = dateRangeSchema.safeParse({ dateFrom: journalDateFrom, dateTo: journalDateTo });
    if (!parsed.success) {
      return;
    }

    const loadJournals = async () => {
      try {
        setJournalsLoading(true);
        setJournalsError(null);
        const response = await accountingApi.listJournals({
          page: journalsPage,
          limit: PAGE_LIMIT,
          search: debouncedJournalsSearch || undefined,
          voucherType: journalVoucherFilter || undefined,
          status: journalStatusFilter || undefined,
          dateFrom: journalDateFrom,
          dateTo: journalDateTo,
        });
        setJournalsData(response.data);
      } catch (error) {
        setJournalsData(null);
        setJournalsError(getErrorMessage(error, "Failed to load journals"));
      } finally {
        setJournalsLoading(false);
      }
    };

    void loadJournals();
  }, [activeTab, journalsPage, debouncedJournalsSearch, journalVoucherFilter, journalStatusFilter, journalDateFrom, journalDateTo, journalRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "ledger") {
      return;
    }

    const parsed = dateRangeSchema.safeParse({ dateFrom: ledgerDateFrom, dateTo: ledgerDateTo });
    if (!parsed.success || !ledgerTargetId) {
      setLedgerData(null);
      setLedgerError(null);
      return;
    }

    const loadLedger = async () => {
      try {
        setLedgerLoading(true);
        setLedgerError(null);
        const query = {
          page: ledgerPage,
          limit: LEDGER_LIMIT,
          dateFrom: ledgerDateFrom,
          dateTo: ledgerDateTo,
        };
        const response =
          ledgerScope === "account"
            ? await accountingApi.getLedger(ledgerTargetId, query)
            : ledgerScope === "customer"
              ? await accountingApi.getCustomerLedger(ledgerTargetId, query)
              : await accountingApi.getSupplierLedger(ledgerTargetId, query);
        setLedgerData(response.data);
      } catch (error) {
        setLedgerData(null);
        setLedgerError(getErrorMessage(error, "Failed to load ledger"));
      } finally {
        setLedgerLoading(false);
      }
    };

    void loadLedger();
  }, [activeTab, ledgerScope, ledgerTargetId, ledgerDateFrom, ledgerDateTo, ledgerPage, toast]);

  useEffect(() => {
    if (activeTab !== "cash-book") {
      return;
    }

    const parsed = dateRangeSchema.safeParse({ dateFrom: cashBookDateFrom, dateTo: cashBookDateTo });
    if (!parsed.success) {
      return;
    }

    const loadCashBook = async () => {
      try {
        setCashBookLoading(true);
        setCashBookError(null);
        const response = await accountingApi.getCashBook({
          page: cashBookPage,
          limit: LEDGER_LIMIT,
          dateFrom: cashBookDateFrom,
          dateTo: cashBookDateTo,
        });
        setCashBookData(response.data);
      } catch (error) {
        setCashBookData(null);
        setCashBookError(getErrorMessage(error, "Failed to load cash book"));
      } finally {
        setCashBookLoading(false);
      }
    };

    void loadCashBook();
  }, [activeTab, cashBookDateFrom, cashBookDateTo, cashBookPage, toast]);

  useEffect(() => {
    if (activeTab !== "bank-book") {
      return;
    }

    const parsed = dateRangeSchema.safeParse({ dateFrom: bankBookDateFrom, dateTo: bankBookDateTo });
    if (!parsed.success) {
      return;
    }

    const loadBankBook = async () => {
      try {
        setBankBookLoading(true);
        setBankBookError(null);
        const response = await accountingApi.getBankBook({
          page: bankBookPage,
          limit: LEDGER_LIMIT,
          bankAccountId: bankBookAccountId || undefined,
          dateFrom: bankBookDateFrom,
          dateTo: bankBookDateTo,
        });
        setBankBookData(response.data);
      } catch (error) {
        setBankBookData(null);
        setBankBookError(getErrorMessage(error, "Failed to load bank book"));
      } finally {
        setBankBookLoading(false);
      }
    };

    void loadBankBook();
  }, [activeTab, bankBookAccountId, bankBookDateFrom, bankBookDateTo, bankBookPage, toast]);

  useEffect(() => {
    if (activeTab !== "trial-balance") {
      return;
    }

    const parsed = reportRangeSchema.safeParse({
      financialYearId: trialFinancialYearId,
      dateFrom: trialDateFrom,
      dateTo: trialDateTo,
    });
    if (!parsed.success) {
      return;
    }

    const loadTrialBalance = async () => {
      try {
        setTrialLoading(true);
        setTrialError(null);
        const response = await accountingApi.getTrialBalance({
          financialYearId: trialFinancialYearId ?? undefined,
          dateFrom: trialFinancialYearId ? undefined : trialDateFrom,
          dateTo: trialFinancialYearId ? undefined : trialDateTo,
        });
        setTrialData(response.data);
      } catch (error) {
        setTrialData(null);
        setTrialError(getErrorMessage(error, "Failed to load trial balance"));
      } finally {
        setTrialLoading(false);
      }
    };

    void loadTrialBalance();
  }, [activeTab, trialFinancialYearId, trialDateFrom, trialDateTo, toast]);

  useEffect(() => {
    if (activeTab !== "profit-loss") {
      return;
    }

    const parsed = reportRangeSchema.safeParse({
      financialYearId: profitLossFinancialYearId,
      dateFrom: profitLossDateFrom,
      dateTo: profitLossDateTo,
    });
    if (!parsed.success) {
      return;
    }

    const loadProfitLoss = async () => {
      try {
        setProfitLossLoading(true);
        setProfitLossError(null);
        const response = await accountingApi.getProfitLoss({
          financialYearId: profitLossFinancialYearId ?? undefined,
          dateFrom: profitLossFinancialYearId ? undefined : profitLossDateFrom,
          dateTo: profitLossFinancialYearId ? undefined : profitLossDateTo,
        });
        setProfitLossData(response.data);
      } catch (error) {
        setProfitLossData(null);
        setProfitLossError(getErrorMessage(error, "Failed to load profit & loss"));
      } finally {
        setProfitLossLoading(false);
      }
    };

    void loadProfitLoss();
  }, [activeTab, profitLossFinancialYearId, profitLossDateFrom, profitLossDateTo, toast]);

  useEffect(() => {
    if (activeTab !== "balance-sheet") {
      return;
    }

    const parsed = balanceSheetFilterSchema.safeParse({
      financialYearId: balanceSheetFinancialYearId,
      asOfDate: balanceSheetAsOfDate,
    });
    if (!parsed.success) {
      return;
    }

    const loadBalanceSheet = async () => {
      try {
        setBalanceSheetLoading(true);
        setBalanceSheetError(null);
        const response = await accountingApi.getBalanceSheet({
          financialYearId: balanceSheetFinancialYearId ?? undefined,
          asOfDate: balanceSheetAsOfDate || undefined,
        });
        setBalanceSheetData(response.data);
      } catch (error) {
        setBalanceSheetData(null);
        setBalanceSheetError(getErrorMessage(error, "Failed to load balance sheet"));
      } finally {
        setBalanceSheetLoading(false);
      }
    };

    void loadBalanceSheet();
  }, [activeTab, balanceSheetFinancialYearId, balanceSheetAsOfDate, toast]);

  useEffect(() => {
    if (activeTab !== "events") {
      return;
    }

    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);
        const response = await accountingApi.listEvents({
          page: eventsPage,
          limit: PAGE_LIMIT,
          status: eventStatusFilter || undefined,
          eventType: eventTypeFilter || undefined,
          referenceType: eventReferenceTypeFilter || undefined,
        });
        setEventsData(response.data);
      } catch (error) {
        setEventsData(null);
        setEventsError(getErrorMessage(error, "Failed to load accounting events"));
      } finally {
        setEventsLoading(false);
      }
    };

    void loadEvents();
  }, [activeTab, eventsPage, eventStatusFilter, eventTypeFilter, eventReferenceTypeFilter, eventsRefreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "period-locks") {
      return;
    }

    const loadPeriodLocks = async () => {
      try {
        setPeriodLocksLoading(true);
        setPeriodLocksError(null);
        const response = await accountingApi.listPeriodLocks({
          financialYearId: periodLocksFinancialYearId || undefined,
        });
        setPeriodLocksData(response.data.items);
      } catch (error) {
        setPeriodLocksData([]);
        setPeriodLocksError(getErrorMessage(error, "Failed to load period locks"));
      } finally {
        setPeriodLocksLoading(false);
      }
    };

    void loadPeriodLocks();
  }, [activeTab, periodLocksFinancialYearId, periodLockRefreshKey, toast]);

  const flatAccountOptions = flattenAccounts(accountLookup);
  const selectedCashAccount = accountLookup.find((item) => item.systemKey === "cash");
  const selectedBankBookAccount = bankAccounts.find((item) => item.id === bankBookAccountId) ?? null;
  const filteredLedgerAccounts = flatAccountOptions.filter((item) => {
    const term = ledgerSearch.trim().toLowerCase();
    if (!term) {
      return true;
    }

    return `${item.accountCode} ${item.accountName}`.toLowerCase().includes(term);
  });

  const refreshAccounts = async () => {
    setAccountRefreshKey((value) => value + 1);
    await loadAccountLookup(true);
  };

  const refreshOpeningBalances = () => setOpeningBalanceRefreshKey((value) => value + 1);
  const refreshJournals = () => setJournalRefreshKey((value) => value + 1);
  const refreshEvents = () => setEventsRefreshKey((value) => value + 1);
  const refreshPeriodLocks = () => setPeriodLockRefreshKey((value) => value + 1);

  const openAccountDrawer = async (mode: "create" | "edit" | "view", account: Account | null = null) => {
    await loadAccountLookup();
    setSelectedAccount(account);
    setAccountDrawerMode(mode);
    setAccountDrawerOpen(true);
  };

  const openOpeningBalanceDrawer = async (mode: "create" | "edit", item: OpeningBalance | null = null) => {
    await loadAccountLookup();
    setSelectedOpeningBalance(item);
    setOpeningBalanceDrawerMode(mode);
    setOpeningBalanceDrawerOpen(true);
  };

  const openJournalDrawer = async (mode: "create" | "edit" | "view", journalId?: string) => {
    await loadAccountLookup();
    setJournalDrawerMode(mode);
    setJournalDrawerOpen(true);
    setSelectedJournal(mode === "create" ? null : selectedJournal);
    setSelectedJournalId(journalId ?? null);

    if (!journalId) {
      setSelectedJournal(null);
      setJournalDetailLoading(false);
      return;
    }

    try {
      setJournalDetailLoading(true);
      const response = await accountingApi.getJournal(journalId);
      setSelectedJournal(response.data.journal);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load journal"));
    } finally {
      setJournalDetailLoading(false);
    }
  };

  const handleAccountSubmit = async (values: AccountFormValues) => {
    try {
      if (values.parentId) {
        const parent = flatAccountOptions.find((item) => item.id === values.parentId);
        const currentType = selectedAccount?.accountType ?? values.accountType;
        if (parent && parent.accountType !== currentType) {
          toast.error("Parent account must match the same account type.");
          return;
        }
      }

      if (!selectedAccount && values.openingBalance > 0 && values.openingBalanceType === "none") {
        toast.error("Choose debit or credit for the opening balance.");
        return;
      }

      setAccountSaving(true);
      if (accountDrawerMode === "edit" && selectedAccount) {
        await accountingApi.updateAccount(selectedAccount.id, {
          accountName: values.accountName.trim(),
          accountSubtype: values.accountSubtype,
          parentId: values.parentId,
          status: values.status,
          description: values.description,
        });
        toast.success("Account updated");
      } else {
        await accountingApi.createAccount({
          accountCode: values.accountCode || null,
          accountName: values.accountName.trim(),
          accountType: values.accountType,
          accountSubtype: values.accountSubtype,
          parentId: values.parentId,
          openingBalance: values.openingBalance,
          openingBalanceType: values.openingBalanceType,
          description: values.description,
        });
        toast.success("Account created");
      }
      setAccountDrawerOpen(false);
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save account"));
    } finally {
      setAccountSaving(false);
    }
  };

  const handleOpeningBalanceSubmit = async (values: OpeningBalanceFormValues) => {
    try {
      setOpeningBalanceSaving(true);
      if (openingBalanceDrawerMode === "edit" && selectedOpeningBalance) {
        await accountingApi.updateOpeningBalance(selectedOpeningBalance.id, {
          openingDate: values.openingDate,
          debit: values.debit,
          credit: values.credit,
          description: values.description,
        });
        toast.success("Opening balance updated");
      } else {
        await accountingApi.createOpeningBalances({
          openingDate: values.openingDate,
          financialYearId: values.financialYearId,
          description: values.description,
          entries: [
            {
              accountId: values.accountId,
              debit: values.debit,
              credit: values.credit,
              description: values.description,
            },
          ],
        });
        toast.success("Opening balance created");
      }
      setOpeningBalanceDrawerOpen(false);
      refreshOpeningBalances();
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save opening balance"));
    } finally {
      setOpeningBalanceSaving(false);
    }
  };

  const handleJournalSubmit = async (values: JournalFormValues, intent: "draft" | "posted") => {
    try {
      setJournalSaving(true);
      if (journalDrawerMode === "edit" && selectedJournalId) {
        await accountingApi.updateJournal(selectedJournalId, {
          financialYearId: values.financialYearId,
          entryDate: values.entryDate,
          voucherType: values.voucherType,
          referenceType: values.referenceType,
          referenceId: values.referenceId,
          referenceNumber: values.referenceNumber,
          description: values.description,
          lines: values.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
          })),
        });
        toast.success("Journal updated");
      } else {
        await accountingApi.createJournal({
          financialYearId: values.financialYearId,
          journalNumber: values.journalNumber,
          entryDate: values.entryDate,
          voucherType: values.voucherType,
          referenceType: values.referenceType,
          referenceId: values.referenceId,
          referenceNumber: values.referenceNumber,
          description: values.description,
          status: intent,
          lines: values.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
          })),
        });
        toast.success(intent === "posted" ? "Journal posted" : "Journal saved as draft");
      }
      setJournalDrawerOpen(false);
      refreshJournals();
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save journal"));
    } finally {
      setJournalSaving(false);
    }
  };

  const handleExport = async (task: () => Promise<{ blob: Blob; fileName: string }>, successLabel: string) => {
    try {
      const result = await task();
      downloadBlobFile(result.blob, result.fileName);
      toast.success(successLabel);
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    }
  };

  if (referencesLoading && !visibleTabs.length) {
    return <LoadingState label="Loading accounting core..." />;
  }

  if (!visibleTabs.length) {
    return <EmptyState title="No accounting core tabs are available for your permissions." />;
  }

return (
    <>
      <AccountingPage
        tabs={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onTabChange={(tab) =>
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set("tab", tab);
            return next;
          })
        }
      >
        {activeTab === "accounts" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input placeholder="Search code or name" value={accountsSearch} onChange={(event) => { setAccountsSearch(event.target.value); setAccountsPage(1); }} />
                <Select value={accountTypeFilter} onChange={(event) => { setAccountTypeFilter(event.target.value as AccountType | ""); setAccountsPage(1); }}>
                  <option value="">All types</option>
                  {(["asset", "liability", "equity", "income", "expense"] as AccountType[]).map((type) => (
                    <option key={type} value={type}>{accountTypeLabels[type]}</option>
                  ))}
                </Select>
                <Select value={accountStatusFilter} onChange={(event) => { setAccountStatusFilter(event.target.value as "active" | "inactive" | ""); setAccountsPage(1); }}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <Select value={accountParentFilter} onChange={(event) => { setAccountParentFilter(event.target.value); setAccountsPage(1); }}>
                  <option value="">All parents</option>
                  {flatAccountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-wrap justify-end gap-2 xl:col-start-6">
                  {canManageChart ? (
                    <Button type="button" onClick={() => void openAccountDrawer("create")}>
                      <Plus className="mr-2 size-4" />
                      Add Account
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <AccountsTable
              items={accountsData?.items ?? []}
              hierarchy={accountsHierarchy}
              loading={accountsLoading}
              error={accountsError}
              canManage={canManageChart}
              onView={(account) => void openAccountDrawer("view", account)}
              onEdit={(account) => void openAccountDrawer("edit", account)}
              onDelete={setDeleteAccountTarget}
            />

            {!accountsHierarchy && accountsData ? (
              <Pagination page={accountsData.pagination.page} totalPages={accountsData.pagination.totalPages} onChange={setAccountsPage} />
            ) : null}

            <Card>
              <CardHeader
                title="Opening Balances"
                action={
                  canManageAccounting ? (
                    <Button type="button" variant="secondary" onClick={() => void openOpeningBalanceDrawer("create")}>
                      <Plus className="mr-2 size-4" />
                      Add Opening
                    </Button>
                  ) : null
                }
              />
              <CardContent className="space-y-3">
                {openingBalancesLoading ? (
                  <LoadingState label="Loading opening balances..." />
                ) : openingBalancesError && !openingBalancesData?.items.length ? (
                  <InlineErrorState title={openingBalancesError} />
                ) : openingBalancesData?.items.length ? (
                  <>
                    <TableWrapper>
                      <Table>
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            {["Account", "Date", "Debit", "Credit", "Status", "Actions"].map((head) => (
                              <th key={head} className="px-4 py-3 font-semibold">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                          {openingBalancesData.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-slate-900">{item.accountCode} - {item.accountName}</td>
                              <td className="px-4 py-3">{formatAccountingDate(item.openingDate)}</td>
                              <td className="px-4 py-3"><AmountText value={item.debit} /></td>
                              <td className="px-4 py-3"><AmountText value={item.credit} /></td>
                              <td className="px-4 py-3"><StatusBadge status={item.isLocked ? "locked" : "active"} label={item.isLocked ? "Locked" : "Open"} /></td>
                              <td className="px-4 py-3">
                                <TableActionIcons
                                  actions={[
                                    {
                                      label: "Edit opening balance",
                                      icon: <Pencil className="size-4" />,
                                      onClick: () => void openOpeningBalanceDrawer("edit", item),
                                      disabled: !canManageAccounting || item.isLocked,
                                    },
                                    {
                                      label: "Lock opening balance",
                                      icon: <Lock className="size-4" />,
                                      onClick: () => setLockOpeningTarget(item),
                                      disabled: !canManageAccounting || item.isLocked,
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrapper>
                    <Pagination page={openingBalancesData.pagination.page} totalPages={openingBalancesData.pagination.totalPages} onChange={setOpeningBalancesPage} />
                  </>
                ) : (
                  <EmptyState title="No opening balances found." />
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "journals" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input placeholder="Search journal no, ref, description" value={journalsSearch} onChange={(event) => { setJournalsSearch(event.target.value); setJournalsPage(1); }} />
                <Input type="date" value={journalDateFrom} onChange={(event) => { setJournalDateFrom(event.target.value); setJournalsPage(1); }} />
                <Input type="date" value={journalDateTo} onChange={(event) => { setJournalDateTo(event.target.value); setJournalsPage(1); }} />
                <Select value={journalVoucherFilter} onChange={(event) => { setJournalVoucherFilter(event.target.value as JournalVoucherType | ""); setJournalsPage(1); }}>
                  <option value="">All voucher types</option>
                  {Object.entries(journalVoucherLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
                <Select value={journalStatusFilter} onChange={(event) => { setJournalStatusFilter(event.target.value as JournalStatus | ""); setJournalsPage(1); }}>
                  <option value="">All status</option>
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="reversed">Reversed</option>
                </Select>
                <div className="flex">
                  {canCreateJournal ? (
                    <Button type="button" className="w-full" onClick={() => void openJournalDrawer("create")}>
                      <Plus className="mr-2 size-4" />
                      Add
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {journalsLoading ? (
              <LoadingState label="Loading journals..." />
            ) : journalsError && !journalsData?.items.length ? (
              <InlineErrorState title={journalsError} />
            ) : journalsData?.items.length ? (
              <>
                <TableWrapper>
                  <Table>
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Journal No", "Date", "Voucher Type", "Description", "Debit", "Credit", "Status", "Actions"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {journalsData.items.map((journal) => (
                        <tr key={journal.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">{journal.journalNumber}</td>
                          <td className="px-4 py-3">{formatAccountingDate(journal.entryDate)}</td>
                          <td className="px-4 py-3">{journalVoucherLabels[journal.voucherType]}</td>
                          <td className="px-4 py-3">{journal.description}</td>
                          <td className="px-4 py-3"><AmountText value={journal.totalDebit} /></td>
                          <td className="px-4 py-3"><AmountText value={journal.totalCredit} /></td>
                          <td className="px-4 py-3"><StatusBadge status={journal.status} label={journal.status} /></td>
                          <td className="px-4 py-3">
                            <TableActionIcons
                              actions={[
                                {
                                  label: "View journal",
                                  icon: <Eye className="size-4" />,
                                  onClick: () => void openJournalDrawer("view", journal.id),
                                },
                                {
                                  label: "Edit journal",
                                  icon: <Pencil className="size-4" />,
                                  onClick: () => void openJournalDrawer("edit", journal.id),
                                  disabled: !canCreateJournal || journal.status !== "draft",
                                },
                                {
                                  label: "Post journal",
                                  icon: <Play className="size-4" />,
                                  onClick: () => setPostJournalTarget(journal),
                                  disabled: !canPostJournal || journal.status !== "draft",
                                },
                                {
                                  label: "Cancel journal",
                                  icon: <Ban className="size-4" />,
                                  onClick: () => {
                                    journalReasonForm.reset({ reason: "", reversalDate: null });
                                    setJournalReasonTarget({ type: "cancel", journal });
                                  },
                                  disabled: !canCancelJournal || journal.status !== "posted",
                                },
                                {
                                  label: "Reverse journal",
                                  icon: <RotateCcw className="size-4" />,
                                  onClick: () => {
                                    journalReasonForm.reset({ reason: "", reversalDate: getTodayInput() });
                                    setJournalReasonTarget({ type: "reverse", journal });
                                  },
                                  disabled: !canCancelJournal || journal.status !== "posted",
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                <Pagination page={journalsData.pagination.page} totalPages={journalsData.pagination.totalPages} onChange={setJournalsPage} />
              </>
            ) : (
              <EmptyState title="No journals found." action={canCreateJournal ? <Button type="button" onClick={() => void openJournalDrawer("create")}><Plus className="mr-2 size-4" />New Journal</Button> : undefined} />
            )}
          </div>
        ) : null}

        {activeTab === "ledger" ? (
          <div className="space-y-4">
            {ledgerScope === "account" && accountLookupError ? <InlineErrorState title={accountLookupError} /> : null}
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Select value={ledgerScope} onChange={(event) => { setLedgerScope(event.target.value as "account" | "customer" | "supplier"); setLedgerTargetId(""); setLedgerPage(1); }}>
                  <option value="account">Account Ledger</option>
                  <option value="customer">Customer Ledger</option>
                  <option value="supplier">Supplier Ledger</option>
                </Select>
                {ledgerScope === "account" ? (
                  <>
                    <Input placeholder="Search account" value={ledgerSearch} onChange={(event) => setLedgerSearch(event.target.value)} />
                    <Select value={ledgerTargetId} onChange={(event) => { setLedgerTargetId(event.target.value); setLedgerPage(1); }}>
                      <option value="">Select account</option>
                      {filteredLedgerAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountCode} - {account.accountName}
                        </option>
                      ))}
                    </Select>
                  </>
                ) : ledgerScope === "customer" ? (
                  <Select value={ledgerTargetId} onChange={(event) => { setLedgerTargetId(event.target.value); setLedgerPage(1); }}>
                    <option value="">Select customer</option>
                    {customerOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Select value={ledgerTargetId} onChange={(event) => { setLedgerTargetId(event.target.value); setLedgerPage(1); }}>
                    <option value="">Select supplier</option>
                    {supplierOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                )}
                <Input type="date" value={ledgerDateFrom} onChange={(event) => { setLedgerDateFrom(event.target.value); setLedgerPage(1); }} />
                <Input type="date" value={ledgerDateTo} onChange={(event) => { setLedgerDateTo(event.target.value); setLedgerPage(1); }} />
              </CardContent>
            </Card>
            <LedgerTable data={ledgerData} loading={ledgerLoading} error={ledgerError} onPageChange={setLedgerPage} />
          </div>
        ) : null}

        {activeTab === "cash-book" ? (
          <div className="space-y-4">
            {accountLookupError ? <InlineErrorState title={accountLookupError} /> : null}
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input type="date" value={cashBookDateFrom} onChange={(event) => { setCashBookDateFrom(event.target.value); setCashBookPage(1); }} />
                <Input type="date" value={cashBookDateTo} onChange={(event) => { setCashBookDateTo(event.target.value); setCashBookPage(1); }} />
                <div />
                <div className="flex justify-end">
                  {canExport && selectedCashAccount ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void handleExport(
                          () =>
                            accountingApi.exportCashBook({
                              page: cashBookPage,
                              limit: LEDGER_LIMIT,
                              format: "pdf",
                              dateFrom: cashBookDateFrom,
                              dateTo: cashBookDateTo,
                            }),
                          "Cash book exported",
                        )
                      }
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <CashBookTable data={cashBookData} loading={cashBookLoading} error={cashBookError} onPageChange={setCashBookPage} />
          </div>
        ) : null}

        {activeTab === "bank-book" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={bankBookAccountId} onChange={(event) => { setBankBookAccountId(event.target.value); setBankBookPage(1); }}>
                  <option value="">All bank accounts</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bankName} - {account.accountNumber}
                    </option>
                  ))}
                </Select>
                <Input type="date" value={bankBookDateFrom} onChange={(event) => { setBankBookDateFrom(event.target.value); setBankBookPage(1); }} />
                <Input type="date" value={bankBookDateTo} onChange={(event) => { setBankBookDateTo(event.target.value); setBankBookPage(1); }} />
                <div className="flex justify-end md:col-span-2 xl:col-span-1">
                  {canExport ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void handleExport(
                          () =>
                            accountingApi.exportBankBook({
                              page: bankBookPage,
                              limit: LEDGER_LIMIT,
                              bankAccountId: bankBookAccountId || undefined,
                              dateFrom: bankBookDateFrom,
                              dateTo: bankBookDateTo,
                            }),
                          selectedBankBookAccount ? "Bank account book exported" : "Bank book exported",
                        )
                      }
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <BankBookTable data={bankBookData} loading={bankBookLoading} error={bankBookError} onPageChange={setBankBookPage} />
          </div>
        ) : null}

        {activeTab === "trial-balance" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Select value={trialFinancialYearId ?? ""} onChange={(event) => setTrialFinancialYearId(event.target.value || null)}>
                  <option value="">Custom Date Range</option>
                  {financialYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </Select>
                <Input type="date" disabled={Boolean(trialFinancialYearId)} value={trialDateFrom} onChange={(event) => setTrialDateFrom(event.target.value)} />
                <Input type="date" disabled={Boolean(trialFinancialYearId)} value={trialDateTo} onChange={(event) => setTrialDateTo(event.target.value)} />
                <div />
                <div className="flex justify-end">
                  {canExport ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void handleExport(
                          () => accountingApi.exportTrialBalance({
                            financialYearId: trialFinancialYearId ?? undefined,
                            dateFrom: trialFinancialYearId ? undefined : trialDateFrom,
                            dateTo: trialFinancialYearId ? undefined : trialDateTo,
                          }),
                          "Trial balance exported",
                        )
                      }
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <TrialBalanceTable data={trialData} loading={trialLoading} error={trialError} />
          </div>
        ) : null}

        {activeTab === "profit-loss" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Select value={profitLossFinancialYearId ?? ""} onChange={(event) => setProfitLossFinancialYearId(event.target.value || null)}>
                  <option value="">Custom Date Range</option>
                  {financialYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </Select>
                <Input type="date" disabled={Boolean(profitLossFinancialYearId)} value={profitLossDateFrom} onChange={(event) => setProfitLossDateFrom(event.target.value)} />
                <Input type="date" disabled={Boolean(profitLossFinancialYearId)} value={profitLossDateTo} onChange={(event) => setProfitLossDateTo(event.target.value)} />
                <div />
                <div className="flex justify-end">
                  {canExport ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void handleExport(
                          () => accountingApi.exportProfitLoss({
                            financialYearId: profitLossFinancialYearId ?? undefined,
                            dateFrom: profitLossFinancialYearId ? undefined : profitLossDateFrom,
                            dateTo: profitLossFinancialYearId ? undefined : profitLossDateTo,
                          }),
                          "Profit & loss exported",
                        )
                      }
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <ProfitLossView data={profitLossData} loading={profitLossLoading} error={profitLossError} />
          </div>
        ) : null}

        {activeTab === "balance-sheet" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={balanceSheetFinancialYearId ?? ""} onChange={(event) => setBalanceSheetFinancialYearId(event.target.value || null)}>
                  <option value="">No financial year filter</option>
                  {financialYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </Select>
                <Input type="date" value={balanceSheetAsOfDate} onChange={(event) => setBalanceSheetAsOfDate(event.target.value)} />
                <div />
                <div className="flex justify-end">
                  {canExport ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void handleExport(
                          () => accountingApi.exportBalanceSheet({
                            financialYearId: balanceSheetFinancialYearId ?? undefined,
                            asOfDate: balanceSheetAsOfDate || undefined,
                          }),
                          "Balance sheet exported",
                        )
                      }
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <BalanceSheetView data={balanceSheetData} loading={balanceSheetLoading} error={balanceSheetError} />
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Select value={eventStatusFilter} onChange={(event) => { setEventStatusFilter(event.target.value as typeof eventStatusFilter); setEventsPage(1); }}>
                  <option value="">All status</option>
                  <option value="pending">Pending</option>
                  <option value="posted">Posted</option>
                  <option value="failed">Failed</option>
                  <option value="ignored">Ignored</option>
                </Select>
                <Input placeholder="Event type" value={eventTypeFilter} onChange={(event) => { setEventTypeFilter(event.target.value); setEventsPage(1); }} />
                <Input placeholder="Reference type" value={eventReferenceTypeFilter} onChange={(event) => { setEventReferenceTypeFilter(event.target.value); setEventsPage(1); }} />
                <div />
                <div className="flex justify-end">
                  {canPostJournal ? (
                    <Button type="button" loading={postPendingLoading} onClick={async () => {
                      try {
                        setPostPendingLoading(true);
                        const response = await accountingApi.postPendingEvents();
                        setPostPendingResult(response.data);
                        toast.success(`Pending events processed: ${response.data.posted} posted`);
                        refreshEvents();
                        refreshJournals();
                        await refreshAccounts();
                      } catch (error) {
                        toast.error(getErrorMessage(error, "Failed to post pending events"));
                      } finally {
                        setPostPendingLoading(false);
                      }
                    }}>
                      <Play className="mr-2 size-4" />
                      Post Pending
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {postPendingResult ? (
              <Card>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p><p className="mt-1 text-sm font-semibold text-slate-900">{postPendingResult.total}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Posted</p><p className="mt-1 text-sm font-semibold text-emerald-700">{postPendingResult.posted}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Failed</p><p className="mt-1 text-sm font-semibold text-rose-700">{postPendingResult.failed}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Ignored</p><p className="mt-1 text-sm font-semibold text-cyan-700">{postPendingResult.ignored}</p></div>
                </CardContent>
              </Card>
            ) : null}

            <AccountingEventsTable
              data={eventsData}
              loading={eventsLoading}
              error={eventsError}
              canPost={canPostJournal}
              postingId={postingEventId}
              onPageChange={setEventsPage}
              onViewPayload={setPayloadEvent}
              onPost={async (event) => {
                try {
                  setPostingEventId(event.id);
                  await accountingApi.postEvent(event.id);
                  toast.success("Accounting event posted");
                  refreshEvents();
                  refreshJournals();
                  await refreshAccounts();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to post accounting event"));
                } finally {
                  setPostingEventId(null);
                }
              }}
            />
          </div>
        ) : null}

        {activeTab === "period-locks" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={periodLocksFinancialYearId} onChange={(event) => setPeriodLocksFinancialYearId(event.target.value)}>
                  <option value="">All financial years</option>
                  {financialYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </Select>
                <div />
                <div />
                <div className="flex justify-end">
                  {canManageAccounting ? (
                    <Button type="button" onClick={() => setPeriodLockModalOpen(true)}>
                      <Lock className="mr-2 size-4" />
                      Add Lock
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {periodLocksLoading ? (
              <LoadingState label="Loading period locks..." />
            ) : periodLocksError && !periodLocksData.length ? (
              <InlineErrorState title={periodLocksError} />
            ) : periodLocksData.length ? (
              <TableWrapper>
                <Table>
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Financial Year", "Period Start", "Period End", "Type", "Reason", "Status", "Actions"].map((head) => (
                        <th key={head} className="px-4 py-3 font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {periodLocksData.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{financialYears.find((year) => year.id === item.financialYearId)?.name ?? "-"}</td>
                        <td className="px-4 py-3">{formatAccountingDate(item.periodStart)}</td>
                        <td className="px-4 py-3">{formatAccountingDate(item.periodEnd)}</td>
                        <td className="px-4 py-3"><Badge tone="warning">{item.lockType}</Badge></td>
                        <td className="px-4 py-3">{item.reason ?? "-"}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.isLocked ? "locked" : "inactive"} label={item.isLocked ? "Locked" : "Open"} /></td>
                        <td className="px-4 py-3">
                          <TableActionIcons
                            actions={[
                              {
                                label: "Remove lock",
                                icon: <Trash2 className="size-4" />,
                                onClick: () => setDeletePeriodLockTarget(item),
                                disabled: !canManageAccounting,
                                tone: "danger",
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>
            ) : (
              <EmptyState title="No period locks found." />
            )}
          </div>
        ) : null}
      </AccountingPage>

      <AccountFormDrawer
        open={accountDrawerOpen}
        mode={accountDrawerMode}
        account={selectedAccount}
        parentOptions={flatAccountOptions.filter((item) => item.status !== "deleted")}
        submitting={accountSaving}
        onClose={() => setAccountDrawerOpen(false)}
        onSubmit={handleAccountSubmit}
      />

      <OpeningBalanceDrawer
        open={openingBalanceDrawerOpen}
        mode={openingBalanceDrawerMode}
        item={selectedOpeningBalance}
        accounts={flatAccountOptions.filter((item) => item.status === "active")}
        financialYears={financialYears}
        submitting={openingBalanceSaving}
        onClose={() => setOpeningBalanceDrawerOpen(false)}
        onSubmit={handleOpeningBalanceSubmit}
      />

      <JournalFormDrawer
        open={journalDrawerOpen}
        mode={journalDrawerMode}
        loading={journalDetailLoading}
        journal={selectedJournal}
        accounts={flatAccountOptions.filter((item) => item.status === "active")}
        financialYears={financialYears}
        submitting={journalSaving}
        onClose={() => {
          setJournalDrawerOpen(false);
          setSelectedJournal(null);
          setSelectedJournalId(null);
        }}
        onSubmit={handleJournalSubmit}
      />

      <PeriodLockModal
        open={periodLockModalOpen}
        financialYears={financialYears}
        submitting={periodLockSaving}
        onClose={() => setPeriodLockModalOpen(false)}
        onSubmit={async (values: PeriodLockFormValues) => {
          try {
            setPeriodLockSaving(true);
            await accountingApi.createPeriodLock({
              financialYearId: values.financialYearId,
              periodStart: values.periodStart,
              periodEnd: values.periodEnd,
              lockType: values.lockType,
              reason: values.reason,
            });
            toast.success("Period lock added");
            setPeriodLockModalOpen(false);
            refreshPeriodLocks();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save period lock"));
          } finally {
            setPeriodLockSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteAccountTarget)}
        onClose={() => setDeleteAccountTarget(null)}
        loading={deletingAccount}
        title="Delete Account"
        description={deleteAccountTarget ? `Remove ${deleteAccountTarget.accountCode} - ${deleteAccountTarget.accountName}?` : "Remove account?"}
        onConfirm={async () => {
          if (!deleteAccountTarget) {
            return;
          }

          try {
            setDeletingAccount(true);
            const response = await accountingApi.removeAccount(deleteAccountTarget.id);
            toast.success(response.data.deactivated ? "Account deactivated because it has posted usage" : "Account deleted");
            setDeleteAccountTarget(null);
            await refreshAccounts();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to remove account"));
          } finally {
            setDeletingAccount(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(lockOpeningTarget)}
        onClose={() => setLockOpeningTarget(null)}
        loading={lockingOpening}
        title="Lock Opening Balance"
        description={lockOpeningTarget ? `Lock opening balance for ${lockOpeningTarget.accountCode} - ${lockOpeningTarget.accountName}?` : "Lock this opening balance?"}
        onConfirm={async () => {
          if (!lockOpeningTarget) {
            return;
          }

          try {
            setLockingOpening(true);
            await accountingApi.lockOpeningBalances([lockOpeningTarget.id]);
            toast.success("Opening balance locked");
            setLockOpeningTarget(null);
            refreshOpeningBalances();
            await refreshAccounts();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to lock opening balance"));
          } finally {
            setLockingOpening(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(postJournalTarget)}
        onClose={() => setPostJournalTarget(null)}
        loading={postingJournal}
        title="Post Journal"
        description={postJournalTarget ? `Post ${postJournalTarget.journalNumber}? Posted journals become read-only.` : "Post this journal?"}
        onConfirm={async () => {
          if (!postJournalTarget) {
            return;
          }

          try {
            setPostingJournal(true);
            await accountingApi.postJournal(postJournalTarget.id);
            toast.success("Journal posted");
            setPostJournalTarget(null);
            refreshJournals();
            await refreshAccounts();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to post journal"));
          } finally {
            setPostingJournal(false);
          }
        }}
        tone="primary"
      />

      <ConfirmDialog
        open={Boolean(deletePeriodLockTarget)}
        onClose={() => setDeletePeriodLockTarget(null)}
        loading={deletingPeriodLock}
        title="Remove Period Lock"
        description={deletePeriodLockTarget ? `Unlock ${formatAccountingDate(deletePeriodLockTarget.periodStart)} to ${formatAccountingDate(deletePeriodLockTarget.periodEnd)}?` : "Remove lock?"}
        onConfirm={async () => {
          if (!deletePeriodLockTarget) {
            return;
          }

          try {
            setDeletingPeriodLock(true);
            await accountingApi.removePeriodLock(deletePeriodLockTarget.id);
            toast.success("Period lock removed");
            setDeletePeriodLockTarget(null);
            refreshPeriodLocks();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to remove period lock"));
          } finally {
            setDeletingPeriodLock(false);
          }
        }}
      />

      <Modal
        open={Boolean(journalReasonTarget)}
        onClose={() => setJournalReasonTarget(null)}
        title={journalReasonTarget?.type === "reverse" ? "Reverse Journal" : "Cancel Journal"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setJournalReasonTarget(null)}>
              Close
            </Button>
            <Button
              type="button"
              variant={journalReasonTarget?.type === "cancel" ? "danger" : "primary"}
              loading={journalReasonSubmitting}
              onClick={journalReasonForm.handleSubmit(async (values) => {
                if (!journalReasonTarget) {
                  return;
                }

                try {
                  setJournalReasonSubmitting(true);
                  if (journalReasonTarget.type === "cancel") {
                    await accountingApi.cancelJournal(journalReasonTarget.journal.id, {
                      reason: values.reason,
                    });
                    toast.success("Journal cancelled");
                  } else {
                    await accountingApi.reverseJournal(journalReasonTarget.journal.id, {
                      reason: values.reason,
                      reversalDate: values.reversalDate,
                    });
                    toast.success("Journal reversed");
                  }
                  setJournalReasonTarget(null);
                  refreshJournals();
                  await refreshAccounts();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to process journal"));
                } finally {
                  setJournalReasonSubmitting(false);
                }
              })}
            >
              {journalReasonTarget?.type === "reverse" ? "Reverse Journal" : "Cancel Journal"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {journalReasonTarget?.type === "reverse" ? (
            <Input type="date" label="Reversal Date" {...journalReasonForm.register("reversalDate")} error={journalReasonForm.formState.errors.reversalDate?.message ?? undefined} />
          ) : null}
          <Textarea label="Reason" rows={4} {...journalReasonForm.register("reason")} error={journalReasonForm.formState.errors.reason?.message} />
        </div>
      </Modal>

      <Modal
        open={Boolean(payloadEvent)}
        onClose={() => setPayloadEvent(null)}
        title={payloadEvent ? `${payloadEvent.eventType} Payload` : "Event Payload"}
        className="max-w-4xl"
      >
        <div className="space-y-3">
          {payloadEvent ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Reference</p>
                  <p className="mt-1 font-medium text-slate-900">{payloadEvent.referenceType}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Created</p>
                  <p className="mt-1 font-medium text-slate-900">{formatAccountingDateTime(payloadEvent.createdAt)}</p>
                </div>
              </div>
              <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(payloadEvent.payload, null, 2)}
              </pre>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
};

