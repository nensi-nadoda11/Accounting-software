import type { UseFormSetError } from "react-hook-form";

import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../../types/company";
import type { Warehouse } from "../../../types/inventory";
import type { SalesFormInput, SalesInvoice } from "../../../types/sales";
import type { SalesFormValues } from "../salesSchemas";
import { SalesInvoiceForm } from "./SalesInvoiceForm";

export const POSBilling = ({
  initialInvoice,
  warehouses,
  bankAccounts,
  companyProfile,
  invoiceSettings,
  submitting,
  onSubmit,
}: {
  initialInvoice?: SalesInvoice | null;
  warehouses: Warehouse[];
  bankAccounts: CompanyBankAccount[];
  companyProfile: CompanyProfile | null;
  invoiceSettings: CompanyInvoiceSettings | null;
  submitting?: boolean;
  onSubmit: (
    values: SalesFormInput,
    setError: UseFormSetError<SalesFormValues>,
    mode: "draft" | "posted",
  ) => Promise<void>;
}) => (
  <SalesInvoiceForm
    mode="pos"
    initialInvoice={initialInvoice}
    warehouses={warehouses}
    bankAccounts={bankAccounts}
    companyProfile={companyProfile}
    invoiceSettings={invoiceSettings}
    submitting={submitting}
    onBack={() => undefined}
    onSubmit={onSubmit}
  />
);
