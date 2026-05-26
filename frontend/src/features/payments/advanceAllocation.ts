import { paymentsApi } from "../../services/paymentsApi";
import type { PartyType, PaymentType } from "../../types/payment";

const toCents = (value: string | number) => Math.round(Number(value) * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export const allocateAdvancePayments = async ({
  partyType,
  paymentType,
  partyId,
  referenceType,
  referenceId,
  referenceNumber,
  allocationDate,
  amount,
}: {
  partyType: PartyType;
  paymentType: PaymentType;
  partyId: string;
  referenceType: "sales_invoice" | "purchase_invoice";
  referenceId: string;
  referenceNumber: string;
  allocationDate: string;
  amount: number;
}) => {
  let remainingCents = toCents(amount);
  let page = 1;
  let totalAllocatedCents = 0;

  while (remainingCents > 0) {
    const response = await paymentsApi.list({
      page,
      limit: 100,
      partyType,
      paymentType,
      partyId,
      status: "completed",
      isAdvance: true,
    });

    const advancePayments = response.data.items.filter((payment) => toCents(payment.unallocatedAmount) > 0);

    for (const payment of advancePayments) {
      if (remainingCents <= 0) {
        break;
      }

      const paymentAvailableCents = toCents(payment.unallocatedAmount);
      if (paymentAvailableCents <= 0) {
        continue;
      }

      const allocationCents = Math.min(paymentAvailableCents, remainingCents);
      await paymentsApi.saveAllocations(payment.id, {
        allocations: [
          {
            allocationType: referenceType,
            referenceId,
            referenceNumber,
            allocatedAmount: fromCents(allocationCents),
            allocationDate,
          },
        ],
      });

      remainingCents -= allocationCents;
      totalAllocatedCents += allocationCents;
    }

    if (page >= response.data.pagination.totalPages) {
      break;
    }

    page += 1;
  }

  return fromCents(totalAllocatedCents);
};
