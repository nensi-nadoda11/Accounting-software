import { Table, TableWrapper } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";

export type ReportTableColumn<TItem> = {
  key: keyof TItem | string;
  label: string;
  render?: (item: TItem) => React.ReactNode;
};

export const ReportTable = <TItem extends object>({
  columns,
  items,
  emptyText = "No records found",
  pagination,
  onPageChange,
  totalsRow,
}: {
  columns: Array<ReportTableColumn<TItem>>;
  items: TItem[];
  emptyText?: string;
  pagination?: { page: number; totalPages: number };
  onPageChange?: (page: number) => void;
  totalsRow?: React.ReactNode;
}) => (
  <div className="space-y-3">
    <TableWrapper>
      <div className="overflow-x-auto">
        <Table className="text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? (
              items.map((item, rowIndex) => (
                <tr key={String((item as { id?: string }).id ?? rowIndex)} className="align-top">
                  {columns.map((column) => (
                    <td key={String(column.key)} className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key as string] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
            {totalsRow}
          </tbody>
        </Table>
      </div>
    </TableWrapper>
    {pagination && onPageChange ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} /> : null}
  </div>
);
