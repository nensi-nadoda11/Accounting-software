import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  ne,
  or,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  companies,
  companyBankAccounts,
  companyBranches,
  companyBranding,
  companyFinancialYears,
  companyInvoiceSettings,
  companyPreferences,
  companyTaxSettings
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type BankAccountsListParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
};

type BranchesListParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
};

class CompanyRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private parseNumeric(value: string | null): number | null {
    return value === null ? null : Number(value);
  }

  public async findCompanyById(companyId: string, executor?: DbExecutor) {
    const [company] = await this.getExecutor(executor).select().from(companies).where(eq(companies.id, companyId)).limit(1);
    return company ?? null;
  }

  public async updateCompany(companyId: string, data: Partial<typeof companies.$inferSelect>, executor?: DbExecutor) {
    const [company] = await this
      .getExecutor(executor)
      .update(companies)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId))
      .returning();

    return company ?? null;
  }

  public async findTaxSettingsByCompanyId(companyId: string, executor?: DbExecutor) {
    const [settings] = await this
      .getExecutor(executor)
      .select()
      .from(companyTaxSettings)
      .where(eq(companyTaxSettings.companyId, companyId))
      .limit(1);

    return settings ?? null;
  }

  public async upsertTaxSettings(
    companyId: string,
    data: Omit<typeof companyTaxSettings.$inferInsert, "companyId">,
    executor?: DbExecutor
  ) {
    const [settings] = await this
      .getExecutor(executor)
      .insert(companyTaxSettings)
      .values({
        companyId,
        ...data
      })
      .onConflictDoUpdate({
        target: companyTaxSettings.companyId,
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();

    return settings ?? null;
  }

  public async listFinancialYears(companyId: string) {
    return db
      .select()
      .from(companyFinancialYears)
      .where(eq(companyFinancialYears.companyId, companyId))
      .orderBy(desc(companyFinancialYears.startDate), desc(companyFinancialYears.createdAt));
  }

  public async findFinancialYearById(companyId: string, financialYearId: string, executor?: DbExecutor) {
    const [financialYear] = await this
      .getExecutor(executor)
      .select()
      .from(companyFinancialYears)
      .where(and(eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.id, financialYearId)))
      .limit(1);

    return financialYear ?? null;
  }

  public async findActiveFinancialYear(companyId: string) {
    const [financialYear] = await db
      .select()
      .from(companyFinancialYears)
      .where(and(eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.isActive, true)))
      .limit(1);

    return financialYear ?? null;
  }

  public async findOverlappingFinancialYear(
    companyId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(companyFinancialYears.companyId, companyId),
      lte(companyFinancialYears.startDate, endDate),
      gte(companyFinancialYears.endDate, startDate)
    ];

    if (excludeId) {
      conditions.push(ne(companyFinancialYears.id, excludeId));
    }

    const [financialYear] = await this
      .getExecutor(executor)
      .select()
      .from(companyFinancialYears)
      .where(and(...conditions))
      .limit(1);

    return financialYear ?? null;
  }

  public async createFinancialYear(data: typeof companyFinancialYears.$inferInsert, executor?: DbExecutor) {
    const [financialYear] = await this.getExecutor(executor).insert(companyFinancialYears).values(data).returning();
    return financialYear ?? null;
  }

  public async updateFinancialYear(
    companyId: string,
    financialYearId: string,
    data: Partial<typeof companyFinancialYears.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [financialYear] = await this
      .getExecutor(executor)
      .update(companyFinancialYears)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.id, financialYearId)))
      .returning();

    return financialYear ?? null;
  }

  public async deactivateFinancialYears(companyId: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.isActive, true)];

    if (excludeId) {
      conditions.push(ne(companyFinancialYears.id, excludeId));
    }

    await this
      .getExecutor(executor)
      .update(companyFinancialYears)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async listBankAccounts(params: BankAccountsListParams) {
    const conditions: SQL[] = [
      eq(companyBankAccounts.companyId, params.companyId),
      isNull(companyBankAccounts.deletedAt)
    ];

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(companyBankAccounts.bankName, searchPattern),
          ilike(companyBankAccounts.accountHolderName, searchPattern),
          ilike(companyBankAccounts.accountNumber, searchPattern),
          ilike(companyBankAccounts.ifscCode, searchPattern),
          ilike(companyBankAccounts.upiId, searchPattern)
        )!
      );
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(companyBankAccounts.isActive, params.isActive));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(companyBankAccounts)
      .where(whereClause)
      .orderBy(desc(companyBankAccounts.isDefault), asc(companyBankAccounts.bankName), desc(companyBankAccounts.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(companyBankAccounts).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findBankAccountById(companyId: string, bankAccountId: string, executor?: DbExecutor) {
    const [bankAccount] = await this
      .getExecutor(executor)
      .select()
      .from(companyBankAccounts)
      .where(
        and(
          eq(companyBankAccounts.companyId, companyId),
          eq(companyBankAccounts.id, bankAccountId),
          isNull(companyBankAccounts.deletedAt)
        )
      )
      .limit(1);

    return bankAccount ?? null;
  }

  public async findDefaultActiveBankAccount(companyId: string, executor?: DbExecutor) {
    const [bankAccount] = await this
      .getExecutor(executor)
      .select()
      .from(companyBankAccounts)
      .where(
        and(
          eq(companyBankAccounts.companyId, companyId),
          eq(companyBankAccounts.isDefault, true),
          eq(companyBankAccounts.isActive, true),
          isNull(companyBankAccounts.deletedAt)
        )
      )
      .limit(1);

    return bankAccount ?? null;
  }

  public async findReplacementDefaultBankAccount(companyId: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(companyBankAccounts.companyId, companyId),
      eq(companyBankAccounts.isActive, true),
      isNull(companyBankAccounts.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(companyBankAccounts.id, excludeId));
    }

    const [bankAccount] = await this
      .getExecutor(executor)
      .select()
      .from(companyBankAccounts)
      .where(and(...conditions))
      .orderBy(desc(companyBankAccounts.createdAt))
      .limit(1);

    return bankAccount ?? null;
  }

  public async countActiveBankAccounts(companyId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(companyBankAccounts)
      .where(
        and(
          eq(companyBankAccounts.companyId, companyId),
          eq(companyBankAccounts.isActive, true),
          isNull(companyBankAccounts.deletedAt)
        )
      );

    return row?.value ?? 0;
  }

  public async clearDefaultBankAccounts(companyId: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(companyBankAccounts.companyId, companyId),
      isNull(companyBankAccounts.deletedAt),
      eq(companyBankAccounts.isDefault, true)
    ];

    if (excludeId) {
      conditions.push(ne(companyBankAccounts.id, excludeId));
    }

    await this
      .getExecutor(executor)
      .update(companyBankAccounts)
      .set({
        isDefault: false,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async createBankAccount(data: typeof companyBankAccounts.$inferInsert, executor?: DbExecutor) {
    const [bankAccount] = await this.getExecutor(executor).insert(companyBankAccounts).values(data).returning();
    return bankAccount ?? null;
  }

  public async updateBankAccount(
    companyId: string,
    bankAccountId: string,
    data: Partial<typeof companyBankAccounts.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [bankAccount] = await this
      .getExecutor(executor)
      .update(companyBankAccounts)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(companyBankAccounts.companyId, companyId),
          eq(companyBankAccounts.id, bankAccountId),
          isNull(companyBankAccounts.deletedAt)
        )
      )
      .returning();

    return bankAccount ?? null;
  }

  public async softDeleteBankAccount(companyId: string, bankAccountId: string, executor?: DbExecutor) {
    const [bankAccount] = await this
      .getExecutor(executor)
      .update(companyBankAccounts)
      .set({
        isDefault: false,
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(companyBankAccounts.companyId, companyId),
          eq(companyBankAccounts.id, bankAccountId),
          isNull(companyBankAccounts.deletedAt)
        )
      )
      .returning();

    return bankAccount ?? null;
  }

  public async findInvoiceSettingsByCompanyId(companyId: string) {
    const [settings] = await db
      .select()
      .from(companyInvoiceSettings)
      .where(eq(companyInvoiceSettings.companyId, companyId))
      .limit(1);

    return settings ?? null;
  }

  public async upsertInvoiceSettings(
    companyId: string,
    data: Omit<typeof companyInvoiceSettings.$inferInsert, "companyId">,
    executor?: DbExecutor
  ) {
    const [settings] = await this
      .getExecutor(executor)
      .insert(companyInvoiceSettings)
      .values({
        companyId,
        ...data
      })
      .onConflictDoUpdate({
        target: companyInvoiceSettings.companyId,
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();

    return settings ?? null;
  }

  public async findBrandingByCompanyId(companyId: string) {
    const [branding] = await db
      .select()
      .from(companyBranding)
      .where(eq(companyBranding.companyId, companyId))
      .limit(1);

    return branding ?? null;
  }

  public async upsertBranding(
    companyId: string,
    data: Omit<Partial<typeof companyBranding.$inferInsert>, "companyId">,
    executor?: DbExecutor
  ) {
    const [branding] = await this
      .getExecutor(executor)
      .insert(companyBranding)
      .values({
        companyId,
        ...data
      })
      .onConflictDoUpdate({
        target: companyBranding.companyId,
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();

    return branding ?? null;
  }

  public async listBranches(params: BranchesListParams) {
    const conditions: SQL[] = [eq(companyBranches.companyId, params.companyId), isNull(companyBranches.deletedAt)];

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(companyBranches.branchName, searchPattern),
          ilike(companyBranches.branchCode, searchPattern),
          ilike(companyBranches.city, searchPattern),
          ilike(companyBranches.managerName, searchPattern)
        )!
      );
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(companyBranches.isActive, params.isActive));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(companyBranches)
      .where(whereClause)
      .orderBy(desc(companyBranches.isActive), asc(companyBranches.branchName), desc(companyBranches.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(companyBranches).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findBranchById(companyId: string, branchId: string, executor?: DbExecutor) {
    const [branch] = await this
      .getExecutor(executor)
      .select()
      .from(companyBranches)
      .where(and(eq(companyBranches.companyId, companyId), eq(companyBranches.id, branchId), isNull(companyBranches.deletedAt)))
      .limit(1);

    return branch ?? null;
  }

  public async findBranchByCode(companyId: string, branchCode: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(companyBranches.companyId, companyId),
      eq(companyBranches.branchCode, branchCode),
      isNull(companyBranches.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(companyBranches.id, excludeId));
    }

    const [branch] = await this
      .getExecutor(executor)
      .select()
      .from(companyBranches)
      .where(and(...conditions))
      .limit(1);

    return branch ?? null;
  }

  public async createBranch(data: typeof companyBranches.$inferInsert, executor?: DbExecutor) {
    const [branch] = await this.getExecutor(executor).insert(companyBranches).values(data).returning();
    return branch ?? null;
  }

  public async updateBranch(
    companyId: string,
    branchId: string,
    data: Partial<typeof companyBranches.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [branch] = await this
      .getExecutor(executor)
      .update(companyBranches)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(companyBranches.companyId, companyId), eq(companyBranches.id, branchId), isNull(companyBranches.deletedAt)))
      .returning();

    return branch ?? null;
  }

  public async softDeleteBranch(companyId: string, branchId: string, executor?: DbExecutor) {
    const [branch] = await this
      .getExecutor(executor)
      .update(companyBranches)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(companyBranches.companyId, companyId), eq(companyBranches.id, branchId), isNull(companyBranches.deletedAt)))
      .returning();

    return branch ?? null;
  }

  public async findPreferencesByCompanyId(companyId: string) {
    const [preferences] = await db
      .select()
      .from(companyPreferences)
      .where(eq(companyPreferences.companyId, companyId))
      .limit(1);

    return preferences ?? null;
  }

  public async upsertPreferences(
    companyId: string,
    data: Omit<typeof companyPreferences.$inferInsert, "companyId">,
    executor?: DbExecutor
  ) {
    const [preferences] = await this
      .getExecutor(executor)
      .insert(companyPreferences)
      .values({
        companyId,
        ...data
      })
      .onConflictDoUpdate({
        target: companyPreferences.companyId,
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();

    return preferences ?? null;
  }

  public toTaxSettings(settings: typeof companyTaxSettings.$inferSelect) {
    return {
      id: settings.id,
      companyId: settings.companyId,
      gstEnabled: settings.gstEnabled,
      gstType: settings.gstType,
      compositionScheme: settings.compositionScheme,
      taxInclusivePricing: settings.taxInclusivePricing,
      defaultGstRate: this.parseNumeric(settings.defaultGstRate),
      hsnSacEnabled: settings.hsnSacEnabled,
      eInvoiceEnabled: settings.eInvoiceEnabled,
      eWayBillEnabled: settings.eWayBillEnabled,
      gstFilingFrequency: settings.gstFilingFrequency,
      tanNumber: settings.tanNumber,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    };
  }

  public toFinancialYear(financialYear: typeof companyFinancialYears.$inferSelect) {
    return {
      id: financialYear.id,
      companyId: financialYear.companyId,
      name: financialYear.name,
      startDate: financialYear.startDate,
      endDate: financialYear.endDate,
      isActive: financialYear.isActive,
      isLocked: financialYear.isLocked,
      lockedAt: financialYear.lockedAt,
      createdAt: financialYear.createdAt,
      updatedAt: financialYear.updatedAt
    };
  }

  public toBankAccount(bankAccount: typeof companyBankAccounts.$inferSelect) {
    return {
      id: bankAccount.id,
      companyId: bankAccount.companyId,
      bankName: bankAccount.bankName,
      accountHolderName: bankAccount.accountHolderName,
      accountNumber: bankAccount.accountNumber,
      ifscCode: bankAccount.ifscCode,
      branchName: bankAccount.branchName,
      upiId: bankAccount.upiId,
      qrImageUrl: bankAccount.qrImageUrl,
      openingBalance: this.parseNumeric(bankAccount.openingBalance) ?? 0,
      accountType: bankAccount.accountType,
      isDefault: bankAccount.isDefault,
      isActive: bankAccount.isActive,
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt
    };
  }

  public toInvoiceSettings(settings: typeof companyInvoiceSettings.$inferSelect) {
    return {
      id: settings.id,
      companyId: settings.companyId,
      salesInvoicePrefix: settings.salesInvoicePrefix,
      purchaseInvoicePrefix: settings.purchaseInvoicePrefix,
      creditNotePrefix: settings.creditNotePrefix,
      debitNotePrefix: settings.debitNotePrefix,
      autoNumbering: settings.autoNumbering,
      nextSalesInvoiceNumber: settings.nextSalesInvoiceNumber,
      nextPurchaseInvoiceNumber: settings.nextPurchaseInvoiceNumber,
      numberPadding: settings.numberPadding,
      termsAndConditions: settings.termsAndConditions,
      footerNote: settings.footerNote,
      showCompanyLogo: settings.showCompanyLogo,
      showBankDetails: settings.showBankDetails,
      showQrCode: settings.showQrCode,
      showSignature: settings.showSignature,
      roundOffEnabled: settings.roundOffEnabled,
      decimalPrecision: settings.decimalPrecision,
      taxDisplayFormat: settings.taxDisplayFormat,
      invoiceTemplate: settings.invoiceTemplate,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    };
  }

  public toBranding(branding: typeof companyBranding.$inferSelect) {
    return {
      id: branding.id,
      companyId: branding.companyId,
      logoUrl: branding.logoUrl,
      invoiceLogoUrl: branding.invoiceLogoUrl,
      signatureUrl: branding.signatureUrl,
      stampUrl: branding.stampUrl,
      faviconUrl: branding.faviconUrl,
      primaryColor: branding.primaryColor,
      createdAt: branding.createdAt,
      updatedAt: branding.updatedAt
    };
  }

  public toBranch(branch: typeof companyBranches.$inferSelect) {
    return {
      id: branch.id,
      companyId: branch.companyId,
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      gstNumber: branch.gstNumber,
      email: branch.email,
      mobileNumber: branch.mobileNumber,
      addressLine1: branch.addressLine1,
      addressLine2: branch.addressLine2,
      city: branch.city,
      state: branch.state,
      pincode: branch.pincode,
      managerName: branch.managerName,
      isActive: branch.isActive,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt
    };
  }

  public toPreferences(preferences: typeof companyPreferences.$inferSelect) {
    return {
      id: preferences.id,
      companyId: preferences.companyId,
      dateFormat: preferences.dateFormat,
      currencyFormat: preferences.currencyFormat,
      numberFormat: preferences.numberFormat,
      decimalPrecision: preferences.decimalPrecision,
      timezone: preferences.timezone,
      language: preferences.language,
      autoLogoutMinutes: preferences.autoLogoutMinutes,
      notificationEmailEnabled: preferences.notificationEmailEnabled,
      notificationSmsEnabled: preferences.notificationSmsEnabled,
      notificationWhatsappEnabled: preferences.notificationWhatsappEnabled,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    };
  }
}

export const companyRepository = new CompanyRepository();
