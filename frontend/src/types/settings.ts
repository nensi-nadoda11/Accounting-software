import type { PermissionKey, Role, UserStatus } from "./auth";

export interface AppSetting {
  key: string;
  group: string;
  value: unknown;
}

export interface OverviewSection {
  key: "permissions" | "invoiceTemplates" | "taxSettings" | "paymentModes" | "theme" | "profile" | "systemPolish";
  label: string;
  status: "configured" | "attention" | "restricted";
  summary: string;
  accessible: boolean;
  missingItems: string[];
}

export interface SettingsOverview {
  sections: OverviewSection[];
  generatedAt: string;
}

export interface PermissionMatrix {
  roles: Array<{
    role: Role;
    permissions: PermissionKey[];
  }>;
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
    role: Role;
    status: UserStatus;
    permissions: PermissionKey[];
  }>;
  groups: Array<{
    key: string;
    label: string;
    permissions: PermissionKey[];
  }>;
  allPermissions: PermissionKey[];
}

export interface InvoiceLayoutConfig {
  showLogo: boolean;
  showSignature: boolean;
  showBankDetails: boolean;
  showQrCode: boolean;
  termsFooter: string;
  footerNote: string;
}

export interface InvoiceTemplate {
  id: string;
  companyId: string;
  templateKey: string;
  templateName: string;
  invoiceType: "sales" | "purchase" | "pos" | "return";
  layoutConfig: InvoiceLayoutConfig;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxSettings {
  gstEnabled: boolean;
  defaultGstRate: 0 | 0.25 | 3 | 5 | 12 | 18 | 28;
  taxInclusiveDefault: boolean;
  roundOffEnabled: boolean;
  hsnSacRequired: boolean;
  gstFilingFrequency: "monthly" | "quarterly" | "annually";
  compositionScheme: boolean;
}

export interface PaymentMode {
  id: string;
  companyId: string;
  modeKey: "cash" | "bank_transfer" | "upi" | "card" | "cheque" | "wallet" | "net_banking";
  modeName: string;
  isEnabled: boolean;
  isDefault: boolean;
  requiresReference: boolean;
  requiresBankAccount: boolean;
  chequeWorkflowEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UiPreference {
  id: string | null;
  companyId: string;
  userId: string;
  accentColor: string | null;
  compactMode: boolean;
  tableDensity: "compact" | "normal";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";
  currencyFormat: "symbol_first" | "symbol_last" | "code";
  numberFormat: "indian" | "western";
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProfileSettings {
  user: {
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
    role: Role;
  };
  company: {
    id: string;
    name: string;
  } | null;
  session: {
    lastLoginAt: string | null;
  };
}
