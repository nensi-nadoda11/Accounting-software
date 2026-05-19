import { Download } from "lucide-react";

import { Button } from "../../../components/ui/Button";

export const ReportExportButton = ({
  onClick,
  loading,
  disabled,
  label = "Export",
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}) => (
  <Button type="button" variant="secondary" onClick={onClick} loading={loading} disabled={disabled}>
    <Download className="mr-2 size-4" />
    {label}
  </Button>
);
