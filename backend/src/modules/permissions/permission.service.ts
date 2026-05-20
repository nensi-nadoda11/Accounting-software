import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { appSettings, userPermissions } from "../../db/schema";
import { AppError } from "../../utils/app-error";
import type { PermissionKey } from "./permission.constants";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "./permission.constants";

type RoleKey = keyof typeof DEFAULT_ROLE_PERMISSIONS;
type RolePermissionMap = Record<RoleKey, PermissionKey[]>;

const ROLE_PERMISSION_SETTING_KEY = "role_permissions";
const USER_PERMISSION_SETTING_PREFIX = "user_permissions:";

const cloneDefaultRolePermissions = (): RolePermissionMap => ({
  admin: [...DEFAULT_ROLE_PERMISSIONS.admin],
  accountant: [...DEFAULT_ROLE_PERMISSIONS.accountant],
  staff: [...DEFAULT_ROLE_PERMISSIONS.staff],
  auditor: [...DEFAULT_ROLE_PERMISSIONS.auditor]
});

const getUserPermissionSettingKey = (userId: string) => `${USER_PERMISSION_SETTING_PREFIX}${userId}`;

export class PermissionService {
  public isKnownPermission(permission: string): permission is PermissionKey {
    return ALL_PERMISSIONS.includes(permission as PermissionKey);
  }

  public assertValidPermissions(permissions: string[]): PermissionKey[] {
    const invalid = permissions.filter((permission) => !this.isKnownPermission(permission));

    if (invalid.length > 0) {
      throw new AppError(`Invalid permissions: ${invalid.join(", ")}`, 400);
    }

    return Array.from(new Set(permissions)) as PermissionKey[];
  }

  private parsePermissionArray(value: unknown): PermissionKey[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return this.assertValidPermissions(value.filter((entry): entry is string => typeof entry === "string"));
  }

  private parseRolePermissionMap(value: unknown): RolePermissionMap {
    const fallback = cloneDefaultRolePermissions();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return fallback;
    }

    for (const role of Object.keys(fallback) as RoleKey[]) {
      const nextPermissions = (value as Record<string, unknown>)[role];
      if (nextPermissions !== undefined) {
        fallback[role] = this.parsePermissionArray(nextPermissions);
      }
    }

    return fallback;
  }

  private async upsertAppSetting(
    companyId: string,
    settingKey: string,
    settingGroup: string,
    settingValue: Record<string, unknown> | unknown[],
    updatedBy: string
  ) {
    const [setting] = await db
      .insert(appSettings)
      .values({
        companyId,
        settingKey,
        settingGroup,
        settingValue,
        updatedBy
      })
      .onConflictDoUpdate({
        target: [appSettings.companyId, appSettings.settingKey],
        set: {
          settingValue,
          settingGroup,
          updatedBy,
          updatedAt: new Date()
        }
      })
      .returning();

    return setting ?? null;
  }

  public async getRolePermissionMap(companyId?: string | null): Promise<RolePermissionMap> {
    if (!companyId) {
      return cloneDefaultRolePermissions();
    }

    const [setting] = await db
      .select({ settingValue: appSettings.settingValue })
      .from(appSettings)
      .where(
        and(
          eq(appSettings.companyId, companyId),
          eq(appSettings.settingKey, ROLE_PERMISSION_SETTING_KEY)
        )
      )
      .limit(1);

    return this.parseRolePermissionMap(setting?.settingValue);
  }

  public async getDefaultPermissionsByRole(role: RoleKey, companyId?: string | null): Promise<PermissionKey[]> {
    const permissions = await this.getRolePermissionMap(companyId);
    return [...permissions[role]];
  }

  public async setRolePermissions(
    companyId: string,
    role: RoleKey,
    permissions: PermissionKey[],
    updatedBy: string
  ): Promise<RolePermissionMap> {
    const nextMap = await this.getRolePermissionMap(companyId);
    nextMap[role] = this.assertValidPermissions(permissions);

    await this.upsertAppSetting(companyId, ROLE_PERMISSION_SETTING_KEY, "permissions", nextMap, updatedBy);

    return nextMap;
  }

  public async getCustomPermissions(userId: string): Promise<PermissionKey[]> {
    const rows = await db
      .select({ permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    return rows.map((row) => row.permissionKey as PermissionKey);
  }

  public async getPermissionsForUsers(userIds: string[]): Promise<Map<string, PermissionKey[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        userId: userPermissions.userId,
        permissionKey: userPermissions.permissionKey
      })
      .from(userPermissions)
      .where(inArray(userPermissions.userId, userIds));

    return rows.reduce<Map<string, PermissionKey[]>>((map, row) => {
      const current = map.get(row.userId) ?? [];
      current.push(row.permissionKey as PermissionKey);
      map.set(row.userId, current);
      return map;
    }, new Map());
  }

  public async getUserPermissionOverride(companyId: string, userId: string): Promise<PermissionKey[] | null> {
    const [setting] = await db
      .select({ settingValue: appSettings.settingValue })
      .from(appSettings)
      .where(
        and(
          eq(appSettings.companyId, companyId),
          eq(appSettings.settingKey, getUserPermissionSettingKey(userId))
        )
      )
      .limit(1);

    if (!setting) {
      return null;
    }

    return this.parsePermissionArray(setting.settingValue);
  }

  public async getUserPermissionOverrides(
    companyId: string,
    userIds: string[]
  ): Promise<Map<string, PermissionKey[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const settingKeys = userIds.map((userId) => getUserPermissionSettingKey(userId));
    const rows = await db
      .select({
        settingKey: appSettings.settingKey,
        settingValue: appSettings.settingValue
      })
      .from(appSettings)
      .where(and(eq(appSettings.companyId, companyId), inArray(appSettings.settingKey, settingKeys)));

    return rows.reduce<Map<string, PermissionKey[]>>((map, row) => {
      const userId = row.settingKey.replace(USER_PERMISSION_SETTING_PREFIX, "");
      map.set(userId, this.parsePermissionArray(row.settingValue));
      return map;
    }, new Map());
  }

  public async setUserPermissionOverride(
    companyId: string,
    userId: string,
    permissions: PermissionKey[],
    updatedBy: string
  ): Promise<void> {
    await this.upsertAppSetting(
      companyId,
      getUserPermissionSettingKey(userId),
      "permissions",
      this.assertValidPermissions(permissions),
      updatedBy
    );

    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  }

  public async clearUserPermissionOverride(companyId: string, userId: string): Promise<void> {
    await db
      .delete(appSettings)
      .where(
        and(
          eq(appSettings.companyId, companyId),
          eq(appSettings.settingKey, getUserPermissionSettingKey(userId))
        )
      );
  }

  public async getEffectivePermissions(
    userId: string,
    role: RoleKey,
    companyId?: string | null
  ): Promise<Set<PermissionKey>> {
    if (!companyId) {
      return new Set(await this.getDefaultPermissionsByRole(role));
    }

    const overridePermissions = await this.getUserPermissionOverride(companyId, userId);
    if (overridePermissions !== null) {
      return new Set(overridePermissions);
    }

    const rolePermissions = await this.getDefaultPermissionsByRole(role, companyId);
    const customPermissions = await this.getCustomPermissions(userId);

    return new Set([...rolePermissions, ...customPermissions]);
  }

  public async getEffectivePermissionsForUsers(
    companyId: string,
    users: Array<{ id: string; role: RoleKey }>
  ): Promise<Map<string, PermissionKey[]>> {
    if (users.length === 0) {
      return new Map();
    }

    const userIds = users.map((user) => user.id);
    const rolePermissions = await this.getRolePermissionMap(companyId);
    const legacyPermissions = await this.getPermissionsForUsers(userIds);
    const overridePermissions = await this.getUserPermissionOverrides(companyId, userIds);

    return users.reduce<Map<string, PermissionKey[]>>((map, user) => {
      const override = overridePermissions.get(user.id);
      if (override !== undefined) {
        map.set(user.id, [...override]);
        return map;
      }

      const combined = new Set([
        ...rolePermissions[user.role],
        ...(legacyPermissions.get(user.id) ?? [])
      ]);

      map.set(user.id, Array.from(combined));
      return map;
    }, new Map());
  }

  public async replacePermissions(userId: string, permissions: PermissionKey[]): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));

    if (permissions.length === 0) {
      return;
    }

    await db.insert(userPermissions).values(
      permissions.map((permissionKey) => ({
        userId,
        permissionKey
      }))
    );
  }
}

export const permissionService = new PermissionService();
