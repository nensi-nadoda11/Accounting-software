import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { userPermissions } from "../../db/schema";
import type { PermissionKey } from "./permission.constants";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "./permission.constants";

export class PermissionService {
  public isKnownPermission(permission: string): permission is PermissionKey {
    return ALL_PERMISSIONS.includes(permission as PermissionKey);
  }

  public assertValidPermissions(permissions: string[]): PermissionKey[] {
    const invalid = permissions.filter((permission) => !this.isKnownPermission(permission));

    if (invalid.length > 0) {
      throw new Error(`Invalid permissions: ${invalid.join(", ")}`);
    }

    return permissions as PermissionKey[];
  }

  public getDefaultPermissionsByRole(role: keyof typeof DEFAULT_ROLE_PERMISSIONS): PermissionKey[] {
    return [...DEFAULT_ROLE_PERMISSIONS[role]];
  }

  public async getCustomPermissions(userId: string): Promise<PermissionKey[]> {
    const rows = await db
      .select({ permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    return rows.map((row) => row.permissionKey as PermissionKey);
  }

  public async getEffectivePermissions(userId: string, role: keyof typeof DEFAULT_ROLE_PERMISSIONS): Promise<Set<PermissionKey>> {
    if (role === "admin") {
      return new Set(ALL_PERMISSIONS);
    }

    const custom = await this.getCustomPermissions(userId);
    return new Set([...this.getDefaultPermissionsByRole(role), ...custom]);
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

  public async appendPermissions(userId: string, permissions: PermissionKey[]): Promise<void> {
    if (permissions.length === 0) {
      return;
    }

    const existing = await this.getCustomPermissions(userId);
    const existingSet = new Set(existing);
    const newPermissions = permissions.filter((permission) => !existingSet.has(permission));

    if (newPermissions.length === 0) {
      return;
    }

    await db.insert(userPermissions).values(
      newPermissions.map((permissionKey) => ({
        userId,
        permissionKey
      }))
    );
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
}

export const permissionService = new PermissionService();
