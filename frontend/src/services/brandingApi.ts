import { client } from "../lib/api/client";
import type { CompanyBranding, CompanyBrandingAssetType } from "../types/company";
import type { ApiResponse } from "../types/api";

export const brandingApi = {
  get: async () => (await client.get<ApiResponse<CompanyBranding>>("/company/branding")).data,
  upload: async (payload: { type: CompanyBrandingAssetType; file?: File; primaryColor?: string }) => {
    const formData = new FormData();
    formData.append("type", payload.type);
    if (payload.file) {
      formData.append("file", payload.file);
    }
    if (payload.primaryColor) {
      formData.append("primaryColor", payload.primaryColor);
    }

    return (
      await client.post<ApiResponse<CompanyBranding>>("/company/branding/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
    ).data;
  },
  remove: async (type: CompanyBrandingAssetType) =>
    (await client.delete<ApiResponse<CompanyBranding>>(`/company/branding/${type}`)).data,
};
