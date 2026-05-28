import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import { getErrorMessage } from "../../../lib/errors";
import { useToast } from "../../../providers/useToast";
import type { Account } from "../../../types/accounting";
import type { ExpenseCategory } from "../../../types/expense";
import { expenseCategorySchema, type ExpenseCategoryInputValues, type ExpenseCategoryValues } from "../expenseSchemas";
import { applyExpenseFieldErrors } from "../expenseUtils";

export const ExpenseCategoryDrawer = ({
  open,
  category,
  categories,
  accounts,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  category: ExpenseCategory | null;
  categories: ExpenseCategory[];
  accounts: Account[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseCategoryValues) => Promise<void>;
}) => {
  const toast = useToast();
  const form = useForm<ExpenseCategoryInputValues, undefined, ExpenseCategoryValues>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: {
      name: "",
      parentId: null,
      defaultAccountId: null,
      description: null,
      status: "active",
      currentId: null,
    },
  });

  useEffect(() => {
    form.reset({
      name: category?.name ?? "",
      parentId: category?.parentId ?? null,
      defaultAccountId: category?.defaultAccountId ?? null,
      description: category?.description ?? null,
      status: category?.status === "inactive" ? "inactive" : "active",
      currentId: category?.id ?? null,
    });
  }, [category, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyExpenseFieldErrors(error, form.setError)) {
        toast.error(getErrorMessage(error, "Failed to save category"));
      }
    }
  });

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={category ? "Edit Category" : "Add Category"}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={() => void handleSubmit()}>
            Save Category
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Parent" {...form.register("parentId")} error={form.formState.errors.parentId?.message}>
            <option value="">No parent</option>
            {categories.filter((item) => item.id !== category?.id && item.status !== "deleted").map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select label="Default Account" {...form.register("defaultAccountId")} error={form.formState.errors.defaultAccountId?.message}>
            <option value="">None</option>
            {accounts.filter((item) => item.status === "active").map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountCode} • {account.accountName}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <Textarea label="Description" rows={4} {...form.register("description")} error={form.formState.errors.description?.message} />
      </div>
    </SideSheet>
  );
};
