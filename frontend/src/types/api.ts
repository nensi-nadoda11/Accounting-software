import type { PermissionKey, Role, User, UserStatus } from "./auth";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  company: import("./auth").Company | null;
  permissions: PermissionKey[];
}

export interface PaginatedUsersResponse {
  items: Array<User & { permissions: PermissionKey[] }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InviteRecord {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  mobileNumber?: string | null;
  permissions?: PermissionKey[];
  createdAt?: string;
}

export interface UserFilters {
  page: number;
  limit: number;
  search?: string;
  role?: Role | "";
  status?: UserStatus | "";
}
