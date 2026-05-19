import type { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export const TableWrapper = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-200 bg-white", className)} {...props} />
);

export const Table = ({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) => (
  <table className={cn("app-table min-w-full divide-y divide-slate-200 text-left", className)} {...props} />
);
