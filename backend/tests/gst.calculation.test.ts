import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateInputTax,
  calculateNetGstPayable,
  calculateOutputTax
} from "../src/modules/gst/gst.calculation.js";

test("calculateOutputTax keeps raw net output and clamps payable output at zero", () => {
  const result = calculateOutputTax({
    salesGst: "100.00",
    salesReturnGst: "140.00",
    outputAdjustments: "5.00"
  });

  assert.deepEqual(result, {
    salesGst: "100.00",
    salesReturnGst: "140.00",
    outputAdjustments: "5.00",
    netOutputGst: "-35.00",
    outputGst: "0.00"
  });
});

test("calculateInputTax separates eligible ITC from claimed ITC used", () => {
  const result = calculateInputTax({
    purchaseGst: "200.00",
    eligiblePurchaseGst: "150.00",
    claimedPurchaseGst: "90.00",
    eligibleExpenseGst: "20.00",
    claimedExpenseGst: "10.00",
    purchaseReturnGst: "30.00",
    itcReversals: "5.00",
    itcClaims: "12.00"
  });

  assert.deepEqual(result, {
    purchaseGst: "200.00",
    eligiblePurchaseGst: "150.00",
    claimedPurchaseGst: "90.00",
    eligibleExpenseGst: "20.00",
    claimedExpenseGst: "10.00",
    purchaseReturnGst: "30.00",
    eligibleItc: "140.00",
    claimedItc: "70.00",
    itcReversals: "5.00",
    itcClaims: "12.00",
    inputGst: "77.00"
  });
});

test("calculateNetGstPayable uses raw net output GST for payable vs credit split", () => {
  const payable = calculateNetGstPayable({
    netOutputGst: "150.00",
    inputGst: "90.00"
  });
  const credit = calculateNetGstPayable({
    netOutputGst: "-20.00",
    inputGst: "50.00"
  });

  assert.deepEqual(payable, {
    netOutputGst: "150.00",
    inputGst: "90.00",
    netGstPayable: "60.00",
    netGstCredit: "0.00"
  });
  assert.deepEqual(credit, {
    netOutputGst: "-20.00",
    inputGst: "50.00",
    netGstPayable: "0.00",
    netGstCredit: "70.00"
  });
});
