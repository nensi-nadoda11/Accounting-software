import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { getErrorMessage } from "../../../lib/errors";
import { productsApi } from "../../../services/productsApi";
import type { ProductStockSummary } from "../../../types/product";
import { formatInr } from "../productUtils";

export const ProductStockSummaryDrawer = ({
  open,
  productId,
  productName,
  onClose,
}: {
  open: boolean;
  productId: string | null;
  productName: string;
  onClose: () => void;
}) => {
  const [data, setData] = useState<ProductStockSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await productsApi.getStockSummary(productId);

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load stock summary"));
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
  }, [open, productId]);

  return (
    <SideSheet open={open} onClose={onClose} title={productName ? `${productName} Stock Summary` : "Stock Summary"}>
      {loading && !data ? (
        <LoadingState label="Loading stock summary..." />
      ) : error ? (
        <div className="space-y-4">
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !data ? (
        <EmptyState title="Stock summary is unavailable" />
      ) : (
        <Card>
          <CardHeader title="Inventory Settings" />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Opening Stock", value: data.openingStockQuantity },
              { label: "Opening Value", value: formatInr(data.openingStockValue) },
              { label: "Available Qty", value: data.availableQuantity },
              { label: "Reserved Qty", value: data.reservedQuantity },
              { label: "Incoming Qty", value: data.incomingQuantity },
              { label: "Min Stock", value: data.minimumStockLevel },
              { label: "Reorder Level", value: data.reorderLevel },
              { label: "Max Stock", value: data.maximumStockLevel },
              { label: "Batch Tracking", value: data.batchTrackingEnabled ? "Enabled" : "Disabled" },
              { label: "Expiry Tracking", value: data.expiryTrackingEnabled ? "Enabled" : "Disabled" },
              { label: "Serial Tracking", value: data.serialTrackingEnabled ? "Enabled" : "Disabled" },
              { label: "Negative Stock", value: data.negativeStockAllowed ? "Allowed" : "Blocked" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </SideSheet>
  );
};
