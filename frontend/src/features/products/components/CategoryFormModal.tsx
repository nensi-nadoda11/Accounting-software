import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { ProductCategory, ProductCategoryFormInput } from "../../../types/product";
import { FORM_CATEGORY_STATUS_OPTIONS } from "../productOptions";
import { categoryFormSchema, type CategoryFormValues } from "../productSchemas";

export const CategoryFormModal = ({
  open,
  onClose,
  initialCategory,
  parentOptions,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialCategory?: ProductCategory | null;
  parentOptions: ProductCategory[];
  submitting?: boolean;
  onSubmit: (
    values: ProductCategoryFormInput,
    setError: UseFormSetError<CategoryFormValues>,
  ) => Promise<void>;
}) => {
  const form = useForm<CategoryFormValues, undefined, ProductCategoryFormInput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: initialCategory?.name ?? "",
      parentId: initialCategory?.parentId ?? null,
      description: initialCategory?.description ?? null,
      status: initialCategory?.status === "inactive" ? "inactive" : "active",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: initialCategory?.name ?? "",
      parentId: initialCategory?.parentId ?? null,
      description: initialCategory?.description ?? null,
      status: initialCategory?.status === "inactive" ? "inactive" : "active",
    });
  }, [form, initialCategory, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialCategory ? "Edit Category" : "Add Category"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              await onSubmit(values, form.setError);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
        <Select label="Parent Category" {...form.register("parentId")} error={form.formState.errors.parentId?.message}>
          <option value="">No Parent</option>
          {parentOptions
            .filter((category) => category.id !== initialCategory?.id)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </Select>
        <Textarea
          label="Description"
          rows={3}
          {...form.register("description")}
          value={(form.watch("description") as string | null | undefined) ?? ""}
          error={form.formState.errors.description?.message}
        />
        <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
          {FORM_CATEGORY_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
};
