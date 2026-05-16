import { eq } from "drizzle-orm";

import { db } from "../../db";
import { companies } from "../../db/schema";

export type SafeCompany = {
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
  status: "setup_pending" | "active" | "suspended" | "inactive";
  setupCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class CompaniesRepository {
  public async create(data: {
    name: string;
    gstNumber?: string;
    city?: string;
    state?: string;
  }): Promise<typeof companies.$inferSelect> {
    const [company] = await db
      .insert(companies)
      .values({
        name: data.name,
        gstNumber: data.gstNumber ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        status: "setup_pending"
      })
      .returning();

    if (!company) {
      throw new Error("Failed to create company");
    }

    return company;
  }

  public async findById(companyId: string): Promise<typeof companies.$inferSelect | null> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    return company ?? null;
  }

  public async updateStatus(companyId: string, status: typeof companies.$inferInsert.status): Promise<void> {
    await db
      .update(companies)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId));
  }

  public toSafeCompany(company: typeof companies.$inferSelect): SafeCompany {
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      businessType: company.businessType,
      industryType: company.industryType,
      gstNumber: company.gstNumber,
      panNumber: company.panNumber,
      cinNumber: company.cinNumber,
      email: company.email,
      mobileNumber: company.mobileNumber,
      website: company.website,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      state: company.state,
      pincode: company.pincode,
      country: company.country,
      timezone: company.timezone,
      currency: company.currency,
      language: company.language,
      status: company.status,
      setupCompletedAt: company.setupCompletedAt,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }
}

export const companiesRepository = new CompaniesRepository();
