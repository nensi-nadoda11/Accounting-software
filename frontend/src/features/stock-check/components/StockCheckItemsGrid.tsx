import { Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { QuantityText } from "../../../components/ui/QuantityText";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { StockCheckBatchRef, StockCheckItemStatus, StockCheckProductRef } from "../../../types/stockCheck";
import { StatusBadge } from "./StatusBadge";

export interface StockCheckDraftItem {
  rowKey: string;
  product: StockCheckProductRef;
  batch: StockCheckBatchRef | null;
  systemQty: string;
  physicalQty: string;
  differenceQty: string;
  status: StockCheckItemStatus;
  reason: string;
}

export const StockCheckItemsGrid = ({
  items,
  editable,
  onPhysicalQtyChange,
  onReasonChange,
  onRemove,
}: {
  items: StockCheckDraftItem[];
  editable: boolean;
  onPhysicalQtyChange: (rowKey: string, value: string) => void;
  onReasonChange: (rowKey: string, value: string) => void;
  onRemove: (rowKey: string) => void;
}) => (
  <TableWrapper>
    <Table>
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {["Product", "Batch", "SKU", "System Stock", "Physical Stock", "Difference", "Status", "Reason", ""].map((head) => (
            <th key={head} className="px-4 py-3 font-semibold">
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
        {items.map((item) => (
          <tr key={item.rowKey}>
            <td className="px-4 py-3">
              <div className="min-w-[180px]">
                <p className="font-medium text-slate-900">{item.product.name}</p>
                <p className="text-xs text-slate-500">{item.product.productCode}</p>
              </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">{item.batch?.batchNumber ?? "-"}</td>
            <td className="px-4 py-3 whitespace-nowrap">{item.product.sku ?? "-"}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <QuantityText value={item.systemQty} tone="default" />
            </td>
            <td className="px-4 py-3 min-w-[140px]">
              {editable ? (
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={item.physicalQty}
                  onChange={(event) => onPhysicalQtyChange(item.rowKey, event.target.value)}
                />
              ) : (
                <QuantityText value={item.physicalQty} tone="default" />
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <QuantityText value={item.differenceQty} tone={Number(item.differenceQty) < 0 ? "danger" : "success"} />
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={item.status} />
            </td>
            <td className="px-4 py-3 min-w-[180px]">
              {editable ? (
                <Input value={item.reason} onChange={(event) => onReasonChange(item.rowKey, event.target.value)} />
              ) : (
                item.reason || "-"
              )}
            </td>
            <td className="px-4 py-3 text-right">
              {editable ? (
                <Button type="button" variant="ghost" className="size-9 px-0" onClick={() => onRemove(item.rowKey)} aria-label="Remove item">
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </TableWrapper>
);
