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
  fixedHeight = false,
}: {
  columns: Array<ReportTableColumn<TItem>>;
  items: TItem[];
  emptyText?: string;
  pagination?: { page: number; totalPages: number };
  onPageChange?: (page: number) => void;
  totalsRow?: React.ReactNode;
  fixedHeight?: boolean;
}) => (
  <div className="space-y-3">
    {/* If this table is used for recent exports or forced fixedHeight, add a fixed height and vertical scroll */}
    <TableWrapper>
      <div
        className={
          pagination && !fixedHeight
            ? "overflow-x-auto"
            : "overflow-x-auto overflow-y-auto max-h-80" // max-h-80 ~320px, shows ~5-6 rows
        }
        style={!pagination || fixedHeight ? { minHeight: 0 } : undefined}
      >
        <Table className="text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? (
              items.map((item, rowIndex) => (
                <tr
                  key={String((item as { id?: string }).id ?? rowIndex)}
                  className="align-top"
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="whitespace-nowrap px-3 py-3 text-slate-600"
                    >
                      {column.render
                        ? column.render(item)
                        : String(
                            (item as Record<string, unknown>)[
                              column.key as string
                            ] ?? "-",
                          )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-8 text-center text-slate-500"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            )}
            {totalsRow}
          </tbody>
        </Table>
      </div>
    </TableWrapper>
    {pagination && onPageChange ? (
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onChange={onPageChange}
      />
    ) : null}
  </div>
);
