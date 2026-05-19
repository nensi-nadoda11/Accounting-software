import type { PermissionKey } from "../permissions/permission.constants";

export const SETTINGS_ROUTE_PERMISSIONS = [
  "settings.view",
  "settings.manage",
  "permissions.manage",
  "invoice.settings.manage",
  "tax.settings.manage",
  "payment.settings.manage",
  "profile.manage"
] as const satisfies PermissionKey[];

export const GST_RATE_VALUES = [0, 0.25, 3, 5, 12, 18, 28] as const;
export const GST_FILING_FREQUENCIES = ["monthly", "quarterly", "annually"] as const;
export const PAYMENT_MODE_KEYS = [
  "cash",
  "bank_transfer",
  "upi",
  "card",
  "cheque",
  "wallet",
  "net_banking"
] as const;
export const TABLE_DENSITIES = ["compact", "normal"] as const;
export const DATE_FORMAT_VALUES = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"] as const;
export const CURRENCY_FORMAT_VALUES = ["symbol_first", "symbol_last", "code"] as const;
export const NUMBER_FORMAT_VALUES = ["indian", "western"] as const;

export type RoleKey = "admin" | "accountant" | "staff" | "auditor";
export type GstFilingFrequency = (typeof GST_FILING_FREQUENCIES)[number];
export type PaymentModeKey = (typeof PAYMENT_MODE_KEYS)[number];
export type TableDensity = (typeof TABLE_DENSITIES)[number];
export type DateFormatValue = (typeof DATE_FORMAT_VALUES)[number];
export type CurrencyFormatValue = (typeof CURRENCY_FORMAT_VALUES)[number];
export type NumberFormatValue = (typeof NUMBER_FORMAT_VALUES)[number];
export type InvoiceType = "sales" | "purchase" | "pos" | "return";

export type SettingsRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type SettingsActor = {
  id: string;
  companyId: string;
  role: RoleKey;
  permissions: PermissionKey[];
  email: string;
};

export type TaxSettings = {
  gstEnabled: boolean;
  defaultGstRate: (typeof GST_RATE_VALUES)[number];
  taxInclusiveDefault: boolean;
  roundOffEnabled: boolean;
  hsnSacRequired: boolean;
  gstFilingFrequency: GstFilingFrequency;
  compositionScheme: boolean;
};

export type InvoiceLayoutConfig = {
  showLogo: boolean;
  showSignature: boolean;
  showBankDetails: boolean;
  showQrCode: boolean;
  termsFooter: string;
  footerNote: string;
};

export type InvoiceTemplateRecord = {
  id: string;
  companyId: string;
  templateKey: string;
  templateName: string;
  invoiceType: InvoiceType;
  layoutConfig: InvoiceLayoutConfig;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentModeRecord = {
  id: string;
  companyId: string;
  modeKey: PaymentModeKey;
  modeName: string;
  isEnabled: boolean;
  isDefault: boolean;
  requiresReference: boolean;
  requiresBankAccount: boolean;
  chequeWorkflowEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UiPreferenceRecord = {
  id: string | null;
  companyId: string;
  userId: string;
  accentColor: string | null;
  compactMode: boolean;
  tableDensity: TableDensity;
  dateFormat: DateFormatValue;
  currencyFormat: CurrencyFormatValue;
  numberFormat: NumberFormatValue;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ProfileSettingsRecord = {
  user: {
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
    role: RoleKey;
  };
  company: {
    id: string;
    name: string;
  } | null;
  session: {
    lastLoginAt: Date | null;
  };
};

export type OverviewSection = {
  key:
    | "permissions"
    | "invoiceTemplates"
    | "taxSettings"
    | "paymentModes"
    | "theme"
    | "profile"
    | "systemPolish";
  label: string;
  status: "configured" | "attention" | "restricted";
  summary: string;
  accessible: boolean;
  missingItems: string[];
};

export type PermissionMatrixRecord = {
  roles: Array<{
    role: RoleKey;
    permissions: PermissionKey[];
  }>;
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string | null;
    role: RoleKey;
    status: "pending_verification" | "invited" | "active" | "suspended" | "disabled";
    permissions: PermissionKey[];
  }>;
  groups: Array<{
    key: string;
    label: string;
    permissions: PermissionKey[];
  }>;
  allPermissions: PermissionKey[];
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstEnabled: false,
  defaultGstRate: 18,
  taxInclusiveDefault: false,
  roundOffEnabled: true,
  hsnSacRequired: false,
  gstFilingFrequency: "monthly",
  compositionScheme: false
};

export const DEFAULT_UI_PREFERENCES = (
  companyId: string,
  userId: string
): UiPreferenceRecord => ({
  id: null,
  companyId,
  userId,
  accentColor: "#0f9f8a",
  compactMode: true,
  tableDensity: "compact",
  dateFormat: "DD/MM/YYYY",
  currencyFormat: "symbol_first",
  numberFormat: "indian",
  createdAt: null,
  updatedAt: null
});

export const DEFAULT_INVOICE_LAYOUT: InvoiceLayoutConfig = {
  showLogo: true,
  showSignature: false,
  showBankDetails: true,
  showQrCode: false,
  termsFooter: "Goods once sold will not be taken back.",
  footerNote: "Thank you for your business."
};

export const DEFAULT_PAYMENT_MODE_SEED: Array<Omit<PaymentModeRecord, "id" | "companyId" | "createdAt" | "updatedAt">> = [
  {
    modeKey: "cash",
    modeName: "Cash",
    isEnabled: true,
    isDefault: true,
    requiresReference: false,
    requiresBankAccount: false,
    chequeWorkflowEnabled: false
  },
  {
    modeKey: "bank_transfer",
    modeName: "Bank Transfer",
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    requiresBankAccount: true,
    chequeWorkflowEnabled: false
  },
  {
    modeKey: "upi",
    modeName: "UPI",
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    requiresBankAccount: true,
    chequeWorkflowEnabled: false
  },
  {
    modeKey: "card",
    modeName: "Card",
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    requiresBankAccount: false,
    chequeWorkflowEnabled: false
  },
  {
    modeKey: "cheque",
    modeName: "Cheque",
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    requiresBankAccount: true,
    chequeWorkflowEnabled: true
  }
];

export const DEFAULT_INVOICE_TEMPLATE_SEED: Array<
  Omit<InvoiceTemplateRecord, "id" | "companyId" | "createdAt" | "updatedAt">
> = [
  {
    templateKey: "sales_standard",
    templateName: "Sales Standard",
    invoiceType: "sales",
    layoutConfig: DEFAULT_INVOICE_LAYOUT,
    isDefault: true,
    isActive: true
  },
  {
    templateKey: "purchase_standard",
    templateName: "Purchase Standard",
    invoiceType: "purchase",
    layoutConfig: DEFAULT_INVOICE_LAYOUT,
    isDefault: true,
    isActive: true
  },
  {
    templateKey: "pos_standard",
    templateName: "POS Compact",
    invoiceType: "pos",
    layoutConfig: {
      ...DEFAULT_INVOICE_LAYOUT,
      showLogo: false,
      showBankDetails: false
    },
    isDefault: true,
    isActive: true
  },
  {
    templateKey: "return_standard",
    templateName: "Return Note",
    invoiceType: "return",
    layoutConfig: DEFAULT_INVOICE_LAYOUT,
    isDefault: true,
    isActive: true
  }
];
