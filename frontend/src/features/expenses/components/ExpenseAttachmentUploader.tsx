import { Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { cn } from "../../../lib/utils";
import { expensesApi } from "../../../services/expensesApi";
import type { ExpenseAttachment } from "../../../types/expense";
import { formatBytes, isPreviewableImage, isPreviewablePdf } from "../expenseUtils";

type UploadingFile = {
  id: string;
  file: File;
  progress: number;
};

export const ExpenseAttachmentUploader = ({
  attachments,
  uploadingFiles,
  disabled,
  onUpload,
  onRemove,
}: {
  attachments: ExpenseAttachment[];
  uploadingFiles: UploadingFile[];
  disabled?: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (attachment: ExpenseAttachment) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const accept = "image/jpeg,image/png,image/webp,application/pdf";

  const previewItems = useMemo(
    () =>
      attachments.map((attachment) => ({
        attachment,
        kind: isPreviewableImage(attachment) ? "image" : isPreviewablePdf(attachment) ? "pdf" : "file",
      })),
    [attachments],
  );

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    const loadPreviews = async () => {
      const nextEntries = await Promise.all(
        previewItems.map(async ({ attachment, kind }) => {
          if (kind === "file") {
            return null;
          }

          try {
            const file = await expensesApi.downloadAttachment(attachment.fileUrl, attachment.originalName);
            const objectUrl = URL.createObjectURL(file.blob);
            urls.push(objectUrl);
            return [attachment.id, objectUrl] as const;
          } catch {
            return null;
          }
        }),
      );

      if (!cancelled) {
        setPreviewUrls(
          Object.fromEntries(nextEntries.filter((entry): entry is readonly [string, string] => Boolean(entry))),
        );
      }
    };

    void loadPreviews();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewItems]);

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) {
      return;
    }

    onUpload(Array.from(list));
  };

  const openAttachment = async (attachment: ExpenseAttachment, previewUrl?: string) => {
    try {
      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const file = await expensesApi.downloadAttachment(attachment.fileUrl, attachment.originalName);
      const objectUrl = URL.createObjectURL(file.blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      // Keep the uploader responsive even if a preview file can no longer be read.
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60",
          dragActive && "border-emerald-500 bg-emerald-50",
        )}
      >
        <UploadCloud className="mr-2 size-4" />
        Upload receipts
      </button>

      {uploadingFiles.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {uploadingFiles.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatBytes(item.file.size)}</p>
                </div>
                <Paperclip className="mt-0.5 size-4 text-slate-400" />
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {previewItems.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {previewItems.map(({ attachment, kind }) => (
            <div key={attachment.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                className="flex h-36 w-full items-center justify-center bg-slate-50"
                onClick={() => void openAttachment(attachment, previewUrls[attachment.id])}
              >
                {kind === "image" && previewUrls[attachment.id] ? (
                  <img src={previewUrls[attachment.id]} alt={attachment.originalName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Paperclip className="size-5" />
                    <span className="text-sm">{kind === "pdf" ? "PDF" : "File"}</span>
                  </div>
                )}
              </button>
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{attachment.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatBytes(attachment.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => onRemove(attachment)}
                  aria-label={`Remove ${attachment.originalName}`}
                  disabled={disabled}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : uploadingFiles.length ? null : (
        <EmptyState title="No attachments yet." />
      )}
    </div>
  );
};
