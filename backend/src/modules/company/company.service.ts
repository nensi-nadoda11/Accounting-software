import path from "path";

import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { companiesRepository } from "../companies/companies.repository";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import {
  buildPublicUploadUrl,
  deleteUploadFileByUrl,
  getBrandingUploadRelativeDirectory
} from "../../utils/upload";
import { companyRepository } from "./company.repository";
import type {
  CompanyActor,
  CompanyBrandingAssetType,
  CompanyRequestContext,
  SetupStatusResult
} from "./company.types";
import { COMPANY_BRANDING_FIELD_MAP } from "./company.types";

type ProfileUpdateInput = {
  name?: string;
  legalName?: string | null;
  businessType?: string | null;
  industryType?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  cinNumber?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string;
  timezone?: string;
  currency?: string;
  language?: string;
};

type TaxSettingsUpdateInput = {
  gstEnabled?: boolean;
  gstType?: "regular" | "composition" | "unregistered";
  compositionScheme?: boolean;
  taxInclusivePricing?: boolean;
  defaultGstRate?: number | null;
  hsnSacEnabled?: boolean;
  eInvoiceEnabled?: boolean;
  eWayBillEnabled?: boolean;
  gstFilingFrequency?: "monthly" | "quarterly" | "annually";
  tanNumber?: string | null;
};

type CreateFinancialYearInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};

type UpdateFinancialYearInput = {
  name?: string | null;
  startDate?: Date;
  endDate?: Date;
};

type CreateBankAccountInput = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string | null;
  upiId?: string | null;
  qrImageUrl?: string | null;
  openingBalance: number;
  accountType: "current" | "savings" | "cash_credit" | "overdraft" | "other";
  isDefault: boolean;
  isActive: boolean;
};

type UpdateBankAccountInput = Partial<CreateBankAccountInput>;

type InvoiceSettingsUpdateInput = {
  salesInvoicePrefix?: string | null;
  purchaseInvoicePrefix?: string | null;
  creditNotePrefix?: string | null;
  debitNotePrefix?: string | null;
  autoNumbering?: boolean;
  nextSalesInvoiceNumber?: number;
  nextPurchaseInvoiceNumber?: number;
  numberPadding?: number;
  termsAndConditions?: string | null;
  footerNote?: string | null;
  showCompanyLogo?: boolean;
  showBankDetails?: boolean;
  showQrCode?: boolean;
  showSignature?: boolean;
  roundOffEnabled?: boolean;
  decimalPrecision?: number;
  taxDisplayFormat?: "item_wise" | "summary" | "both";
  invoiceTemplate?: "gst_a4" | "pos" | "thermal";
};

type BranchInput = {
  branchName: string;
  branchCode: string;
  gstNumber?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  managerName?: string | null;
  isActive: boolean;
};

type UpdateBranchInput = Partial<BranchInput>;

type PreferencesUpdateInput = {
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";
  currencyFormat?: "symbol_first" | "symbol_last";
  numberFormat?: "indian" | "western";
  decimalPrecision?: number;
  timezone?: string | null;
  language?: string | null;
  autoLogoutMinutes?: number;
  notificationEmailEnabled?: boolean;
  notificationSmsEnabled?: boolean;
  notificationWhatsappEnabled?: boolean;
};

type BrandingUploadInput = {
  type: CompanyBrandingAssetType;
  primaryColor?: string | null;
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toDecimalString = (value: number) => value.toFixed(2);

const formatInvoiceNumber = (prefix: string, nextNumber: number, padding: number) =>
  `${prefix}${String(nextNumber).padStart(padding, "0")}`;

class CompanyService {
  private async getCompanyOrThrow(companyId: string) {
    const company = await companyRepository.findCompanyById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return company;
  }

  private buildDefaultTaxSettings(companyId: string, hasGstNumber: boolean) {
    return {
      id: null,
      companyId,
      gstEnabled: hasGstNumber,
      gstType: hasGstNumber ? ("regular" as const) : ("unregistered" as const),
      compositionScheme: false,
      taxInclusivePricing: false,
      defaultGstRate: null,
      hsnSacEnabled: false,
      eInvoiceEnabled: false,
      eWayBillEnabled: false,
      gstFilingFrequency: "monthly" as const,
      tanNumber: null,
      createdAt: null,
      updatedAt: null
    };
  }

  private buildDefaultInvoiceSettings(companyId: string) {
    return {
      id: null,
      companyId,
      salesInvoicePrefix: "INV",
      purchaseInvoicePrefix: "PUR",
      creditNotePrefix: "CN",
      debitNotePrefix: "DN",
      autoNumbering: true,
      nextSalesInvoiceNumber: 1,
      nextPurchaseInvoiceNumber: 1,
      numberPadding: 4,
      termsAndConditions: null,
      footerNote: null,
      showCompanyLogo: true,
      showBankDetails: true,
      showQrCode: false,
      showSignature: false,
      roundOffEnabled: true,
      decimalPrecision: 2,
      taxDisplayFormat: "both" as const,
      invoiceTemplate: "gst_a4" as const,
      createdAt: null,
      updatedAt: null
    };
  }

  private buildDefaultBranding(companyId: string) {
    return {
      id: null,
      companyId,
      logoUrl: null,
      invoiceLogoUrl: null,
      signatureUrl: null,
      stampUrl: null,
      faviconUrl: null,
      primaryColor: null,
      createdAt: null,
      updatedAt: null
    };
  }

  private buildDefaultPreferences(company: Awaited<ReturnType<typeof companyRepository.findCompanyById>>) {
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return {
      id: null,
      companyId: company.id,
      dateFormat: "DD/MM/YYYY" as const,
      currencyFormat: "symbol_first" as const,
      numberFormat: "indian" as const,
      decimalPrecision: 2,
      timezone: company.timezone,
      language: company.language,
      autoLogoutMinutes: 30,
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationWhatsappEnabled: false,
      createdAt: null,
      updatedAt: null
    };
  }

  private async assertNoOverlappingFinancialYear(
    companyId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
    executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const overlapping = await companyRepository.findOverlappingFinancialYear(
      companyId,
      startDate,
      endDate,
      excludeId,
      executor
    );

    if (overlapping) {
      throw new AppError("Financial year overlaps with an existing record", 409);
    }
  }

  private async ensureBranchCodeIsAvailable(
    companyId: string,
    branchCode: string,
    excludeId?: string,
    executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const existingBranch = await companyRepository.findBranchByCode(companyId, branchCode, excludeId, executor);
    if (existingBranch) {
      throw new AppError("A branch with this code already exists", 409);
    }
  }

  private assertUniqueInvoicePrefixes(settings: {
    salesInvoicePrefix: string;
    purchaseInvoicePrefix: string;
    creditNotePrefix: string;
    debitNotePrefix: string;
  }) {
    const prefixes = [
      settings.salesInvoicePrefix,
      settings.purchaseInvoicePrefix,
      settings.creditNotePrefix,
      settings.debitNotePrefix
    ];

    if (new Set(prefixes).size !== prefixes.length) {
      throw new AppError("Invoice prefixes must be unique", 400);
    }
  }

  private async ensureActiveBankHasDefault(
    companyId: string,
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
    preferredBankId?: string
  ) {
    const existingDefault = await companyRepository.findDefaultActiveBankAccount(companyId, executor);
    if (existingDefault) {
      return;
    }

    if (preferredBankId) {
      const preferredBank = await companyRepository.findBankAccountById(companyId, preferredBankId, executor);
      if (preferredBank?.isActive) {
        await companyRepository.updateBankAccount(companyId, preferredBankId, { isDefault: true }, executor);
        return;
      }
    }

    const replacement = await companyRepository.findReplacementDefaultBankAccount(companyId, preferredBankId, executor);
    if (replacement) {
      await companyRepository.updateBankAccount(companyId, replacement.id, { isDefault: true }, executor);
    }
  }

  private async buildSetupStatus(companyId: string): Promise<SetupStatusResult> {
    const company = await this.getCompanyOrThrow(companyId);
    const [activeFinancialYear, invoiceSettings, activeBankAccounts] = await Promise.all([
      companyRepository.findActiveFinancialYear(companyId),
      companyRepository.findInvoiceSettingsByCompanyId(companyId),
      companyRepository.countActiveBankAccounts(companyId)
    ]);

    const hasCompanyProfile = Boolean(
      company.name && company.addressLine1 && company.city && company.state && company.pincode
    );

    const missingSteps: string[] = [];
    if (!hasCompanyProfile) {
      missingSteps.push("Complete company profile with name, address, city, state, and pincode");
    }

    if (!activeFinancialYear) {
      missingSteps.push("Create and activate a financial year");
    }

    if (!invoiceSettings) {
      missingSteps.push("Configure invoice settings");
    }

    const recommendedSteps: string[] = [];
    if (activeBankAccounts === 0) {
      recommendedSteps.push("Add at least one active bank account");
    }

    return {
      companyStatus: company.status,
      setupCompletedAt: company.setupCompletedAt,
      isComplete: missingSteps.length === 0,
      missingSteps,
      recommendedSteps,
      summary: {
        hasCompanyProfile,
        hasActiveFinancialYear: Boolean(activeFinancialYear),
        hasInvoiceSettings: Boolean(invoiceSettings),
        activeBankAccounts
      }
    };
  }

  public async getProfile(companyId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    return companiesRepository.toSafeCompany(company);
  }

  public async updateProfile(actor: CompanyActor, input: ProfileUpdateInput, context: CompanyRequestContext) {
    const company = await this.getCompanyOrThrow(actor.companyId);
    const taxSettings = await companyRepository.findTaxSettingsByCompanyId(actor.companyId);

    if (
      input.gstNumber === null &&
      taxSettings?.gstEnabled &&
      taxSettings.gstType !== "unregistered"
    ) {
      throw new AppError("GST number is required while GST settings are enabled", 400);
    }

    const updatedCompany = await companyRepository.updateCompany(actor.companyId, pickDefined(input));
    if (!updatedCompany) {
      throw new AppError("Failed to update company profile", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_profile_updated",
      entityType: "company",
      entityId: company.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companiesRepository.toSafeCompany(updatedCompany);
  }

  public async getTaxSettings(companyId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    const settings = await companyRepository.findTaxSettingsByCompanyId(companyId);
    return settings ? companyRepository.toTaxSettings(settings) : this.buildDefaultTaxSettings(companyId, Boolean(company.gstNumber));
  }

  public async updateTaxSettings(actor: CompanyActor, input: TaxSettingsUpdateInput, context: CompanyRequestContext) {
    const company = await this.getCompanyOrThrow(actor.companyId);
    const existing = await companyRepository.findTaxSettingsByCompanyId(actor.companyId);
    const merged = {
      ...(existing ? companyRepository.toTaxSettings(existing) : this.buildDefaultTaxSettings(actor.companyId, Boolean(company.gstNumber))),
      ...pickDefined(input)
    };

    const gstEnabled = merged.gstEnabled;
    const gstType = gstEnabled ? merged.gstType : "unregistered";
    const compositionScheme = gstType === "composition" ? (merged.compositionScheme ?? true) : false;

    if (gstEnabled && gstType !== "unregistered" && !company.gstNumber) {
      throw new AppError("Company GST number must be configured before enabling GST settings", 400);
    }

    const updatedSettings = await companyRepository.upsertTaxSettings(
      actor.companyId,
      {
        gstEnabled,
        gstType,
        compositionScheme,
        taxInclusivePricing: merged.taxInclusivePricing,
        defaultGstRate: merged.defaultGstRate === null ? null : toDecimalString(merged.defaultGstRate),
        hsnSacEnabled: merged.hsnSacEnabled,
        eInvoiceEnabled: merged.eInvoiceEnabled,
        eWayBillEnabled: merged.eWayBillEnabled,
        gstFilingFrequency: merged.gstFilingFrequency,
        tanNumber: merged.tanNumber
      }
    );

    if (!updatedSettings) {
      throw new AppError("Failed to update tax settings", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_tax_settings_updated",
      entityType: "company_tax_settings",
      entityId: updatedSettings.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toTaxSettings(updatedSettings);
  }

  public async listFinancialYears(companyId: string) {
    const rows = await companyRepository.listFinancialYears(companyId);
    return {
      items: rows.map((row) => companyRepository.toFinancialYear(row))
    };
  }

  public async createFinancialYear(
    actor: CompanyActor,
    input: CreateFinancialYearInput,
    context: CompanyRequestContext
  ) {
    const financialYear = await db.transaction(async (transaction) => {
      await this.assertNoOverlappingFinancialYear(actor.companyId, input.startDate, input.endDate, undefined, transaction);

      if (input.isActive) {
        await companyRepository.deactivateFinancialYears(actor.companyId, undefined, transaction);
      }

      const created = await companyRepository.createFinancialYear(
        {
          companyId: actor.companyId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          isActive: input.isActive,
          isLocked: false,
          lockedAt: null
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create financial year", 500);
      }

      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_financial_year_created",
      entityType: "company_financial_year",
      entityId: financialYear.id,
      metadata: {
        name: financialYear.name,
        isActive: financialYear.isActive
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toFinancialYear(financialYear);
  }

  public async updateFinancialYear(
    actor: CompanyActor,
    financialYearId: string,
    input: UpdateFinancialYearInput,
    context: CompanyRequestContext
  ) {
    const financialYear = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findFinancialYearById(actor.companyId, financialYearId, transaction);
      if (!existing) {
        throw new AppError("Financial year not found", 404);
      }

      if (existing.isLocked) {
        throw new AppError("Locked financial years cannot be edited", 400);
      }

      const nextStartDate = input.startDate ?? existing.startDate;
      const nextEndDate = input.endDate ?? existing.endDate;

      if (nextEndDate <= nextStartDate) {
        throw new AppError("End date must be greater than start date", 400);
      }

      await this.assertNoOverlappingFinancialYear(
        actor.companyId,
        nextStartDate,
        nextEndDate,
        financialYearId,
        transaction
      );

      const updated = await companyRepository.updateFinancialYear(
        actor.companyId,
        financialYearId,
        {
          name: input.name ?? existing.name,
          startDate: nextStartDate,
          endDate: nextEndDate
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update financial year", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_financial_year_updated",
      entityType: "company_financial_year",
      entityId: financialYear.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toFinancialYear(financialYear);
  }

  public async activateFinancialYear(actor: CompanyActor, financialYearId: string, context: CompanyRequestContext) {
    const financialYear = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findFinancialYearById(actor.companyId, financialYearId, transaction);
      if (!existing) {
        throw new AppError("Financial year not found", 404);
      }

      if (existing.isLocked) {
        throw new AppError("Locked financial years cannot be activated", 400);
      }

      await companyRepository.deactivateFinancialYears(actor.companyId, financialYearId, transaction);
      const updated = await companyRepository.updateFinancialYear(
        actor.companyId,
        financialYearId,
        {
          isActive: true
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to activate financial year", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_financial_year_activated",
      entityType: "company_financial_year",
      entityId: financialYear.id,
      metadata: {
        name: financialYear.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toFinancialYear(financialYear);
  }

  public async lockFinancialYear(actor: CompanyActor, financialYearId: string, context: CompanyRequestContext) {
    const financialYear = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findFinancialYearById(actor.companyId, financialYearId, transaction);
      if (!existing) {
        throw new AppError("Financial year not found", 404);
      }

      if (existing.isLocked) {
        return existing;
      }

      const updated = await companyRepository.updateFinancialYear(
        actor.companyId,
        financialYearId,
        {
          isLocked: true,
          lockedAt: new Date()
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to lock financial year", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_financial_year_locked",
      entityType: "company_financial_year",
      entityId: financialYear.id,
      metadata: {
        name: financialYear.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toFinancialYear(financialYear);
  }

  public async listBankAccounts(
    companyId: string,
    query: { page: number; limit: number; search?: string; isActive?: boolean }
  ) {
    const pagination = getPagination(query.page, query.limit);
    const result = await companyRepository.listBankAccounts({
      companyId,
      page: pagination.page,
      limit: pagination.limit,
      ...(query.search ? { search: query.search } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {})
    });

    return {
      items: result.rows.map((row) => companyRepository.toBankAccount(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createBankAccount(actor: CompanyActor, input: CreateBankAccountInput, context: CompanyRequestContext) {
    if (input.isDefault && !input.isActive) {
      throw new AppError("A default bank account must be active", 400);
    }

    const bankAccount = await db.transaction(async (transaction) => {
      const currentDefault = await companyRepository.findDefaultActiveBankAccount(actor.companyId, transaction);
      const shouldBeDefault = input.isActive && (input.isDefault || !currentDefault);

      if (shouldBeDefault) {
        await companyRepository.clearDefaultBankAccounts(actor.companyId, undefined, transaction);
      }

      const created = await companyRepository.createBankAccount(
        {
          companyId: actor.companyId,
          bankName: input.bankName,
          accountHolderName: input.accountHolderName,
          accountNumber: input.accountNumber,
          ifscCode: input.ifscCode,
          branchName: input.branchName ?? null,
          upiId: input.upiId ?? null,
          qrImageUrl: input.qrImageUrl ?? null,
          openingBalance: toDecimalString(input.openingBalance),
          accountType: input.accountType,
          isDefault: shouldBeDefault,
          isActive: input.isActive
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create bank account", 500);
      }

      await this.ensureActiveBankHasDefault(actor.companyId, transaction, shouldBeDefault ? created.id : undefined);
      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_bank_account_created",
      entityType: "company_bank_account",
      entityId: bankAccount.id,
      metadata: {
        bankName: bankAccount.bankName,
        isDefault: bankAccount.isDefault
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBankAccount(bankAccount);
  }

  public async updateBankAccount(
    actor: CompanyActor,
    bankAccountId: string,
    input: UpdateBankAccountInput,
    context: CompanyRequestContext
  ) {
    const bankAccount = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findBankAccountById(actor.companyId, bankAccountId, transaction);
      if (!existing) {
        throw new AppError("Bank account not found", 404);
      }

      const nextIsActive = input.isActive ?? existing.isActive;
      const nextIsDefault = input.isDefault ?? existing.isDefault;

      if (nextIsDefault && !nextIsActive) {
        throw new AppError("A default bank account must be active", 400);
      }

      if (input.isDefault === true) {
        await companyRepository.clearDefaultBankAccounts(actor.companyId, bankAccountId, transaction);
      }

      const updated = await companyRepository.updateBankAccount(
        actor.companyId,
        bankAccountId,
        {
          bankName: input.bankName ?? existing.bankName,
          accountHolderName: input.accountHolderName ?? existing.accountHolderName,
          accountNumber: input.accountNumber ?? existing.accountNumber,
          ifscCode: input.ifscCode ?? existing.ifscCode,
          branchName: input.branchName ?? existing.branchName,
          upiId: input.upiId ?? existing.upiId,
          qrImageUrl: input.qrImageUrl ?? existing.qrImageUrl,
          openingBalance:
            input.openingBalance !== undefined
              ? toDecimalString(input.openingBalance)
              : existing.openingBalance,
          accountType: input.accountType ?? existing.accountType,
          isDefault: nextIsDefault,
          isActive: nextIsActive
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update bank account", 500);
      }

      const preferredDefaultBankId =
        nextIsActive && input.isDefault !== false ? updated.id : undefined;

      await this.ensureActiveBankHasDefault(actor.companyId, transaction, preferredDefaultBankId);
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_bank_account_updated",
      entityType: "company_bank_account",
      entityId: bankAccount.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBankAccount(bankAccount);
  }

  public async deleteBankAccount(actor: CompanyActor, bankAccountId: string, context: CompanyRequestContext) {
    await db.transaction(async (transaction) => {
      const existing = await companyRepository.findBankAccountById(actor.companyId, bankAccountId, transaction);
      if (!existing) {
        throw new AppError("Bank account not found", 404);
      }

      const deleted = await companyRepository.softDeleteBankAccount(actor.companyId, bankAccountId, transaction);
      if (!deleted) {
        throw new AppError("Failed to delete bank account", 500);
      }

      await this.ensureActiveBankHasDefault(actor.companyId, transaction);
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_bank_account_deleted",
      entityType: "company_bank_account",
      entityId: bankAccountId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async setDefaultBankAccount(actor: CompanyActor, bankAccountId: string, context: CompanyRequestContext) {
    const bankAccount = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findBankAccountById(actor.companyId, bankAccountId, transaction);
      if (!existing) {
        throw new AppError("Bank account not found", 404);
      }

      if (!existing.isActive) {
        throw new AppError("Only active bank accounts can be set as default", 400);
      }

      await companyRepository.clearDefaultBankAccounts(actor.companyId, bankAccountId, transaction);
      const updated = await companyRepository.updateBankAccount(
        actor.companyId,
        bankAccountId,
        {
          isDefault: true
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update default bank account", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_bank_account_default_set",
      entityType: "company_bank_account",
      entityId: bankAccount.id,
      metadata: {
        bankName: bankAccount.bankName
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBankAccount(bankAccount);
  }

  public async getInvoiceSettings(companyId: string) {
    const settings = await companyRepository.findInvoiceSettingsByCompanyId(companyId);
    return settings ? companyRepository.toInvoiceSettings(settings) : this.buildDefaultInvoiceSettings(companyId);
  }

  public async updateInvoiceSettings(
    actor: CompanyActor,
    input: InvoiceSettingsUpdateInput,
    context: CompanyRequestContext
  ) {
    const existing = await companyRepository.findInvoiceSettingsByCompanyId(actor.companyId);
    const merged = {
      ...(existing ? companyRepository.toInvoiceSettings(existing) : this.buildDefaultInvoiceSettings(actor.companyId)),
      ...pickDefined(input)
    };

    const normalizedInvoiceSettings = {
      ...merged,
      salesInvoicePrefix: merged.salesInvoicePrefix ?? "INV",
      purchaseInvoicePrefix: merged.purchaseInvoicePrefix ?? "PUR",
      creditNotePrefix: merged.creditNotePrefix ?? "CN",
      debitNotePrefix: merged.debitNotePrefix ?? "DN"
    };

    this.assertUniqueInvoicePrefixes(normalizedInvoiceSettings);

    const updatedSettings = await companyRepository.upsertInvoiceSettings(actor.companyId, {
      salesInvoicePrefix: normalizedInvoiceSettings.salesInvoicePrefix,
      purchaseInvoicePrefix: normalizedInvoiceSettings.purchaseInvoicePrefix,
      creditNotePrefix: normalizedInvoiceSettings.creditNotePrefix,
      debitNotePrefix: normalizedInvoiceSettings.debitNotePrefix,
      autoNumbering: normalizedInvoiceSettings.autoNumbering,
      nextSalesInvoiceNumber: normalizedInvoiceSettings.nextSalesInvoiceNumber,
      nextPurchaseInvoiceNumber: normalizedInvoiceSettings.nextPurchaseInvoiceNumber,
      numberPadding: normalizedInvoiceSettings.numberPadding,
      termsAndConditions: normalizedInvoiceSettings.termsAndConditions,
      footerNote: normalizedInvoiceSettings.footerNote,
      showCompanyLogo: normalizedInvoiceSettings.showCompanyLogo,
      showBankDetails: normalizedInvoiceSettings.showBankDetails,
      showQrCode: normalizedInvoiceSettings.showQrCode,
      showSignature: normalizedInvoiceSettings.showSignature,
      roundOffEnabled: normalizedInvoiceSettings.roundOffEnabled,
      decimalPrecision: normalizedInvoiceSettings.decimalPrecision,
      taxDisplayFormat: normalizedInvoiceSettings.taxDisplayFormat,
      invoiceTemplate: normalizedInvoiceSettings.invoiceTemplate
    });

    if (!updatedSettings) {
      throw new AppError("Failed to update invoice settings", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_invoice_settings_updated",
      entityType: "company_invoice_settings",
      entityId: updatedSettings.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toInvoiceSettings(updatedSettings);
  }

  public async previewInvoiceNumber(companyId: string) {
    const settings = await this.getInvoiceSettings(companyId);
    return {
      sales: formatInvoiceNumber(
        settings.salesInvoicePrefix,
        settings.nextSalesInvoiceNumber,
        settings.numberPadding
      ),
      purchase: formatInvoiceNumber(
        settings.purchaseInvoicePrefix,
        settings.nextPurchaseInvoiceNumber,
        settings.numberPadding
      )
    };
  }

  public async getBranding(companyId: string) {
    const branding = await companyRepository.findBrandingByCompanyId(companyId);
    return branding ? companyRepository.toBranding(branding) : this.buildDefaultBranding(companyId);
  }

  public async uploadBrandingAsset(
    actor: CompanyActor,
    input: BrandingUploadInput,
    file: Express.Multer.File | undefined,
    context: CompanyRequestContext
  ) {
    if (!file && !input.primaryColor) {
      throw new AppError("A branding file or primary color is required", 400);
    }

    const fieldName = COMPANY_BRANDING_FIELD_MAP[input.type];
    const relativeFilePath = file
      ? path.posix.join(getBrandingUploadRelativeDirectory(actor.companyId), file.filename)
      : null;
    const nextFileUrl = relativeFilePath ? buildPublicUploadUrl(relativeFilePath) : null;
    const existingBranding = await companyRepository.findBrandingByCompanyId(actor.companyId);
    const previousFileUrl = existingBranding ? existingBranding[fieldName] : null;

    try {
      const updatedBranding = await companyRepository.upsertBranding(actor.companyId, {
        ...(nextFileUrl ? { [fieldName]: nextFileUrl } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {})
      });

      if (!updatedBranding) {
        throw new AppError("Failed to update branding", 500);
      }

      if (nextFileUrl && previousFileUrl && previousFileUrl !== nextFileUrl) {
        await deleteUploadFileByUrl(previousFileUrl);
      }

      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "company_branding_uploaded",
        entityType: "company_branding",
        entityId: updatedBranding.id,
        metadata: {
          type: input.type,
          primaryColorUpdated: input.primaryColor !== undefined
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return companyRepository.toBranding(updatedBranding);
    } catch (error) {
      if (nextFileUrl) {
        await deleteUploadFileByUrl(nextFileUrl).catch((cleanupError) => {
          logger.warn("Failed to cleanup uploaded branding file after error", cleanupError);
        });
      }

      throw error;
    }
  }

  public async deleteBrandingAsset(
    actor: CompanyActor,
    type: CompanyBrandingAssetType,
    context: CompanyRequestContext
  ) {
    const existingBranding = await companyRepository.findBrandingByCompanyId(actor.companyId);
    if (!existingBranding) {
      return this.buildDefaultBranding(actor.companyId);
    }

    const fieldName = COMPANY_BRANDING_FIELD_MAP[type];
    const currentFileUrl = existingBranding[fieldName];

    const updatedBranding = await companyRepository.upsertBranding(actor.companyId, {
      [fieldName]: null
    });

    if (!updatedBranding) {
      throw new AppError("Failed to delete branding asset", 500);
    }

    if (currentFileUrl) {
      await deleteUploadFileByUrl(currentFileUrl).catch((error) => {
        logger.warn("Failed to cleanup deleted branding file", error);
      });
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_branding_deleted",
      entityType: "company_branding",
      entityId: updatedBranding.id,
      metadata: {
        type
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBranding(updatedBranding);
  }

  public async listBranches(
    companyId: string,
    query: { page: number; limit: number; search?: string; isActive?: boolean }
  ) {
    const pagination = getPagination(query.page, query.limit);
    const result = await companyRepository.listBranches({
      companyId,
      page: pagination.page,
      limit: pagination.limit,
      ...(query.search ? { search: query.search } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {})
    });

    return {
      items: result.rows.map((row) => companyRepository.toBranch(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createBranch(actor: CompanyActor, input: BranchInput, context: CompanyRequestContext) {
    const branch = await db.transaction(async (transaction) => {
      await this.ensureBranchCodeIsAvailable(actor.companyId, input.branchCode, undefined, transaction);

      const created = await companyRepository.createBranch(
        {
          companyId: actor.companyId,
          branchName: input.branchName,
          branchCode: input.branchCode,
          gstNumber: input.gstNumber ?? null,
          email: input.email ?? null,
          mobileNumber: input.mobileNumber ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          pincode: input.pincode ?? null,
          managerName: input.managerName ?? null,
          isActive: input.isActive
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create branch", 500);
      }

      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_branch_created",
      entityType: "company_branch",
      entityId: branch.id,
      metadata: {
        branchCode: branch.branchCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBranch(branch);
  }

  public async updateBranch(
    actor: CompanyActor,
    branchId: string,
    input: UpdateBranchInput,
    context: CompanyRequestContext
  ) {
    const branch = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findBranchById(actor.companyId, branchId, transaction);
      if (!existing) {
        throw new AppError("Branch not found", 404);
      }

      const nextBranchCode = input.branchCode ?? existing.branchCode;
      if (nextBranchCode !== existing.branchCode) {
        await this.ensureBranchCodeIsAvailable(actor.companyId, nextBranchCode, branchId, transaction);
      }

      const updated = await companyRepository.updateBranch(
        actor.companyId,
        branchId,
        {
          branchName: input.branchName ?? existing.branchName,
          branchCode: nextBranchCode,
          gstNumber: input.gstNumber ?? existing.gstNumber,
          email: input.email ?? existing.email,
          mobileNumber: input.mobileNumber ?? existing.mobileNumber,
          addressLine1: input.addressLine1 ?? existing.addressLine1,
          addressLine2: input.addressLine2 ?? existing.addressLine2,
          city: input.city ?? existing.city,
          state: input.state ?? existing.state,
          pincode: input.pincode ?? existing.pincode,
          managerName: input.managerName ?? existing.managerName,
          isActive: input.isActive ?? existing.isActive
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update branch", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_branch_updated",
      entityType: "company_branch",
      entityId: branch.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toBranch(branch);
  }

  public async deleteBranch(actor: CompanyActor, branchId: string, context: CompanyRequestContext) {
    const deletedBranch = await db.transaction(async (transaction) => {
      const existing = await companyRepository.findBranchById(actor.companyId, branchId, transaction);
      if (!existing) {
        throw new AppError("Branch not found", 404);
      }

      const deleted = await companyRepository.softDeleteBranch(actor.companyId, branchId, transaction);
      if (!deleted) {
        throw new AppError("Failed to delete branch", 500);
      }

      return deleted;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_branch_deleted",
      entityType: "company_branch",
      entityId: deletedBranch.id,
      metadata: {
        branchCode: deletedBranch.branchCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async getPreferences(companyId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    const preferences = await companyRepository.findPreferencesByCompanyId(companyId);
    return preferences ? companyRepository.toPreferences(preferences) : this.buildDefaultPreferences(company);
  }

  public async updatePreferences(
    actor: CompanyActor,
    input: PreferencesUpdateInput,
    context: CompanyRequestContext
  ) {
    const company = await this.getCompanyOrThrow(actor.companyId);
    const existing = await companyRepository.findPreferencesByCompanyId(actor.companyId);
    const merged = {
      ...(existing ? companyRepository.toPreferences(existing) : this.buildDefaultPreferences(company)),
      ...pickDefined(input)
    };

    const updatedPreferences = await companyRepository.upsertPreferences(actor.companyId, {
      dateFormat: merged.dateFormat,
      currencyFormat: merged.currencyFormat,
      numberFormat: merged.numberFormat,
      decimalPrecision: merged.decimalPrecision,
      timezone: merged.timezone ?? company.timezone,
      language: merged.language ?? company.language,
      autoLogoutMinutes: merged.autoLogoutMinutes,
      notificationEmailEnabled: merged.notificationEmailEnabled,
      notificationSmsEnabled: merged.notificationSmsEnabled,
      notificationWhatsappEnabled: merged.notificationWhatsappEnabled
    });

    if (!updatedPreferences) {
      throw new AppError("Failed to update preferences", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_preferences_updated",
      entityType: "company_preferences",
      entityId: updatedPreferences.id,
      metadata: {
        fields: Object.keys(pickDefined(input))
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return companyRepository.toPreferences(updatedPreferences);
  }

  public async getSetupStatus(companyId: string) {
    return this.buildSetupStatus(companyId);
  }

  public async completeSetup(actor: CompanyActor, context: CompanyRequestContext) {
    const status = await this.buildSetupStatus(actor.companyId);
    if (!status.isComplete) {
      throw new AppError("Company setup is incomplete", 400, status.missingSteps);
    }

    const updatedCompany = await companyRepository.updateCompany(actor.companyId, {
      status: "active",
      setupCompletedAt: new Date()
    });

    if (!updatedCompany) {
      throw new AppError("Failed to complete company setup", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "company_setup_completed",
      entityType: "company",
      entityId: updatedCompany.id,
      metadata: {
        status: updatedCompany.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      company: companiesRepository.toSafeCompany(updatedCompany),
      missingSteps: status.missingSteps,
      recommendedSteps: status.recommendedSteps
    };
  }
}

export const companyService = new CompanyService();
