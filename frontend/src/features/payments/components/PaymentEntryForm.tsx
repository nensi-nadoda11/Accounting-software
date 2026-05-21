import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { getErrorMessage } from "../../../lib/errors";
import { useToast } from "../../../providers/useToast";
import { customersApi } from "../../../services/customersApi";
import { paymentsApi } from "../../../services/paymentsApi";
import { suppliersApi } from "../../../services/suppliersApi";
import type { CompanyBankAccount } from "../../../types/company";
import type { DueItem, PartyType, Payment, PaymentFormInput, PaymentType } from "../../../types/payment";
import type { CustomerListItem } from "../../../types/customer";
import type { SupplierListItem } from "../../../types/supplier";
import { applyFriendlyFieldErrors } from "../../customers/customerUtils";
import { AsyncLookupSelect, type LookupOption } from "../../sales/components/AsyncLookupSelect";
import { AllocationTable } from "./AllocationTable";
import { paymentFormSchema, type PaymentFormInputValues, type PaymentFormValues } from "../paymentSchemas";
import { PAYMENT_MODE_OPTIONS } from "../paymentOptions";
import {
  autoAllocateDueItems,
  buildPaymentPayload,
  getRemainingAmount,
  isChequeMode,
  mapPaymentToFormValues,
  requiresBankAccount,
} from "../paymentUtils";

const createDefaults = (paymentType: PaymentType, partyType: PartyType): PaymentFormValues => ({
  paymentType,
  partyType,
  partyId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  paymentMode: "cash",
  bankAccountId: null,
  referenceNumber: null,
  notes: null,
  status: "draft",
  isAdvance: false,
  chequeNumber: null,
  chequeDate: null,
  chequeBankName: null,
  chequeStatus: paymentType === "customer_receive" ? "received" : "issued",
  allocations: [],
});

const buildLookupOption = (payment: Payment): LookupOption | null =>
  payment.party
    ? {
        id: payment.party.id,
        label: payment.party.name ?? "-",
        description: payment.party.code ?? null,
        meta: payment.partyType === "customer" ? "Customer" : "Supplier",
      }
    : null;

const DIRECTORY_LIMIT = 100;

const buildCustomerLookupOption = (customer: Pick<CustomerListItem, "id" | "name" | "customerCode" | "mobile">): LookupOption => ({
  id: customer.id,
  label: customer.name,
  description: customer.customerCode,
  meta: customer.mobile,
});

const buildSupplierLookupOption = (supplier: Pick<SupplierListItem, "id" | "name" | "supplierCode" | "mobile">): LookupOption => ({
  id: supplier.id,
  label: supplier.name,
  description: supplier.supplierCode,
  meta: supplier.mobile,
});

const matchesPartySearch = (
  option: Pick<CustomerListItem, "name" | "customerCode" | "mobile" | "businessName" | "email"> | Pick<SupplierListItem, "name" | "supplierCode" | "mobile" | "businessName" | "email">,
  search: string,
) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    option.name,
    "customerCode" in option ? option.customerCode : option.supplierCode,
    option.mobile,
    option.businessName,
    option.email,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
};

export const PaymentEntryForm = ({
  mode,
  title,
  partyLabel,
  advanceLabel,
  paymentType,
  partyType,
  bankAccounts,
  canSubmit,
  editingPaymentId,
  seedKey,
  seedParty,
  onSubmitted,
  onCancelEdit,
}: {
  mode: "receive" | "pay";
  title: string;
  partyLabel: string;
  advanceLabel: string;
  paymentType: PaymentType;
  partyType: PartyType;
  bankAccounts: CompanyBankAccount[];
  canSubmit: boolean;
  editingPaymentId: string | null;
  seedKey: number;
  seedParty: LookupOption | null;
  onSubmitted: (payment: Payment, status: "draft" | "completed") => void;
  onCancelEdit: () => void;
}) => {
  const toast = useToast();
  const [lookupOptions, setLookupOptions] = useState<LookupOption[]>([]);
  const [partyDirectory, setPartyDirectory] = useState<Array<CustomerListItem | SupplierListItem>>([]);
  const [partyDirectoryLoaded, setPartyDirectoryLoaded] = useState(false);
  const [lookupValue, setLookupValue] = useState<LookupOption | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingDueItems, setLoadingDueItems] = useState(false);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lookupRequestRef = useRef(0);

  const form = useForm<PaymentFormInputValues, undefined, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: createDefaults(paymentType, partyType),
  });

  const paymentMode = form.watch("paymentMode");
  const amount = Number(form.watch("amount") || 0);
  const paymentDate = String(form.watch("paymentDate") ?? "");
  const allocations = (form.watch("allocations") as PaymentFormInput["allocations"]) ?? [];
  const partyId = form.watch("partyId");

  const remainingAmount = useMemo(() => getRemainingAmount(amount, allocations), [allocations, amount]);

  useEffect(() => {
    let cancelled = false;
    setPartyDirectory([]);
    setPartyDirectoryLoaded(false);
    setLookupOptions([]);
    setLoadingLookup(false);

    void (async () => {
      try {
        const response =
          partyType === "customer"
            ? await customersApi.list({ page: 1, limit: DIRECTORY_LIMIT, status: "active", sortBy: "name", sortOrder: "asc" })
            : await suppliersApi.list({ page: 1, limit: DIRECTORY_LIMIT, status: "active", sortBy: "name", sortOrder: "asc" });

        if (cancelled) {
          return;
        }

        setPartyDirectory(response.data.items);
      } catch {
        if (cancelled) {
          return;
        }

        setPartyDirectory([]);
      } finally {
        if (!cancelled) {
          setPartyDirectoryLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partyType]);

  const loadLookupOptions = useCallback(async (searchValue: string) => {
    const normalizedSearch = searchValue.trim();
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;

    const cachedMatches = partyDirectory
      .filter((option) => matchesPartySearch(option, normalizedSearch))
      .slice(0, 20)
      .map((option) => ("customerCode" in option ? buildCustomerLookupOption(option) : buildSupplierLookupOption(option)));

    setLookupOptions(cachedMatches);

    if (!normalizedSearch || (partyDirectoryLoaded && (cachedMatches.length > 0 || partyDirectory.length < DIRECTORY_LIMIT))) {
      setLoadingLookup(false);
      return;
    }

    try {
      setLoadingLookup(true);
      let remoteOptions: LookupOption[] = [];

      if (partyType === "customer") {
        const response = await customersApi.list({ page: 1, limit: 20, search: normalizedSearch, status: "active" });
        if (lookupRequestRef.current !== requestId) {
          return;
        }

        setPartyDirectory((current) => {
          const next = new Map(current.map((item) => [item.id, item]));
          response.data.items.forEach((item) => {
            next.set(item.id, item);
          });
          return Array.from(next.values());
        });

        remoteOptions = response.data.items.map(buildCustomerLookupOption);
      } else {
        const response = await suppliersApi.list({ page: 1, limit: 20, search: normalizedSearch, status: "active" });
        if (lookupRequestRef.current !== requestId) {
          return;
        }

        setPartyDirectory((current) => {
          const next = new Map(current.map((item) => [item.id, item]));
          response.data.items.forEach((item) => {
            next.set(item.id, item);
          });
          return Array.from(next.values());
        });

        remoteOptions = response.data.items.map(buildSupplierLookupOption);
      }

      const merged = new Map<string, LookupOption>();
      [...cachedMatches, ...remoteOptions].forEach((option) => {
        merged.set(option.id, option);
      });
      setLookupOptions(Array.from(merged.values()));
    } catch {
      if (lookupRequestRef.current === requestId) {
        setLookupOptions(cachedMatches);
      }
    } finally {
      if (lookupRequestRef.current === requestId) {
        setLoadingLookup(false);
      }
    }
  }, [partyDirectory, partyDirectoryLoaded, partyType]);

  const syncDueItems = async (nextPartyId: string, nextPaymentDate: string, applyAutoAllocate: boolean, initialAllocations?: PaymentFormInput["allocations"]) => {
    try {
      setLoadingDueItems(true);
      const response = await paymentsApi.getPartyDueItems(partyType, nextPartyId);
      setDueItems(response.data.items);
      if (initialAllocations) {
        form.setValue("allocations", initialAllocations, { shouldValidate: true, shouldDirty: false });
        return;
      }

      if (applyAutoAllocate) {
        form.setValue("allocations", autoAllocateDueItems(response.data.items, amount, paymentType, nextPaymentDate), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    } catch (error) {
      setDueItems([]);
      toast.error(getErrorMessage(error, "Failed to load due items"));
    } finally {
      setLoadingDueItems(false);
    }
  };

  const handleSelectParty = async (option: LookupOption) => {
    setLookupValue(option);
    form.setValue("partyId", option.id, { shouldValidate: true, shouldDirty: true });
    await syncDueItems(option.id, form.getValues("paymentDate"), true);
  };

  const resetForNew = () => {
    form.reset(createDefaults(paymentType, partyType));
    setLookupValue(null);
    setDueItems([]);
  };

  useEffect(() => {
    if (!editingPaymentId) {
      resetForNew();
      return;
    }

    const loadDraft = async () => {
      try {
        setLoadingDraft(true);
        const response = await paymentsApi.get(editingPaymentId);
        const payment = response.data.payment;
        const nextValues = mapPaymentToFormValues(payment);
        form.reset(nextValues);
        setLookupValue(buildLookupOption(payment));
        await syncDueItems(payment.partyId, nextValues.paymentDate, false, nextValues.allocations);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load payment draft"));
      } finally {
        setLoadingDraft(false);
      }
    };

    void loadDraft();
  }, [editingPaymentId]);

  useEffect(() => {
    if (!seedParty || editingPaymentId) {
      return;
    }

    form.reset({
      ...createDefaults(paymentType, partyType),
      partyId: seedParty.id,
    });
    setLookupValue(seedParty);
    void syncDueItems(seedParty.id, new Date().toISOString().slice(0, 10), true);
  }, [editingPaymentId, form, partyType, paymentType, seedKey, seedParty]);

  useEffect(() => {
    if (!requiresBankAccount(paymentMode)) {
      form.setValue("bankAccountId", null, { shouldValidate: true });
    }

    if (!isChequeMode(paymentMode)) {
      form.setValue("chequeNumber", null);
      form.setValue("chequeDate", null);
      form.setValue("chequeBankName", null);
    }
  }, [form, paymentMode]);

  const submitPayment = async (values: PaymentFormValues, status: "draft" | "completed") => {
    try {
      setSubmitting(true);
      const payload = buildPaymentPayload(values, status);
      const response = editingPaymentId
        ? await paymentsApi.update(editingPaymentId, {
            paymentDate: payload.paymentDate,
            amount: payload.amount,
            paymentMode: payload.paymentMode,
            bankAccountId: payload.bankAccountId,
            referenceNumber: payload.referenceNumber,
            notes: payload.notes,
            chequeNumber: payload.chequeNumber,
            chequeDate: payload.chequeDate,
            chequeBankName: payload.chequeBankName,
            chequeStatus: payload.chequeStatus,
            allocations: payload.allocations,
          })
        : await paymentsApi.create(payload);

      const paymentId = response.data.payment.id;
      const finalResponse =
        status === "completed" && response.data.payment.status !== "completed"
          ? await paymentsApi.complete(paymentId, { allocations: payload.allocations })
          : response;

      toast.success(status === "completed" ? `${title} completed` : `${title} draft saved`);
      onSubmitted(finalResponse.data.payment, status);
      if (!editingPaymentId) {
        resetForNew();
      }
    } catch (error) {
      applyFriendlyFieldErrors(error, form.setError);
      toast.error(getErrorMessage(error, `Failed to save ${title.toLowerCase()}`));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSubmit && !editingPaymentId) {
    return <EmptyState title={`You do not have access to ${title.toLowerCase()}.`} />;
  }

  if (loadingDraft) {
    return <LoadingState label="Loading draft..." />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={editingPaymentId ? `${title} Draft` : title} />
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <AsyncLookupSelect
              label={partyLabel}
              placeholder={`Search ${partyLabel.toLowerCase()}`}
              value={lookupValue}
              loading={loadingLookup}
              options={lookupOptions}
              error={form.formState.errors.partyId?.message}
              onSearch={(value) => void loadLookupOptions(value)}
              onSelect={(option) => void handleSelectParty(option)}
              onClear={() => {
                form.setValue("partyId", "", { shouldValidate: true, shouldDirty: true });
                setLookupValue(null);
                setDueItems([]);
                form.setValue("allocations", [], { shouldValidate: true });
              }}
            />
          </div>
          <Input type="date" label="Payment Date" {...form.register("paymentDate")} error={form.formState.errors.paymentDate?.message} />
          <Input type="number" min="0" step="0.01" label="Amount" {...form.register("amount")} error={form.formState.errors.amount?.message} />
          <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
            {PAYMENT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {requiresBankAccount(paymentMode) ? (
            <Select label="Bank Account" {...form.register("bankAccountId")} error={form.formState.errors.bankAccountId?.message}>
              <option value="">Select bank account</option>
              {bankAccounts.map((bankAccount) => (
                <option key={bankAccount.id} value={bankAccount.id}>
                  {bankAccount.bankName} · {bankAccount.accountNumber.slice(-4)}
                </option>
              ))}
            </Select>
          ) : (
            <div />
          )}
          <Input label="Reference Number" {...form.register("referenceNumber")} error={form.formState.errors.referenceNumber?.message} />
          {isChequeMode(paymentMode) ? (
            <>
              <Input label="Cheque Number" {...form.register("chequeNumber")} error={form.formState.errors.chequeNumber?.message} />
              <Input type="date" label="Cheque Date" {...form.register("chequeDate")} error={form.formState.errors.chequeDate?.message} />
              <Input label="Cheque Bank Name" {...form.register("chequeBankName")} error={form.formState.errors.chequeBankName?.message} />
            </>
          ) : null}
          <div className="md:col-span-2 xl:col-span-4">
            <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
          </div>
        </CardContent>
      </Card>

      {partyId ? (
        <>
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Due Items</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{dueItems.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Remaining</p>
                <div className="mt-1">
                  <AmountText value={remainingAmount} tone="warning" />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{advanceLabel}</p>
                <div className="mt-1">
                  <AmountText value={remainingAmount} tone="warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          {loadingDueItems ? (
            <LoadingState label="Loading due items..." />
          ) : (
            <AllocationTable
              dueItems={dueItems}
              allocations={allocations}
              amount={amount}
              paymentDate={paymentDate}
              paymentType={paymentType}
              advanceLabel={advanceLabel}
              error={form.formState.errors.allocations?.message}
              onChange={(nextAllocations) => form.setValue("allocations", nextAllocations, { shouldValidate: true, shouldDirty: true })}
            />
          )}
        </>
      ) : (
        <EmptyState title={`Select a ${partyLabel.toLowerCase()} to load due items`} />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {editingPaymentId ? (
          <Button type="button" variant="secondary" onClick={onCancelEdit}>
            Cancel Edit
          </Button>
        ) : null}
        <Button type="button" variant="secondary" loading={submitting} onClick={form.handleSubmit(async (values) => submitPayment(values, "draft"))}>
          Save Draft
        </Button>
        <Button type="button" loading={submitting} onClick={form.handleSubmit(async (values) => submitPayment(values, "completed"))}>
          {mode === "receive" ? "Complete Payment" : "Complete Voucher"}
        </Button>
      </div>
    </div>
  );
};

