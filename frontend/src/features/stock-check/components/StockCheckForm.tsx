import { Plus, RefreshCw, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { InventoryLookupField } from "../../inventory/components/InventoryLookupField";
import type { LookupOption } from "../../inventory/inventoryUtils";
import { StockCheckItemsGrid, type StockCheckDraftItem } from "./StockCheckItemsGrid";
import { StockCheckSummary } from "./StockCheckSummary";

export const StockCheckForm = ({
  title,
  warehouse,
  checkDate,
  remarks,
  items,
  submitting,
  loadingStock,
  loadWarehouseOptions,
  loadProductOptions,
  loadBatchOptions,
  onWarehouseChange,
  onCheckDateChange,
  onRemarksChange,
  onLoadWarehouseStock,
  onAddProduct,
  onPhysicalQtyChange,
  onReasonChange,
  onRemoveItem,
  onCancel,
  onSubmit,
}: {
  title: string;
  warehouse: LookupOption | null;
  checkDate: string;
  remarks: string;
  items: StockCheckDraftItem[];
  submitting: boolean;
  loadingStock: boolean;
  loadWarehouseOptions: (search: string) => Promise<LookupOption[]>;
  loadProductOptions: (search: string) => Promise<LookupOption[]>;
  loadBatchOptions: (productId: string, search: string) => Promise<LookupOption[]>;
  onWarehouseChange: (value: LookupOption | null) => void;
  onCheckDateChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onLoadWarehouseStock: () => void;
  onAddProduct: (product: LookupOption, batch: LookupOption | null) => Promise<void>;
  onPhysicalQtyChange: (productId: string, value: string) => void;
  onReasonChange: (productId: string, value: string) => void;
  onRemoveItem: (productId: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) => {
  const [productOption, setProductOption] = useState<LookupOption | null>(null);
  const [batchOption, setBatchOption] = useState<LookupOption | null>(null);
  const summary = {
    totalItems: items.length,
    matchedItems: items.filter((item) => item.status === "matched").length,
    shortItems: items.filter((item) => item.status === "short").length,
    excessItems: items.filter((item) => item.status === "excess").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} loading={submitting}>
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-5 md:grid-cols-3">
          <InventoryLookupField
            label="Warehouse"
            value={warehouse}
            onChange={onWarehouseChange}
            loadOptions={loadWarehouseOptions}
            placeholder="Select warehouse"
            allowClear={false}
          />
          <Input type="date" label="Date" value={checkDate} onChange={(event) => onCheckDateChange(event.target.value)} />
          <Textarea label="Remarks" value={remarks} onChange={(event) => onRemarksChange(event.target.value)} rows={1} className="min-h-[44px]" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <InventoryLookupField
            label="Product"
            value={productOption}
            onChange={(value) => {
              setProductOption(value);
              setBatchOption(null);
            }}
            loadOptions={loadProductOptions}
            placeholder="Add product"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <InventoryLookupField
            label="Batch"
            value={batchOption}
            onChange={setBatchOption}
            loadOptions={(search) => (productOption && warehouse ? loadBatchOptions(productOption.id, search) : Promise.resolve([]))}
            placeholder="All batches"
            disabled={!productOption || !warehouse}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!productOption || !warehouse}
          onClick={async () => {
            if (!productOption) {
              return;
            }
            await onAddProduct(productOption, batchOption);
            setProductOption(null);
            setBatchOption(null);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add
        </Button>
        <Button type="button" variant="secondary" disabled={!warehouse} loading={loadingStock} onClick={onLoadWarehouseStock}>
          <RefreshCw className="mr-2 size-4" />
          Load Stock
        </Button>
      </div>

      <StockCheckSummary summary={summary} />
      <Card>
        <StockCheckItemsGrid
          items={items}
          editable
          onPhysicalQtyChange={onPhysicalQtyChange}
          onReasonChange={onReasonChange}
          onRemove={onRemoveItem}
        />
      </Card>
    </div>
  );
};
