import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { QuantityText } from "../../components/ui/QuantityText";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIconButton } from "../../components/ui/TableActionIconButton";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { categoriesApi, productsApi, unitsApi } from "../../services/productsApi";
import { inventoryApi } from "../../services/inventoryApi";
import type {
  InventoryAlert,
  InventoryPagination,
  InventoryQuery,
  ProductBatch,
  StockAdjustment,
  StockBalance,
  Warehouse,
  WarehouseMutableStatus,
} from "../../types/inventory";
import type { ProductCategory, ProductUnit } from "../../types/product";
import { InventoryPage } from "./components/InventoryPage";
import { InventoryTabs } from "./components/InventoryTabs";
import { InventoryFilters } from "./components/InventoryFilters";
import { StockSummaryCards } from "./components/StockSummaryCards";
import { CurrentStockTable } from "./components/CurrentStockTable";
import { WarehouseFormModal } from "./components/WarehouseFormModal";
import { BatchFormDrawer } from "./components/BatchFormDrawer";
import { OpeningStockDrawer } from "./components/OpeningStockDrawer";
import { AdjustmentFormDrawer } from "./components/AdjustmentFormDrawer";
import { MovementsTable } from "./components/MovementsTable";
import { AlertsTable } from "./components/AlertsTable";
import { ValuationTable } from "./components/ValuationTable";
import { StockDetailDrawer } from "./components/StockDetailDrawer";
import { InventoryLookupField } from "./components/InventoryLookupField";
import {
  ALERT_READ_FILTER_OPTIONS,
  applyInventoryFieldErrors,
  BATCH_STATUS_OPTIONS,
  buildProductSettings,
  formatDate,
  formatDateTime,
  formatInr,
  formatLookupProduct,
  formatLookupWarehouse,
  getBatchStatusTone,
  INVENTORY_ALERT_SEVERITY_LABELS,
  INVENTORY_ALERT_TYPE_LABELS,
  INVENTORY_TAB_LABELS,
  saveDownloadedFile,
  STOCK_ADJUSTMENT_TYPE_LABELS,
  STOCK_MOVEMENT_TYPE_LABELS,
  type InventoryProductSettings,
  type InventoryTabId,
  type LookupOption,
  WAREHOUSE_STATUS_OPTIONS,
  YES_NO_FILTER_OPTIONS,
} from "./inventoryUtils";
import { useDebouncedValue } from "../customers/useDebouncedValue";

const isInventoryTab = (value: string | null): value is InventoryTabId =>
  value === "current-stock" ||
  value === "warehouses" ||
  value === "batches" ||
  value === "adjustments" ||
  value === "movements" ||
  value === "alerts" ||
  value === "valuation";

const FILTER_LIMIT = 20;

export const InventoryStockPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const productSettingsCacheRef = useRef<Record<string, InventoryProductSettings>>({});

  const canViewInventory = auth.hasPermission("inventory.view");
  const canManageInventory = auth.hasPermission("inventory.manage");
  const canAdjustInventory = auth.hasPermission("inventory.adjust");
  const canExportInventory = auth.hasPermission("inventory.export");
  const canViewValuation = auth.hasPermission("inventory.valuation.view");
  const canManageWarehouses = auth.hasPermission("warehouse.manage");
  const canViewWarehouses = auth.hasPermission(["inventory.view", "warehouse.manage"]);
  const canViewBatches = auth.hasPermission("batch.view");
  const canManageBatches = auth.hasPermission("batch.manage");

  const availableTabs = useMemo(
    () =>
      [
        { id: "current-stock" as const, label: INVENTORY_TAB_LABELS["current-stock"], visible: canViewInventory },
        { id: "warehouses" as const, label: INVENTORY_TAB_LABELS.warehouses, visible: canViewWarehouses },
        { id: "batches" as const, label: INVENTORY_TAB_LABELS.batches, visible: canViewBatches },
        { id: "adjustments" as const, label: INVENTORY_TAB_LABELS.adjustments, visible: canViewInventory },
        { id: "movements" as const, label: INVENTORY_TAB_LABELS.movements, visible: canViewInventory },
        { id: "alerts" as const, label: INVENTORY_TAB_LABELS.alerts, visible: canViewInventory },
        { id: "valuation" as const, label: INVENTORY_TAB_LABELS.valuation, visible: canViewValuation },
      ].filter((tab) => tab.visible),
    [canViewBatches, canViewInventory, canViewValuation, canViewWarehouses],
  );

  const activeTabParam = searchParams.get("tab");
  const activeTab =
    (isInventoryTab(activeTabParam) && availableTabs.some((item) => item.id === activeTabParam) ? activeTabParam : availableTabs[0]?.id) ??
    "current-stock";

  useEffect(() => {
    if (!availableTabs.length) {
      return;
    }

    if (searchParams.get("tab") === activeTab) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, availableTabs.length, searchParams, setSearchParams]);

  const setActiveTab = useCallback(
    (tab: InventoryTabId) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [categoriesResponse, unitsResponse] = await Promise.all([
          categoriesApi.list({ page: 1, limit: 100, status: "active" }),
          unitsApi.list({ page: 1, limit: 100, status: "active" }),
        ]);

        if (!cancelled) {
          setCategories(categoriesResponse.data.items);
          setUnits(unitsResponse.data.items);
        }
      } catch {
        // keep module usable even if reference lookups fail
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const unitMap = useMemo(() => new Map(units.map((item) => [item.id, item])), [units]);

  const loadProductOptions = useCallback(async (search: string) => {
    const response = await productsApi.lookup(search || undefined, FILTER_LIMIT);
    return response.data
      .filter((item) => item.type === "goods")
      .map((item) => formatLookupProduct(item));
  }, []);

  const loadWarehouseOptions = useCallback(async (search: string) => {
    const response = await inventoryApi.listWarehouses({ page: 1, limit: FILTER_LIMIT, search, status: "active" });
    return response.data.items.map((item) => formatLookupWarehouse(item));
  }, []);

  const resolveProductSettings = useCallback(
    async (productId: string) => {
      const cached = productSettingsCacheRef.current[productId];
      if (cached) {
        return cached;
      }

      const response = await productsApi.get(productId);
      const next = buildProductSettings(response.data.product, unitMap);
      productSettingsCacheRef.current[productId] = next;
      return next;
    },
    [unitMap],
  );

  const loadBatchOptions = useCallback(async (productId: string, warehouseId: string) => {
    const response = await inventoryApi.listBatches({ page: 1, limit: 100, productId, warehouseId });
    return response.data.items;
  }, []);

  const [stockSearchInput, setStockSearchInput] = useState("");
  const stockSearch = useDebouncedValue(stockSearchInput, 350);
  const [stockPage, setStockPage] = useState(1);
  const [stockWarehouseOption, setStockWarehouseOption] = useState<LookupOption | null>(null);
  const [stockProductOption, setStockProductOption] = useState<LookupOption | null>(null);
  const [stockCategoryId, setStockCategoryId] = useState("");
  const [stockLowStock, setStockLowStock] = useState<string>("");
  const [stockOutOfStock, setStockOutOfStock] = useState<string>("");
  const [stockExpired, setStockExpired] = useState<string>("");
  const [stockExpiringSoon, setStockExpiringSoon] = useState<string>("");
  const [stockRows, setStockRows] = useState<StockBalance[]>([]);
  const [stockPagination, setStockPagination] = useState<InventoryPagination | null>(null);
  const [stockSummary, setStockSummary] = useState<Awaited<ReturnType<typeof inventoryApi.getStockSummary>>["data"] | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSummaryLoading, setStockSummaryLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const loadCurrentStock = useCallback(async () => {
    if (!canViewInventory) {
      return;
    }

    try {
      setStockLoading(true);
      setStockError(null);
      const response = await inventoryApi.listStock({
        page: stockPage,
        limit: FILTER_LIMIT,
        search: stockSearch || undefined,
        warehouseId: stockWarehouseOption?.id,
        categoryId: stockCategoryId || undefined,
        productId: stockProductOption?.id,
        lowStock: stockLowStock === "" ? undefined : stockLowStock === "true",
        outOfStock: stockOutOfStock === "" ? undefined : stockOutOfStock === "true",
        expired: stockExpired === "" ? undefined : stockExpired === "true",
        expiringSoon: stockExpiringSoon === "" ? undefined : stockExpiringSoon === "true",
      });
      setStockRows(response.data.items);
      setStockPagination(response.data.pagination);
    } catch (loadError) {
      setStockError(getErrorMessage(loadError, "Failed to load stock"));
    } finally {
      setStockLoading(false);
    }
  }, [
    canViewInventory,
    stockCategoryId,
    stockExpired,
    stockExpiringSoon,
    stockLowStock,
    stockOutOfStock,
    stockPage,
    stockProductOption?.id,
    stockSearch,
    stockWarehouseOption?.id,
  ]);

  const loadStockSummary = useCallback(async () => {
    if (!canViewInventory) {
      return;
    }

    try {
      setStockSummaryLoading(true);
      const response = await inventoryApi.getStockSummary({
        warehouseId: stockWarehouseOption?.id,
        categoryId: stockCategoryId || undefined,
        productId: stockProductOption?.id,
      });
      setStockSummary(response.data);
    } catch {
      setStockSummary(null);
    } finally {
      setStockSummaryLoading(false);
    }
  }, [canViewInventory, stockCategoryId, stockProductOption?.id, stockWarehouseOption?.id]);

  useEffect(() => {
    if (activeTab !== "current-stock") {
      return;
    }

    void loadCurrentStock();
    void loadStockSummary();
  }, [activeTab, loadCurrentStock, loadStockSummary]);

  const [warehouseSearchInput, setWarehouseSearchInput] = useState("");
  const warehouseSearch = useDebouncedValue(warehouseSearchInput, 300);
  const [warehousePage, setWarehousePage] = useState(1);
  const [warehouseStatus, setWarehouseStatus] = useState<WarehouseMutableStatus | "">("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousePagination, setWarehousePagination] = useState<InventoryPagination | null>(null);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehousesError, setWarehousesError] = useState<string | null>(null);

  const loadWarehouses = useCallback(async () => {
    if (!canViewWarehouses) {
      return;
    }

    try {
      setWarehousesLoading(true);
      setWarehousesError(null);
      const response = await inventoryApi.listWarehouses({
        page: warehousePage,
        limit: FILTER_LIMIT,
        search: warehouseSearch || undefined,
        status: warehouseStatus || undefined,
      });
      setWarehouses(response.data.items);
      setWarehousePagination(response.data.pagination);
    } catch (loadError) {
      setWarehousesError(getErrorMessage(loadError, "Failed to load warehouses"));
    } finally {
      setWarehousesLoading(false);
    }
  }, [canViewWarehouses, warehousePage, warehouseSearch, warehouseStatus]);

  useEffect(() => {
    if (activeTab !== "warehouses") {
      return;
    }

    void loadWarehouses();
  }, [activeTab, loadWarehouses]);

  const [batchPage, setBatchPage] = useState(1);
  const [batchProductOption, setBatchProductOption] = useState<LookupOption | null>(null);
  const [batchWarehouseOption, setBatchWarehouseOption] = useState<LookupOption | null>(null);
  const [batchExpired, setBatchExpired] = useState<string>("");
  const [batchExpiringSoon, setBatchExpiringSoon] = useState<string>("");
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [batchPagination, setBatchPagination] = useState<InventoryPagination | null>(null);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    if (!canViewBatches) {
      return;
    }

    try {
      setBatchesLoading(true);
      setBatchesError(null);
      const response = await inventoryApi.listBatches({
        page: batchPage,
        limit: FILTER_LIMIT,
        productId: batchProductOption?.id,
        warehouseId: batchWarehouseOption?.id,
        expired: batchExpired === "" ? undefined : batchExpired === "true",
        expiringSoon: batchExpiringSoon === "" ? undefined : batchExpiringSoon === "true",
        status: batchStatus || undefined,
      });
      setBatches(response.data.items);
      setBatchPagination(response.data.pagination);
    } catch (loadError) {
      setBatchesError(getErrorMessage(loadError, "Failed to load batches"));
    } finally {
      setBatchesLoading(false);
    }
  }, [batchExpired, batchExpiringSoon, batchPage, batchProductOption?.id, batchStatus, batchWarehouseOption?.id, canViewBatches]);

  useEffect(() => {
    if (activeTab !== "batches") {
      return;
    }

    void loadBatches();
  }, [activeTab, loadBatches]);

  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const [adjustmentProductOption, setAdjustmentProductOption] = useState<LookupOption | null>(null);
  const [adjustmentWarehouseOption, setAdjustmentWarehouseOption] = useState<LookupOption | null>(null);
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState<string>("");
  const [adjustmentDateFrom, setAdjustmentDateFrom] = useState("");
  const [adjustmentDateTo, setAdjustmentDateTo] = useState("");
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [adjustmentPagination, setAdjustmentPagination] = useState<InventoryPagination | null>(null);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [adjustmentsError, setAdjustmentsError] = useState<string | null>(null);

  const loadAdjustments = useCallback(async () => {
    if (!canViewInventory) {
      return;
    }

    try {
      setAdjustmentsLoading(true);
      setAdjustmentsError(null);
      const response = await inventoryApi.listAdjustments({
        page: adjustmentPage,
        limit: FILTER_LIMIT,
        productId: adjustmentProductOption?.id,
        warehouseId: adjustmentWarehouseOption?.id,
        adjustmentType: adjustmentTypeFilter as InventoryQuery["adjustmentType"],
        dateFrom: adjustmentDateFrom || undefined,
        dateTo: adjustmentDateTo || undefined,
      });
      setAdjustments(response.data.items);
      setAdjustmentPagination(response.data.pagination);
    } catch (loadError) {
      setAdjustmentsError(getErrorMessage(loadError, "Failed to load adjustments"));
    } finally {
      setAdjustmentsLoading(false);
    }
  }, [
    adjustmentDateFrom,
    adjustmentDateTo,
    adjustmentPage,
    adjustmentProductOption?.id,
    adjustmentTypeFilter,
    adjustmentWarehouseOption?.id,
    canViewInventory,
  ]);

  useEffect(() => {
    if (activeTab !== "adjustments") {
      return;
    }

    void loadAdjustments();
  }, [activeTab, loadAdjustments]);

  const [movementPage, setMovementPage] = useState(1);
  const [movementProductOption, setMovementProductOption] = useState<LookupOption | null>(null);
  const [movementWarehouseOption, setMovementWarehouseOption] = useState<LookupOption | null>(null);
  const [movementBatchId, setMovementBatchId] = useState("");
  const [movementBatchOptions, setMovementBatchOptions] = useState<ProductBatch[]>([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [movementReferenceType, setMovementReferenceType] = useState("");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof inventoryApi.listMovements>>["data"]["items"]>([]);
  const [movementPagination, setMovementPagination] = useState<InventoryPagination | null>(null);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  useEffect(() => {
    if (!movementProductOption?.id || !movementWarehouseOption?.id) {
      setMovementBatchOptions([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const items = await loadBatchOptions(movementProductOption.id, movementWarehouseOption.id);
        if (!cancelled) {
          setMovementBatchOptions(items);
        }
      } catch {
        if (!cancelled) {
          setMovementBatchOptions([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [loadBatchOptions, movementProductOption?.id, movementWarehouseOption?.id]);

  const loadMovements = useCallback(async () => {
    if (!canViewInventory) {
      return;
    }

    try {
      setMovementsLoading(true);
      setMovementsError(null);
      const response = await inventoryApi.listMovements({
        page: movementPage,
        limit: FILTER_LIMIT,
        productId: movementProductOption?.id,
        warehouseId: movementWarehouseOption?.id,
        batchId: movementBatchId || undefined,
        movementType: movementTypeFilter as InventoryQuery["movementType"],
        referenceType: movementReferenceType || undefined,
        dateFrom: movementDateFrom || undefined,
        dateTo: movementDateTo || undefined,
      });
      setMovements(response.data.items);
      setMovementPagination(response.data.pagination);
    } catch (loadError) {
      setMovementsError(getErrorMessage(loadError, "Failed to load movements"));
    } finally {
      setMovementsLoading(false);
    }
  }, [
    canViewInventory,
    movementBatchId,
    movementDateFrom,
    movementDateTo,
    movementPage,
    movementProductOption?.id,
    movementReferenceType,
    movementTypeFilter,
    movementWarehouseOption?.id,
  ]);

  useEffect(() => {
    if (activeTab !== "movements") {
      return;
    }

    void loadMovements();
  }, [activeTab, loadMovements]);

  const [alertPage, setAlertPage] = useState(1);
  const [alertTypeFilter, setAlertTypeFilter] = useState("");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("");
  const [alertReadFilter, setAlertReadFilter] = useState("");
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [alertPagination, setAlertPagination] = useState<InventoryPagination | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [markingAlertId, setMarkingAlertId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!canViewInventory) {
      return;
    }

    try {
      setAlertsLoading(true);
      setAlertsError(null);
      const response = await inventoryApi.listAlerts({
        page: alertPage,
        limit: FILTER_LIMIT,
        type: alertTypeFilter as InventoryQuery["type"],
        severity: alertSeverityFilter as InventoryQuery["severity"],
        read: alertReadFilter === "" ? undefined : alertReadFilter === "true",
      });
      setAlerts(response.data.items);
      setAlertPagination(response.data.pagination);
    } catch (loadError) {
      setAlertsError(getErrorMessage(loadError, "Failed to load alerts"));
    } finally {
      setAlertsLoading(false);
    }
  }, [alertPage, alertReadFilter, alertSeverityFilter, alertTypeFilter, canViewInventory]);

  useEffect(() => {
    if (activeTab !== "alerts") {
      return;
    }

    void loadAlerts();
  }, [activeTab, loadAlerts]);

  const [valuationWarehouseOption, setValuationWarehouseOption] = useState<LookupOption | null>(null);
  const [valuationProductOption, setValuationProductOption] = useState<LookupOption | null>(null);
  const [valuationCategoryId, setValuationCategoryId] = useState("");
  const [valuationData, setValuationData] = useState<Awaited<ReturnType<typeof inventoryApi.getValuation>>["data"] | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);

  const loadValuation = useCallback(async () => {
    if (!canViewValuation) {
      return;
    }

    try {
      setValuationLoading(true);
      setValuationError(null);
      const response = await inventoryApi.getValuation({
        warehouseId: valuationWarehouseOption?.id,
        categoryId: valuationCategoryId || undefined,
        productId: valuationProductOption?.id,
      });
      setValuationData(response.data);
    } catch (loadError) {
      setValuationError(getErrorMessage(loadError, "Failed to load valuation"));
    } finally {
      setValuationLoading(false);
    }
  }, [canViewValuation, valuationCategoryId, valuationProductOption?.id, valuationWarehouseOption?.id]);

  useEffect(() => {
    if (activeTab !== "valuation") {
      return;
    }

    void loadValuation();
  }, [activeTab, loadValuation]);

  const refreshCurrentStockArea = useCallback(async () => {
    if (activeTab === "current-stock" || stockRows.length || stockSummary) {
      await Promise.all([loadCurrentStock(), loadStockSummary()]);
    }
  }, [activeTab, loadCurrentStock, loadStockSummary, stockRows.length, stockSummary]);

  const refreshBatchesArea = useCallback(async () => {
    if (activeTab === "batches" || batches.length) {
      await loadBatches();
    }
  }, [activeTab, batches.length, loadBatches]);

  const refreshAdjustmentsArea = useCallback(async () => {
    if (activeTab === "adjustments" || adjustments.length) {
      await loadAdjustments();
    }
  }, [activeTab, adjustments.length, loadAdjustments]);

  const refreshMovementsArea = useCallback(async () => {
    if (activeTab === "movements" || movements.length) {
      await loadMovements();
    }
  }, [activeTab, loadMovements, movements.length]);

  const refreshAlertsArea = useCallback(async () => {
    if (activeTab === "alerts" || alerts.length) {
      await loadAlerts();
    }
  }, [activeTab, alerts.length, loadAlerts]);

  const refreshValuationArea = useCallback(async () => {
    if (activeTab === "valuation" || valuationData) {
      await loadValuation();
    }
  }, [activeTab, loadValuation, valuationData]);

  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseSubmitLoading, setWarehouseSubmitLoading] = useState(false);
  const [deleteWarehouseTarget, setDeleteWarehouseTarget] = useState<Warehouse | null>(null);
  const [deleteWarehouseLoading, setDeleteWarehouseLoading] = useState(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string | null>(null);

  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [batchSubmitLoading, setBatchSubmitLoading] = useState(false);

  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [openingStockSeed, setOpeningStockSeed] = useState<ComponentProps<typeof OpeningStockDrawer>["initialValues"]>(null);
  const [openingSubmitLoading, setOpeningSubmitLoading] = useState(false);

  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentSeed, setAdjustmentSeed] = useState<ComponentProps<typeof AdjustmentFormDrawer>["initialValues"]>(null);
  const [adjustmentSubmitLoading, setAdjustmentSubmitLoading] = useState(false);

  const [stockDetailTarget, setStockDetailTarget] = useState<{ id: string; name: string } | null>(null);

  const activeHeaderActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canManageInventory ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpeningStockSeed(null);
            setOpeningStockOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Opening Stock
        </Button>
      ) : null}

      {activeTab === "warehouses" && canManageWarehouses ? (
        <Button
          type="button"
          onClick={() => {
            setEditingWarehouse(null);
            setWarehouseFormOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Warehouse
        </Button>
      ) : null}

      {activeTab === "batches" && canManageBatches ? (
        <Button
          type="button"
          onClick={() => {
            setEditingBatch(null);
            setBatchDrawerOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Batch
        </Button>
      ) : null}

      {activeTab === "adjustments" && canAdjustInventory ? (
        <Button
          type="button"
          onClick={() => {
            setAdjustmentSeed(null);
            setAdjustmentOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Adjustment
        </Button>
      ) : null}

      {activeTab === "alerts" && canManageInventory ? (
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              await inventoryApi.recalculateAlerts();
              toast.success("Alerts recalculated");
              await Promise.all([refreshAlertsArea(), refreshCurrentStockArea()]);
            } catch (error) {
              toast.error(getErrorMessage(error, "Failed to recalculate alerts"));
            }
          }}
        >
          <RefreshCw className="mr-2 size-4" />
          Recalculate
        </Button>
      ) : null}

      {(activeTab === "current-stock" || activeTab === "movements" || activeTab === "valuation") && canExportInventory ? (
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              const download =
                activeTab === "current-stock"
                  ? await inventoryApi.exportStock({
                      page: stockPage,
                      limit: FILTER_LIMIT,
                      search: stockSearchInput || undefined,
                      warehouseId: stockWarehouseOption?.id,
                      categoryId: stockCategoryId || undefined,
                      productId: stockProductOption?.id,
                      lowStock: stockLowStock === "" ? undefined : stockLowStock === "true",
                      outOfStock: stockOutOfStock === "" ? undefined : stockOutOfStock === "true",
                      expired: stockExpired === "" ? undefined : stockExpired === "true",
                      expiringSoon: stockExpiringSoon === "" ? undefined : stockExpiringSoon === "true",
                      format: "pdf",
                    })
                  : activeTab === "movements"
                    ? await inventoryApi.exportMovements({
                        page: movementPage,
                        limit: FILTER_LIMIT,
                        productId: movementProductOption?.id,
                        warehouseId: movementWarehouseOption?.id,
                        batchId: movementBatchId || undefined,
                        movementType: movementTypeFilter as InventoryQuery["movementType"],
                        referenceType: movementReferenceType || undefined,
                        dateFrom: movementDateFrom || undefined,
                        dateTo: movementDateTo || undefined,
                        format: "pdf",
                      })
                    : await inventoryApi.exportValuation({
                        warehouseId: valuationWarehouseOption?.id,
                        categoryId: valuationCategoryId || undefined,
                        productId: valuationProductOption?.id,
                        format: "pdf",
                      });

              saveDownloadedFile(download.blob, download.fileName);
            } catch (error) {
              toast.error(getErrorMessage(error, "Export failed"));
            }
          }}
        >
          <Download className="mr-2 size-4" />
          Export
        </Button>
      ) : null}
    </div>
  );

  if (!availableTabs.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-slate-600">You do not have permission to access inventory stock management.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <InventoryPage
        title="Inventory & Stock Management"
        actions={activeHeaderActions}
        tabs={<InventoryTabs tabs={availableTabs.map(({ id, label }) => ({ id, label }))} activeTab={activeTab} onChange={setActiveTab} />}
      >
        {activeTab === "current-stock" ? (
          <div className="space-y-4">
            <StockSummaryCards summary={stockSummary} loading={stockSummaryLoading} />
            <InventoryFilters className="md:grid-cols-2 xl:grid-cols-8">
              <Input
                label="Search"
                value={stockSearchInput}
                onChange={(event) => {
                  setStockSearchInput(event.target.value);
                  setStockPage(1);
                }}
              />
              <InventoryLookupField
                label="Warehouse"
                value={stockWarehouseOption}
                onChange={(option) => {
                  setStockWarehouseOption(option);
                  setStockPage(1);
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="All warehouses"
              />
              <Select
                label="Category"
                value={stockCategoryId}
                onChange={(event) => {
                  setStockCategoryId(event.target.value);
                  setStockPage(1);
                }}
              >
                <option value="">All Categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <InventoryLookupField
                label="Product"
                value={stockProductOption}
                onChange={(option) => {
                  setStockProductOption(option);
                  setStockPage(1);
                }}
                loadOptions={loadProductOptions}
                placeholder="All products"
              />
              <Select label="Low Stock" value={stockLowStock} onChange={(event) => setStockLowStock(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Out of Stock" value={stockOutOfStock} onChange={(event) => setStockOutOfStock(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Expired" value={stockExpired} onChange={(event) => setStockExpired(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Expiring Soon" value={stockExpiringSoon} onChange={(event) => setStockExpiringSoon(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </InventoryFilters>

            <CurrentStockTable
              items={stockRows}
              pagination={stockPagination}
              loading={stockLoading}
              error={stockError}
              onRetry={() => void loadCurrentStock()}
              onPageChange={setStockPage}
              canAdjust={canAdjustInventory}
              onViewDetail={(row) => setStockDetailTarget({ id: row.product.id, name: row.product.name })}
              onAddAdjustment={(row) => {
                setAdjustmentSeed({
                  productId: row.product.id,
                  productLabel: `${row.product.productCode} - ${row.product.name}`,
                  warehouseId: row.warehouse.id,
                  warehouseLabel: `${row.warehouse.warehouseCode ?? ""} - ${row.warehouse.name ?? ""}`.trim(),
                  batchId: row.batch?.id,
                  batchNumber: row.batch?.batchNumber ?? null,
                  manufacturingDate: row.batch?.manufacturingDate ?? null,
                  expiryDate: row.batch?.expiryDate ?? null,
                  rate: row.averageCost,
                });
                setAdjustmentOpen(true);
              }}
              onViewMovements={(row) => {
                setMovementProductOption({ id: row.product.id, label: `${row.product.productCode} - ${row.product.name}` });
                setMovementWarehouseOption({
                  id: row.warehouse.id,
                  label: `${row.warehouse.warehouseCode ?? ""} - ${row.warehouse.name ?? ""}`.trim(),
                });
                setMovementBatchId(row.batch?.id ?? "");
                setMovementPage(1);
                setActiveTab("movements");
              }}
            />
          </div>
        ) : null}

        {activeTab === "warehouses" ? (
          <div className="space-y-4">
            <InventoryFilters>
              <Input
                label="Search"
                value={warehouseSearchInput}
                onChange={(event) => {
                  setWarehouseSearchInput(event.target.value);
                  setWarehousePage(1);
                }}
              />
              <Select
                label="Status"
                value={warehouseStatus}
                onChange={(event) => {
                  setWarehouseStatus(event.target.value as WarehouseMutableStatus | "");
                  setWarehousePage(1);
                }}
              >
                {WAREHOUSE_STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </InventoryFilters>

            {warehousesLoading && !warehouses.length ? (
              <Card className="p-5">
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-10 rounded bg-slate-100" />
                  ))}
                </div>
              </Card>
            ) : warehousesError && !warehouses.length ? (
              <Card>
                <CardContent className="py-6 text-sm text-rose-700">{warehousesError}</CardContent>
              </Card>
            ) : !warehouses.length ? (
              <EmptyState title="No warehouses found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Code", "Name", "City", "Contact", "Default", "Status", "Actions"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {warehouses.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.warehouseCode}</td>
                          <td className="px-4 py-4">{item.name}</td>
                          <td className="px-4 py-4">{item.city ?? "-"}</td>
                          <td className="px-4 py-4">{item.contactPerson ?? item.mobile ?? "-"}</td>
                          <td className="px-4 py-4">{item.isDefault ? <Badge tone="success">Default</Badge> : "-"}</td>
                          <td className="px-4 py-4"><StatusBadge status={item.status} label={item.status} /></td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {canManageWarehouses ? (
                                <>
                                  <TableActionIconButton
                                    label="Set default"
                                    icon={<Star className="size-4" />}
                                    onClick={async () => {
                                      try {
                                        setDefaultWarehouseId(item.id);
                                        await inventoryApi.setDefaultWarehouse(item.id);
                                        toast.success("Default warehouse updated");
                                        await loadWarehouses();
                                      } catch (error) {
                                        toast.error(getErrorMessage(error, "Failed to set default warehouse"));
                                      } finally {
                                        setDefaultWarehouseId(null);
                                      }
                                    }}
                                    disabled={item.isDefault || defaultWarehouseId === item.id}
                                  />
                                  <TableActionIconButton
                                    label="Edit warehouse"
                                    icon={<Pencil className="size-4" />}
                                    onClick={() => {
                                      setEditingWarehouse(item);
                                      setWarehouseFormOpen(true);
                                    }}
                                  />
                                  <TableActionIconButton
                                    label="Delete warehouse"
                                    tone="danger"
                                    icon={<Trash2 className="size-4" />}
                                    onClick={() => setDeleteWarehouseTarget(item)}
                                  />
                                </>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                {warehousePagination ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                    <p className="text-sm text-slate-500">
                      Showing {warehouses.length} of {warehousePagination.total} warehouses
                    </p>
                    <Pagination page={warehousePagination.page} totalPages={warehousePagination.totalPages} onChange={setWarehousePage} />
                  </div>
                ) : null}
              </Card>
            )}
          </div>
        ) : null}

        {activeTab === "batches" ? (
          <div className="space-y-4">
            <InventoryFilters className="md:grid-cols-2 xl:grid-cols-5">
              <InventoryLookupField
                label="Product"
                value={batchProductOption}
                onChange={(option) => {
                  setBatchProductOption(option);
                  setBatchPage(1);
                }}
                loadOptions={loadProductOptions}
                placeholder="All products"
              />
              <InventoryLookupField
                label="Warehouse"
                value={batchWarehouseOption}
                onChange={(option) => {
                  setBatchWarehouseOption(option);
                  setBatchPage(1);
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="All warehouses"
              />
              <Select label="Expired" value={batchExpired} onChange={(event) => setBatchExpired(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Expiring Soon" value={batchExpiringSoon} onChange={(event) => setBatchExpiringSoon(event.target.value)}>
                {YES_NO_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Status" value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)}>
                {BATCH_STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </InventoryFilters>

            {batchesLoading && !batches.length ? (
              <Card className="p-5">
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-10 rounded bg-slate-100" />
                  ))}
                </div>
              </Card>
            ) : batchesError && !batches.length ? (
              <Card>
                <CardContent className="py-6 text-sm text-rose-700">{batchesError}</CardContent>
              </Card>
            ) : !batches.length ? (
              <EmptyState title="No batches found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Product", "Batch No", "Warehouse", "MFG Date", "Expiry Date", "Qty", "Purchase Rate", "Status", "Actions"].map(
                          (head) => (
                            <th key={head} className="px-4 py-3 font-semibold">
                              {head}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {batches.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4">
                            <div className="min-w-[170px]">
                              <p className="font-medium text-slate-900">{item.productName ?? "-"}</p>
                              <p className="text-xs text-slate-500">{item.productCode ?? "-"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">{item.batchNumber}</td>
                          <td className="px-4 py-4">{item.warehouseName ?? item.warehouseCode ?? "-"}</td>
                          <td className="px-4 py-4">{formatDate(item.manufacturingDate)}</td>
                          <td className="px-4 py-4">{formatDate(item.expiryDate)}</td>
                          <td className="px-4 py-4"><QuantityText value={item.availableQuantity} tone="default" /></td>
                          <td className="px-4 py-4">{formatInr(item.purchaseRate)}</td>
                          <td className="px-4 py-4">
                            <Badge tone={getBatchStatusTone(item.status)}>{item.status}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {canManageBatches ? (
                                <TableActionIconButton
                                  label="Edit batch"
                                  icon={<Pencil className="size-4" />}
                                  onClick={() => {
                                    setEditingBatch(item);
                                    setBatchDrawerOpen(true);
                                  }}
                                />
                              ) : null}
                              {canManageInventory ? (
                                <TableActionIconButton
                                  label="Opening stock"
                                  icon={<Plus className="size-4" />}
                                  onClick={() => {
                                    setOpeningStockSeed({
                                      productId: item.productId,
                                      productLabel: `${item.productCode ?? ""} - ${item.productName ?? ""}`.trim(),
                                      warehouseId: item.warehouseId,
                                      warehouseLabel: `${item.warehouseCode ?? ""} - ${item.warehouseName ?? ""}`.trim(),
                                      batchId: item.id,
                                      batchNumber: item.batchNumber,
                                      manufacturingDate: item.manufacturingDate,
                                      expiryDate: item.expiryDate,
                                      rate: item.purchaseRate,
                                    });
                                    setOpeningStockOpen(true);
                                  }}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                {batchPagination ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                    <p className="text-sm text-slate-500">
                      Showing {batches.length} of {batchPagination.total} batches
                    </p>
                    <Pagination page={batchPagination.page} totalPages={batchPagination.totalPages} onChange={setBatchPage} />
                  </div>
                ) : null}
              </Card>
            )}
          </div>
        ) : null}

        {activeTab === "adjustments" ? (
          <div className="space-y-4">
            <InventoryFilters className="md:grid-cols-2 xl:grid-cols-5">
              <Input type="date" label="Date From" value={adjustmentDateFrom} onChange={(event) => setAdjustmentDateFrom(event.target.value)} />
              <Input type="date" label="Date To" value={adjustmentDateTo} onChange={(event) => setAdjustmentDateTo(event.target.value)} />
              <InventoryLookupField
                label="Product"
                value={adjustmentProductOption}
                onChange={(option) => {
                  setAdjustmentProductOption(option);
                  setAdjustmentPage(1);
                }}
                loadOptions={loadProductOptions}
                placeholder="All products"
              />
              <InventoryLookupField
                label="Warehouse"
                value={adjustmentWarehouseOption}
                onChange={(option) => {
                  setAdjustmentWarehouseOption(option);
                  setAdjustmentPage(1);
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="All warehouses"
              />
              <Select label="Type" value={adjustmentTypeFilter} onChange={(event) => setAdjustmentTypeFilter(event.target.value)}>
                <option value="">All Types</option>
                {Object.entries(STOCK_ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </InventoryFilters>

            {adjustmentsLoading && !adjustments.length ? (
              <Card className="p-5">
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-10 rounded bg-slate-100" />
                  ))}
                </div>
              </Card>
            ) : adjustmentsError && !adjustments.length ? (
              <Card>
                <CardContent className="py-6 text-sm text-rose-700">{adjustmentsError}</CardContent>
              </Card>
            ) : !adjustments.length ? (
              <EmptyState title="No adjustments found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Date", "Product", "Warehouse", "Batch", "Type", "Qty", "Value", "Reason", "Actions"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {adjustments.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.adjustmentDate)}</td>
                          <td className="px-4 py-4">
                            <div className="min-w-[170px]">
                              <p className="font-medium text-slate-900">{item.product.name}</p>
                              <p className="text-xs text-slate-500">{item.product.productCode}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">{item.warehouse.name ?? item.warehouse.warehouseCode ?? "-"}</td>
                          <td className="px-4 py-4">{item.batch?.batchNumber ?? "-"}</td>
                          <td className="px-4 py-4">{STOCK_ADJUSTMENT_TYPE_LABELS[item.adjustmentType]}</td>
                          <td className="px-4 py-4"><QuantityText value={item.quantity} tone="default" /></td>
                          <td className="px-4 py-4">{formatInr(item.value)}</td>
                          <td className="px-4 py-4">{item.reason}</td>
                          <td className="px-4 py-4">
                            <span className="text-xs text-slate-400">Append only</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                {adjustmentPagination ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                    <p className="text-sm text-slate-500">
                      Showing {adjustments.length} of {adjustmentPagination.total} adjustments
                    </p>
                    <Pagination page={adjustmentPagination.page} totalPages={adjustmentPagination.totalPages} onChange={setAdjustmentPage} />
                  </div>
                ) : null}
              </Card>
            )}
          </div>
        ) : null}

        {activeTab === "movements" ? (
          <div className="space-y-4">
            <InventoryFilters>
              <Input type="date" label="Date From" value={movementDateFrom} onChange={(event) => setMovementDateFrom(event.target.value)} />
              <Input type="date" label="Date To" value={movementDateTo} onChange={(event) => setMovementDateTo(event.target.value)} />
              <InventoryLookupField
                label="Product"
                value={movementProductOption}
                onChange={(option) => {
                  setMovementProductOption(option);
                  setMovementPage(1);
                }}
                loadOptions={loadProductOptions}
                placeholder="All products"
              />
              <InventoryLookupField
                label="Warehouse"
                value={movementWarehouseOption}
                onChange={(option) => {
                  setMovementWarehouseOption(option);
                  setMovementPage(1);
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="All warehouses"
              />
              <Select label="Batch" value={movementBatchId} onChange={(event) => setMovementBatchId(event.target.value)}>
                <option value="">All Batches</option>
                {movementBatchOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.batchNumber}
                  </option>
                ))}
              </Select>
              <Select label="Type" value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)}>
                <option value="">All Types</option>
                {Object.entries(STOCK_MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Reference"
                value={movementReferenceType}
                onChange={(event) => setMovementReferenceType(event.target.value)}
                placeholder="reference type"
              />
            </InventoryFilters>
            <MovementsTable
              items={movements}
              pagination={movementPagination}
              loading={movementsLoading}
              error={movementsError}
              onPageChange={setMovementPage}
            />
          </div>
        ) : null}

        {activeTab === "alerts" ? (
          <div className="space-y-4">
            <InventoryFilters>
              <Select label="Type" value={alertTypeFilter} onChange={(event) => setAlertTypeFilter(event.target.value)}>
                <option value="">All Types</option>
                {Object.entries(INVENTORY_ALERT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select label="Severity" value={alertSeverityFilter} onChange={(event) => setAlertSeverityFilter(event.target.value)}>
                <option value="">All Severity</option>
                {Object.entries(INVENTORY_ALERT_SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select label="Read" value={alertReadFilter} onChange={(event) => setAlertReadFilter(event.target.value)}>
                {ALERT_READ_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </InventoryFilters>
            <AlertsTable
              items={alerts}
              pagination={alertPagination}
              loading={alertsLoading}
              error={alertsError}
              onPageChange={setAlertPage}
              canMarkRead={canViewInventory || canManageInventory}
              markingId={markingAlertId}
              onMarkRead={async (alert) => {
                try {
                  setMarkingAlertId(alert.id);
                  await inventoryApi.markAlertRead(alert.id, true);
                  toast.success("Alert marked as read");
                  await refreshAlertsArea();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to update alert"));
                } finally {
                  setMarkingAlertId(null);
                }
              }}
            />
          </div>
        ) : null}

        {activeTab === "valuation" ? (
          <div className="space-y-4">
            <InventoryFilters>
              <InventoryLookupField
                label="Warehouse"
                value={valuationWarehouseOption}
                onChange={setValuationWarehouseOption}
                loadOptions={loadWarehouseOptions}
                placeholder="All warehouses"
              />
              <Select label="Category" value={valuationCategoryId} onChange={(event) => setValuationCategoryId(event.target.value)}>
                <option value="">All Categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <InventoryLookupField
                label="Product"
                value={valuationProductOption}
                onChange={setValuationProductOption}
                loadOptions={loadProductOptions}
                placeholder="All products"
              />
            </InventoryFilters>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Quantity</p>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    <QuantityText value={valuationData?.totals.totalQuantity ?? 0} tone="default" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Value</p>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{formatInr(valuationData?.totals.totalValue ?? 0)}</div>
                </CardContent>
              </Card>
            </div>

            <ValuationTable items={valuationData?.items ?? []} loading={valuationLoading} error={valuationError} />
          </div>
        ) : null}
      </InventoryPage>

      <WarehouseFormModal
        open={warehouseFormOpen}
        onClose={() => {
          setWarehouseFormOpen(false);
          setEditingWarehouse(null);
        }}
        initialWarehouse={editingWarehouse}
        submitting={warehouseSubmitLoading}
        onSubmit={async (values, setError) => {
          try {
            setWarehouseSubmitLoading(true);
            if (editingWarehouse) {
              await inventoryApi.updateWarehouse(editingWarehouse.id, values);
              toast.success("Warehouse updated");
            } else {
              await inventoryApi.createWarehouse(values);
              toast.success("Warehouse created");
            }
            setWarehouseFormOpen(false);
            setEditingWarehouse(null);
            await Promise.all([loadWarehouses(), refreshCurrentStockArea(), refreshBatchesArea(), refreshAdjustmentsArea(), refreshMovementsArea(), refreshAlertsArea(), refreshValuationArea()]);
          } catch (error) {
            applyInventoryFieldErrors(error, setError, { name: "name", pincode: "pincode", mobile: "mobile" });
            toast.error(getErrorMessage(error, "Failed to save warehouse"));
          } finally {
            setWarehouseSubmitLoading(false);
          }
        }}
      />

      <BatchFormDrawer
        open={batchDrawerOpen}
        onClose={() => {
          setBatchDrawerOpen(false);
          setEditingBatch(null);
        }}
        initialBatch={editingBatch}
        submitting={batchSubmitLoading}
        loadProductOptions={loadProductOptions}
        loadWarehouseOptions={loadWarehouseOptions}
        resolveProductSettings={resolveProductSettings}
        onSubmit={async (values, setError) => {
          try {
            setBatchSubmitLoading(true);
            if (editingBatch) {
              await inventoryApi.updateBatch(editingBatch.id, values);
              toast.success("Batch updated");
            } else {
              await inventoryApi.createBatch(values);
              toast.success("Batch created");
            }
            setBatchDrawerOpen(false);
            setEditingBatch(null);
            await Promise.all([refreshBatchesArea(), refreshCurrentStockArea()]);
          } catch (error) {
            applyInventoryFieldErrors(error, setError, {
              productId: "product",
              warehouseId: "warehouse",
              batchNumber: "batch",
              expiryDate: "expiry",
            });
            toast.error(getErrorMessage(error, "Failed to save batch"));
          } finally {
            setBatchSubmitLoading(false);
          }
        }}
      />

      <OpeningStockDrawer
        open={openingStockOpen}
        onClose={() => {
          setOpeningStockOpen(false);
          setOpeningStockSeed(null);
        }}
        initialValues={openingStockSeed}
        submitting={openingSubmitLoading}
        loadProductOptions={loadProductOptions}
        loadWarehouseOptions={loadWarehouseOptions}
        loadBatchOptions={loadBatchOptions}
        resolveProductSettings={resolveProductSettings}
        onSubmit={async (values, setError) => {
          try {
            setOpeningSubmitLoading(true);
            await inventoryApi.addOpeningStock(values);
            toast.success("Opening stock added");
            setOpeningStockOpen(false);
            setOpeningStockSeed(null);
            await Promise.all([refreshCurrentStockArea(), refreshBatchesArea(), refreshMovementsArea(), refreshAlertsArea(), refreshValuationArea()]);
          } catch (error) {
            applyInventoryFieldErrors(error, setError, {
              productId: "product",
              warehouseId: "warehouse",
              batchNumber: "batch",
              quantity: "quantity",
              expiryDate: "expiry",
            });
            toast.error(getErrorMessage(error, "Failed to add opening stock"));
          } finally {
            setOpeningSubmitLoading(false);
          }
        }}
      />

      <AdjustmentFormDrawer
        open={adjustmentOpen}
        onClose={() => {
          setAdjustmentOpen(false);
          setAdjustmentSeed(null);
        }}
        initialValues={adjustmentSeed}
        submitting={adjustmentSubmitLoading}
        loadProductOptions={loadProductOptions}
        loadWarehouseOptions={loadWarehouseOptions}
        loadBatchOptions={loadBatchOptions}
        resolveProductSettings={resolveProductSettings}
        onSubmit={async (values, setError) => {
          try {
            setAdjustmentSubmitLoading(true);
            await inventoryApi.createAdjustment(values);
            toast.success("Adjustment recorded");
            setAdjustmentOpen(false);
            setAdjustmentSeed(null);
            await Promise.all([refreshCurrentStockArea(), refreshAdjustmentsArea(), refreshMovementsArea(), refreshAlertsArea(), refreshValuationArea()]);
          } catch (error) {
            applyInventoryFieldErrors(error, setError, {
              productId: "product",
              warehouseId: "warehouse",
              batchId: "batch",
              batchNumber: "batch",
              quantity: "quantity",
              reason: "reason",
            });
            toast.error(getErrorMessage(error, "Failed to create adjustment"));
          } finally {
            setAdjustmentSubmitLoading(false);
          }
        }}
      />

      <StockDetailDrawer
        open={Boolean(stockDetailTarget)}
        productId={stockDetailTarget?.id ?? null}
        productName={stockDetailTarget?.name ?? ""}
        onClose={() => setStockDetailTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteWarehouseTarget)}
        loading={deleteWarehouseLoading}
        title="Delete Warehouse"
        description={`Delete ${deleteWarehouseTarget?.name ?? "this warehouse"}?`}
        onClose={() => setDeleteWarehouseTarget(null)}
        onConfirm={async () => {
          if (!deleteWarehouseTarget) {
            return;
          }

          try {
            setDeleteWarehouseLoading(true);
            await inventoryApi.deleteWarehouse(deleteWarehouseTarget.id);
            toast.success("Warehouse deleted");
            setDeleteWarehouseTarget(null);
            await loadWarehouses();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete warehouse"));
          } finally {
            setDeleteWarehouseLoading(false);
          }
        }}
      />
    </div>
  );
};

