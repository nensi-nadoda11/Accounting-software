import { zodResolver } from "@hookform/resolvers/zod";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AmountText } from "../../components/ui/AmountText";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { bankApi } from "../../services/bankApi";
import { customersApi } from "../../services/customersApi";
import { paymentsApi } from "../../services/paymentsApi";
import { suppliersApi } from "../../services/suppliersApi";
import type { CompanyBankAccount } from "../../types/company";
import type {
  DueItem,
  DueTrackingQuery,
  DueTrackingResponse,
  PartyType,
  Payment,
  PaymentFormAllocationInput,
  PaymentListQuery,
  PaymentListResponse,
  PaymentReminder,
  PaymentRemindersResponse,
} from "../../types/payment";
import { saveDownloadedFile } from "../customers/customerUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import type { LookupOption } from "../sales/components/AsyncLookupSelect";
import { PaymentDetailDrawer } from "./components/PaymentDetailDrawer";
import { PaymentFilters } from "./components/PaymentFilters";
import { PaymentTabs } from "./components/PaymentTabs";
import { PaymentsListTable } from "./components/PaymentsListTable";
import { ReceivePaymentForm } from "./components/ReceivePaymentForm";
import { PaySupplierForm } from "./components/PaySupplierForm";
import { DueTrackingTable } from "./components/DueTrackingTable";
import { AdvancesTable } from "./components/AdvancesTable";
import { RemindersTable } from "./components/RemindersTable";
import { ReceiptDrawer } from "./components/ReceiptDrawer";
import { SendReceiptModal } from "./components/SendReceiptModal";
import { ChequeStatusModal } from "./components/ChequeStatusModal";
import { AllocationTable } from "./components/AllocationTable";
import {
  CANCEL_PAYMENT_SCHEMA,
  SEND_REMINDER_SCHEMA,
  UPDATE_REMINDER_STATUS_SCHEMA,
  type CancelPaymentFormInputValues,
  type CancelPaymentFormValues,
  type ReminderStatusFormInputValues,
  type ReminderStatusFormValues,
  type SendReminderFormInputValues,
  type SendReminderFormValues,
} from "./pageSchemas";
import { CHEQUE_STATUS_LABELS, PAYMENT_TABS, REMINDER_STATUS_OPTIONS } from "./paymentOptions";
import type { PaymentManagementTab } from "./paymentTypes";
import { matchesNinetyPlusBucket, openReceiptPrintWindow } from "./paymentUtils";

const ALL_FETCH_LIMIT = 100;

type PartyOption = {
  id: string;
  label: string;
};

type SeedState = {
  key: number;
  option: LookupOption | null;
};

const getFirstAvailableTab = (tabs: PaymentManagementTab[]) => tabs[0] ?? "list";

const createLookupOption = (partyId: string, name: string | null, code: string | null, partyType: PartyType): LookupOption => ({
  id: partyId,
  label: name ?? "-",
  description: code,
  meta: partyType === "customer" ? "Customer" : "Supplier",
});

const mapDueFilterToApi = (agingBucket: string) => {
  if (agingBucket === "31-60" || agingBucket === "61-90") {
    return agingBucket;
  }

  return undefined;
};

const filterDueItems = (response: DueTrackingResponse | null, agingBucket: string) => {
  if (!response || !agingBucket) {
    return response;
  }

  const items =
    agingBucket === "0-30"
      ? response.items.filter((item) => item.agingBucket === "current" || item.agingBucket === "1-30")
      : agingBucket === "90+"
        ? response.items.filter((item) => matchesNinetyPlusBucket(item.agingBucket))
        : response.items;

  return {
    ...response,
    items,
    pagination: {
      ...response.pagination,
      total: items.length,
      totalPages: 1,
      page: 1,
    },
  };
};

const filterReminders = (response: PaymentRemindersResponse | null, channel: string) => {
  if (!response || !channel) {
    return response;
  }

  const items = response.items.filter((item) => item.channel === channel);
  return {
    ...response,
    items,
    pagination: {
      ...response.pagination,
      total: items.length,
      totalPages: 1,
      page: 1,
    },
  };
};

export const PaymentsPage = () => {
  const auth = useAuth();
  const toast = useToast();

  const canReceive = auth.hasPermission("payment.receive");
  const canPay = auth.hasPermission("payment.pay");
  const canUpdate = auth.hasPermission("payment.update");
  const canCancel = auth.hasPermission("payment.cancel");
  const canExport = auth.hasPermission("payment.export");
  const canReceiptPrint = auth.hasPermission("payment.receipt.print");
  const canReminderManage = auth.hasPermission("payment.reminder.manage");

  const visibleTabs = useMemo(
    () =>
      PAYMENT_TABS.filter((tab) =>
        tab.permissions.length === 1 ? auth.hasPermission(tab.permissions[0]) : auth.hasPermission(tab.permissions),
      ).map((tab) => ({ id: tab.id, label: tab.label })),
    [auth],
  );

  const [activeTab, setActiveTab] = useState<PaymentManagementTab>(getFirstAvailableTab(visibleTabs.map((tab) => tab.id)));
  const [refreshKey, setRefreshKey] = useState(0);

  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [customerOptions, setCustomerOptions] = useState<PartyOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<PartyOption[]>([]);

  const [receiveSeed, setReceiveSeed] = useState<SeedState>({ key: 0, option: null });
  const [paySeed, setPaySeed] = useState<SeedState>({ key: 0, option: null });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [paymentsList, setPaymentsList] = useState<PaymentListResponse | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const debouncedPaymentsSearch = useDebouncedValue(paymentsSearch, 350);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsFilters, setPaymentsFilters] = useState<Record<string, string | boolean | undefined>>({
    partyType: "",
    paymentType: "",
    partyId: undefined,
    paymentMode: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [exporting, setExporting] = useState(false);

  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [sendReceiptPayment, setSendReceiptPayment] = useState<Payment | null>(null);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [chequePayment, setChequePayment] = useState<Payment | null>(null);
  const [updatingCheque, setUpdatingCheque] = useState(false);

  const [cancelPayment, setCancelPayment] = useState<Payment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const cancelForm = useForm<CancelPaymentFormInputValues, undefined, CancelPaymentFormValues>({
    resolver: zodResolver(CANCEL_PAYMENT_SCHEMA),
    defaultValues: { reason: "" },
  });

  const [dueScope, setDueScope] = useState<PartyType>("customer");
  const [dueFilters, setDueFilters] = useState<Record<string, string | boolean | undefined>>({
    partyId: undefined,
    dateFrom: "",
    dateTo: "",
    overdueOnly: false,
    agingBucket: "",
  });
  const [duePage, setDuePage] = useState(1);
  const [dueData, setDueData] = useState<DueTrackingResponse | null>(null);
  const [dueLoading, setDueLoading] = useState(false);

  const [advanceScope, setAdvanceScope] = useState<PartyType>("customer");
  const [advanceFilters, setAdvanceFilters] = useState<Record<string, string | boolean | undefined>>({
    partyId: undefined,
    paymentMode: "",
    dateFrom: "",
    dateTo: "",
  });
  const [advancePage, setAdvancePage] = useState(1);
  const [advancesData, setAdvancesData] = useState<PaymentListResponse | null>(null);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [allocationPayment, setAllocationPayment] = useState<Payment | null>(null);
  const [allocationDueItems, setAllocationDueItems] = useState<DueItem[]>([]);
  const [allocationAllocations, setAllocationAllocations] = useState<PaymentFormAllocationInput[]>([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [savingAllocations, setSavingAllocations] = useState(false);

  const [reminderFilters, setReminderFilters] = useState<Record<string, string | boolean | undefined>>({
    partyType: "",
    partyId: undefined,
    channel: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [reminderPage, setReminderPage] = useState(1);
  const [remindersData, setRemindersData] = useState<PaymentRemindersResponse | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const reminderForm = useForm<SendReminderFormInputValues, undefined, SendReminderFormValues>({
    resolver: zodResolver(SEND_REMINDER_SCHEMA),
    defaultValues: {
      partyType: "customer",
      partyId: "",
      referenceType: "manual",
      referenceId: null,
      referenceNumber: null,
      dueDate: new Date().toISOString().slice(0, 10),
      amountDue: 0,
      channel: "in_app",
      message: null,
    },
  });

  const [reminderStatusTarget, setReminderStatusTarget] = useState<PaymentReminder | null>(null);
  const [reminderStatusSubmitting, setReminderStatusSubmitting] = useState(false);
  const reminderStatusForm = useForm<ReminderStatusFormInputValues, undefined, ReminderStatusFormValues>({
    resolver: zodResolver(UPDATE_REMINDER_STATUS_SCHEMA),
    defaultValues: {
      status: "pending",
      errorMessage: null,
    },
  });

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(getFirstAvailableTab(visibleTabs.map((tab) => tab.id)));
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const loadReferenceData = async () => {
      const [bankResult, customerResult, supplierResult] = await Promise.allSettled([
        bankApi.list({ page: 1, limit: ALL_FETCH_LIMIT, isActive: true }),
        customersApi.list({ page: 1, limit: ALL_FETCH_LIMIT, status: "active" }),
        suppliersApi.list({ page: 1, limit: ALL_FETCH_LIMIT, status: "active" }),
      ]);

      setBankAccounts(bankResult.status === "fulfilled" ? bankResult.value.data.items.filter((item) => item.isActive) : []);
      setCustomerOptions(
        customerResult.status === "fulfilled"
          ? customerResult.value.data.items.map((item) => ({ id: item.id, label: item.name }))
          : [],
      );
      setSupplierOptions(
        supplierResult.status === "fulfilled"
          ? supplierResult.value.data.items.map((item) => ({ id: item.id, label: item.name }))
          : [],
      );
    };

    void loadReferenceData();
  }, []);

  useEffect(() => {
    if (activeTab !== "list") {
      return;
    }

    const loadPayments = async () => {
      try {
        setPaymentsLoading(true);
        const response = await paymentsApi.list({
          page: paymentsPage,
          limit: 20,
          search: debouncedPaymentsSearch || undefined,
          partyType: (paymentsFilters.partyType as PartyType | "") || undefined,
          paymentType: (paymentsFilters.paymentType as PaymentListQuery["paymentType"]) || undefined,
          partyId: (paymentsFilters.partyId as string | undefined) || undefined,
          paymentMode: (paymentsFilters.paymentMode as PaymentListQuery["paymentMode"]) || undefined,
          status: (paymentsFilters.status as PaymentListQuery["status"]) || undefined,
          dateFrom: (paymentsFilters.dateFrom as string) || undefined,
          dateTo: (paymentsFilters.dateTo as string) || undefined,
        });
        setPaymentsList(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load payments"));
      } finally {
        setPaymentsLoading(false);
      }
    };

    void loadPayments();
  }, [activeTab, debouncedPaymentsSearch, paymentsFilters, paymentsPage, refreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "dues") {
      return;
    }

    const loadDues = async () => {
      try {
        setDueLoading(true);
        const query: DueTrackingQuery = {
          page: dueFilters.agingBucket === "0-30" || dueFilters.agingBucket === "90+" ? 1 : duePage,
          limit: dueFilters.agingBucket === "0-30" || dueFilters.agingBucket === "90+" ? ALL_FETCH_LIMIT : 20,
          partyId: (dueFilters.partyId as string | undefined) || undefined,
          dateFrom: (dueFilters.dateFrom as string) || undefined,
          dateTo: (dueFilters.dateTo as string) || undefined,
          overdueOnly: Boolean(dueFilters.overdueOnly),
          agingBucket: mapDueFilterToApi(String(dueFilters.agingBucket ?? "")),
        };
        const response =
          dueScope === "customer"
            ? await paymentsApi.getCustomerDues(query)
            : await paymentsApi.getSupplierDues(query);
        setDueData(filterDueItems(response.data, String(dueFilters.agingBucket ?? "")));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load dues"));
      } finally {
        setDueLoading(false);
      }
    };

    void loadDues();
  }, [activeTab, dueFilters, duePage, dueScope, refreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "advances") {
      return;
    }

    const loadAdvances = async () => {
      try {
        setAdvancesLoading(true);
        const response = await paymentsApi.list({
          page: advancePage,
          limit: 20,
          partyType: advanceScope,
          partyId: (advanceFilters.partyId as string | undefined) || undefined,
          paymentMode: (advanceFilters.paymentMode as PaymentListQuery["paymentMode"]) || undefined,
          dateFrom: (advanceFilters.dateFrom as string) || undefined,
          dateTo: (advanceFilters.dateTo as string) || undefined,
          isAdvance: true,
        });
        setAdvancesData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load advances"));
      } finally {
        setAdvancesLoading(false);
      }
    };

    void loadAdvances();
  }, [activeTab, advanceFilters, advancePage, advanceScope, refreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "reminders") {
      return;
    }

    const loadReminders = async () => {
      try {
        setRemindersLoading(true);
        const usingChannelFilter = Boolean(reminderFilters.channel);
        const response = await paymentsApi.listReminders({
          page: usingChannelFilter ? 1 : reminderPage,
          limit: usingChannelFilter ? ALL_FETCH_LIMIT : 20,
          partyType: (reminderFilters.partyType as PartyType | "") || undefined,
          partyId: (reminderFilters.partyId as string | undefined) || undefined,
          status: (reminderFilters.status as PaymentReminder["status"] | "") || undefined,
          dateFrom: (reminderFilters.dateFrom as string) || undefined,
          dateTo: (reminderFilters.dateTo as string) || undefined,
        });
        setRemindersData(filterReminders(response.data, String(reminderFilters.channel ?? "")));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load reminders"));
      } finally {
        setRemindersLoading(false);
      }
    };

    void loadReminders();
  }, [activeTab, reminderFilters, reminderPage, refreshKey, toast]);

  const refreshData = () => setRefreshKey((value) => value + 1);

  const openPaymentDetail = async (paymentId: string) => {
    try {
      setDetailLoading(true);
      const response = await paymentsApi.get(paymentId);
      setDetailPayment(response.data.payment);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load payment"));
    } finally {
      setDetailLoading(false);
    }
  };

  const resolvePaymentDetail = async (payment: Payment) => {
    if (payment.allocations && payment.party?.email !== undefined) {
      return payment;
    }

    const response = await paymentsApi.get(payment.id);
    return response.data.payment;
  };

  const handleCompletePayment = async (payment: Payment) => {
    try {
      const detail = await resolvePaymentDetail(payment);
      const response = await paymentsApi.complete(detail.id, {
        allocations:
          detail.allocations?.map((allocation) => ({
            allocationType: allocation.allocationType,
            referenceId: allocation.referenceId,
            referenceNumber: allocation.referenceNumber,
            allocatedAmount: Number(allocation.allocatedAmount),
            allocationDate: allocation.allocationDate ? allocation.allocationDate.slice(0, 10) : detail.paymentDate.slice(0, 10),
          })) ?? [],
      });
      toast.success("Payment completed");
      refreshData();
      setDetailPayment(response.data.payment);
      setReceiptPaymentId(response.data.payment.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to complete payment"));
    }
  };

  const handlePrintReceipt = async (paymentId: string) => {
    try {
      const response = await paymentsApi.getReceiptPdfPayload(paymentId);
      openReceiptPrintWindow(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load receipt print view"));
    }
  };

  const openReminderForm = (payload?: Partial<SendReminderFormValues>) => {
    reminderForm.reset({
      partyType: payload?.partyType ?? "customer",
      partyId: payload?.partyId ?? "",
      referenceType: payload?.referenceType ?? "manual",
      referenceId: payload?.referenceId ?? null,
      referenceNumber: payload?.referenceNumber ?? null,
      dueDate: payload?.dueDate ?? new Date().toISOString().slice(0, 10),
      amountDue: payload?.amountDue ?? 0,
      channel: payload?.channel ?? "in_app",
      message: payload?.message ?? null,
    });
    setReminderFormOpen(true);
  };

  const openReminderStatusForm = (reminder: PaymentReminder) => {
    reminderStatusForm.reset({
      status: reminder.status,
      errorMessage: reminder.errorMessage,
    });
    setReminderStatusTarget(reminder);
  };

  const openAdvanceAllocation = async (payment: Payment) => {
    try {
      setAllocationLoading(true);
      const detail = await resolvePaymentDetail(payment);
      const dueItemsResponse = await paymentsApi.getPartyDueItems(detail.partyType, detail.partyId);
      setAllocationPayment(detail);
      setAllocationDueItems(dueItemsResponse.data.items);
      setAllocationAllocations(
        detail.allocations?.map((allocation) => ({
          allocationType: allocation.allocationType,
          referenceId: allocation.referenceId,
          referenceNumber: allocation.referenceNumber,
          allocatedAmount: Number(allocation.allocatedAmount),
          allocationDate: allocation.allocationDate ? allocation.allocationDate.slice(0, 10) : detail.paymentDate.slice(0, 10),
        })) ?? [],
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load advance allocation"));
    } finally {
      setAllocationLoading(false);
    }
  };

  const partyOptions = {
    customer: customerOptions,
    supplier: supplierOptions,
  };

  if (!visibleTabs.length) {
    return <EmptyState title="You do not have access to payment management." />;
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Payment Management"
          actions={
            activeTab === "list" && canExport ? (
              <Button
                type="button"
                variant="secondary"
                loading={exporting}
                onClick={async () => {
                  try {
                    setExporting(true);
                    const file = await paymentsApi.exportList({
                      page: 1,
                      limit: ALL_FETCH_LIMIT,
                      search: debouncedPaymentsSearch || undefined,
                      partyType: (paymentsFilters.partyType as PartyType | "") || undefined,
                      paymentType: (paymentsFilters.paymentType as PaymentListQuery["paymentType"]) || undefined,
                      partyId: (paymentsFilters.partyId as string | undefined) || undefined,
                      paymentMode: (paymentsFilters.paymentMode as PaymentListQuery["paymentMode"]) || undefined,
                      status: (paymentsFilters.status as PaymentListQuery["status"]) || undefined,
                      dateFrom: (paymentsFilters.dateFrom as string) || undefined,
                      dateTo: (paymentsFilters.dateTo as string) || undefined,
                    });
                    saveDownloadedFile(file.blob, file.fileName);
                    toast.success("Payments export downloaded");
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Failed to export payments"));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="mr-2 size-4" />
                Export
              </Button>
            ) : null
          }
        />

        <PaymentTabs tabs={visibleTabs} activeTab={activeTab} onChange={(tab) => {
          setActiveTab(tab);
          setEditingPaymentId(null);
        }} />

        {activeTab === "receive" ? (
          <ReceivePaymentForm
            bankAccounts={bankAccounts}
            canSubmit={canReceive}
            editingPaymentId={editingPaymentId}
            seedKey={receiveSeed.key}
            seedParty={receiveSeed.option}
            onCancelEdit={() => setEditingPaymentId(null)}
            onSubmitted={(payment, status) => {
              setEditingPaymentId(null);
              refreshData();
              if (status === "completed") {
                setReceiptPaymentId(payment.id);
              } else {
                setDetailPayment(payment);
              }
            }}
          />
        ) : null}

        {activeTab === "pay" ? (
          <PaySupplierForm
            bankAccounts={bankAccounts}
            canSubmit={canPay}
            editingPaymentId={editingPaymentId}
            seedKey={paySeed.key}
            seedParty={paySeed.option}
            onCancelEdit={() => setEditingPaymentId(null)}
            onSubmitted={(payment, status) => {
              setEditingPaymentId(null);
              refreshData();
              if (status === "completed") {
                setReceiptPaymentId(payment.id);
              } else {
                setDetailPayment(payment);
              }
            }}
          />
        ) : null}

        {activeTab === "list" ? (
          <div className="space-y-4">
            {paymentsList?.summary ? (
              <Card>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Amount</p>
                    <div className="mt-1"><AmountText value={paymentsList.summary.amount} /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Allocated</p>
                    <div className="mt-1"><AmountText value={paymentsList.summary.allocatedAmount} /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Advance</p>
                    <div className="mt-1"><AmountText value={paymentsList.summary.unallocatedAmount} tone="warning" /></div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <PaymentFilters
              variant="list"
              search={paymentsSearch}
              onSearchChange={(value) => {
                setPaymentsSearch(value);
                setPaymentsPage(1);
              }}
              values={paymentsFilters}
              partyOptions={
                paymentsFilters.partyType === "supplier"
                  ? supplierOptions
                  : paymentsFilters.partyType === "customer"
                    ? customerOptions
                    : [...customerOptions, ...supplierOptions]
              }
              partyLabel={
                paymentsFilters.partyType === "supplier"
                  ? "Suppliers"
                  : paymentsFilters.partyType === "customer"
                    ? "Customers"
                    : "Parties"
              }
              onChange={(updates) => {
                setPaymentsFilters((current) => ({ ...current, ...updates }));
                setPaymentsPage(1);
              }}
              onReset={() => {
                setPaymentsSearch("");
                setPaymentsPage(1);
                setPaymentsFilters({
                  partyType: "",
                  paymentType: "",
                  partyId: undefined,
                  paymentMode: "",
                  status: "",
                  dateFrom: "",
                  dateTo: "",
                });
              }}
            />

            <PaymentsListTable
              data={paymentsList}
              loading={paymentsLoading}
              canUpdate={canUpdate}
              canCancel={canCancel}
              canReceiptPrint={canReceiptPrint}
              canChequeUpdate={canUpdate}
              canCompleteCustomer={canReceive}
              canCompleteSupplier={canPay}
              onPageChange={setPaymentsPage}
              onView={(payment) => {
                setDetailPayment(null);
                void openPaymentDetail(payment.id);
              }}
              onEdit={(payment) => {
                setEditingPaymentId(payment.id);
                setActiveTab(payment.paymentType === "customer_receive" ? "receive" : "pay");
              }}
              onComplete={(payment) => void handleCompletePayment(payment)}
              onCancel={(payment) => {
                setCancelPayment(payment);
                cancelForm.reset({ reason: "" });
              }}
              onReceipt={(payment) => setReceiptPaymentId(payment.id)}
              onPdf={(payment) => void handlePrintReceipt(payment.id)}
              onSendReceipt={async (payment) => {
                const detail = await resolvePaymentDetail(payment);
                setSendReceiptPayment(detail);
              }}
              onChequeStatus={async (payment) => {
                const detail = await resolvePaymentDetail(payment);
                setChequePayment(detail);
              }}
            />
          </div>
        ) : null}

        {activeTab === "dues" ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
              {(["customer", "supplier"] as PartyType[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${dueScope === scope ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  onClick={() => {
                    setDueScope(scope);
                    setDuePage(1);
                  }}
                >
                  {scope === "customer" ? "Customer Dues" : "Supplier Dues"}
                </button>
              ))}
            </div>

            <PaymentFilters
              variant="due"
              values={dueFilters}
              partyOptions={partyOptions[dueScope]}
              partyLabel={dueScope === "customer" ? "Customers" : "Suppliers"}
              onChange={(updates) => {
                setDueFilters((current) => ({ ...current, ...updates }));
                setDuePage(1);
              }}
              onReset={() => {
                setDueFilters({
                  partyId: undefined,
                  dateFrom: "",
                  dateTo: "",
                  overdueOnly: false,
                  agingBucket: "",
                });
                setDuePage(1);
              }}
            />

            {dueData?.summary ? (
              <Card>
                <CardContent className="grid gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Due</p>
                    <div className="mt-1"><AmountText value={dueData.summary.totalDue} tone="danger" /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">0-30</p>
                    <div className="mt-1"><AmountText value={Number(dueData.summary.aging.current) + Number(dueData.summary.aging["1-30"])} tone="warning" /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">31-60</p>
                    <div className="mt-1"><AmountText value={dueData.summary.aging["31-60"]} tone="warning" /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">61-90</p>
                    <div className="mt-1"><AmountText value={dueData.summary.aging["61-90"]} tone="warning" /></div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">90+</p>
                    <div className="mt-1"><AmountText value={Number(dueData.summary.aging["91-180"]) + Number(dueData.summary.aging["181+"])} tone="danger" /></div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <DueTrackingTable
              data={dueData}
              loading={dueLoading}
              canWalletAction={dueScope === "customer" ? canReceive : canPay}
              canReminderAction={canReminderManage}
              actionLabel={dueScope === "customer" ? "Receive payment" : "Pay supplier"}
              onPageChange={setDuePage}
              onWallet={(row) => {
                const seed = createLookupOption(row.partyId, row.partyName, row.partyCode, dueScope);
                if (dueScope === "customer") {
                  setReceiveSeed((state) => ({ key: state.key + 1, option: seed }));
                  setActiveTab("receive");
                } else {
                  setPaySeed((state) => ({ key: state.key + 1, option: seed }));
                  setActiveTab("pay");
                }
                setEditingPaymentId(null);
              }}
              onReminder={(row) =>
                openReminderForm({
                  partyType: dueScope,
                  partyId: row.partyId,
                  referenceType: row.referenceType,
                  referenceId: row.referenceId,
                  referenceNumber: row.referenceNumber,
                  dueDate: row.dueDate?.slice(0, 10) ?? row.invoiceDate.slice(0, 10),
                  amountDue: Number(row.dueAmount),
                })
              }
            />
          </div>
        ) : null}

        {activeTab === "advances" ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
              {(["customer", "supplier"] as PartyType[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${advanceScope === scope ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  onClick={() => {
                    setAdvanceScope(scope);
                    setAdvancePage(1);
                  }}
                >
                  {scope === "customer" ? "Customer Advances" : "Supplier Advances"}
                </button>
              ))}
            </div>

            <PaymentFilters
              variant="advance"
              values={advanceFilters}
              partyOptions={partyOptions[advanceScope]}
              partyLabel={advanceScope === "customer" ? "Customers" : "Suppliers"}
              onChange={(updates) => {
                setAdvanceFilters((current) => ({ ...current, ...updates }));
                setAdvancePage(1);
              }}
              onReset={() => {
                setAdvanceFilters({
                  partyId: undefined,
                  paymentMode: "",
                  dateFrom: "",
                  dateTo: "",
                });
                setAdvancePage(1);
              }}
            />

            <AdvancesTable
              data={advancesData}
              loading={advancesLoading}
              canReceipt={canReceiptPrint}
              canAllocate={canUpdate}
              onPageChange={setAdvancePage}
              onView={(payment) => {
                setDetailPayment(null);
                void openPaymentDetail(payment.id);
              }}
              onAllocate={(payment) => void openAdvanceAllocation(payment)}
              onReceipt={(payment) => setReceiptPaymentId(payment.id)}
            />
          </div>
        ) : null}

        {activeTab === "reminders" ? (
          <div className="space-y-4">
            <PaymentFilters
              variant="reminder"
              values={reminderFilters}
              partyOptions={
                reminderFilters.partyType === "supplier"
                  ? supplierOptions
                  : reminderFilters.partyType === "customer"
                    ? customerOptions
                    : [...customerOptions, ...supplierOptions]
              }
              partyLabel="Parties"
              onChange={(updates) => {
                setReminderFilters((current) => ({ ...current, ...updates }));
                setReminderPage(1);
              }}
              onReset={() => {
                setReminderFilters({
                  partyType: "",
                  partyId: undefined,
                  channel: "",
                  status: "",
                  dateFrom: "",
                  dateTo: "",
                });
                setReminderPage(1);
              }}
            />

            {canReminderManage ? (
              <div className="flex justify-end">
                <Button type="button" onClick={() => openReminderForm()}>
                  New Reminder
                </Button>
              </div>
            ) : null}

            <RemindersTable
              data={remindersData}
              loading={remindersLoading}
              canManage={canReminderManage}
              onPageChange={setReminderPage}
              onSend={(reminder) =>
                openReminderForm({
                  partyType: reminder.partyType,
                  partyId: reminder.partyId,
                  referenceType: reminder.referenceType,
                  referenceId: reminder.referenceId,
                  referenceNumber: reminder.referenceNumber,
                  dueDate: reminder.dueDate.slice(0, 10),
                  amountDue: Number(reminder.amountDue),
                  channel: reminder.channel,
                  message: reminder.message,
                })
              }
              onUpdateStatus={openReminderStatusForm}
            />
          </div>
        ) : null}
      </div>

      <PaymentDetailDrawer
        open={Boolean(detailPayment || detailLoading)}
        payment={detailPayment}
        loading={detailLoading}
        canUpdate={canUpdate}
        canCancel={canCancel}
        canReceipt={canReceiptPrint}
        canChequeUpdate={canUpdate}
        canCompleteCustomer={canReceive}
        canCompleteSupplier={canPay}
        onClose={() => {
          setDetailPayment(null);
          setDetailLoading(false);
        }}
        onEdit={(payment) => {
          setEditingPaymentId(payment.id);
          setActiveTab(payment.paymentType === "customer_receive" ? "receive" : "pay");
          setDetailPayment(null);
        }}
        onComplete={(payment) => void handleCompletePayment(payment)}
        onCancel={(payment) => {
          setCancelPayment(payment);
          cancelForm.reset({ reason: "" });
        }}
        onReceipt={(payment) => setReceiptPaymentId(payment.id)}
        onPdf={(payment) => void handlePrintReceipt(payment.id)}
        onSendReceipt={(payment) => setSendReceiptPayment(payment)}
        onChequeStatus={(payment) => setChequePayment(payment)}
      />

      <ReceiptDrawer
        open={Boolean(receiptPaymentId)}
        paymentId={receiptPaymentId}
        onClose={() => setReceiptPaymentId(null)}
        onPrint={handlePrintReceipt}
      />

      <SendReceiptModal
        open={Boolean(sendReceiptPayment)}
        payment={sendReceiptPayment}
        submitting={sendingReceipt}
        onClose={() => setSendReceiptPayment(null)}
        onSubmit={async (values) => {
          if (!sendReceiptPayment) {
            return;
          }

          try {
            setSendingReceipt(true);
            const response = await paymentsApi.sendReceipt(sendReceiptPayment.id, values);
            if (response.data.status === "sent") {
              toast.success("Receipt sent");
            } else {
              toast.error(response.data.errorMessage || "Receipt could not be sent");
            }
            setSendReceiptPayment(null);
            refreshData();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to send receipt"));
          } finally {
            setSendingReceipt(false);
          }
        }}
      />

      <ChequeStatusModal
        open={Boolean(chequePayment)}
        payment={chequePayment}
        submitting={updatingCheque}
        onClose={() => setChequePayment(null)}
        onSubmit={async (values) => {
          if (!chequePayment) {
            return;
          }

          try {
            setUpdatingCheque(true);
            const response = await paymentsApi.updateChequeStatus(chequePayment.id, {
              chequeStatus: values.chequeStatus,
              statusDate: values.statusDate || undefined,
              remarks: values.remarks,
              reason: values.reason,
            });
            toast.success(`Cheque marked ${CHEQUE_STATUS_LABELS[values.chequeStatus]}`);
            setChequePayment(null);
            setDetailPayment(response.data.payment);
            refreshData();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to update cheque status"));
          } finally {
            setUpdatingCheque(false);
          }
        }}
      />

      <Modal
        open={Boolean(cancelPayment)}
        onClose={() => setCancelPayment(null)}
        title="Cancel Payment"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCancelPayment(null)}>
              Close
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={cancelling}
              onClick={cancelForm.handleSubmit(async (values) => {
                if (!cancelPayment) {
                  return;
                }

                try {
                  setCancelling(true);
                  const response = await paymentsApi.cancel(cancelPayment.id, values);
                  toast.success("Payment cancelled");
                  setCancelPayment(null);
                  setDetailPayment(response.data.payment);
                  refreshData();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to cancel payment"));
                } finally {
                  setCancelling(false);
                }
              })}
            >
              Cancel Payment
            </Button>
          </>
        }
      >
        <Textarea label="Reason" rows={4} {...cancelForm.register("reason")} error={cancelForm.formState.errors.reason?.message} />
      </Modal>

      <Modal
        open={reminderFormOpen}
        onClose={() => setReminderFormOpen(false)}
        title="Send Reminder"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setReminderFormOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              loading={reminderSubmitting}
              onClick={reminderForm.handleSubmit(async (values) => {
                try {
                  setReminderSubmitting(true);
                  const response = await paymentsApi.sendReminder(values);
                  if (response.data.reminder.status === "sent") {
                    toast.success("Reminder processed");
                  } else {
                    toast.error(response.data.reminder.errorMessage || "Reminder could not be sent");
                  }
                  setReminderFormOpen(false);
                  refreshData();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to send reminder"));
                } finally {
                  setReminderSubmitting(false);
                }
              })}
            >
              Send
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Party Type" {...reminderForm.register("partyType")} error={reminderForm.formState.errors.partyType?.message}>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
          </Select>
          <Select label="Party" {...reminderForm.register("partyId")} error={reminderForm.formState.errors.partyId?.message}>
            <option value="">Select party</option>
            {(reminderForm.watch("partyType") === "supplier" ? supplierOptions : customerOptions).map((party) => (
              <option key={party.id} value={party.id}>
                {party.label}
              </option>
            ))}
          </Select>
          <Input label="Reference Number" {...reminderForm.register("referenceNumber")} error={reminderForm.formState.errors.referenceNumber?.message} />
          <Input type="date" label="Due Date" {...reminderForm.register("dueDate")} error={reminderForm.formState.errors.dueDate?.message} />
          <Input type="number" min="0" step="0.01" label="Amount" {...reminderForm.register("amountDue")} error={reminderForm.formState.errors.amountDue?.message} />
          <Select label="Channel" {...reminderForm.register("channel")} error={reminderForm.formState.errors.channel?.message}>
            <option value="in_app">In-App</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </Select>
          <div className="md:col-span-2">
            <Textarea label="Message" rows={4} {...reminderForm.register("message")} error={reminderForm.formState.errors.message?.message} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(reminderStatusTarget)}
        onClose={() => setReminderStatusTarget(null)}
        title="Update Reminder Status"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setReminderStatusTarget(null)}>
              Close
            </Button>
            <Button
              type="button"
              loading={reminderStatusSubmitting}
              onClick={reminderStatusForm.handleSubmit(async (values) => {
                if (!reminderStatusTarget) {
                  return;
                }

                try {
                  setReminderStatusSubmitting(true);
                  await paymentsApi.updateReminderStatus(reminderStatusTarget.id, values);
                  toast.success("Reminder status updated");
                  setReminderStatusTarget(null);
                  refreshData();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to update reminder"));
                } finally {
                  setReminderStatusSubmitting(false);
                }
              })}
            >
              Update
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Status" {...reminderStatusForm.register("status")} error={reminderStatusForm.formState.errors.status?.message}>
            {REMINDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Error Message"
            rows={3}
            {...reminderStatusForm.register("errorMessage")}
            error={reminderStatusForm.formState.errors.errorMessage?.message}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(allocationPayment)}
        onClose={() => {
          setAllocationPayment(null);
          setAllocationDueItems([]);
          setAllocationAllocations([]);
        }}
        title={allocationPayment ? `Allocate Advance · ${allocationPayment.paymentNumber}` : "Allocate Advance"}
        className="max-w-5xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAllocationPayment(null);
                setAllocationDueItems([]);
                setAllocationAllocations([]);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              loading={savingAllocations}
              onClick={async () => {
                if (!allocationPayment) {
                  return;
                }

                try {
                  setSavingAllocations(true);
                  const response = await paymentsApi.replaceAllocations(allocationPayment.id, { allocations: allocationAllocations });
                  toast.success("Advance allocations updated");
                  setAllocationPayment(null);
                  setAllocationDueItems([]);
                  setAllocationAllocations([]);
                  setDetailPayment(response.data.payment);
                  refreshData();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to update allocations"));
                } finally {
                  setSavingAllocations(false);
                }
              }}
            >
              Save Allocations
            </Button>
          </>
        }
      >
        {allocationLoading || !allocationPayment ? (
          <Card>
            <CardContent>{allocationLoading ? "Loading advance..." : "Advance not available."}</CardContent>
          </Card>
        ) : (
          <AllocationTable
            dueItems={allocationDueItems}
            allocations={allocationAllocations}
            amount={Number(allocationPayment.amount)}
            paymentDate={allocationPayment.paymentDate.slice(0, 10)}
            paymentType={allocationPayment.paymentType}
            advanceLabel={allocationPayment.paymentType === "customer_receive" ? "Advance" : "Advance Paid"}
            onChange={setAllocationAllocations}
          />
        )}
      </Modal>
    </>
  );
};
