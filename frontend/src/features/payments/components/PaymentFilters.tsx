import { Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { PAYMENT_MODE_LABELS, PAYMENT_REMINDER_CHANNEL_LABELS, PAYMENT_REMINDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, PARTY_TYPE_LABELS } from "../paymentOptions";
import type { PaymentMode, PaymentReminderChannel, PaymentReminderStatus, PaymentStatus, PaymentType, PartyType } from "../../../types/payment";

type PartyOption = {
  id: string;
  label: string;
};

export const PaymentFilters = ({
  variant,
  search,
  onSearchChange,
  values,
  partyOptions,
  partyLabel,
  onChange,
  onReset,
}: {
  variant: "list" | "due" | "advance" | "reminder";
  search?: string;
  onSearchChange?: (value: string) => void;
  values: Record<string, string | boolean | undefined>;
  partyOptions: PartyOption[];
  partyLabel: string;
  onChange: (updates: Record<string, string | boolean | undefined>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {variant === "list" && onSearchChange ? (
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search ?? ""}
              placeholder="Search payment, receipt, party, ref"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        ) : null}

        {(variant === "list" || variant === "reminder") && (
          <Select
            value={String(values.partyType ?? "")}
            onChange={(event) => onChange({ partyType: event.target.value as PartyType | "" })}
          >
            <option value="">All Party Types</option>
            {Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}

        {variant === "list" ? (
          <Select
            value={String(values.paymentType ?? "")}
            onChange={(event) => onChange({ paymentType: event.target.value as PaymentType | "" })}
          >
            <option value="">All Types</option>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}

        <Select value={String(values.partyId ?? "")} onChange={(event) => onChange({ partyId: event.target.value || undefined })}>
          <option value="">All {partyLabel}</option>
          {partyOptions.map((party) => (
            <option key={party.id} value={party.id}>
              {party.label}
            </option>
          ))}
        </Select>

        {variant === "list" || variant === "advance" ? (
          <Select
            value={String(values.paymentMode ?? "")}
            onChange={(event) => onChange({ paymentMode: event.target.value as PaymentMode | "" })}
          >
            <option value="">All Modes</option>
            {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}

        {variant === "list" ? (
          <Select
            value={String(values.status ?? "")}
            onChange={(event) => onChange({ status: event.target.value as PaymentStatus | "" })}
          >
            <option value="">All Statuses</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}

        {variant === "reminder" ? (
          <>
            <Select
              value={String(values.channel ?? "")}
              onChange={(event) => onChange({ channel: event.target.value as PaymentReminderChannel | "" })}
            >
              <option value="">All Channels</option>
              {Object.entries(PAYMENT_REMINDER_CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={String(values.status ?? "")}
              onChange={(event) => onChange({ status: event.target.value as PaymentReminderStatus | "" })}
            >
              <option value="">All Statuses</option>
              {Object.entries(PAYMENT_REMINDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        <Input
          type="date"
          value={String(values.dateFrom ?? "")}
          onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
        />
        <Input
          type="date"
          value={String(values.dateTo ?? "")}
          onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
        />

        {variant === "due" ? (
          <Select
            value={String(values.agingBucket ?? "")}
            onChange={(event) => onChange({ agingBucket: event.target.value || undefined })}
          >
            <option value="">All Aging</option>
            <option value="0-30">0-30</option>
            <option value="31-60">31-60</option>
            <option value="61-90">61-90</option>
            <option value="90+">90+</option>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {variant === "due" ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(values.overdueOnly)}
              onChange={(event) => onChange({ overdueOnly: event.target.checked })}
            />
            Overdue only
          </label>
        ) : (
          <div />
        )}
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={onReset}>
          Reset
        </Button>
      </div>
    </CardContent>
  </Card>
);
