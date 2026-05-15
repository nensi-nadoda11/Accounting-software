import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type { SessionData } from "../types/auth";

export const profileApi = {
  get: async () => (await client.get<ApiResponse<SessionData>>("/profile")).data,
  update: async (payload: { fullName: string; mobileNumber?: string | null }) =>
    (await client.patch<ApiResponse<{ user: SessionData["user"] }>>("/profile", payload)).data,
};
