import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { companyApi } from "../../services/companyApi";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { CompanySetupStatusCard } from "./components/CompanySetupStatusCard";
import { COMPANY_CURRENCY_OPTIONS, COMPANY_LANGUAGE_OPTIONS, COMPANY_TIMEZONE_OPTIONS } from "./companyOptions";
import { companyProfileSchema } from "./companySchemas";
import { getCompanyProfileFormDefaults, nullableString } from "./companyUtils";

type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

export const CompanyProfilePage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const form = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: "",
      legalName: "",
      businessType: "",
      industryType: "",
      gstNumber: "",
      panNumber: "",
      cinNumber: "",
      email: "",
      mobileNumber: "",
      website: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      timezone: "Asia/Kolkata",
      currency: "INR",
      language: "en",
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const response = await companyApi.getProfile();
        form.reset(getCompanyProfileFormDefaults(response.data));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load company profile"));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, toast]);

  if (loading) {
    return <LoadingState label="Loading company profile..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Company Profile" />
      <CompanySetupStatusCard />
      <Card>
        <CardHeader title="Profile Details" />
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const response = await companyApi.updateProfile({
                  name: values.name.trim(),
                  legalName: nullableString(values.legalName),
                  businessType: nullableString(values.businessType),
                  industryType: nullableString(values.industryType),
                  gstNumber: nullableString(values.gstNumber)?.toUpperCase() ?? null,
                  panNumber: nullableString(values.panNumber)?.toUpperCase() ?? null,
                  cinNumber: nullableString(values.cinNumber)?.toUpperCase() ?? null,
                  email: nullableString(values.email)?.toLowerCase() ?? null,
                  mobileNumber: nullableString(values.mobileNumber),
                  website: nullableString(values.website),
                  addressLine1: nullableString(values.addressLine1),
                  addressLine2: nullableString(values.addressLine2),
                  city: nullableString(values.city),
                  state: nullableString(values.state),
                  pincode: nullableString(values.pincode),
                  country: values.country.trim(),
                  timezone: values.timezone.trim(),
                  currency: values.currency.trim().toUpperCase(),
                  language: values.language.trim(),
                });
                auth.updateCompany(response.data);
                form.reset(getCompanyProfileFormDefaults(response.data));
                toast.success("Company profile saved");
              } catch (error) {
                toast.error(getErrorMessage(error, "Failed to save company profile"));
              }
            })}
          >
            <Input label="Company Name" {...form.register("name")} error={form.formState.errors.name?.message} />
            <Input label="Legal Name" {...form.register("legalName")} error={form.formState.errors.legalName?.message} />
            <Input label="Business Type" {...form.register("businessType")} error={form.formState.errors.businessType?.message} />
            <Input label="Industry Type" {...form.register("industryType")} error={form.formState.errors.industryType?.message} />
            <Input label="GST Number" {...form.register("gstNumber")} error={form.formState.errors.gstNumber?.message} />
            <Input label="PAN Number" {...form.register("panNumber")} error={form.formState.errors.panNumber?.message} />
            <Input label="CIN" {...form.register("cinNumber")} error={form.formState.errors.cinNumber?.message} />
            <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
            <Input label="Mobile" {...form.register("mobileNumber")} error={form.formState.errors.mobileNumber?.message} />
            <Input label="Website" {...form.register("website")} error={form.formState.errors.website?.message} />
            <Input label="Address Line 1" {...form.register("addressLine1")} error={form.formState.errors.addressLine1?.message} />
            <Input label="Address Line 2" {...form.register("addressLine2")} error={form.formState.errors.addressLine2?.message} />
            <Input label="City" {...form.register("city")} error={form.formState.errors.city?.message} />
            <Input label="State" {...form.register("state")} error={form.formState.errors.state?.message} />
            <Input label="Pincode" {...form.register("pincode")} error={form.formState.errors.pincode?.message} />
            <Input label="Country" {...form.register("country")} error={form.formState.errors.country?.message} />
            <Select label="Timezone" {...form.register("timezone")} error={form.formState.errors.timezone?.message}>
              {COMPANY_TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select label="Currency" {...form.register("currency")} error={form.formState.errors.currency?.message}>
              {COMPANY_CURRENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select label="Language" {...form.register("language")} error={form.formState.errors.language?.message}>
              {COMPANY_LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </Select>
            <div className="md:col-span-2 xl:col-span-3 flex justify-end">
              <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                <Save className="mr-2 size-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

