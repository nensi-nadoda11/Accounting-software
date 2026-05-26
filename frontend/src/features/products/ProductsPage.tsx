import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  History,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIconButton } from "../../components/ui/TableActionIconButton";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { categoriesApi, productsApi, unitsApi } from "../../services/productsApi";
import type {
  Product,
  ProductCategory,
  ProductCategoryStatus,
  ProductPriceHistoryResponse,
  ProductStatus,
  ProductType,
  ProductUnit,
  ProductUnitStatus,
} from "../../types/product";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import {
  BOOLEAN_FILTER_OPTIONS,
  CATEGORY_STATUS_OPTIONS,
  PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  UNIT_STATUS_OPTIONS,
} from "./productOptions";
import { CategoryFormModal } from "./components/CategoryFormModal";
import { ProductDetailDrawer } from "./components/ProductDetailDrawer";
import { ProductFilters } from "./components/ProductFilters";
import { ProductFormDrawer } from "./components/ProductFormDrawer";
import { ProductPriceHistoryDrawer } from "./components/ProductPriceHistoryDrawer";
import { ProductStockSummaryDrawer } from "./components/ProductStockSummaryDrawer";
import { UnitFormModal } from "./components/UnitFormModal";
import {
  applyFriendlyFieldErrors,
  createProductUpdatePayload,
  findCategoryName,
  findUnitName,
  formatDateTime,
  formatInr,
  formatPercent,
  getProductStatusTone,
  saveDownloadedFile,
} from "./productUtils";

type InternalTab = "products" | "categories" | "units" | "price-history";
type BooleanFilterValue = "" | "true" | "false";
type DeleteTarget =
  | { type: "product"; product: Pick<Product, "id" | "name"> }
  | { type: "category"; category: Pick<ProductCategory, "id" | "name"> }
  | { type: "unit"; unit: Pick<ProductUnit, "id" | "name" | "symbol"> };

const isProductStatus = (value: string | null): value is ProductStatus =>
  value === "active" || value === "inactive" || value === "deleted";

const isProductType = (value: string | null): value is ProductType =>
  value === "goods" || value === "service";

const isInternalTab = (value: string | null): value is InternalTab =>
  value === "products" || value === "categories" || value === "units" || value === "price-history";

const isCategoryStatus = (value: string | null): value is ProductCategoryStatus =>
  value === "active" || value === "inactive" || value === "deleted";

const isUnitStatus = (value: string | null): value is ProductUnitStatus =>
  value === "active" || value === "inactive" || value === "deleted";

const parseBooleanFilter = (value: string | null): BooleanFilterValue =>
  value === "true" || value === "false" ? value : "";

const ProductTableSkeleton = () => (
  <Card>
    <TableWrapper className="border-none">
      <Table>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {[
              "Product Code",
              "Product Name",
              "Type",
              "Category",
              "Unit",
              "GST %",
              "Purchase Price",
              "Sale Price",
              "Status",
              "Actions",
            ].map((head) => (
              <th key={head} className="px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <tr key={rowIndex} className="animate-pulse">
              {Array.from({ length: 10 }).map((__, cellIndex) => (
                <td key={cellIndex} className="px-4 py-4">
                  <div className="h-4 rounded bg-slate-100" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  </Card>
);

export const ProductsPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [productsData, setProductsData] = useState<Awaited<ReturnType<typeof productsApi.list>>["data"] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [preparingFormId, setPreparingFormId] = useState<string | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productFormValue, setProductFormValue] = useState<Product | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [historyDrawerProduct, setHistoryDrawerProduct] = useState<{ id: string; name: string } | null>(null);
  const [stockDrawerProduct, setStockDrawerProduct] = useState<{ id: string; name: string } | null>(null);
  const [barcodeLoadingId, setBarcodeLoadingId] = useState<string | null>(null);

  const [categoriesData, setCategoriesData] = useState<Awaited<ReturnType<typeof categoriesApi.list>>["data"] | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatus, setCategoryStatus] = useState<ProductCategoryStatus | "">("");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryFormValue, setCategoryFormValue] = useState<ProductCategory | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);

  const [unitsData, setUnitsData] = useState<Awaited<ReturnType<typeof unitsApi.list>>["data"] | null>(null);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatus, setUnitStatus] = useState<ProductUnitStatus | "">("");
  const [unitDecimalAllowed, setUnitDecimalAllowed] = useState<BooleanFilterValue>("");
  const [unitPage, setUnitPage] = useState(1);
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [unitFormValue, setUnitFormValue] = useState<ProductUnit | null>(null);
  const [submittingUnit, setSubmittingUnit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [historyLookupSearch, setHistoryLookupSearch] = useState("");
  const [historyLookupOptions, setHistoryLookupOptions] = useState<Array<{ id: string; name: string; productCode: string }>>([]);
  const [historyLookupLoading, setHistoryLookupLoading] = useState(false);
  const [historyLookupError, setHistoryLookupError] = useState<string | null>(null);
  const [historyTabProductId, setHistoryTabProductId] = useState("");
  const [historyTabData, setHistoryTabData] = useState<ProductPriceHistoryResponse | null>(null);
  const [historyTabPage, setHistoryTabPage] = useState(1);
  const [historyTabLoading, setHistoryTabLoading] = useState(false);
  const [historyTabError, setHistoryTabError] = useState<string | null>(null);

  const canViewProducts = auth.hasPermission("product.view");
  const canCreateProducts = auth.hasPermission("product.create");
  const canUpdateProducts = auth.hasPermission("product.update");
  const canDeleteProducts = auth.hasPermission("product.delete");
  const canExportProducts = auth.hasPermission("product.export");
  const canViewPriceHistory = auth.hasPermission("product.price.view");
  const canManagePrice = auth.hasPermission(["product.update", "product.price.manage"]);
  const canManageCategories = auth.hasPermission("category.manage");
  const canManageUnits = auth.hasPermission("unit.manage");

  const tabParam = searchParams.get("tab");
  const productTypeParam = searchParams.get("productType");
  const statusParam = searchParams.get("status");

  const activeTab: InternalTab = isInternalTab(tabParam) ? tabParam : "products";
  const pageValue = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const productType: ProductType | "" = isProductType(productTypeParam) ? productTypeParam : "";
  const status: ProductStatus | "" = isProductStatus(statusParam) ? statusParam : "";
  const lowStock = parseBooleanFilter(searchParams.get("lowStock"));
  const categoryId = searchParams.get("categoryId") ?? "";

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });

      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "products") {
      return;
    }

    const removableKeys = ["unitId", "gstRate", "stockTrackingEnabled", "taxType", "sortBy", "sortOrder"];
    if (!removableKeys.some((key) => searchParams.has(key))) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    removableKeys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? "";
    if (debouncedSearch === currentSearch) {
      return;
    }

    updateQuery({
      search: debouncedSearch || null,
      page: "1",
    });
  }, [debouncedSearch, searchParams, updateQuery]);

  const loadProducts = useCallback(async () => {
    if (!canViewProducts) {
      return;
    }

    try {
      setProductsLoading(true);
      setProductsError(null);
      const response = await productsApi.list({
        page,
        limit: 20,
        search: searchParams.get("search") || undefined,
        productType: productType || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
        lowStock: lowStock === "" ? undefined : lowStock === "true",
      });
      setProductsData(response.data);
    } catch (loadError) {
      setProductsError(getErrorMessage(loadError, "Failed to load products"));
    } finally {
      setProductsLoading(false);
    }
  }, [
    canViewProducts,
    categoryId,
    lowStock,
    page,
    productType,
    searchParams,
    status,
  ]);

  useEffect(() => {
    if (activeTab !== "products") {
      return;
    }

    void loadProducts();
  }, [activeTab, loadProducts]);

  const loadCategories = useCallback(async () => {
    if (!canManageCategories) {
      return;
    }

    try {
      setCategoriesLoading(true);
      setCategoriesError(null);
      const response = await categoriesApi.list({
        page: categoryPage,
        limit: 20,
        search: categorySearch || undefined,
        status: categoryStatus || undefined,
      });
      setCategoriesData(response.data);
    } catch (loadError) {
      setCategoriesError(getErrorMessage(loadError, "Failed to load categories"));
    } finally {
      setCategoriesLoading(false);
    }
  }, [canManageCategories, categoryPage, categorySearch, categoryStatus]);

  useEffect(() => {
    if (activeTab !== "categories") {
      return;
    }

    void loadCategories();
  }, [activeTab, loadCategories]);

  const loadUnits = useCallback(async () => {
    if (!canManageUnits) {
      return;
    }

    try {
      setUnitsLoading(true);
      setUnitsError(null);
      const response = await unitsApi.list({
        page: unitPage,
        limit: 20,
        search: unitSearch || undefined,
        status: unitStatus || undefined,
        decimalAllowed: unitDecimalAllowed === "" ? undefined : unitDecimalAllowed === "true",
      });
      setUnitsData(response.data);
    } catch (loadError) {
      setUnitsError(getErrorMessage(loadError, "Failed to load units"));
    } finally {
      setUnitsLoading(false);
    }
  }, [canManageUnits, unitDecimalAllowed, unitPage, unitSearch, unitStatus]);

  useEffect(() => {
    if (activeTab !== "units") {
      return;
    }

    void loadUnits();
  }, [activeTab, loadUnits]);

  const loadReferenceOptions = useCallback(async () => {
    if (canManageCategories) {
      try {
        const response = await categoriesApi.list({ page: 1, limit: 100, status: "active" });
        setCategoriesData((current) => current ?? response.data);
      } catch {
        // keep page usable without blocking on reference lists
      }
    }

    if (canManageUnits) {
      try {
        const response = await unitsApi.list({ page: 1, limit: 100, status: "active" });
        setUnitsData((current) => current ?? response.data);
      } catch {
        // keep page usable without blocking on reference lists
      }
    }
  }, [canManageCategories, canManageUnits]);

  useEffect(() => {
    void loadReferenceOptions();
  }, [loadReferenceOptions]);

  const debouncedHistoryLookupSearch = useDebouncedValue(historyLookupSearch, 250);

  useEffect(() => {
    if (activeTab !== "price-history" || !canViewPriceHistory) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setHistoryLookupLoading(true);
        setHistoryLookupError(null);
        const response = await productsApi.lookup(debouncedHistoryLookupSearch || undefined, 20);

        if (cancelled) {
          return;
        }

        setHistoryLookupOptions(
          response.data.map((item) => ({
            id: item.id,
            name: item.name,
            productCode: item.productCode,
          })),
        );

        if (!historyTabProductId && response.data[0]) {
          setHistoryTabProductId(response.data[0].id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryLookupError(getErrorMessage(loadError, "Failed to load products"));
        }
      } finally {
        if (!cancelled) {
          setHistoryLookupLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canViewPriceHistory, debouncedHistoryLookupSearch, historyTabProductId]);

  useEffect(() => {
    if (activeTab !== "price-history" || !canViewPriceHistory || !historyTabProductId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setHistoryTabLoading(true);
        setHistoryTabError(null);
        const response = await productsApi.getPriceHistory(historyTabProductId, historyTabPage, 20);

        if (!cancelled) {
          setHistoryTabData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryTabError(getErrorMessage(loadError, "Failed to load price history"));
        }
      } finally {
        if (!cancelled) {
          setHistoryTabLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canViewPriceHistory, historyTabPage, historyTabProductId]);

  const productRows = useMemo(() => productsData?.items ?? [], [productsData]);

  const categoryOptions = useMemo(() => {
    if (categoriesData?.items.length) {
      return categoriesData.items;
    }

    const deduped = new Map<string, ProductCategory>();
    for (const item of productRows) {
      if (!item.category.id) {
        continue;
      }

      deduped.set(item.category.id, {
        id: item.category.id,
        companyId: "",
        categoryCode: "",
        name: item.category.name ?? "Unknown",
        parentId: null,
        description: null,
        status: "active",
        createdBy: null,
        updatedBy: null,
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      });
    }

    return Array.from(deduped.values());
  }, [categoriesData?.items, productRows]);

  const unitOptions = useMemo(() => {
    if (unitsData?.items.length) {
      return unitsData.items;
    }

    const deduped = new Map<string, ProductUnit>();
    for (const item of productRows) {
      if (!item.unit.id) {
        continue;
      }

      deduped.set(item.unit.id, {
        id: item.unit.id,
        companyId: "",
        name: item.unit.name ?? "Unknown",
        symbol: item.unit.symbol ?? "",
        decimalAllowed: true,
        baseUnitId: null,
        conversionRate: null,
        status: "active",
        createdBy: null,
        updatedBy: null,
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      });
    }

    return Array.from(deduped.values());
  }, [productRows, unitsData?.items]);

  const openCreateProduct = () => {
    setProductFormValue(null);
    setProductFormOpen(true);
  };

  const openEditProduct = async (productId: string, seededProduct?: Product) => {
    if (seededProduct) {
      setProductFormValue(seededProduct);
      setProductFormOpen(true);
      return;
    }

    try {
      setPreparingFormId(productId);
      const response = await productsApi.get(productId);
      setProductFormValue(response.data.product);
      setProductFormOpen(true);
    } catch (loadError) {
      toast.error(getErrorMessage(loadError, "Failed to load product"));
    } finally {
      setPreparingFormId(null);
    }
  };

  const refreshProductViews = async (productId?: string) => {
    await loadProducts();
    await loadReferenceOptions();

    if (productId && detailProductId === productId) {
      setDetailReloadKey((value) => value + 1);
    }
  };

  const generateBarcode = async (productId: string) => {
    try {
      setBarcodeLoadingId(productId);
      await productsApi.generateBarcode(productId);
      toast.success("Barcode generated");
      await refreshProductViews(productId);
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, "Failed to generate barcode"));
    } finally {
      setBarcodeLoadingId(null);
    }
  };

  const internalTabs: Array<{ key: InternalTab; label: string; visible: boolean }> = [
    { key: "products", label: "Products", visible: canViewProducts },
    { key: "categories", label: "Categories", visible: true },
    { key: "units", label: "Units", visible: true },
    { key: "price-history", label: "Price History", visible: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Services"
        actions={
          <div className="flex flex-wrap gap-2">
            {activeTab === "products" && canExportProducts ? (
              <Button
                type="button"
                variant="secondary"
                loading={exporting}
                onClick={async () => {
                  try {
                    setExporting(true);
                    const file = await productsApi.exportList({
                      page,
                      limit: 20,
                      search: searchParams.get("search") || undefined,
                      productType: productType || undefined,
                      categoryId: categoryId || undefined,
                      status: status || undefined,
                      lowStock: lowStock === "" ? undefined : lowStock === "true",
                    });
                    saveDownloadedFile(file.blob, file.fileName);
                    toast.success("Product list exported");
                  } catch (exportError) {
                    toast.error(getErrorMessage(exportError, "Failed to export products"));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="mr-2 size-4" />
                Export
              </Button>
            ) : null}
            {activeTab === "products" && canCreateProducts ? (
              <Button type="button" onClick={openCreateProduct}>
                <Plus className="mr-2 size-4" />
                Add Product
              </Button>
            ) : null}
            {activeTab === "categories" && canManageCategories ? (
              <Button
                type="button"
                onClick={() => {
                  setCategoryFormValue(null);
                  setCategoryFormOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Add Category
              </Button>
            ) : null}
            {activeTab === "units" && canManageUnits ? (
              <Button
                type="button"
                onClick={() => {
                  setUnitFormValue(null);
                  setUnitFormOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Add Unit
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="flex gap-5 overflow-x-auto px-3 py-0 sm:px-4">
          {internalTabs
            .filter((tab) => tab.visible)
            .map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => updateQuery({ tab: tab.key, page: tab.key === "products" ? String(page) : null })}
                className={`relative whitespace-nowrap pb-3 pt-4 text-sm font-medium transition ${
                  activeTab === tab.key ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
                {activeTab === tab.key ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
              </button>
            ))}
        </CardContent>
      </Card>

      {activeTab === "products" ? (
        <>
          <ProductFilters
            search={searchInput}
            categories={categoryOptions}
            values={{
              productType: productType || "",
              categoryId,
              status: status || "",
              lowStock,
            }}
            onSearchChange={setSearchInput}
            onChange={(values) =>
              updateQuery({
                productType: values.productType !== undefined ? values.productType || null : productType || null,
                categoryId: values.categoryId !== undefined ? values.categoryId || null : categoryId || null,
                status: values.status !== undefined ? values.status || null : status || null,
                lowStock: values.lowStock !== undefined ? values.lowStock || null : lowStock || null,
                page: "1",
              })
            }
          />

          {productsLoading && !productsData ? (
            <ProductTableSkeleton />
          ) : productsError && !productsData ? (
            <Card>
              <CardContent className="space-y-4 py-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {productsError}
                </div>
                <Button type="button" variant="secondary" onClick={() => void loadProducts()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : !productRows.length ? (
            <EmptyState
              title="No products found"
              action={
                canCreateProducts ? (
                  <Button type="button" onClick={openCreateProduct}>
                    <Plus className="mr-2 size-4" />
                    Add Product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <TableWrapper className="border-none">
                <div className="overflow-x-auto">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {[
                          "Product Code",
                          "Product Name",
                          "Type",
                          "Category",
                          "Unit",
                          "GST %",
                          "Purchase Price",
                          "Sale Price",
                          "Status",
                          "Actions",
                        ].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {productRows.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer transition hover:bg-slate-50"
                          onDoubleClick={() => setDetailProductId(item.id)}
                        >
                          <td className="px-4 py-4 font-medium text-slate-900">{item.productCode}</td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-slate-900">{item.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">{PRODUCT_TYPE_LABELS[item.productType]}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{item.category.name || "-"}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{item.unit.symbol || item.unit.name || "-"}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{formatPercent(item.gstRate)}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{formatInr(item.purchasePrice)}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{formatInr(item.salePrice)}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Badge tone={getProductStatusTone(item.status)}>{PRODUCT_STATUS_LABELS[item.status]}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <TableActionIconButton
                                label="View product"
                                icon={<Eye className="size-4" />}
                                onClick={() => setDetailProductId(item.id)}
                              />
                              {canUpdateProducts ? (
                                <TableActionIconButton
                                  label="Edit product"
                                  icon={<Pencil className="size-4" />}
                                  disabled={preparingFormId === item.id}
                                  onClick={() => void openEditProduct(item.id)}
                                />
                              ) : null}
                              {canViewPriceHistory ? (
                                <TableActionIconButton
                                  label="View price history"
                                  icon={<History className="size-4" />}
                                  onClick={() => setHistoryDrawerProduct({ id: item.id, name: item.name })}
                                />
                              ) : null}
                              <TableActionIconButton
                                label="View stock summary"
                                icon={<Package className="size-4" />}
                                onClick={() => setStockDrawerProduct({ id: item.id, name: item.name })}
                              />
                              {canManagePrice ? (
                                <TableActionIconButton
                                  label="Generate barcode"
                                  icon={<ScanLine className="size-4" />}
                                  disabled={barcodeLoadingId === item.id}
                                  onClick={() => void generateBarcode(item.id)}
                                />
                              ) : null}
                              {canDeleteProducts ? (
                                <TableActionIconButton
                                  label="Delete product"
                                  tone="danger"
                                  icon={<Trash2 className="size-4" />}
                                  onClick={() =>
                                    setDeleteTarget({ type: "product", product: { id: item.id, name: item.name } })
                                  }
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </TableWrapper>
              {productsData?.pagination ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                  <p className="text-sm text-slate-500">
                    Showing {productRows.length} of {productsData.pagination.total} products
                  </p>
                  <Pagination
                    page={productsData.pagination.page}
                    totalPages={productsData.pagination.totalPages}
                    onChange={(nextPage) => updateQuery({ page: String(nextPage) })}
                  />
                </div>
              ) : null}
            </Card>
          )}
        </>
      ) : null}

      {activeTab === "categories" ? (
        !canManageCategories ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-600">
              You do not have permission to manage categories.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Search"
                  value={categorySearch}
                  onChange={(event) => {
                    setCategorySearch(event.target.value);
                    setCategoryPage(1);
                  }}
                />
                <Select
                  label="Status"
                  value={categoryStatus}
                  onChange={(event) => {
                    setCategoryStatus(isCategoryStatus(event.target.value) ? event.target.value : "");
                    setCategoryPage(1);
                  }}
                >
                  {CATEGORY_STATUS_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            {categoriesLoading && !categoriesData ? (
              <LoadingState label="Loading categories..." />
            ) : categoriesError && !categoriesData ? (
              <Card>
                <CardContent className="space-y-4 py-6">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    {categoriesError}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void loadCategories()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : !categoriesData?.items.length ? (
              <EmptyState title="No categories found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Category Code", "Name", "Parent", "Status", "Actions"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {categoriesData.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.categoryCode || "-"}</td>
                          <td className="px-4 py-4">{item.name}</td>
                          <td className="px-4 py-4">{findCategoryName(categoryOptions, item.parentId)}</td>
                          <td className="px-4 py-4">
                            <Badge tone={item.status === "active" ? "success" : item.status === "inactive" ? "warning" : "danger"}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <TableActionIconButton
                                label="Edit category"
                                icon={<Pencil className="size-4" />}
                                onClick={() => {
                                  setCategoryFormValue(item);
                                  setCategoryFormOpen(true);
                                }}
                              />
                              <TableActionIconButton
                                label="Delete category"
                                tone="danger"
                                icon={<Trash2 className="size-4" />}
                                onClick={() => setDeleteTarget({ type: "category", category: { id: item.id, name: item.name } })}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                  <p className="text-sm text-slate-500">
                    Showing {categoriesData.items.length} of {categoriesData.pagination.total} categories
                  </p>
                  <Pagination page={categoriesData.pagination.page} totalPages={categoriesData.pagination.totalPages} onChange={setCategoryPage} />
                </div>
              </Card>
            )}
          </div>
        )
      ) : null}

      {activeTab === "units" ? (
        !canManageUnits ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-600">
              You do not have permission to manage units.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Input
                  label="Search"
                  value={unitSearch}
                  onChange={(event) => {
                    setUnitSearch(event.target.value);
                    setUnitPage(1);
                  }}
                />
                <Select
                  label="Status"
                  value={unitStatus}
                  onChange={(event) => {
                    setUnitStatus(isUnitStatus(event.target.value) ? event.target.value : "");
                    setUnitPage(1);
                  }}
                >
                  {UNIT_STATUS_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Decimal Allowed"
                  value={unitDecimalAllowed}
                  onChange={(event) => {
                    setUnitDecimalAllowed(event.target.value as BooleanFilterValue);
                    setUnitPage(1);
                  }}
                >
                  {BOOLEAN_FILTER_OPTIONS.decimalAllowed.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            {unitsLoading && !unitsData ? (
              <LoadingState label="Loading units..." />
            ) : unitsError && !unitsData ? (
              <Card>
                <CardContent className="space-y-4 py-6">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    {unitsError}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void loadUnits()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : !unitsData?.items.length ? (
              <EmptyState title="No units found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Name", "Symbol", "Decimal Allowed", "Base Unit", "Conversion", "Status", "Actions"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {unitsData.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                          <td className="px-4 py-4">{item.symbol}</td>
                          <td className="px-4 py-4">{item.decimalAllowed ? "Yes" : "No"}</td>
                          <td className="px-4 py-4">{findUnitName(unitOptions, item.baseUnitId)}</td>
                          <td className="px-4 py-4">{item.conversionRate ?? "-"}</td>
                          <td className="px-4 py-4">
                            <Badge tone={item.status === "active" ? "success" : item.status === "inactive" ? "warning" : "danger"}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <TableActionIconButton
                                label="Edit unit"
                                icon={<Pencil className="size-4" />}
                                onClick={() => {
                                  setUnitFormValue(item);
                                  setUnitFormOpen(true);
                                }}
                              />
                              <TableActionIconButton
                                label="Delete unit"
                                tone="danger"
                                icon={<Trash2 className="size-4" />}
                                onClick={() => setDeleteTarget({ type: "unit", unit: { id: item.id, name: item.name, symbol: item.symbol } })}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                  <p className="text-sm text-slate-500">
                    Showing {unitsData.items.length} of {unitsData.pagination.total} units
                  </p>
                  <Pagination page={unitsData.pagination.page} totalPages={unitsData.pagination.totalPages} onChange={setUnitPage} />
                </div>
              </Card>
            )}
          </div>
        )
      ) : null}

      {activeTab === "price-history" ? (
        !canViewPriceHistory ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-600">
              You do not have permission to view price history.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                <Input label="Product Search" value={historyLookupSearch} onChange={(event) => setHistoryLookupSearch(event.target.value)} />
                <Select
                  label="Product"
                  value={historyTabProductId}
                  onChange={(event) => {
                    setHistoryTabProductId(event.target.value);
                    setHistoryTabPage(1);
                  }}
                >
                  <option value="">Select Product</option>
                  {historyLookupOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productCode} - {item.name}
                    </option>
                  ))}
                </Select>
                {historyTabProductId ? (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const current = historyLookupOptions.find((item) => item.id === historyTabProductId);
                        if (current) {
                          setHistoryDrawerProduct({ id: current.id, name: current.name });
                        }
                      }}
                    >
                      <History className="mr-2 size-4" />
                      Open Drawer
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {historyLookupLoading && !historyLookupOptions.length ? (
              <LoadingState label="Loading products..." />
            ) : historyLookupError ? (
              <Card>
                <CardContent className="py-6 text-sm text-rose-700">{historyLookupError}</CardContent>
              </Card>
            ) : !historyTabProductId ? (
              <EmptyState title="Select a product to view price history" />
            ) : historyTabLoading && !historyTabData ? (
              <LoadingState label="Loading price history..." />
            ) : historyTabError ? (
              <Card>
                <CardContent className="py-6 text-sm text-rose-700">{historyTabError}</CardContent>
              </Card>
            ) : !historyTabData?.items.length ? (
              <EmptyState title="No price history found" />
            ) : (
              <Card>
                <TableWrapper className="border-none">
                  <Table>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Date", "Change Type", "Old Value", "New Value", "Changed By", "Reason"].map((head) => (
                          <th key={head} className="px-4 py-3 font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {historyTabData.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                          <td className="px-4 py-4">{PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS[item.changeType]}</td>
                          <td className="px-4 py-4">{item.oldValue ?? "-"}</td>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.newValue ?? "-"}</td>
                          <td className="px-4 py-4">{item.changedBy ?? "-"}</td>
                          <td className="px-4 py-4">{item.reason ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                  <p className="text-sm text-slate-500">
                    Showing {historyTabData.items.length} of {historyTabData.pagination.total} entries
                  </p>
                  <Pagination page={historyTabData.pagination.page} totalPages={historyTabData.pagination.totalPages} onChange={setHistoryTabPage} />
                </div>
              </Card>
            )}
          </div>
        )
      ) : null}

      <ProductFormDrawer
        open={productFormOpen}
        onClose={() => {
          setProductFormOpen(false);
          setProductFormValue(null);
        }}
        initialProduct={productFormValue}
        categories={categoryOptions}
        units={unitOptions}
        submitting={submittingProduct}
        barcodeLoading={barcodeLoadingId === productFormValue?.id}
        onGenerateBarcode={
          productFormValue && canManagePrice
            ? async () => {
                await generateBarcode(productFormValue.id);
                const response = await productsApi.get(productFormValue.id);
                setProductFormValue(response.data.product);
              }
            : undefined
        }
        onSubmit={async (values, setError) => {
          try {
            setSubmittingProduct(true);

            if (productFormValue) {
              await productsApi.update(productFormValue.id, createProductUpdatePayload(values));
              toast.success("Product updated");
              await refreshProductViews(productFormValue.id);
            } else {
              const response = await productsApi.create(values);
              toast.success("Product created");
              await refreshProductViews(response.data.product.id);
            }

            setProductFormOpen(false);
            setProductFormValue(null);
          } catch (submitError) {
            applyFriendlyFieldErrors(submitError, setError);
            toast.error(getErrorMessage(submitError, "Failed to save product"));
          } finally {
            setSubmittingProduct(false);
          }
        }}
      />

      <ProductDetailDrawer
        open={Boolean(detailProductId)}
        productId={detailProductId}
        reloadKey={detailReloadKey}
        onClose={() => setDetailProductId(null)}
        onEdit={(product) => void openEditProduct(product.id, product)}
        onOpenPriceHistory={(product) => setHistoryDrawerProduct({ id: product.id, name: product.name })}
        onOpenStockSummary={(product) => setStockDrawerProduct({ id: product.id, name: product.name })}
        onGenerateBarcode={async (product) => {
          await generateBarcode(product.id);
        }}
        onDelete={(product) => setDeleteTarget({ type: "product", product: { id: product.id, name: product.name } })}
        canEdit={canUpdateProducts}
        canDelete={canDeleteProducts}
        canViewPriceHistory={canViewPriceHistory}
        canManagePrice={canManagePrice}
      />

      <ProductPriceHistoryDrawer
        open={Boolean(historyDrawerProduct)}
        productId={historyDrawerProduct?.id ?? null}
        productName={historyDrawerProduct?.name ?? ""}
        onClose={() => setHistoryDrawerProduct(null)}
      />

      <ProductStockSummaryDrawer
        open={Boolean(stockDrawerProduct)}
        productId={stockDrawerProduct?.id ?? null}
        productName={stockDrawerProduct?.name ?? ""}
        onClose={() => setStockDrawerProduct(null)}
      />

      <CategoryFormModal
        open={categoryFormOpen}
        onClose={() => {
          setCategoryFormOpen(false);
          setCategoryFormValue(null);
        }}
        initialCategory={categoryFormValue}
        parentOptions={categoryOptions}
        submitting={submittingCategory}
        onSubmit={async (values, setError) => {
          try {
            setSubmittingCategory(true);
            if (categoryFormValue) {
              await categoriesApi.update(categoryFormValue.id, values);
              toast.success("Category updated");
            } else {
              await categoriesApi.create(values);
              toast.success("Category created");
            }

            setCategoryFormOpen(false);
            setCategoryFormValue(null);
            await loadCategories();
            await loadReferenceOptions();
          } catch (submitError) {
            if (!applyFriendlyFieldErrors(submitError, setError)) {
              const message = getErrorMessage(submitError, "Failed to save category");
              if (message.toLowerCase().includes("name")) {
                setError("name", { type: "server", message });
              }
              toast.error(message);
            } else {
              toast.error(getErrorMessage(submitError, "Failed to save category"));
            }
          } finally {
            setSubmittingCategory(false);
          }
        }}
      />

      <UnitFormModal
        open={unitFormOpen}
        onClose={() => {
          setUnitFormOpen(false);
          setUnitFormValue(null);
        }}
        initialUnit={unitFormValue}
        baseUnitOptions={unitOptions}
        submitting={submittingUnit}
        onSubmit={async (values, setError) => {
          try {
            setSubmittingUnit(true);
            if (unitFormValue) {
              await unitsApi.update(unitFormValue.id, values);
              toast.success("Unit updated");
            } else {
              await unitsApi.create(values);
              toast.success("Unit created");
            }

            setUnitFormOpen(false);
            setUnitFormValue(null);
            await loadUnits();
            await loadReferenceOptions();
          } catch (submitError) {
            if (!applyFriendlyFieldErrors(submitError, setError)) {
              const message = getErrorMessage(submitError, "Failed to save unit");
              if (message.toLowerCase().includes("symbol")) {
                setError("symbol", { type: "server", message });
              }
              toast.error(message);
            } else {
              toast.error(getErrorMessage(submitError, "Failed to save unit"));
            }
          } finally {
            setSubmittingUnit(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        loading={deleteLoading}
        title={
          deleteTarget?.type === "product"
            ? "Delete Product"
            : deleteTarget?.type === "category"
              ? "Delete Category"
              : "Delete Unit"
        }
        description={
          deleteTarget?.type === "product"
            ? `Delete ${deleteTarget.product.name}?`
            : deleteTarget?.type === "category"
              ? `Delete ${deleteTarget.category.name}?`
              : `Delete ${deleteTarget?.unit.name}?`
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) {
            return;
          }

          try {
            setDeleteLoading(true);

            if (deleteTarget.type === "product") {
              await productsApi.remove(deleteTarget.product.id);
              toast.success("Product deleted");
              if (detailProductId === deleteTarget.product.id) {
                setDetailProductId(null);
              }
              await refreshProductViews(deleteTarget.product.id);
            } else if (deleteTarget.type === "category") {
              await categoriesApi.remove(deleteTarget.category.id);
              toast.success("Category deleted");
              await loadCategories();
              await loadReferenceOptions();
            } else {
              await unitsApi.remove(deleteTarget.unit.id);
              toast.success("Unit deleted");
              await loadUnits();
              await loadReferenceOptions();
            }

            setDeleteTarget(null);
          } catch (deleteError) {
            toast.error(getErrorMessage(deleteError, "Failed to delete record"));
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </div>
  );
};

