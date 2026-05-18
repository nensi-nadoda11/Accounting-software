import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { Account, AccountType } from "../../../types/accounting";
import { accountFormSchema, type AccountFormInputValues, type AccountFormValues } from "../accountingSchemas";
import { ACCOUNT_TYPES } from "../../../types/accounting";
import { accountTypeLabels } from "../accountingUtils";

export const AccountFormDrawer = ({
  open,
  mode,
  account,
  parentOptions,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit" | "view";
  account: Account | null;
  parentOptions: Account[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void> | void;
}) => {
  const form = useForm<AccountFormInputValues, undefined, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountCode: "",
      accountName: "",
      accountType: "asset",
      accountSubtype: null,
      parentId: null,
      openingBalance: 0,
      openingBalanceType: "none",
      status: "active",
      description: null,
    },
  });

  const readOnly = mode === "view";
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      accountCode: account?.accountCode ?? "",
      accountName: account?.accountName ?? "",
      accountType: account?.accountType ?? "asset",
      accountSubtype: account?.accountSubtype ?? null,
      parentId: account?.parentId ?? null,
      openingBalance: Number(account?.openingBalance ?? 0),
      openingBalanceType: account?.openingBalanceType ?? "none",
      status: account?.status === "inactive" ? "inactive" : "active",
      description: account?.description ?? null,
    });
  }, [account, form, open]);

  const selectedType = form.watch("accountType");
  const filteredParents = parentOptions.filter((item) => item.id !== account?.id && item.accountType === selectedType);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add Account" : mode === "edit" ? "Edit Account" : "Account Details"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!readOnly ? (
            <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
              {isEdit ? "Save Changes" : "Create Account"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Account Code"
          readOnly={readOnly || isEdit}
          {...form.register("accountCode")}
          error={form.formState.errors.accountCode?.message}
        />
        <Input
          label="Account Name"
          readOnly={readOnly}
          {...form.register("accountName")}
          error={form.formState.errors.accountName?.message}
        />
        <Select
          label="Account Type"
          disabled={readOnly || isEdit}
          {...form.register("accountType")}
          error={form.formState.errors.accountType?.message}
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {accountTypeLabels[type as AccountType]}
            </option>
          ))}
        </Select>
        <Input
          label="Subtype"
          readOnly={readOnly}
          {...form.register("accountSubtype")}
          error={form.formState.errors.accountSubtype?.message ?? undefined}
        />
        <Select
          label="Parent Account"
          disabled={readOnly}
          value={form.watch("parentId") ?? ""}
          onChange={(event) => form.setValue("parentId", event.target.value || null, { shouldValidate: true })}
          error={form.formState.errors.parentId?.message}
        >
          <option value="">None</option>
          {filteredParents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.accountCode} - {item.accountName}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          disabled={readOnly}
          {...form.register("status")}
          error={form.formState.errors.status?.message}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        {!isEdit ? (
          <>
            <Input
              type="number"
              min="0"
              step="0.01"
              label="Opening Balance"
              readOnly={readOnly}
              {...form.register("openingBalance", { valueAsNumber: true })}
              error={form.formState.errors.openingBalance?.message}
            />
            <Select
              label="Opening Balance Side"
              disabled={readOnly}
              {...form.register("openingBalanceType")}
              error={form.formState.errors.openingBalanceType?.message}
            >
              <option value="none">None</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </Select>
          </>
        ) : null}
        <div className="md:col-span-2">
          <Textarea
            label="Description"
            rows={4}
            readOnly={readOnly}
            {...form.register("description")}
            error={form.formState.errors.description?.message ?? undefined}
          />
        </div>
      </div>
    </SideSheet>
  );
};
