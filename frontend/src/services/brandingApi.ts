import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { CompanyBranding, CompanyBrandingAssetType } from "../types/company";
import type { ApiResponse } from "../types/api";

const extractBlob = async (request: Promise<AxiosResponse<Blob>>) => {
  const response = await request;
  return response.data;
};

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
  downloadAsset: async (assetUrl: string) =>
    extractBlob(
      client.get(assetUrl, {
        responseType: "blob",
      }),
    ),
  remove: async (type: CompanyBrandingAssetType) =>
    (await client.delete<ApiResponse<CompanyBranding>>(`/company/branding/${type}`)).data,
};
