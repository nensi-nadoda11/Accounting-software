import { useId, useRef } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { FormField } from "./FormField";

export const FileUpload = ({
  label,
  previewUrl,
  error,
  accept = "image/png,image/jpeg,image/webp",
  disabled,
  uploading,
  emptyLabel = "Upload image",
  onFileSelect,
  onRemove,
  previewClassName,
}: {
  label: string;
  previewUrl?: string | null;
  error?: string;
  accept?: string;
  disabled?: boolean;
  uploading?: boolean;
  emptyLabel?: string;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  previewClassName?: string;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const id = useId();

  return (
    <FormField label={label} htmlFor={id} error={error}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          onFileSelect(file);
          event.target.value = "";
        }}
      />
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div
          className={cn(
            "flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white",
            previewClassName,
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <ImagePlus className="size-6" />
              <span className="text-sm">{emptyLabel}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={uploading}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? <RefreshCw className="mr-2 size-4" /> : <ImagePlus className="mr-2 size-4" />}
            {previewUrl ? "Replace" : "Upload"}
          </Button>
          {previewUrl && onRemove ? (
            <Button type="button" variant="secondary" disabled={disabled || uploading} onClick={onRemove}>
              <Trash2 className="mr-2 size-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </FormField>
  );
};
