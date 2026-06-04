import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { formatPreferredDate, formatPreferredDateTime } from "../../lib/date-format";
import type {
  Supplier,
  SupplierCreatePayload,
  SupplierFormInput,
  SupplierPurchaseRow,
  SupplierStatus,
  SupplierUpdatePayload,
} from "../../types/supplier";

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

const subtractAmounts = (value: string | number | null | undefined, subtractBy: string | number | null | undefined) => {
  const left = Number(value);
  const right = Number(subtractBy);

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return (left - right).toFixed(2);
};

export const formatInr = (value: string | number | null | undefined) => currencyFormatter.format(Number(value ?? 0));

export const formatPercent = (value: string | number | null | undefined) =>
  `${percentFormatter.format(Number(value ?? 0))}%`;

export const formatDate = (value: string | Date | null | undefined, formatString = "dd MMM yyyy") => {
  return formatPreferredDate(value, formatString);
};

export const formatDateTime = (value: string | Date | null | undefined) => formatPreferredDateTime(value);

export const saveDownloadedFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const buildSupplierFormDefaults = (supplier?: Supplier | null): SupplierFormInput => ({
  name: supplier?.name ?? "",
  supplierType: supplier?.supplierType ?? "business",
  businessName: supplier?.businessName ?? null,
  contactPerson: supplier?.contactPerson ?? null,
  mobile: supplier?.mobile ?? "",
  alternateMobile: supplier?.alternateMobile ?? null,
  email: supplier?.email ?? null,
  website: supplier?.website ?? null,
  gstNumber: supplier?.gstNumber ?? null,
  panNumber: supplier?.panNumber ?? null,
  tanNumber: supplier?.tanNumber ?? null,
  taxType: supplier?.taxType ?? "unregistered",
  gstState: supplier?.gstState ?? null,
  reverseChargeApplicable: supplier?.reverseChargeApplicable ?? false,
  msmeRegistered: supplier?.msmeRegistered ?? false,
  billingAddressLine1: supplier?.billingAddressLine1 ?? null,
  billingAddressLine2: supplier?.billingAddressLine2 ?? null,
  billingCity: supplier?.billingCity ?? null,
  billingState: supplier?.billingState ?? null,
  billingPincode: supplier?.billingPincode ?? null,
  billingCountry: supplier?.billingCountry ?? "India",
  shippingAddressLine1: supplier?.shippingAddressLine1 ?? null,
  shippingAddressLine2: supplier?.shippingAddressLine2 ?? null,
  shippingCity: supplier?.shippingCity ?? null,
  shippingState: supplier?.shippingState ?? null,
  shippingPincode: supplier?.shippingPincode ?? null,
  shippingCountry: supplier?.shippingCountry ?? "India",
  sameAsBilling: supplier?.sameAsBilling ?? true,
  creditLimit: Number(supplier?.creditLimit ?? 0),
  creditDays: supplier?.creditDays ?? 0,
  paymentTerms: supplier?.paymentTerms ?? null,
  defaultGstRate: Number(supplier?.defaultGstRate ?? 0),
  defaultDiscount: Number(supplier?.defaultDiscount ?? 0),
  bankName: supplier?.bankName ?? null,
  accountHolderName: supplier?.accountHolderName ?? null,
  accountNumber: supplier?.accountNumber ?? null,
  ifscCode: supplier?.ifscCode ?? null,
  bankBranch: supplier?.bankBranch ?? null,
  upiId: supplier?.upiId ?? null,
  status: supplier?.status === "inactive" || supplier?.status === "blocked" ? supplier.status : "active",
  isBlacklisted: supplier?.isBlacklisted ?? false,
  blacklistReason: null,
  isPreferred: supplier?.isPreferred ?? false,
  notes: supplier?.notes ?? null,
});

export const createSupplierPayload = (values: SupplierFormInput): SupplierCreatePayload => ({
  name: values.name,
  supplierType: values.supplierType,
  businessName: values.businessName,
  contactPerson: values.contactPerson,
  mobile: values.mobile,
  alternateMobile: values.alternateMobile,
  email: values.email,
  website: values.website,
  gstNumber: values.gstNumber,
  panNumber: values.panNumber,
  tanNumber: values.tanNumber,
  taxType: values.taxType,
  gstState: values.gstState,
  reverseChargeApplicable: values.reverseChargeApplicable,
  msmeRegistered: values.msmeRegistered,
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
  paymentTerms: values.paymentTerms,
  defaultGstRate: values.defaultGstRate,
  defaultDiscount: values.defaultDiscount,
  bankName: values.bankName,
  accountHolderName: values.accountHolderName,
  accountNumber: values.accountNumber,
  ifscCode: values.ifscCode,
  bankBranch: values.bankBranch,
  upiId: values.upiId,
  status: values.status,
  isPreferred: values.isPreferred,
  notes: values.notes,
});

export const createSupplierUpdatePayload = (values: SupplierFormInput): SupplierUpdatePayload => ({
  name: values.name,
  supplierType: values.supplierType,
  businessName: values.businessName,
  contactPerson: values.contactPerson,
  mobile: values.mobile,
  alternateMobile: values.alternateMobile,
  email: values.email,
  website: values.website,
  gstNumber: values.gstNumber,
  panNumber: values.panNumber,
  tanNumber: values.tanNumber,
  taxType: values.taxType,
  gstState: values.gstState,
  reverseChargeApplicable: values.reverseChargeApplicable,
  msmeRegistered: values.msmeRegistered,
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
  paymentTerms: values.paymentTerms,
  defaultGstRate: values.defaultGstRate,
  defaultDiscount: values.defaultDiscount,
  bankName: values.bankName,
  accountHolderName: values.accountHolderName,
  accountNumber: values.accountNumber,
  ifscCode: values.ifscCode,
  bankBranch: values.bankBranch,
  upiId: values.upiId,
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

export const getSupplierStatusTone = (status: SupplierStatus) => {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "inactive") {
    return "neutral" as const;
  }

  return "danger" as const;
};

export const getTaxTypeTone = (taxType: Supplier["taxType"]) => {
  if (taxType === "registered") {
    return "success" as const;
  }

  if (taxType === "composition") {
    return "warning" as const;
  }

  return "neutral" as const;
};

export const getGenericStatusTone = (status: string | null | undefined) => {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) {
    return "neutral" as const;
  }

  if (["active", "paid", "completed", "success", "clear"].includes(normalized)) {
    return "success" as const;
  }

  if (["pending", "partial", "processing", "draft"].includes(normalized)) {
    return "warning" as const;
  }

  if (["blocked", "cancelled", "canceled", "failed", "deleted", "overdue", "unpaid"].includes(normalized)) {
    return "danger" as const;
  }

  return "neutral" as const;
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

export const toProfileCards = (supplier: Supplier | null | undefined) => [
  { label: "Mobile", value: trimToEmpty(supplier?.mobile) || "-" },
  { label: "Alternate Mobile", value: trimToEmpty(supplier?.alternateMobile) || "-" },
  { label: "Email", value: trimToEmpty(supplier?.email) || "-" },
  { label: "Contact Person", value: trimToEmpty(supplier?.contactPerson) || "-" },
  { label: "Website", value: trimToEmpty(supplier?.website) || "-" },
  { label: "Business Name", value: trimToEmpty(supplier?.businessName) || "-" },
];

export const getPurchaseInvoiceLabel = (item: SupplierPurchaseRow) => item.purchaseInvoiceNo || item.referenceNo || "-";

export const getPurchaseGstAmount = (item: SupplierPurchaseRow) => item.gstAmount ?? item.gst ?? null;

export const getPurchaseTotalAmount = (item: SupplierPurchaseRow) => item.totalAmount ?? item.grossAmount ?? null;

export const getPurchasePaidAmount = (item: SupplierPurchaseRow) => {
  if (item.paidAmount !== undefined) {
    return item.paidAmount;
  }

  if (item.totalAmount !== undefined && item.dueAmount !== undefined) {
    return subtractAmounts(item.totalAmount, item.dueAmount);
  }

  return null;
};

export const getLinkedPurchaseLabel = (value: { linkedPurchase?: string | null; linkedInvoice?: string | null }) =>
  value.linkedPurchase || value.linkedInvoice || "-";
