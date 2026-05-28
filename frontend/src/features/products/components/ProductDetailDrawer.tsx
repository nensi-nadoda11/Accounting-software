import { useEffect, useState } from "react";
import { Eye, History, Package, Pencil, ScanLine, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { productsApi } from "../../../services/productsApi";
import type { Product, ProductPriceHistoryResponse, ProductStockSummary } from "../../../types/product";
import {
  PRICE_TAX_TYPE_LABELS,
  PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  TAX_TYPE_LABELS,
} from "../productOptions";
import {
  formatDateTime,
  formatInr,
  formatPercent,
  getProductStatusTone,
  getTaxTypeTone,
} from "../productUtils";

export const ProductDetailDrawer = ({
  open,
  productId,
  reloadKey,
  onClose,
  onEdit,
  onOpenPriceHistory,
  onOpenStockSummary,
  onGenerateBarcode,
  onDelete,
  canEdit,
  canDelete,
  canViewPriceHistory,
  canManagePrice,
}: {
  open: boolean;
  productId: string | null;
  reloadKey: number;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onOpenPriceHistory: (product: Product) => void;
  onOpenStockSummary: (product: Product) => void;
  onGenerateBarcode: (product: Product) => Promise<void>;
  onDelete: (product: Product) => void;
  canEdit: boolean;
  canDelete: boolean;
  canViewPriceHistory: boolean;
  canManagePrice: boolean;
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ProductPriceHistoryResponse | null>(null);
  const [stockSummary, setStockSummary] = useState<ProductStockSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const isGoodsProduct = product?.productType === "goods";

  useEffect(() => {
    if (!open || !productId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [detailResponse, priceHistoryResponse, stockResponse] = await Promise.all([
          productsApi.get(productId),
          canViewPriceHistory ? productsApi.getPriceHistory(productId, 1, 5) : Promise.resolve(null),
          productsApi.getStockSummary(productId).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setProduct(detailResponse.data.product);
        setHistory(priceHistoryResponse?.data ?? null);
        setStockSummary(stockResponse?.data ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load product details"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canViewPriceHistory, open, productId, reloadKey]);

  return (
    <SideSheet open={open} onClose={onClose} title={product?.name ?? "Product Details"} className="max-w-5xl">
      {loading && !product ? (
        <LoadingState label="Loading product details..." />
      ) : error ? (
        <div className="space-y-4">
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !product ? (
        <EmptyState title="Product details are unavailable" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{product.productCode}</Badge>
                <Badge tone="neutral">{PRODUCT_TYPE_LABELS[product.productType]}</Badge>
                <Badge tone={getProductStatusTone(product.status)}>{PRODUCT_STATUS_LABELS[product.status]}</Badge>
                <Badge tone={getTaxTypeTone(product.taxType)}>{TAX_TYPE_LABELS[product.taxType]}</Badge>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">
                  {product.brand || product.category.name || "-"} • {product.unit.symbol || product.unit.name || "-"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button type="button" variant="secondary" onClick={() => onEdit(product)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              ) : null}
              {canViewPriceHistory ? (
                <Button type="button" variant="secondary" onClick={() => onOpenPriceHistory(product)}>
                  <History className="mr-2 size-4" />
                  Price History
                </Button>
              ) : null}
              {isGoodsProduct ? (
                <Button type="button" variant="secondary" onClick={() => onOpenStockSummary(product)}>
                  <Package className="mr-2 size-4" />
                  Stock Summary
                </Button>
              ) : null}
              {canManagePrice ? (
                <Button
                  type="button"
                  variant="secondary"
                  loading={barcodeLoading}
                  onClick={async () => {
                    try {
                      setBarcodeLoading(true);
                      await onGenerateBarcode(product);
                    } finally {
                      setBarcodeLoading(false);
                    }
                  }}
                >
                  <ScanLine className="mr-2 size-4" />
                  Generate Barcode
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Purchase Price", value: formatInr(product.purchasePrice) },
              { label: "Sale Price", value: formatInr(product.salePrice) },
              { label: "Final Sale Price", value: formatInr(product.pricePreview.finalSalePrice) },
              { label: "Margin %", value: formatPercent(product.pricePreview.marginPercentage) },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Product Summary" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "SKU", value: product.sku || "-" },
                  { label: "Barcode", value: product.barcode || "-" },
                  { label: "HSN/SAC", value: product.hsnSacCode || "-" },
                  { label: "Description", value: product.description || "-" },
                  { label: "Category", value: product.category.name || "-" },
                  { label: "Unit", value: product.unit.symbol || product.unit.name || "-" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Tax Details" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Tax Type", value: TAX_TYPE_LABELS[product.taxType] },
                  { label: "GST %", value: `${product.gstRate}%` },
                  { label: "Cess %", value: `${product.cessRate}%` },
                  { label: "Price Tax Type", value: PRICE_TAX_TYPE_LABELS[product.priceTaxType] },
                  { label: "Base Price", value: formatInr(product.pricePreview.baseSalePrice) },
                  { label: "Tax Amount", value: formatInr(Number(product.pricePreview.gstAmount) + Number(product.pricePreview.cessAmount)) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Pricing Details" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Purchase Price", value: formatInr(product.purchasePrice) },
                  { label: "Sale Price", value: formatInr(product.salePrice) },
                  { label: "MRP", value: formatInr(product.mrp) },
                  { label: "Wholesale Price", value: formatInr(product.wholesalePrice) },
                  { label: "Minimum Sale Price", value: formatInr(product.minimumSalePrice) },
                  { label: "Default Discount", value: formatPercent(product.defaultDiscount) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Recent Price History" />
              <CardContent>
                {!history?.items.length ? (
                  <EmptyState title="No price history found" />
                ) : (
                  <TableWrapper className="border-slate-100">
                    <Table>
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {history.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                            <td className="px-4 py-3">{PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS[item.changeType]}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{item.newValue ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>

          </div>

          {isGoodsProduct ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Inventory Settings" action={<Eye className="size-4 text-slate-400" />} />
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Stock Tracking", value: product.stockTrackingEnabled ? "Enabled" : "Disabled" },
                    { label: "Opening Stock", value: product.openingStockQuantity },
                    { label: "Opening Value", value: formatInr(product.openingStockValue) },
                    { label: "Min Stock", value: product.minimumStockLevel },
                    { label: "Reorder Level", value: product.reorderLevel },
                    { label: "Max Stock", value: product.maximumStockLevel },
                    { label: "Batch Tracking", value: product.batchTrackingEnabled ? "Enabled" : "Disabled" },
                    { label: "Expiry Tracking", value: product.expiryTrackingEnabled ? "Enabled" : "Disabled" },
                    { label: "Serial Tracking", value: product.serialTrackingEnabled ? "Enabled" : "Disabled" },
                    { label: "Negative Stock", value: product.negativeStockAllowed ? "Allowed" : "Blocked" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Stock Summary" />
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {stockSummary
                    ? [
                        { label: "Available Qty", value: stockSummary.availableQuantity },
                        { label: "Reserved Qty", value: stockSummary.reservedQuantity },
                        { label: "Incoming Qty", value: stockSummary.incomingQuantity },
                        { label: "Inventory Module", value: stockSummary.inventoryModuleReady ? "Ready" : "Pending" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                        </div>
                      ))
                    : <EmptyState title="Stock summary unavailable" />}
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canDelete ? (
              <Button type="button" variant="danger" onClick={() => onDelete(product)}>
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </SideSheet>
  );
};
