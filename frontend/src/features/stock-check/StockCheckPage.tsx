import { Download, FileSpreadsheet, Plus, ShieldCheck, CheckCircle2, Pencil, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Table, TableWrapper } from "../../components/ui/Table";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { inventoryApi } from "../../services/inventoryApi";
import { productsApi } from "../../services/productsApi";
import { stockCheckApi } from "../../services/stockCheckApi";
import type { InventoryPagination } from "../../types/inventory";
import type { StockCheckBatchRef, StockCheckDetail, StockCheckExportFormat, StockCheckListItem, StockCheckProductRef, StockCheckStatus } from "../../types/stockCheck";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { formatLookupProduct, formatLookupWarehouse, saveDownloadedFile, type LookupOption } from "../inventory/inventoryUtils";
import { InventoryPage } from "../inventory/components/InventoryPage";
import { ApproveStockCheckModal } from "./components/ApproveStockCheckModal";
import { StatusBadge } from "./components/StatusBadge";
import { StockCheckFilters } from "./components/StockCheckFilters";
import { StockCheckForm } from "./components/StockCheckForm";
import { StockCheckItemsGrid, type StockCheckDraftItem } from "./components/StockCheckItemsGrid";
import { StockCheckSummary } from "./components/StockCheckSummary";
import { StockCheckTable } from "./components/StockCheckTable";

const FILTER_LIMIT = 20;
const BATCH_LIMIT = 100;

const today = () => new Date().toISOString().slice(0, 10);

const toQuantity = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : "0.000";
};

const getItemStatus = (differenceQty: string) => {
  const value = Number(differenceQty);
  if (value === 0) {
    return "matched" as const;
  }
  return value < 0 ? "short" as const : "excess" as const;
};

const getDraftRowKey = (productId: string, batchId?: string | null) => `${productId}:${batchId ?? "no-batch"}`;

const buildDraftItem = (
  product: StockCheckProductRef,
  systemQty: string,
  physicalQty = systemQty,
  reason = "",
  batch: StockCheckBatchRef | null = null,
): StockCheckDraftItem => {
  const differenceQty = toQuantity(Number(physicalQty || 0) - Number(systemQty || 0));
  return {
    rowKey: getDraftRowKey(product.id, batch?.id),
    product,
    batch,
    systemQty: toQuantity(systemQty),
    physicalQty: toQuantity(physicalQty),
    differenceQty,
    status: getItemStatus(differenceQty),
    reason,
  };
};

const toWarehouseOption = (warehouse: StockCheckDetail["warehouse"]): LookupOption => ({
  id: warehouse.id,
  label: warehouse.name ?? warehouse.warehouseCode ?? "Warehouse",
  description: warehouse.warehouseCode ?? undefined,
});

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const StockCheckPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission("stock_check.view");
  const canCreate = auth.hasPermission("stock_check.create");
  const canApprove = auth.hasPermission("stock_check.approve") && auth.user?.role === "admin";
  const canExport = auth.hasPermission("stock_check.export");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);
  const [status, setStatus] = useState<StockCheckStatus | "">("");
  const [warehouseFilter, setWarehouseFilter] = useState<LookupOption | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StockCheckListItem[]>([]);
  const [pagination, setPagination] = useState<InventoryPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">(searchParams.get("mode") === "create" ? "create" : "list");
  const [activeDetail, setActiveDetail] = useState<StockCheckDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formWarehouse, setFormWarehouse] = useState<LookupOption | null>(null);
  const [formDate, setFormDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [draftItems, setDraftItems] = useState<StockCheckDraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);

  const [approveTarget, setApproveTarget] = useState<StockCheckDetail | null>(null);
  const [approving, setApproving] = useState(false);

  const loadWarehouseOptions = useCallback(async (lookupSearch: string) => {
    const response = await inventoryApi.listWarehouses({ page: 1, limit: FILTER_LIMIT, search: lookupSearch, status: "active" });
    return response.data.items.map((item) => formatLookupWarehouse(item));
  }, []);

  const loadProductOptions = useCallback(async (lookupSearch: string) => {
    const response = await productsApi.lookup(lookupSearch || undefined, FILTER_LIMIT);
    return response.data
      .filter((item) => item.type === "goods" && item.stockTrackingEnabled)
      .map((item) => formatLookupProduct(item));
  }, []);

  const loadBatchOptions = useCallback(async (productId: string, lookupSearch: string) => {
    if (!formWarehouse) {
      return [];
    }

    const response = await inventoryApi.listBatches({
      page: 1,
      limit: BATCH_LIMIT,
      productId,
      warehouseId: formWarehouse.id,
      status: "active",
    });
    const searchText = lookupSearch.trim().toLowerCase();

    return response.data.items
      .filter((batch) => !searchText || batch.batchNumber.toLowerCase().includes(searchText))
      .map((batch) => ({
        id: batch.id,
        label: batch.batchNumber,
        description: `${toQuantity(batch.availableQuantity)} stock`,
      }));
  }, [formWarehouse]);

  const loadList = useCallback(async () => {
    if (!canView) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await stockCheckApi.list({
        page,
        limit: FILTER_LIMIT,
        search: search || undefined,
        status: status || undefined,
        warehouseId: warehouseFilter?.id,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setItems(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load stock checks"));
    } finally {
      setLoading(false);
    }
  }, [canView, dateFrom, dateTo, page, search, status, warehouseFilter?.id]);

  useEffect(() => {
    if (mode !== "list") {
      return;
    }
    void loadList();
  }, [loadList, mode]);

  const loadDetail = useCallback(async (stockCheckId: string, nextMode: "view" | "edit" = "view") => {
    try {
      setDetailLoading(true);
      const response = await stockCheckApi.get(stockCheckId);
      const detail = response.data.stockCheck;
      setActiveDetail(detail);
      setMode(nextMode);
      setSearchParams(nextMode === "view" ? { id: stockCheckId } : { edit: stockCheckId });

      if (nextMode === "edit") {
        setEditingId(stockCheckId);
        setFormWarehouse(toWarehouseOption(detail.warehouse));
        setFormDate(String(detail.checkDate).slice(0, 10));
        setRemarks(detail.remarks ?? "");
        setDraftItems(
          detail.items.map((item) =>
            buildDraftItem(item.product, item.systemQty, item.physicalQty, item.reason ?? "", item.batch),
          ),
        );
      }
    } catch (detailError) {
      toast.error(getErrorMessage(detailError, "Failed to load stock check"));
    } finally {
      setDetailLoading(false);
    }
  }, [setSearchParams, toast]);

  useEffect(() => {
    const id = searchParams.get("id");
    const edit = searchParams.get("edit");
    if (id && mode === "list") {
      void loadDetail(id, "view");
    } else if (edit && mode === "list") {
      void loadDetail(edit, "edit");
    }
  }, [loadDetail, mode, searchParams]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormWarehouse(null);
    setFormDate(today());
    setRemarks("");
    setDraftItems([]);
  }, []);

  const startCreate = () => {
    resetForm();
    setActiveDetail(null);
    setMode("create");
    setSearchParams({ mode: "create" });
  };

  const backToList = useCallback(() => {
    setMode("list");
    setActiveDetail(null);
    resetForm();
    setSearchParams({});
    void loadList();
  }, [loadList, resetForm, setSearchParams]);

  const refreshSystemStockForProduct = useCallback(
    async (product: StockCheckProductRef, warehouseId: string, batchTracked: boolean, selectedBatchId?: string | null) => {
      const response = await inventoryApi.getProductStock(product.id);
      const warehouseItems = response.data.items.filter((item) => item.warehouse.id === warehouseId);

      if (batchTracked) {
        const batchesResponse = await inventoryApi.listBatches({
          page: 1,
          limit: BATCH_LIMIT,
          productId: product.id,
          warehouseId,
          status: "active",
        });
        const stockByBatchId = new Map(warehouseItems.flatMap((item) => (item.batch?.id ? [[item.batch.id, item]] : [])));

        return batchesResponse.data.items
          .filter((batch) => !selectedBatchId || batch.id === selectedBatchId)
          .map((batch) => {
            const stock = stockByBatchId.get(batch.id);
            const systemQty = stock?.availableQuantity ?? batch.availableQuantity ?? "0.000";
            return buildDraftItem(product, systemQty, systemQty, "", {
              id: batch.id,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate ?? null,
            });
          });
      }

      const systemQty = warehouseItems.reduce((total, item) => total + Number(item.availableQuantity), 0);
      return [buildDraftItem(product, toQuantity(systemQty))];
    },
    [],
  );

  const addProduct = useCallback(async (option: LookupOption, selectedBatch: LookupOption | null) => {
    if (!formWarehouse) {
      toast.error("Select a warehouse first");
      return;
    }

    const response = await productsApi.get(option.id);
    const product = response.data.product;
    const nextItems = await refreshSystemStockForProduct(
      {
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        sku: product.sku,
      },
      formWarehouse.id,
      product.batchTrackingEnabled,
      product.batchTrackingEnabled ? selectedBatch?.id ?? null : null,
    );

    if (!nextItems.length) {
      toast.error(selectedBatch ? "Selected batch was not found" : "No batches found for this product in selected warehouse");
      return;
    }

    setDraftItems((current) => {
      const existingKeys = new Set(current.map((item) => item.rowKey));
      const append = nextItems.filter((item) => !existingKeys.has(item.rowKey));
      if (!append.length) {
        toast.error("Product already added");
        return current;
      }
      return [...current, ...append];
    });
  }, [formWarehouse, refreshSystemStockForProduct, toast]);

  const loadWarehouseStock = useCallback(async () => {
    if (!formWarehouse) {
      toast.error("Select a warehouse first");
      return;
    }

    try {
      setLoadingStock(true);
      const [stockResponse, batchesResponse] = await Promise.all([
        inventoryApi.listStock({
          page: 1,
          limit: BATCH_LIMIT,
          warehouseId: formWarehouse.id,
          status: "active",
        }),
        inventoryApi.listBatches({
          page: 1,
          limit: BATCH_LIMIT,
          warehouseId: formWarehouse.id,
          status: "active",
        }),
      ]);
      const stockByBatchId = new Map(stockResponse.data.items.flatMap((row) => (row.batch?.id ? [[row.batch.id, row]] : [])));
      const batchItems = batchesResponse.data.items.map((batch) => {
        const stock = stockByBatchId.get(batch.id);
        const systemQty = stock?.availableQuantity ?? batch.availableQuantity ?? "0.000";
        return buildDraftItem(
          {
            id: batch.productId,
            name: batch.productName ?? "Product",
            productCode: batch.productCode ?? "-",
            sku: stock?.product.sku ?? null,
          },
          systemQty,
          systemQty,
          "",
          {
            id: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate ?? null,
          },
        );
      });
      const batchKeys = new Set(batchItems.map((item) => item.rowKey));
      const nonBatchItems = stockResponse.data.items
        .filter((row) => !row.batch?.id && !batchKeys.has(getDraftRowKey(row.product.id, null)))
        .map((row) =>
          buildDraftItem(
            {
              id: row.product.id,
              name: row.product.name,
              productCode: row.product.productCode,
              sku: row.product.sku,
            },
            row.availableQuantity,
            row.availableQuantity,
            "",
            row.batch
              ? {
                  id: row.batch.id,
                  batchNumber: row.batch.batchNumber,
                  expiryDate: row.batch.expiryDate ?? null,
                }
              : null,
          ),
        );
      setDraftItems([...batchItems, ...nonBatchItems]);
    } catch (stockError) {
      toast.error(getErrorMessage(stockError, "Failed to load warehouse stock"));
    } finally {
      setLoadingStock(false);
    }
  }, [formWarehouse, toast]);

  const updatePhysicalQty = (rowKey: string, value: string) => {
    setDraftItems((current) =>
      current.map((item) => {
        if (item.rowKey !== rowKey) {
          return item;
        }
        const physicalQty = value;
        const differenceQty = toQuantity(Number(physicalQty || 0) - Number(item.systemQty));
        return {
          ...item,
          physicalQty,
          differenceQty,
          status: getItemStatus(differenceQty),
        };
      }),
    );
  };

  const updateReason = (rowKey: string, value: string) => {
    setDraftItems((current) => current.map((item) => (item.rowKey === rowKey ? { ...item, reason: value } : item)));
  };

  const saveStockCheck = async () => {
    if (!formWarehouse) {
      toast.error("Warehouse is required");
      return;
    }

    if (!draftItems.length) {
      toast.error("At least one item is required");
      return;
    }

    if (draftItems.some((item) => Number(item.physicalQty) < 0 || !Number.isFinite(Number(item.physicalQty)))) {
      toast.error("Physical quantity cannot be negative");
      return;
    }

    const payload = {
      warehouseId: formWarehouse.id,
      checkDate: formDate,
      remarks: remarks || null,
      items: draftItems.map((item) => ({
        productId: item.product.id,
        batchId: item.batch?.id ?? null,
        physicalQty: Number(item.physicalQty || 0),
        reason: item.reason || null,
      })),
    };

    try {
      setSubmitting(true);
      const response = editingId ? await stockCheckApi.update(editingId, payload) : await stockCheckApi.create(payload);
      toast.success(editingId ? "Stock check updated" : "Stock check created");
      setActiveDetail(response.data.stockCheck);
      setMode("view");
      setSearchParams({ id: response.data.stockCheck.id });
      resetForm();
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to save stock check"));
    } finally {
      setSubmitting(false);
    }
  };

  const completeStockCheck = async (stockCheckId: string) => {
    try {
      const response = await stockCheckApi.complete(stockCheckId);
      setActiveDetail(response.data.stockCheck);
      toast.success("Stock check completed");
      await loadList();
    } catch (completeError) {
      toast.error(getErrorMessage(completeError, "Failed to complete stock check"));
    }
  };

  const approveStockCheck = async () => {
    if (!approveTarget) {
      return;
    }

    try {
      setApproving(true);
      const response = await stockCheckApi.approve(approveTarget.id);
      setApproveTarget(null);
      setActiveDetail(response.data.stockCheck);
      toast.success("Stock check approved");
      await loadList();
    } catch (approveError) {
      toast.error(getErrorMessage(approveError, "Failed to approve stock check"));
    } finally {
      setApproving(false);
    }
  };

  const exportStockCheck = async (stockCheckId: string, format: StockCheckExportFormat = "pdf") => {
    try {
      const file = await stockCheckApi.exportById(stockCheckId, format);
      saveDownloadedFile(file.blob, file.fileName);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, "Failed to export stock check"));
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <StockCheckForm
        title={mode === "edit" ? "Edit Stock Check" : "Create Stock Check"}
        warehouse={formWarehouse}
        checkDate={formDate}
        remarks={remarks}
        items={draftItems}
        submitting={submitting}
        loadingStock={loadingStock}
        loadWarehouseOptions={loadWarehouseOptions}
        loadProductOptions={loadProductOptions}
        loadBatchOptions={loadBatchOptions}
        onWarehouseChange={(warehouse) => {
          setFormWarehouse(warehouse);
          setDraftItems([]);
        }}
        onCheckDateChange={setFormDate}
        onRemarksChange={setRemarks}
        onLoadWarehouseStock={() => void loadWarehouseStock()}
        onAddProduct={addProduct}
        onPhysicalQtyChange={updatePhysicalQty}
        onReasonChange={updateReason}
        onRemoveItem={(rowKey) => setDraftItems((current) => current.filter((item) => item.rowKey !== rowKey))}
        onCancel={backToList}
        onSubmit={() => void saveStockCheck()}
      />
    );
  }

  if (mode === "view" && activeDetail) {
    const readonlyItems: StockCheckDraftItem[] = activeDetail.items.map((item) =>
      buildDraftItem(item.product, item.systemQty, item.physicalQty, item.reason ?? "", item.batch),
    );

    return (
      <div className="space-y-4">
        <PageHeader
          title={activeDetail.checkNo}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={backToList}>
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
              {canCreate && activeDetail.status === "draft" ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => void loadDetail(activeDetail.id, "edit")}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                  <Button type="button" onClick={() => void completeStockCheck(activeDetail.id)}>
                    <CheckCircle2 className="mr-2 size-4" />
                    Complete
                  </Button>
                </>
              ) : null}
              {canApprove && activeDetail.status === "completed" ? (
                <Button type="button" onClick={() => setApproveTarget(activeDetail)}>
                  <ShieldCheck className="mr-2 size-4" />
                  Approve
                </Button>
              ) : null}
              {canExport ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => void exportStockCheck(activeDetail.id, "pdf")}>
                    <Download className="mr-2 size-4" />
                    PDF
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void exportStockCheck(activeDetail.id, "xlsx")}>
                    <FileSpreadsheet className="mr-2 size-4" />
                    Excel
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        <Card>
          <CardContent className="grid gap-4 py-5 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(activeDetail.checkDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Warehouse</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{activeDetail.warehouse.name ?? activeDetail.warehouse.warehouseCode}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <div className="mt-1"><StatusBadge status={activeDetail.status} /></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Checked By</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{activeDetail.checkedBy.name ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <StockCheckSummary summary={activeDetail.summary} />

        <Card>
          <StockCheckItemsGrid items={readonlyItems} editable={false} onPhysicalQtyChange={() => undefined} onReasonChange={() => undefined} onRemove={() => undefined} />
        </Card>

        <Card>
          <CardContent className="py-5">
            <h2 className="text-sm font-semibold text-slate-900">Approval History</h2>
            <TableWrapper className="mt-3">
              <Table>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeDetail.approvalHistory.map((entry) => (
                    <tr key={`${entry.status}-${entry.at}`}>
                      <td className="px-4 py-3 capitalize text-slate-900">{entry.status}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.userName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(entry.at).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <ApproveStockCheckModal
          open={Boolean(approveTarget)}
          stockCheck={approveTarget}
          loading={approving}
          onClose={() => setApproveTarget(null)}
          onApprove={() => void approveStockCheck()}
        />
      </div>
    );
  }

  return (
    <>
      <InventoryPage
        title="Stock Check"
        tabs={null}
        actions={
          canCreate ? (
            <Button type="button" onClick={startCreate}>
              <Plus className="mr-2 size-4" />
              Create
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <StockCheckFilters
            search={searchInput}
            status={status}
            warehouse={warehouseFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onSearchChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            onStatusChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            onWarehouseChange={(value) => {
              setWarehouseFilter(value);
              setPage(1);
            }}
            onDateFromChange={(value) => {
              setDateFrom(value);
              setPage(1);
            }}
            onDateToChange={(value) => {
              setDateTo(value);
              setPage(1);
            }}
            loadWarehouseOptions={loadWarehouseOptions}
          />

          <StockCheckTable
            items={items}
            pagination={pagination}
            loading={loading || detailLoading}
            error={error}
            canCreate={canCreate}
            canApprove={canApprove}
            canExport={canExport}
            onView={(item) => void loadDetail(item.id, "view")}
            onEdit={(item) => void loadDetail(item.id, "edit")}
            onApprove={async (item) => {
              const response = await stockCheckApi.get(item.id);
              setApproveTarget(response.data.stockCheck);
            }}
            onExport={(item) => void exportStockCheck(item.id, "pdf")}
            onPageChange={setPage}
          />
        </div>
      </InventoryPage>

      <ApproveStockCheckModal
        open={Boolean(approveTarget)}
        stockCheck={approveTarget}
        loading={approving}
        onClose={() => setApproveTarget(null)}
        onApprove={() => void approveStockCheck()}
      />
    </>
  );
};
