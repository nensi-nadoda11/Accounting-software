import { ArrowLeft, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Textarea } from "../../../components/ui/Textarea";
import type { CashVerificationStatus } from "../../../types/cashVerification";
import { CashVerificationSummary } from "./CashVerificationSummary";

export const getCashStatus = (differenceAmount: string | number): CashVerificationStatus => {
  const numeric = Number(differenceAmount);
  if (numeric === 0) {
    return "matched";
  }
  return numeric < 0 ? "short_cash" : "excess_cash";
};

export const toMoney = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
};

export const CashVerificationForm = ({
  title,
  verificationDate,
  actualCash,
  expectedCash,
  remarks,
  submitting,
  onVerificationDateChange,
  onActualCashChange,
  onRemarksChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  verificationDate: string;
  actualCash: string;
  expectedCash: string;
  remarks: string;
  submitting: boolean;
  onVerificationDateChange: (value: string) => void;
  onActualCashChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) => {
  const actual = toMoney(actualCash || "0");
  const difference = toMoney(Number(actual || 0) - Number(expectedCash || 0));
  const status = getCashStatus(difference);

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          <Button type="button" variant="secondary" onClick={onCancel}>
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        }
      />

      <CashVerificationSummary
        expectedCash={expectedCash}
        actualCash={actual}
        differenceAmount={difference}
        status={status}
      />

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-2">
          <Input
            label="Date"
            type="date"
            required
            value={verificationDate}
            onChange={(event) => onVerificationDateChange(event.target.value)}
          />
          <Input label="Expected Cash" value={expectedCash} readOnly className="bg-slate-50" />
          <Input
            label="Actual Cash Counted"
            type="number"
            min="0"
            step="0.01"
            required
            value={actualCash}
            onChange={(event) => onActualCashChange(event.target.value)}
          />
          <div className="lg:row-span-2">
            <Textarea
              label="Remarks"
              value={remarks}
              rows={5}
              onChange={(event) => onRemarksChange(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={onSubmit}
              loading={submitting}
              disabled={!verificationDate || actualCash.trim() === "" || Number(actualCash) < 0}
            >
              <Save className="mr-2 size-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
