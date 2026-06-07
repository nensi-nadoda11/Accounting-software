import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { SiteAuditAttachment } from "../../../types/siteAudit";

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export const SiteAuditAttachmentUploader = ({
  attachments,
  editable,
  uploading,
  onUpload,
  onRemove,
}: {
  attachments: SiteAuditAttachment[];
  editable: boolean;
  uploading?: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (attachment: SiteAuditAttachment) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <div className="space-y-3">
      {editable ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setSelectedCount(files.length);
              if (files.length) {
                onUpload(files);
                event.target.value = "";
              }
            }}
          />
          <Button type="button" variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 size-4" />
            Upload
          </Button>
          {selectedCount ? <span className="text-sm text-slate-500">{selectedCount} selected</span> : null}
        </div>
      ) : null}
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Size</th>
              <th className="w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {attachments.length ? attachments.map((attachment) => (
              <tr key={attachment.id}>
                <td className="font-medium text-slate-900">{attachment.originalName}</td>
                <td>{attachment.mimeType}</td>
                <td>{formatSize(attachment.sizeBytes)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <TableActionIconButton
                      label="Download"
                      icon={<Download className="size-4" />}
                      onClick={() => window.open(attachment.fileUrl, "_blank", "noopener,noreferrer")}
                    />
                    {editable ? (
                      <TableActionIconButton
                        label="Remove"
                        tone="danger"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => onRemove(attachment)}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">No attachments</td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>
    </div>
  );
};
