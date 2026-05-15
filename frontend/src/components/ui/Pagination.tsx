import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./Button";

export const Pagination = ({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <p className="text-sm text-slate-500">
      Page {page} of {totalPages}
    </p>
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="mr-1 size-4" />
        Previous
      </Button>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  </div>
);
