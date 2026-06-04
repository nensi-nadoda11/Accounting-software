import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateLineTaxInclusive as calculatePurchaseLineTaxInclusive } from "../src/modules/purchases/purchases.calculation.js";
import { calculateLineTaxInclusive as calculateSalesLineTaxInclusive } from "../src/modules/sales/sales.calculation.js";

test("sales invoice inclusive pricing extracts GST from the gross amount", () => {
  const fivePercent = calculateSalesLineTaxInclusive({
    quantity: "1.00",
    saleRate: "200.00",
    discountPercent: "0.00",
    discountAmount: "0.00",
    gstRate: "5.00",
    cessRate: "0.00",
    isInterState: false
  });

  const twelvePercent = calculateSalesLineTaxInclusive({
    quantity: "1.00",
    saleRate: "200.00",
    discountPercent: "0.00",
    discountAmount: "0.00",
    gstRate: "12.00",
    cessRate: "0.00",
    isInterState: false
  });

  assert.deepEqual(fivePercent, {
    subtotal: "200.00",
    discountPercentAmount: "0.00",
    discountAmount: "0.00",
    itemDiscountTotal: "0.00",
    taxableAmount: "190.48",
    cgstAmount: "4.76",
    sgstAmount: "4.76",
    igstAmount: "0.00",
    cessAmount: "0.00",
    gstAmount: "9.52",
    lineTotal: "200.00"
  });

  assert.deepEqual(twelvePercent, {
    subtotal: "200.00",
    discountPercentAmount: "0.00",
    discountAmount: "0.00",
    itemDiscountTotal: "0.00",
    taxableAmount: "178.57",
    cgstAmount: "10.72",
    sgstAmount: "10.71",
    igstAmount: "0.00",
    cessAmount: "0.00",
    gstAmount: "21.43",
    lineTotal: "200.00"
  });
});

test("purchase invoice inclusive pricing extracts GST from the gross amount", () => {
  const result = calculatePurchaseLineTaxInclusive({
    quantity: "1.00",
    purchaseRate: "200.00",
    discountPercent: "0.00",
    discountAmount: "0.00",
    gstRate: "5.00",
    cessRate: "0.00",
    isInterState: false
  });

  assert.deepEqual(result, {
    subtotal: "200.00",
    discountPercentAmount: "0.00",
    discountAmount: "0.00",
    itemDiscountTotal: "0.00",
    taxableAmount: "190.48",
    cgstAmount: "4.76",
    sgstAmount: "4.76",
    igstAmount: "0.00",
    cessAmount: "0.00",
    gstAmount: "9.52",
    lineTotal: "200.00"
  });
});
