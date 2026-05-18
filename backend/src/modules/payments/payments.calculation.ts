import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  normalizeMoney as normalizeMoneyValue,
  scaledBigIntToDecimal,
  subtractDecimals
} from "../inventory/inventory.utils";

import type { PaymentAgingBucket } from "./payments.types";

export const normalizeMoney = (value: string | number | null | undefined) => normalizeMoneyValue(value);

export const calculateAllocatedAmount = (
  allocations: Array<{ allocatedAmount: string | number | null | undefined }>
) => allocations.reduce((total, allocation) => addDecimals(total, allocation.allocatedAmount, 2), "0.00");

export const calculateUnallocatedAmount = (
  amount: string | number | null | undefined,
  allocatedAmount: string | number | null | undefined
) => {
  const next = subtractDecimals(normalizeMoney(amount), normalizeMoney(allocatedAmount), 2);
  return compareDecimals(next, "0.00", 2) < 0 ? "0.00" : next;
};

export const calculateDueAfterAllocation = (
  currentDue: string | number | null | undefined,
  allocatedAmount: string | number | null | undefined
) => {
  const next = subtractDecimals(normalizeMoney(currentDue), normalizeMoney(allocatedAmount), 2);
  return compareDecimals(next, "0.00", 2) < 0 ? "0.00" : next;
};

export const validateAllocation = (input: {
  paymentAmount: string | number | null | undefined;
  totalAllocated: string | number | null | undefined;
  invoiceDue: string | number | null | undefined;
  allocatedAmount: string | number | null | undefined;
}) => {
  if (compareDecimals(input.allocatedAmount, "0.00", 2) <= 0) {
    return { isValid: false, message: "Allocated amount must be greater than 0" };
  }

  if (compareDecimals(input.totalAllocated, input.paymentAmount, 2) > 0) {
    return { isValid: false, message: "Allocation total cannot exceed payment amount" };
  }

  if (compareDecimals(input.allocatedAmount, input.invoiceDue, 2) > 0) {
    return { isValid: false, message: "Allocated amount cannot exceed the current due amount" };
  }

  return { isValid: true, message: null };
};

const calculateOverdueDays = (dueDate: Date, asOfDate: Date) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const utcDue = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const utcAsOf = Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate());
  return Math.floor((utcAsOf - utcDue) / dayMs);
};

export const calculateAgingBucket = (
  dueDate: Date | null,
  asOfDate = new Date()
): PaymentAgingBucket => {
  if (!dueDate) {
    return "current";
  }

  const overdueDays = calculateOverdueDays(dueDate, asOfDate);
  if (overdueDays <= 0) {
    return "current";
  }

  if (overdueDays <= 30) {
    return "1-30";
  }

  if (overdueDays <= 60) {
    return "31-60";
  }

  if (overdueDays <= 90) {
    return "61-90";
  }

  if (overdueDays <= 180) {
    return "91-180";
  }

  return "181+";
};

export const calculateAgingBuckets = (
  items: Array<{ amountDue: string | number | null | undefined; dueDate: Date | null }>
) => {
  const buckets: Record<PaymentAgingBucket, string> = {
    current: "0.00",
    "1-30": "0.00",
    "31-60": "0.00",
    "61-90": "0.00",
    "91-180": "0.00",
    "181+": "0.00"
  };

  for (const item of items) {
    const bucket = calculateAgingBucket(item.dueDate);
    buckets[bucket] = addDecimals(buckets[bucket], item.amountDue, 2);
  }

  return buckets;
};

export const calculatePaymentStatus = (input: {
  amount: string | number | null | undefined;
  allocatedAmount: string | number | null | undefined;
  unallocatedAmount: string | number | null | undefined;
}) => {
  const amount = normalizeMoney(input.amount);
  const allocatedAmount = normalizeMoney(input.allocatedAmount);
  const unallocatedAmount = normalizeMoney(input.unallocatedAmount);

  if (compareDecimals(allocatedAmount, "0.00", 2) <= 0) {
    return compareDecimals(unallocatedAmount, amount, 2) === 0 ? "unallocated" : "advance";
  }

  if (compareDecimals(unallocatedAmount, "0.00", 2) <= 0) {
    return "fully_allocated";
  }

  return "partially_allocated";
};

export const toSignedMoney = (value: string | number | null | undefined) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 2), 2);
