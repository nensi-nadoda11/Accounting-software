import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type UseFormSetError } from "react-hook-form";
import { ArrowLeft, Plus, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { applyFriendlyFieldErrors } from "../../customers/customerUtils";
import { getErrorMessage } from "../../../lib/errors";
import { useAuth } from "../../../providers/useAuth";
import { useToast } from "../../../providers/useToast";
import { paymentsApi } from "../../../services/paymentsApi";
import { productsApi } from "../../../services/productsApi";
import { suppliersApi } from "../../../services/suppliersApi";
import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../../types/company";
import type { Warehouse } from "../../../types/inventory";
import type { Product, ProductListItem, ProductLookupItem } from "../../../types/product";
import type { Supplier, SupplierFormInput, SupplierListItem } from "../../../types/supplier";
import type { PurchaseFormInput, PurchaseInvoice, PurchasePaymentMode } from "../../../types/purchase";
import { SupplierFormDrawer } from "../../suppliers/components/SupplierFormDrawer";
import { createSupplierPayload } from "../../suppliers/supplierUtils";
import type { SupplierFormValues } from "../../suppliers/supplierSchemas";
import { PURCHASE_PAYMENT_MODE_OPTIONS } from "../purchaseOptions";
import { purchaseFormSchema, type PurchaseFormValues } from "../purchaseSchemas";
import {
  buildPurchaseFormDefaults,
  calculatePurchasePreview,
  createPurchasePayload,
  hydrateItemFromProduct,
  isBankPaymentMode,
  resolveInterState,
} from "../purchaseUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";
import { PurchaseItemsTable } from "./PurchaseItemsTable";
import { PurchaseTotalsPanel } from "./PurchaseTotalsPanel";
import { WarehouseLookupSelect } from "./WarehouseLookupSelect";

type SupplierLookupValue = LookupOption | null;
const SUPPLIER_DIRECTORY_LIMIT = 100;
const PRODUCT_DIRECTORY_LIMIT = 100;

const buildSupplierLookupOption = (supplier: Pick<SupplierListItem, "id" | "name" | "supplierCode" | "mobile">): LookupOption => ({
  id: supplier.id,
  label: supplier.name,
  description: supplier.supplierCode,
  meta: supplier.mobile,
});

const doesSupplierMatch = (supplier: Pick<SupplierListItem, "name" | "supplierCode" | "mobile" | "businessName" | "email">, search: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [supplier.name, supplier.supplierCode, supplier.mobile, supplier.businessName, supplier.email]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
};

const buildProductLookupOptionFromListItem = (
  product: Pick<ProductListItem, "id" | "name" | "productCode" | "sku" | "barcode" | "purchasePrice" | "unit">,
): LookupOption => ({
  id: product.id,
  label: product.name,
  description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
  meta: product.unit.symbol ? `${product.purchasePrice} · ${product.unit.symbol}` : product.purchasePrice,
});

const buildProductLookupOptionFromLookupItem = (product: ProductLookupItem): LookupOption => ({
  id: product.id,
  label: product.name,
  description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
  meta: product.unit.symbol ? `${product.purchasePrice} · ${product.unit.symbol}` : product.purchasePrice,
});

const doesProductMatch = (
  product: Pick<ProductListItem, "name" | "productCode" | "sku" | "barcode" | "brand" | "hsnSacCode">,
  search: string,
) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [product.name, product.productCode, product.sku, product.barcode, product.brand, product.hsnSacCode]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
};

export const PurchaseForm = ({
  initialInvoice,
  warehouses,
  bankAccounts,
  companyProfile,
  invoiceSettings,
  submitting,
  onBack,
  onSubmit,
}: {
  initialInvoice?: PurchaseInvoice | null;
  warehouses: Warehouse[];
  bankAccounts: CompanyBankAccount[];
  companyProfile: CompanyProfile | null;
  invoiceSettings: CompanyInvoiceSettings | null;
  submitting?: boolean;
  onBack: () => void;
  onSubmit: (
    values: PurchaseFormInput,
    setError: UseFormSetError<PurchaseFormValues>,
    mode: "draft" | "posted",
    advanceAdjustmentAmount: number,
  ) => Promise<void>;
}) => {
  const auth = useAuth();
  const toast = useToast();
  const [submitMode, setSubmitMode] = useState<"draft" | "posted">("draft");
  const [supplierLookup, setSupplierLookup] = useState<LookupOption[]>([]);
  const [supplierDirectory, setSupplierDirectory] = useState<SupplierListItem[]>([]);
  const [supplierDirectoryLoaded, setSupplierDirectoryLoaded] = useState(false);
  const [supplierLookupMessage, setSupplierLookupMessage] = useState<string | null>(null);
  const [productLookup, setProductLookup] = useState<LookupOption[]>([]);
  const [productDirectory, setProductDirectory] = useState<ProductListItem[]>([]);
  const [productDirectoryLoaded, setProductDirectoryLoaded] = useState(false);
  const [productLookupMessage, setProductLookupMessage] = useState<string | null>(null);
  const [supplierLookupValue, setSupplierLookupValue] = useState<SupplierLookupValue>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [availableAdvanceAmount, setAvailableAdvanceAmount] = useState(0);
  const [useAdvanceAmount, setUseAdvanceAmount] = useState(false);
  const [advanceAdjustmentAmount, setAdvanceAdjustmentAmount] = useState(0);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const supplierLookupRequestRef = useRef(0);
  const productLookupRequestRef = useRef(0);
  const canCreateSupplier = auth.hasPermission("supplier.create");

  const form = useForm<PurchaseFormValues, undefined, PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
      grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const values = form.watch() as PurchaseFormValues;
  const preview = calculatePurchasePreview({
    items: values.items.map((item) => ({
      quantity: Number(item.quantity ?? 0),
      purchaseRate: Number(item.purchaseRate ?? 0),
      priceTaxType: item.priceTaxType ?? "exclusive",
      discountPercent: Number(item.discountPercent ?? 0),
      discountAmount: Number(item.discountAmount ?? 0),
      gstRate: Number(item.gstRate ?? 0),
      cessRate: Number(item.cessRate ?? 0),
      isInterState: resolveInterState(companyProfile, supplierDetail),
    })),
    invoiceDiscountTotal: Number(values.invoiceDiscountTotal ?? 0),
    additionalCharges: Number(values.additionalCharges ?? 0),
    freightCharges: Number(values.freightCharges ?? 0),
    paidAmount: Number(values.paidAmount ?? 0) + (useAdvanceAmount ? advanceAdjustmentAmount : 0),
    dueDate: (values.dueDate as string | null | undefined) ?? null,
    roundOffEnabled: invoiceSettings?.roundOffEnabled ?? true,
  });

  useEffect(() => {
    form.setValue("grandTotalPreview", Number(preview.grandTotal), { shouldDirty: false, shouldValidate: true });
  }, [form, preview.grandTotal]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await suppliersApi.list({
          page: 1,
          limit: SUPPLIER_DIRECTORY_LIMIT,
          status: "active",
          isBlacklisted: false,
          sortBy: "name",
          sortOrder: "asc",
        });

        if (cancelled) {
          return;
        }

        setSupplierDirectory(response.data.items);
      } catch {
        if (cancelled) {
          return;
        }

        setSupplierDirectory([]);
      } finally {
        if (!cancelled) {
          setSupplierDirectoryLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await productsApi.list({
          page: 1,
          limit: PRODUCT_DIRECTORY_LIMIT,
          status: "active",
          sortBy: "name",
          sortOrder: "asc",
        });

        if (cancelled) {
          return;
        }

        setProductDirectory(response.data.items);
      } catch {
        if (cancelled) {
          return;
        }

        setProductDirectory([]);
      } finally {
        if (!cancelled) {
          setProductDirectoryLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialInvoice) {
      setSupplierLookupValue(null);
      setSupplierDetail(null);
      setAvailableAdvanceAmount(0);
      setUseAdvanceAmount(false);
      setAdvanceAdjustmentAmount(0);
      setAdvanceError(null);
      form.reset({
        ...buildPurchaseFormDefaults(null, invoiceSettings),
        grandTotalPreview: 0,
      });
      return;
    }

    form.reset({
      ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
      grandTotalPreview: Number(initialInvoice.grandTotal),
    });
    setAvailableAdvanceAmount(0);
    setUseAdvanceAmount(false);
    setAdvanceAdjustmentAmount(0);
    setAdvanceError(null);
    setSupplierLookupValue({
      id: initialInvoice.supplier.id,
      label: initialInvoice.supplier.name,
      description: initialInvoice.supplier.supplierCode ?? null,
      meta: initialInvoice.purchaseNumber,
    });
    void (async () => {
      try {
        const [supplierResponse, ...productResponses] = await Promise.all([
          suppliersApi.get(initialInvoice.supplier.id),
          ...(initialInvoice.items ?? []).map((item) => productsApi.get(item.productId)),
        ]);

        setSupplierDetail(supplierResponse.data.supplier);
        setProductDetails(
          productResponses.reduce<Record<string, Product>>((accumulator, response) => {
            accumulator[response.data.product.id] = response.data.product;
            return accumulator;
          }, {}),
        );
      } catch {
        // The form still works with existing invoice snapshots if these lookups fail.
      }
    })();
  }, [form, initialInvoice, invoiceSettings]);

  const stopSupplierLookup = useCallback(() => {
    supplierLookupRequestRef.current += 1;
    setSupplierLoading(false);
    setSupplierLookup([]);
    setSupplierLookupMessage(null);
  }, []);

  const loadSuppliers = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    const requestId = supplierLookupRequestRef.current + 1;
    supplierLookupRequestRef.current = requestId;
    setSupplierLookupMessage(null);

    const cachedMatches = supplierDirectory
      .filter((supplier) => doesSupplierMatch(supplier, normalizedSearch))
      .slice(0, 20)
      .map(buildSupplierLookupOption);

    if (cachedMatches.length > 0) {
      setSupplierLookup(cachedMatches);
    }

    if (!normalizedSearch || (supplierDirectoryLoaded && (cachedMatches.length > 0 || supplierDirectory.length < SUPPLIER_DIRECTORY_LIMIT))) {
      setSupplierLoading(false);
      return;
    }

    try {
      setSupplierLoading(true);
      const response = await suppliersApi.list({
        page: 1,
        limit: 20,
        search: normalizedSearch,
        status: "active",
        isBlacklisted: false,
      });
      if (supplierLookupRequestRef.current !== requestId) {
        return;
      }

      setSupplierDirectory((current) => {
        const next = new Map(current.map((supplier) => [supplier.id, supplier]));
        response.data.items.forEach((supplier) => {
          next.set(supplier.id, supplier);
        });
        return Array.from(next.values());
      });

      const remoteOptions = response.data.items.map(buildSupplierLookupOption);
      const mergedOptions = new Map<string, LookupOption>();

      [...cachedMatches, ...remoteOptions].forEach((option) => {
        mergedOptions.set(option.id, option);
      });

      setSupplierLookup(Array.from(mergedOptions.values()));
    } catch {
      if (supplierLookupRequestRef.current !== requestId) {
        return;
      }

      if (cachedMatches.length > 0) {
        setSupplierLookup(cachedMatches);
        setSupplierLookupMessage("Showing cached suppliers. Live search is temporarily unavailable.");
      } else {
        setSupplierLookup([]);
        setSupplierLookupMessage("Could not load suppliers. Check backend/database connection.");
      }
    } finally {
      if (supplierLookupRequestRef.current === requestId) {
        setSupplierLoading(false);
      }
    }
  }, [supplierDirectory, supplierDirectoryLoaded]);

  const loadProducts = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    const requestId = productLookupRequestRef.current + 1;
    productLookupRequestRef.current = requestId;

    if (!normalizedSearch) {
      setProductLookupLoading(false);
      setProductLookup([]);
      return;
    }

    try {
      setProductLookupLoading(true);
      const response = await productsApi.lookup(normalizedSearch, 20);
      if (productLookupRequestRef.current !== requestId) {
        return;
      }
      setProductLookup(
        response.data.map((product) => ({
          id: product.id,
          label: product.name,
          description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
          meta: product.unit.symbol ? `${product.purchasePrice} · ${product.unit.symbol}` : product.purchasePrice,
        })),
      );
    } catch {
      if (productLookupRequestRef.current !== requestId) {
        return;
      }

      setProductLookup([]);
    } finally {
      if (productLookupRequestRef.current === requestId) {
        setProductLookupLoading(false);
      }
    }
  }, []);

  const loadProductsWithFallback = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    const requestId = productLookupRequestRef.current + 1;
    productLookupRequestRef.current = requestId;
    setProductLookupMessage(null);

    const cachedMatches = (normalizedSearch ? productDirectory.filter((product) => doesProductMatch(product, normalizedSearch)) : productDirectory)
      .slice(0, 20)
      .map(buildProductLookupOptionFromListItem);

    setProductLookup(cachedMatches);

    if (!normalizedSearch) {
      setProductLookupLoading(false);
      return;
    }

    if (productDirectoryLoaded && (cachedMatches.length > 0 || productDirectory.length < PRODUCT_DIRECTORY_LIMIT)) {
      setProductLookupLoading(false);

      if (cachedMatches.length === 0) {
        setProductLookup([]);
      }

      return;
    }

    try {
      setProductLookupLoading(true);
      const response = await productsApi.lookup(normalizedSearch, 20);
      if (productLookupRequestRef.current !== requestId) {
        return;
      }

      const remoteOptions = response.data.map(buildProductLookupOptionFromLookupItem);
      const mergedOptions = new Map<string, LookupOption>();

      [...cachedMatches, ...remoteOptions].forEach((option) => {
        mergedOptions.set(option.id, option);
      });

      setProductLookup(Array.from(mergedOptions.values()));
    } catch {
      if (productLookupRequestRef.current !== requestId) {
        return;
      }

      if (cachedMatches.length > 0) {
        setProductLookup(cachedMatches);
        setProductLookupMessage("Showing cached products. Live search is temporarily unavailable.");
      } else {
        setProductLookup([]);
        setProductLookupMessage("Could not load products. Check backend/database connection.");
      }
    } finally {
      if (productLookupRequestRef.current === requestId) {
        setProductLookupLoading(false);
      }
    }
  }, [productDirectory, productDirectoryLoaded]);

  void loadProducts;

  const handleSupplierSelect = async (option: LookupOption) => {
    stopSupplierLookup();
    setSupplierLookupValue(option);
    form.setValue("supplierId", option.id, { shouldDirty: true, shouldValidate: true });
    setAdvanceError(null);

    try {
      const [response, dueItemsResponse] = await Promise.all([
        suppliersApi.get(option.id),
        paymentsApi.getPartyDueItems("supplier", option.id),
      ]);
      setSupplierDetail(response.data.supplier);
      setAvailableAdvanceAmount(Number(dueItemsResponse.data.advanceBalance ?? 0));
      setUseAdvanceAmount(false);
      setAdvanceAdjustmentAmount(0);
      if (!form.getValues("termsConditions")) {
        form.setValue("termsConditions", response.data.supplier.paymentTerms ?? invoiceSettings?.termsAndConditions ?? null, {
          shouldDirty: true,
        });
      }
    } catch {
      setSupplierDetail(null);
      setAvailableAdvanceAmount(0);
      setUseAdvanceAmount(false);
      setAdvanceAdjustmentAmount(0);
    }
  };

  const handleProductSelect = async (index: number, option: LookupOption) => {
    try {
      const cached = productDetails[option.id];
      const product =
        cached ??
        (
          await productsApi.get(option.id)
        ).data.product;

      setProductDetails((current) => ({ ...current, [product.id]: product }));
      const nextItem = hydrateItemFromProduct(product, (form.getValues("warehouseId") as string | null | undefined) ?? null);

      form.setValue(`items.${index}.productId`, product.id, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.warehouseId`, nextItem.warehouseId, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.batchId`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.batchNumber`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.quantity`, nextItem.quantity, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.freeQuantity`, nextItem.freeQuantity, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.purchaseRate`, nextItem.purchaseRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.priceTaxType`, nextItem.priceTaxType, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountPercent`, nextItem.discountPercent, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountAmount`, nextItem.discountAmount, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.gstRate`, nextItem.gstRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.cessRate`, nextItem.cessRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.manufacturingDate`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.expiryDate`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.remarks`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.productType`, product.productType, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.batchTrackingEnabled`, product.batchTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.expiryTrackingEnabled`, product.expiryTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.decimalAllowed`, undefined, { shouldDirty: false, shouldValidate: true });
    } catch {
      // Validation and submit feedback will still protect the flow.
    }
  };

  const applyDefaultWarehouseToItems = useCallback((warehouseId: string | null) => {
    values.items.forEach((item, index) => {
      if (item.productType === "goods") {
        form.setValue(`items.${index}.warehouseId`, warehouseId, { shouldDirty: true, shouldValidate: true });
      }
    });
  }, [form, values.items]);

  const currentPaymentMode = (form.watch("paymentMode") as PurchasePaymentMode | null | undefined) ?? null;
  const hasDirectPayment = Number(values.paidAmount ?? 0) > 0;
  const handleSupplierCreated = async (values: SupplierFormInput, setError: UseFormSetError<SupplierFormValues>) => {
    try {
      setSubmittingSupplier(true);
      const response = await suppliersApi.create(createSupplierPayload(values));
      const supplier = response.data.supplier;
      const lookupOption: LookupOption = {
        id: supplier.id,
        label: supplier.name,
        description: supplier.supplierCode,
        meta: supplier.mobile,
      };

      setSupplierDirectory((current) => {
        const next = new Map(current.map((item) => [item.id, item]));
        next.set(supplier.id, {
          id: supplier.id,
          supplierCode: supplier.supplierCode,
          name: supplier.name,
          supplierType: supplier.supplierType,
          businessName: supplier.businessName,
          mobile: supplier.mobile,
          email: supplier.email,
          gstNumber: supplier.gstNumber,
          taxType: supplier.taxType,
          status: supplier.status,
          isBlacklisted: supplier.isBlacklisted,
          isPreferred: supplier.isPreferred,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt,
          creditDays: supplier.creditDays,
          outstandingSummary: response.data.outstandingSummary,
        });
        return Array.from(next.values());
      });
      setSupplierLookup((current) => [lookupOption, ...current.filter((option) => option.id !== supplier.id)]);
      setSupplierLookupValue(lookupOption);
      setSupplierDetail(supplier);
      setAvailableAdvanceAmount(0);
      setUseAdvanceAmount(false);
      setAdvanceAdjustmentAmount(0);
      form.setValue("supplierId", supplier.id, { shouldDirty: true, shouldValidate: true });

      if (!form.getValues("termsConditions")) {
        form.setValue("termsConditions", supplier.paymentTerms ?? invoiceSettings?.termsAndConditions ?? null, {
          shouldDirty: true,
        });
      }

      setSupplierDrawerOpen(false);
      toast.success("Supplier created");
    } catch (error) {
      applyFriendlyFieldErrors(error, setError);
      toast.error(getErrorMessage(error, "Failed to save supplier"));
    } finally {
      setSubmittingSupplier(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (output) => {
        try {
          const directPaidAmount = Number(output.paidAmount ?? 0);
          const requestedAdvanceAmount = useAdvanceAmount ? Number(advanceAdjustmentAmount ?? 0) : 0;

          setAdvanceError(null);
          if (submitMode === "draft" && requestedAdvanceAmount > 0) {
            setAdvanceError("Advance adjustment sirf Save & Post par apply hoga.");
            return;
          }

          if (requestedAdvanceAmount > availableAdvanceAmount) {
            setAdvanceError("Advance amount available balance se zyada nahi ho sakta.");
            return;
          }

          if (directPaidAmount + requestedAdvanceAmount > Number(preview.grandTotal)) {
            setAdvanceError("Cash payment aur advance milakar grand total se zyada nahi ho sakte.");
            return;
          }

          const payload = submitMode === "draft"
            ? createPurchasePayload({ ...output, purchaseStatus: "draft" })
            : createPurchasePayload({ ...output, purchaseStatus: "posted" });
          await onSubmit(payload, form.setError, submitMode, requestedAdvanceAmount);
        } catch (error) {
          applyFriendlyFieldErrors(error, form.setError);
        }
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Back to List
          </Button>
          <h1 className="text-xl font-semibold text-slate-900">{initialInvoice ? "Edit Purchase Draft" : "New Purchase"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setUseAdvanceAmount(false);
              setAdvanceAdjustmentAmount(0);
              setAdvanceError(null);
              form.reset({
                ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
                grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
              });
            }}
          >
            Reset
          </Button>
          <Button type="submit" variant="secondary" loading={submitting} onClick={() => setSubmitMode("draft")}>
            <Save className="mr-2 size-4" />
            Save Draft
          </Button>
          <Button type="submit" loading={submitting} onClick={() => setSubmitMode("posted")}>
            <Save className="mr-2 size-4" />
            Save & Post
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Supplier <span className="text-rose-500">*</span>
              </span>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <AsyncLookupSelect
                    value={supplierLookupValue}
                    loading={supplierLoading}
                    options={supplierLookup}
                    placeholder="Search supplier"
                    error={form.formState.errors.supplierId?.message}
                    noResultsLabel={supplierLookupMessage ?? "No matching active suppliers found"}
                    onSearch={loadSuppliers}
                    onSelect={(option) => void handleSupplierSelect(option)}
                    onClear={() => {
                      stopSupplierLookup();
                      setSupplierLookupValue(null);
                      setSupplierDetail(null);
                      setAvailableAdvanceAmount(0);
                      setUseAdvanceAmount(false);
                      setAdvanceAdjustmentAmount(0);
                      setAdvanceError(null);
                      form.setValue("supplierId", "", { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                </div>
                {canCreateSupplier ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 min-w-11 px-3 text-emerald-700 hover:text-emerald-800"
                    onClick={() => setSupplierDrawerOpen(true)}
                    aria-label="Add supplier"
                  >
                    <Plus className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <Input
              label="Supplier Invoice No."
              placeholder="Enter invoice no."
              {...form.register("supplierInvoiceNumber")}
              error={form.formState.errors.supplierInvoiceNumber?.message}
            />
            <Input
              type="date"
              label="Invoice Date"
              required
              {...form.register("invoiceDate")}
              error={form.formState.errors.invoiceDate?.message}
            />
            <Input type="date" label="Due Date" {...form.register("dueDate")} error={form.formState.errors.dueDate?.message} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
            <WarehouseLookupSelect
              label="Default Warehouse"
              required
              value={(form.watch("warehouseId") as string | null | undefined) ?? ""}
              warehouses={warehouses}
              error={form.formState.errors.warehouseId?.message}
              placeholder="Select warehouse"
              onChange={(value) => {
                form.setValue("warehouseId", value, { shouldDirty: true, shouldValidate: true });
                applyDefaultWarehouseToItems(value);
              }}
            />
            <Textarea
              label="Terms"
              rows={2}
              className="min-h-[96px]"
              placeholder="Enter terms and conditions"
              {...form.register("termsConditions")}
              error={form.formState.errors.termsConditions?.message}
            />
            <Textarea
              label="Notes"
              rows={2}
              className="min-h-[96px]"
              placeholder="Add notes (optional)"
              {...form.register("notes")}
              error={form.formState.errors.notes?.message}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <PurchaseItemsTable
        form={form}
        fields={fields}
        warehouses={warehouses}
        productLookupOptions={productLookup}
        productLookupLoading={productLookupLoading}
        productLookupNoResultsLabel={productLookupMessage ?? "No matching active products found"}
        productDetails={productDetails}
        preview={preview}
        append={append}
        remove={remove}
        onProductSearch={(value) => void loadProductsWithFallback(value)}
        onProductSelect={(index, option) => void handleProductSelect(index, option)}
        getLookupValue={(index) => {
          const item = values.items[index];
          if (!item?.productId) {
            return null;
          }

          const product = productDetails[item.productId];
          if (!product) {
            const fallback = productLookup.find((option) => option.id === item.productId);
            return fallback ?? null;
          }

          return {
            id: product.id,
            label: product.name,
            description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
            meta: product.unit.symbol,
          };
        }}
          />

          <Card>
            <CardHeader title="Payment" />
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Input type="number" min="0" step="0.01" label="Paid Amount" {...form.register("paidAmount")} error={form.formState.errors.paidAmount?.message} />
              <Select label="Payment Mode" required={hasDirectPayment} {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
                <option value="">Select payment mode</option>
                {PURCHASE_PAYMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Reference"
                placeholder="Enter reference (optional)"
                {...form.register("paymentReference")}
                error={form.formState.errors.paymentReference?.message}
              />
              {hasDirectPayment && isBankPaymentMode(currentPaymentMode) ? (
                <Select label="Bank Account" required={hasDirectPayment} {...form.register("bankAccountId")} error={form.formState.errors.bankAccountId?.message}>
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {bankAccount.bankName} · {bankAccount.accountNumber.slice(-4)}
                    </option>
                  ))}
                </Select>
              ) : null}
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Advance Adjustment</p>
                    <p className="text-xs text-slate-600">Available advance: {availableAdvanceAmount.toFixed(2)}</p>
                  </div>
                  <Checkbox
                    label="Use available advance"
                    checked={useAdvanceAmount}
                    disabled={availableAdvanceAmount <= 0}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setUseAdvanceAmount(checked);
                      setAdvanceError(null);
                      if (!checked) {
                        setAdvanceAdjustmentAmount(0);
                        return;
                      }

                      if (advanceAdjustmentAmount === 0) {
                        setAdvanceAdjustmentAmount(Number(Math.min(availableAdvanceAmount, Number(preview.grandTotal)).toFixed(2)));
                      }
                    }}
                  />
                </div>
                {useAdvanceAmount ? (
                  <div className="mt-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      label="Adjust Advance Amount"
                      value={advanceAdjustmentAmount}
                      onChange={(event) => {
                        setAdvanceAdjustmentAmount(Number(event.target.value || 0));
                        setAdvanceError(null);
                      }}
                      error={advanceError ?? undefined}
                    />
                  </div>
                ) : advanceError ? <p className="mt-3 text-sm text-rose-600">{advanceError}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <PurchaseTotalsPanel totals={preview} />
      </div>
      <SupplierFormDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        submitting={submittingSupplier}
        onSubmit={handleSupplierCreated}
      />
    </form>
  );
};

