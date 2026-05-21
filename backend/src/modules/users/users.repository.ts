import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";

import { db } from "../../db";
import { userInvites, users } from "../../db/schema";
import type { PermissionKey } from "../permissions/permission.constants";

export type SafeUser = {
  id: string;
  companyId: string | null;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  role: "admin" | "accountant" | "staff" | "auditor";
  status: "pending_verification" | "invited" | "active" | "suspended" | "disabled";
  emailVerifiedAt: Date | null;
  mobileVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectivePermissionSet = Set<PermissionKey>;

type ListUsersParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  role?: SafeUser["role"];
  status?: SafeUser["status"];
};

type ListInvitesParams = {
  companyId: string;
};

export class UsersRepository {
  public async create(data: typeof users.$inferInsert): Promise<typeof users.$inferSelect> {
    const [user] = await db.insert(users).values(data).returning();
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  }

  public async findByEmail(email: string): Promise<typeof users.$inferSelect | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  public async findByMobileNumber(mobileNumber: string): Promise<typeof users.$inferSelect | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.mobileNumber, mobileNumber), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  public async findByIdentifier(identifier: string): Promise<typeof users.$inferSelect | null> {
    const normalized = identifier.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(eq(users.email, normalized), eq(users.mobileNumber, identifier))
        )
      )
      .limit(1);

    return user ?? null;
  }

  public async findById(userId: string): Promise<typeof users.$inferSelect | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  public async markEmailVerifiedAndActivate(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  public async updateStatus(userId: string, companyId: string, status: SafeUser["status"]): Promise<void> {
    await db
      .update(users)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId), isNull(users.deletedAt)));
  }

  public async updateRole(userId: string, companyId: string, role: SafeUser["role"]): Promise<void> {
    await db
      .update(users)
      .set({
        role,
        updatedAt: new Date()
      })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId), isNull(users.deletedAt)));
  }

  public async updateProfile(userId: string, data: { fullName: string; mobileNumber: string | null }): Promise<void> {
    await db
      .update(users)
      .set({
        fullName: data.fullName,
        mobileNumber: data.mobileNumber,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  public async listByCompany(params: ListUsersParams): Promise<{
    rows: typeof users.$inferSelect[];
    total: number;
  }> {
    const conditions = [
      eq(users.companyId, params.companyId),
      isNull(users.deletedAt)
    ];

    if (params.search) {
      const query = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.fullName, query),
          ilike(users.email, query),
          ilike(users.mobileNumber, query)
        )!
      );
    }

    if (params.role) {
      conditions.push(eq(users.role, params.role));
    }

    if (params.status) {
      conditions.push(eq(users.status, params.status));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt), asc(users.fullName))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(users).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findManyByIds(userIds: string[]): Promise<(typeof users.$inferSelect)[]> {
    if (userIds.length === 0) {
      return [];
    }

    return db.select().from(users).where(and(inArray(users.id, userIds), isNull(users.deletedAt)));
  }

  public async findUserByIdAndCompany(userId: string, companyId: string): Promise<typeof users.$inferSelect | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.companyId, companyId), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  public async createInvite(data: typeof userInvites.$inferInsert): Promise<typeof userInvites.$inferSelect> {
    const [invite] = await db.insert(userInvites).values(data).returning();
    if (!invite) {
      throw new Error("Failed to create invite");
    }
    return invite;
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<typeof userInvites.$inferSelect | null> {
    const [invite] = await db
      .select()
      .from(userInvites)
      .where(eq(userInvites.tokenHash, tokenHash))
      .limit(1);

    return invite ?? null;
  }

  public async findInviteById(inviteId: string, companyId: string): Promise<typeof userInvites.$inferSelect | null> {
    const [invite] = await db
      .select()
      .from(userInvites)
      .where(and(eq(userInvites.id, inviteId), eq(userInvites.companyId, companyId)))
      .limit(1);

    return invite ?? null;
  }

  public async listInvitesByCompany(params: ListInvitesParams): Promise<(typeof userInvites.$inferSelect)[]> {
    return db
      .select()
      .from(userInvites)
      .where(eq(userInvites.companyId, params.companyId))
      .orderBy(desc(userInvites.createdAt), asc(userInvites.fullName));
  }

  public async updateInvite(inviteId: string, data: Partial<typeof userInvites.$inferInsert>): Promise<void> {
    await db
      .update(userInvites)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(userInvites.id, inviteId));
  }

  public async findExistingCompanyUser(email: string, companyId: string): Promise<typeof users.$inferSelect | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.companyId, companyId), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  public toSafeUser(user: typeof users.$inferSelect): SafeUser {
    return {
      id: user.id,
      companyId: user.companyId,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      mobileVerifiedAt: user.mobileVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export const usersRepository = new UsersRepository();
