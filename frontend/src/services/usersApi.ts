import { client } from "../lib/api/client";
import type { ApiResponse, InviteRecord, PaginatedUsersResponse, UserFilters } from "../types/api";
import type { PermissionKey, Role, UserStatus } from "../types/auth";

export const usersApi = {
  list: async (filters: UserFilters) =>
    (
      await client.get<ApiResponse<PaginatedUsersResponse>>("/users", {
        params: {
          page: filters.page,
          limit: filters.limit,
          search: filters.search || undefined,
          role: filters.role || undefined,
          status: filters.status || undefined,
        },
      })
    ).data,
  invite: async (payload: {
    fullName: string;
    email: string;
    mobileNumber?: string;
    role: Exclude<Role, "admin">;
    permissions?: PermissionKey[];
  }) => (await client.post<ApiResponse<InviteRecord>>("/users/invite", payload)).data,
  acceptInvite: async (payload: { token: string; password: string; confirmPassword: string }) =>
    (await client.post<ApiResponse<Record<string, unknown>>>("/users/accept-invite", payload)).data,
  resendInvite: async (inviteId: string) =>
    (await client.post<ApiResponse<Record<string, never>>>("/users/resend-invite", { inviteId })).data,
  revokeInvite: async (inviteId: string) =>
    (await client.post<ApiResponse<Record<string, never>>>("/users/revoke-invite", { inviteId })).data,
  updateStatus: async (userId: string, status: Extract<UserStatus, "active" | "suspended" | "disabled">) =>
    (await client.patch<ApiResponse<Record<string, never>>>(`/users/${userId}/status`, { status })).data,
  updateRole: async (userId: string, role: Role) =>
    (await client.patch<ApiResponse<Record<string, never>>>(`/users/${userId}/role`, { role })).data,
  updatePermissions: async (userId: string, permissions: PermissionKey[]) =>
    (await client.patch<ApiResponse<Record<string, never>>>(`/users/${userId}/permissions`, { permissions })).data,
};
