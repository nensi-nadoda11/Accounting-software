import { useEffect, useState } from "react";

import { getErrorMessage } from "../../lib/errors";
import { brandingApi } from "../../services/brandingApi";
import { useToast } from "../../providers/ToastProvider";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { FileUpload } from "../../components/ui/FileUpload";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionGrid } from "../../components/ui/SectionGrid";
import type { CompanyBranding, CompanyBrandingAssetType } from "../../types/company";
import { BRANDING_ASSET_SECTIONS } from "./companyOptions";
import { getBrandingAssetUrl } from "./companyUtils";

export const BrandingPage = () => {
  const toast = useToast();
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<CompanyBrandingAssetType | null>(null);
  const [removingType, setRemovingType] = useState<CompanyBrandingAssetType | null>(null);
  const [fileErrors, setFileErrors] = useState<Partial<Record<CompanyBrandingAssetType, string>>>({});

  const loadBranding = async () => {
    try {
      setLoading(true);
      const response = await brandingApi.get();
      setBranding(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load branding"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranding();
  }, []);

  if (loading || !branding) {
    return <LoadingState label="Loading branding..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" />
      <Card>
        <CardHeader title="Assets" />
        <CardContent>
          <SectionGrid className="xl:grid-cols-2">
            {BRANDING_ASSET_SECTIONS.map((asset) => (
              <FileUpload
                key={asset.type}
                label={asset.label}
                previewUrl={getBrandingAssetUrl(branding, asset.type)}
                error={fileErrors[asset.type]}
                uploading={uploadingType === asset.type || removingType === asset.type}
                onFileSelect={async (file) => {
                  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                    setFileErrors((current) => ({ ...current, [asset.type]: "Only PNG, JPG, JPEG and WEBP files are allowed" }));
                    return;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    setFileErrors((current) => ({ ...current, [asset.type]: "Image must be 2MB or less" }));
                    return;
                  }

                  try {
                    setUploadingType(asset.type);
                    setFileErrors((current) => ({ ...current, [asset.type]: undefined }));
                    const response = await brandingApi.upload({ type: asset.type, file });
                    setBranding(response.data);
                    toast.success(`${asset.label} updated`);
                  } catch (error) {
                    toast.error(getErrorMessage(error, `Failed to upload ${asset.label.toLowerCase()}`));
                  } finally {
                    setUploadingType(null);
                  }
                }}
                onRemove={
                  getBrandingAssetUrl(branding, asset.type)
                    ? async () => {
                        try {
                          setRemovingType(asset.type);
                          const response = await brandingApi.remove(asset.type);
                          setBranding(response.data);
                          toast.success(`${asset.label} removed`);
                        } catch (error) {
                          toast.error(getErrorMessage(error, `Failed to remove ${asset.label.toLowerCase()}`));
                        } finally {
                          setRemovingType(null);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </SectionGrid>
        </CardContent>
      </Card>
    </div>
  );
};
