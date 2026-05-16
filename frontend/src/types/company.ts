export type CompanyStatus = "setup_pending" | "active" | "suspended" | "inactive";

export type CompanyProfile = {
  id: string;
  name: string;
  legalName: string | null;
  businessType: string | null;
  industryType: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  cinNumber: string | null;
  email: string | null;
  mobileNumber: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  status: CompanyStatus;
  setupCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyTaxSettings = {
  id: string | null;
  companyId: string;
  gstEnabled: boolean;
  gstType: "regular" | "composition" | "unregistered";
  compositionScheme: boolean;
  taxInclusivePricing: boolean;
  defaultGstRate: number | null;
  hsnSacEnabled: boolean;
  eInvoiceEnabled: boolean;
  eWayBillEnabled: boolean;
  gstFilingFrequency: "monthly" | "quarterly" | "annually";
  tanNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CompanyFinancialYear = {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyBankAccount = {
  id: string;
  companyId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string | null;
  upiId: string | null;
  qrImageUrl: string | null;
  openingBalance: number;
  accountType: "current" | "savings" | "cash_credit" | "overdraft" | "other";
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyInvoiceSettings = {
  id: string | null;
  companyId: string;
  salesInvoicePrefix: string;
  purchaseInvoicePrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  autoNumbering: boolean;
  nextSalesInvoiceNumber: number;
  nextPurchaseInvoiceNumber: number;
  numberPadding: number;
  termsAndConditions: string | null;
  footerNote: string | null;
  showCompanyLogo: boolean;
  showBankDetails: boolean;
  showQrCode: boolean;
  showSignature: boolean;
  roundOffEnabled: boolean;
  decimalPrecision: number;
  taxDisplayFormat: "item_wise" | "summary" | "both";
  invoiceTemplate: "gst_a4" | "pos" | "thermal";
  createdAt: string | null;
  updatedAt: string | null;
};

export type InvoicePreview = {
  sales: string;
  purchase: string;
};

export type CompanyBrandingAssetType = "logo" | "invoiceLogo" | "signature" | "stamp" | "favicon";

export type CompanyBranding = {
  id: string | null;
  companyId: string;
  logoUrl: string | null;
  invoiceLogoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CompanyBranch = {
  id: string;
  companyId: string;
  branchName: string;
  branchCode: string;
  gstNumber: string | null;
  email: string | null;
  mobileNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  managerName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyPreferences = {
  id: string | null;
  companyId: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";
  currencyFormat: "symbol_first" | "symbol_last";
  numberFormat: "indian" | "western";
  decimalPrecision: number;
  timezone: string;
  language: string;
  autoLogoutMinutes: number;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  notificationWhatsappEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CompanySetupStatus = {
  companyStatus: CompanyStatus;
  setupCompletedAt: string | null;
  isComplete: boolean;
  missingSteps: string[];
  recommendedSteps: string[];
  summary: {
    hasCompanyProfile: boolean;
    hasActiveFinancialYear: boolean;
    hasInvoiceSettings: boolean;
    activeBankAccounts: number;
  };
};

export type CompanyPaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
