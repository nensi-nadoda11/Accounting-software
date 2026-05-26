import { format } from "date-fns";
import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { Customer, CustomerCreatePayload, CustomerFormInput, CustomerUpdatePayload } from "../../types/customer";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const trimToEmpty = (value: string | null | undefined) => value ?? "";

const normalizeServerField = (field: string) => {
  if (field.startsWith("body.")) {
    return field.slice(5);
  }

  return field;
};

export const formatInr = (value: string | number | null | undefined) =>
  currencyFormatter.format(Number(value ?? 0));

export const formatPercent = (value: string | number | null | undefined) =>
  `${percentFormatter.format(Number(value ?? 0))}%`;

export const formatDate = (value: string | Date | null | undefined, formatString = "dd MMM yyyy") => {
  if (!value) {
    return "-";
  }

  return format(new Date(value), formatString);
};

export const formatDateTime = (value: string | Date | null | undefined) => formatDate(value, "dd MMM yyyy, hh:mm a");

export const saveDownloadedFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const buildCustomerFormDefaults = (customer?: Customer | null): CustomerFormInput => ({
  name: customer?.name ?? "",
  customerType: customer?.customerType ?? "individual",
  businessName: customer?.businessName ?? null,
  contactPerson: customer?.contactPerson ?? null,
  mobile: customer?.mobile ?? "",
  alternateMobile: customer?.alternateMobile ?? null,
  email: customer?.email ?? null,
  gstNumber: customer?.gstNumber ?? null,
  panNumber: customer?.panNumber ?? null,
  taxType: customer?.taxType ?? "unregistered",
  billingAddressLine1: customer?.billingAddressLine1 ?? null,
  billingAddressLine2: customer?.billingAddressLine2 ?? null,
  billingCity: customer?.billingCity ?? null,
  billingState: customer?.billingState ?? null,
  billingPincode: customer?.billingPincode ?? null,
  billingCountry: customer?.billingCountry ?? "India",
  shippingAddressLine1: customer?.shippingAddressLine1 ?? null,
  shippingAddressLine2: customer?.shippingAddressLine2 ?? null,
  shippingCity: customer?.shippingCity ?? null,
  shippingState: customer?.shippingState ?? null,
  shippingPincode: customer?.shippingPincode ?? null,
  shippingCountry: customer?.shippingCountry ?? "India",
  sameAsBilling: customer?.sameAsBilling ?? false,
  creditLimit: Number(customer?.creditLimit ?? 0),
  creditDays: customer?.creditDays ?? 0,
  defaultDiscount: Number(customer?.defaultDiscount ?? 0),
  status: customer?.status === "inactive" ? "inactive" : "active",
  isBlacklisted: customer?.isBlacklisted ?? false,
  blacklistReason: null,
  notes: customer?.notes ?? null,
});

export const createCustomerPayload = (values: CustomerFormInput): CustomerCreatePayload => ({
  name: values.name,
  customerType: values.customerType,
  businessName: values.businessName,
  contactPerson: values.contactPerson,
  mobile: values.mobile,
  alternateMobile: values.alternateMobile,
  email: values.email,
  gstNumber: values.gstNumber,
  panNumber: values.panNumber,
  taxType: values.taxType,
  billingAddressLine1: values.billingAddressLine1,
  billingAddressLine2: values.billingAddressLine2,
  billingCity: values.billingCity,
  billingState: values.billingState,
  billingPincode: values.billingPincode,
  billingCountry: values.billingCountry,
  shippingAddressLine1: values.shippingAddressLine1,
  shippingAddressLine2: values.shippingAddressLine2,
  shippingCity: values.shippingCity,
  shippingState: values.shippingState,
  shippingPincode: values.shippingPincode,
  shippingCountry: values.shippingCountry,
  sameAsBilling: values.sameAsBilling,
  creditLimit: values.creditLimit,
  creditDays: values.creditDays,
  defaultDiscount: values.defaultDiscount,
  status: values.status,
  notes: values.notes,
});

export const createCustomerUpdatePayload = (values: CustomerFormInput): CustomerUpdatePayload => ({
  name: values.name,
  customerType: values.customerType,
  businessName: values.businessName,
  contactPerson: values.contactPerson,
  mobile: values.mobile,
  alternateMobile: values.alternateMobile,
  email: values.email,
  gstNumber: values.gstNumber,
  panNumber: values.panNumber,
  taxType: values.taxType,
  billingAddressLine1: values.billingAddressLine1,
  billingAddressLine2: values.billingAddressLine2,
  billingCity: values.billingCity,
  billingState: values.billingState,
  billingPincode: values.billingPincode,
  billingCountry: values.billingCountry,
  shippingAddressLine1: values.shippingAddressLine1,
  shippingAddressLine2: values.shippingAddressLine2,
  shippingCity: values.shippingCity,
  shippingState: values.shippingState,
  shippingPincode: values.shippingPincode,
  shippingCountry: values.shippingCountry,
  sameAsBilling: values.sameAsBilling,
  creditLimit: values.creditLimit,
  creditDays: values.creditDays,
  defaultDiscount: values.defaultDiscount,
  notes: values.notes,
});

export const formatAddress = (parts: Array<string | null | undefined>) => {
  const joined = parts.map((part) => part?.trim()).filter(Boolean).join(", ");
  return joined || "-";
};

export const toInputString = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export const applyFriendlyFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
) => {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }

  const data = error.response.data as ApiErrorShape | undefined;
  const handled = new Set<string>();

  for (const item of data?.errors ?? []) {
    const separatorIndex = item.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = normalizeServerField(item.slice(0, separatorIndex).trim()) as Path<TFieldValues>;
    const message = item.slice(separatorIndex + 1).trim();

    if (!field || !message) {
      continue;
    }

    handled.add(field);
    setError(field, { type: "server", message });
  }

  const message = data?.message?.toLowerCase() ?? "";
  if (!handled.size) {
    if (message.includes("mobile")) {
      setError("mobile" as Path<TFieldValues>, { type: "server", message: data?.message ?? "Mobile number is invalid" });
      handled.add("mobile");
    }

    if (message.includes("email")) {
      setError("email" as Path<TFieldValues>, { type: "server", message: data?.message ?? "Email is invalid" });
      handled.add("email");
    }
  }

  return handled.size > 0;
};

export const toSummaryCards = (customer: Customer | null | undefined) => [
  { label: "Mobile", value: trimToEmpty(customer?.mobile) || "-" },
  { label: "Email", value: trimToEmpty(customer?.email) || "-" },
  { label: "GST", value: trimToEmpty(customer?.gstNumber) || "-" },
  { label: "PAN", value: trimToEmpty(customer?.panNumber) || "-" },
];
