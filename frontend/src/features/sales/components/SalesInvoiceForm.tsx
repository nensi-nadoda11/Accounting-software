import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type UseFormSetError } from "react-hook-form";
import { ArrowLeft, FileText, Plus, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { getErrorMessage } from "../../../lib/errors";
import { useAuth } from "../../../providers/useAuth";
import { useToast } from "../../../providers/useToast";
import { customersApi } from "../../../services/customersApi";
import { inventoryApi } from "../../../services/inventoryApi";
import { productsApi } from "../../../services/productsApi";
import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../../types/company";
import type { Customer, CustomerFormInput, CustomerListItem } from "../../../types/customer";
import type { Warehouse } from "../../../types/inventory";
import type { Product, ProductListItem, ProductLookupItem } from "../../../types/product";
import type { SalesFormInput, SalesInvoice, SalesPaymentMode } from "../../../types/sales";
import { CustomerFormDrawer } from "../../customers/components/CustomerFormDrawer";
import { applyFriendlyFieldErrors, createCustomerPayload } from "../../customers/customerUtils";
import type { CustomerFormValues } from "../../customers/customerSchemas";
import { SALES_PAYMENT_MODE_OPTIONS, SALES_PRICE_TAX_TYPE_OPTIONS } from "../salesOptions";
import { salesFormSchema, type SalesFormValues } from "../salesSchemas";
import {
  buildSalesFormDefaults,
  calculateSalesPreview,
  createSalesPayload,
  hydrateItemFromProduct,
  isBankPaymentMode,
  resolveInterState,
} from "../salesUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";
import { SalesItemsTable } from "./SalesItemsTable";
import { SalesTotalsPanel } from "./SalesTotalsPanel";

type BatchOption = {
  id: string;
  label: string;
  expiryDate: string | null;
  status: string;
  availableQuantity: string;
};

const PRODUCT_DIRECTORY_LIMIT = 100;
const CUSTOMER_DIRECTORY_LIMIT = 100;

const buildCustomerLookupOption = (customer: Pick<CustomerListItem, "id" | "name" | "customerCode" | "mobile">): LookupOption => ({
  id: customer.id,
  label: customer.name,
  description: customer.customerCode,
  meta: customer.mobile,
});

const doesCustomerMatch = (
  customer: Pick<CustomerListItem, "name" | "customerCode" | "mobile" | "businessName" | "email">,
  search: string,
) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [customer.name, customer.customerCode, customer.mobile, customer.businessName, customer.email]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
};

const buildProductLookupOptionFromListItem = (
  product: Pick<ProductListItem, "id" | "name" | "productCode" | "sku" | "barcode" | "salePrice" | "unit">,
): LookupOption => ({
  id: product.id,
  label: product.name,
  description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
  meta: product.unit.symbol ? `${product.salePrice} · ${product.unit.symbol}` : product.salePrice,
});

const buildProductLookupOptionFromLookupItem = (product: ProductLookupItem): LookupOption => ({
  id: product.id,
  label: product.name,
  description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
  meta: product.unit.symbol ? `${product.salePrice} · ${product.unit.symbol}` : product.salePrice,
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

export const SalesInvoiceForm = ({
  mode = "invoice",
  initialInvoice,
  warehouses,
  bankAccounts,
  companyProfile,
  invoiceSettings,
  submitting,
  onBack,
  onSubmit,
  onPrint,
}: {
  mode?: "invoice" | "pos";
  initialInvoice?: SalesInvoice | null;
  warehouses: Warehouse[];
  bankAccounts: CompanyBankAccount[];
  companyProfile: CompanyProfile | null;
  invoiceSettings: CompanyInvoiceSettings | null;
  submitting?: boolean;
  onBack: () => void;
  onSubmit: (
    values: SalesFormInput,
    setError: UseFormSetError<SalesFormValues>,
    mode: "draft" | "posted",
  ) => Promise<void>;
  onPrint?: (invoice: SalesInvoice) => void;
}) => {
  const auth = useAuth();
  const toast = useToast();
  const [submitMode, setSubmitMode] = useState<"draft" | "posted">("draft");
  const [customerLookup, setCustomerLookup] = useState<LookupOption[]>([]);
  const [customerDirectory, setCustomerDirectory] = useState<CustomerListItem[]>([]);
  const [customerDirectoryLoaded, setCustomerDirectoryLoaded] = useState(false);
  const [productLookup, setProductLookup] = useState<LookupOption[]>([]);
  const [productDirectory, setProductDirectory] = useState<ProductListItem[]>([]);
  const [productDirectoryLoaded, setProductDirectoryLoaded] = useState(false);
  const [productLookupMessage, setProductLookupMessage] = useState<string | null>(null);
  const [customerLookupValue, setCustomerLookupValue] = useState<LookupOption | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [batchOptions, setBatchOptions] = useState<Record<number, BatchOption[]>>({});
  const [loadingBatchIndex, setLoadingBatchIndex] = useState<number | null>(null);
  const customerLookupRequestRef = useRef(0);
  const productLookupRequestRef = useRef(0);
  const canCreateCustomer = auth.hasPermission("customer.create");

  const form = useForm<SalesFormValues, undefined, SalesFormInput>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      ...buildSalesFormDefaults(initialInvoice, invoiceSettings, mode === "pos" ? "pos" : "gst_invoice"),
      grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const values = form.watch() as SalesFormValues;
  const isWalkIn = form.watch("isWalkIn");
  const placeOfSupply = form.watch("placeOfSupply");
  const preview = calculateSalesPreview({
    items: values.items.map((item) => ({
      quantity: Number(item.quantity ?? 0),
      saleRate: Number(item.saleRate ?? 0),
      priceTaxType: item.priceTaxType ?? values.priceTaxType,
      discountPercent: Number(item.discountPercent ?? 0),
      discountAmount: Number(item.discountAmount ?? 0),
      gstRate: Number(item.gstRate ?? 0),
      cessRate: Number(item.cessRate ?? 0),
      isInterState: resolveInterState(companyProfile, customerDetail, (placeOfSupply as string | null | undefined) ?? null),
    })),
    invoiceDiscountTotal: Number(values.invoiceDiscountTotal ?? 0),
    deliveryCharges: Number(values.deliveryCharges ?? 0),
    packingCharges: Number(values.packingCharges ?? 0),
    otherCharges: Number(values.otherCharges ?? 0),
    paidAmount: Number(values.paidAmount ?? 0),
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
        const response = await customersApi.list({
          page: 1,
          limit: CUSTOMER_DIRECTORY_LIMIT,
          status: "active",
          sortBy: "name",
          sortOrder: "asc",
        });

        if (cancelled) {
          return;
        }

        setCustomerDirectory(response.data.items);
      } catch {
        if (cancelled) {
          return;
        }

        setCustomerDirectory([]);
      } finally {
        if (!cancelled) {
          setCustomerDirectoryLoaded(true);
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
      setCustomerLookupValue(null);
      setCustomerDetail(null);
      form.reset({
        ...buildSalesFormDefaults(null, invoiceSettings, mode === "pos" ? "pos" : "gst_invoice"),
        grandTotalPreview: 0,
      });
      return;
    }

    form.reset({
      ...buildSalesFormDefaults(initialInvoice, invoiceSettings, mode === "pos" ? "pos" : "gst_invoice"),
      grandTotalPreview: Number(initialInvoice.grandTotal),
    });
    setCustomerLookupValue(
      initialInvoice.customer
        ? {
            id: initialInvoice.customer.id,
            label: initialInvoice.customer.name,
            description: initialInvoice.customer.customerCode,
            meta: initialInvoice.customer.mobile,
          }
        : null,
    );
    void (async () => {
      try {
        const [customerResponse, productResponses] = await Promise.all([
          initialInvoice.customer ? customersApi.get(initialInvoice.customer.id) : Promise.resolve(null),
          Promise.all((initialInvoice.items ?? []).map((item) => productsApi.get(item.productId))),
        ]);
        if (customerResponse) {
          setCustomerDetail(customerResponse.data.customer);
        }
        setProductDetails(
          productResponses.reduce<Record<string, Product>>((accumulator, response) => {
            accumulator[response.data.product.id] = response.data.product;
            return accumulator;
          }, {}),
        );
      } catch {
        // Snapshot data keeps the form usable even if lookups fail.
      }
    })();
  }, [form, initialInvoice, invoiceSettings, mode]);

  useEffect(() => {
    const headerWarehouseId = form.getValues("warehouseId");
    values.items.forEach((item, index) => {
      if (item.productType === "goods" && !item.warehouseId && headerWarehouseId) {
        form.setValue(`items.${index}.warehouseId`, headerWarehouseId, { shouldDirty: false });
      }
    });
  }, [form, values.items, values.warehouseId]);

  const loadCustomers = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    const requestId = customerLookupRequestRef.current + 1;
    customerLookupRequestRef.current = requestId;

    const cachedMatches = customerDirectory
      .filter((customer) => doesCustomerMatch(customer, normalizedSearch))
      .slice(0, 20)
      .map(buildCustomerLookupOption);

    setCustomerLookup(cachedMatches);

    if (!normalizedSearch || (customerDirectoryLoaded && (cachedMatches.length > 0 || customerDirectory.length < CUSTOMER_DIRECTORY_LIMIT))) {
      setCustomerLoading(false);
      return;
    }

    try {
      setCustomerLoading(true);
      const response = await customersApi.list({
        page: 1,
        limit: 20,
        search: normalizedSearch,
        status: "active",
      });
      if (customerLookupRequestRef.current !== requestId) {
        return;
      }

      setCustomerDirectory((current) => {
        const next = new Map(current.map((customer) => [customer.id, customer]));
        response.data.items.forEach((customer) => {
          next.set(customer.id, customer);
        });
        return Array.from(next.values());
      });

      const merged = new Map<string, LookupOption>();
      [...cachedMatches, ...response.data.items.map(buildCustomerLookupOption)].forEach((option) => {
        merged.set(option.id, option);
      });
      setCustomerLookup(Array.from(merged.values()));
    } finally {
      if (customerLookupRequestRef.current === requestId) {
        setCustomerLoading(false);
      }
    }
  }, [customerDirectory, customerDirectoryLoaded]);

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

  const loadProducts = async (search: string) => {
    try {
      setProductLookupLoading(true);
      const response = await productsApi.lookup(search, 20);
      setProductLookup(
        response.data.map((product) => ({
          id: product.id,
          label: product.name,
          description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
          meta: product.unit.symbol ? `${product.salePrice} · ${product.unit.symbol}` : product.salePrice,
        })),
      );
    } finally {
      setProductLookupLoading(false);
    }
  };

  void loadProducts;

  const loadBatches = async (index: number, productId?: string, warehouseId?: string | null) => {
    const resolvedProductId = (productId ?? (form.getValues(`items.${index}.productId`) as string | undefined)) ?? "";
    const resolvedWarehouseId =
      (warehouseId ?? (form.getValues(`items.${index}.warehouseId`) as string | null | undefined) ?? (form.getValues("warehouseId") as string | undefined)) ?? "";
    if (!resolvedProductId || !resolvedWarehouseId) {
      return;
    }

    try {
      setLoadingBatchIndex(index);
      const response = await inventoryApi.listBatches({
        page: 1,
        limit: 50,
        productId: resolvedProductId,
        warehouseId: resolvedWarehouseId,
      });
      setBatchOptions((current) => ({
        ...current,
        [index]: response.data.items.map((batch) => ({
          id: batch.id,
          label: batch.expiryDate ? `${batch.batchNumber} · ${batch.availableQuantity} · ${batch.expiryDate.slice(0, 10)}` : `${batch.batchNumber} · ${batch.availableQuantity}`,
          expiryDate: batch.expiryDate,
          status: batch.status,
          availableQuantity: batch.availableQuantity,
        })),
      }));
    } catch {
      setBatchOptions((current) => ({ ...current, [index]: [] }));
    } finally {
      setLoadingBatchIndex(null);
    }
  };

  const handleCustomerSelect = async (option: LookupOption) => {
    setCustomerLookupValue(option);
    form.setValue("customerId", option.id, { shouldDirty: true, shouldValidate: true });
    form.setValue("isWalkIn", false, { shouldDirty: true, shouldValidate: true });

    try {
      const response = await customersApi.get(option.id);
      setCustomerDetail(response.data.customer);
      if (!form.getValues("placeOfSupply")) {
        form.setValue(
          "placeOfSupply",
          (response.data.customer.shippingState ?? response.data.customer.billingState ?? companyProfile?.state ?? null) as string | null,
          {
            shouldDirty: true,
          },
        );
      }
    } catch {
      setCustomerDetail(null);
    }
  };

  const handleProductSelect = async (index: number, option: LookupOption) => {
    try {
      const cached = productDetails[option.id];
      const product = cached ?? (await productsApi.get(option.id)).data.product;

      setProductDetails((current) => ({ ...current, [product.id]: product }));
      const nextItem = hydrateItemFromProduct(product, form.getValues("warehouseId") || null);

      form.setValue(`items.${index}.productId`, product.id, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.warehouseId`, nextItem.warehouseId, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.batchId`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.quantity`, nextItem.quantity, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.saleRate`, nextItem.saleRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.mrp`, nextItem.mrp, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.priceTaxType`, nextItem.priceTaxType, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountPercent`, nextItem.discountPercent, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountAmount`, nextItem.discountAmount, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.gstRate`, nextItem.gstRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.cessRate`, nextItem.cessRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.remarks`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.productType`, nextItem.productType, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.decimalAllowed`, nextItem.decimalAllowed, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.batchTrackingEnabled`, nextItem.batchTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.expiryTrackingEnabled`, nextItem.expiryTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.minimumSalePrice`, nextItem.minimumSalePrice, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.batchStatus`, null, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.batchExpiryDate`, null, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.availableQuantity`, undefined, { shouldDirty: false, shouldValidate: true });

      if (nextItem.batchTrackingEnabled && nextItem.warehouseId) {
        await loadBatches(index, product.id, nextItem.warehouseId);
      }
    } catch {
      // Validation and submit feedback still protect the flow.
    }
  };

  const handleBatchSelect = (index: number, batchId: string | null) => {
    form.setValue(`items.${index}.batchId`, batchId, { shouldDirty: true, shouldValidate: true });
    const selected = (batchOptions[index] ?? []).find((entry) => entry.id === batchId);
    form.setValue(`items.${index}.batchStatus`, selected?.status ?? null, { shouldDirty: false, shouldValidate: true });
    form.setValue(`items.${index}.batchExpiryDate`, selected?.expiryDate ?? null, { shouldDirty: false, shouldValidate: true });
    form.setValue(`items.${index}.availableQuantity`, selected ? Number(selected.availableQuantity) : undefined, {
      shouldDirty: false,
      shouldValidate: true,
    });
  };

  const currentPaymentMode = (form.watch("paymentMode") as SalesPaymentMode | null | undefined) ?? null;
  const handleCustomerCreated = async (values: CustomerFormInput, setError: UseFormSetError<CustomerFormValues>) => {
    try {
      setSubmittingCustomer(true);
      const response = await customersApi.create(createCustomerPayload(values));
      const customer = response.data.customer;
      const lookupOption: LookupOption = {
        id: customer.id,
        label: customer.name,
        description: customer.customerCode,
        meta: customer.mobile,
      };

      setCustomerLookup((current) => [lookupOption, ...current.filter((option) => option.id !== customer.id)]);
      setCustomerLookupValue(lookupOption);
      setCustomerDetail(customer);
      form.setValue("customerId", customer.id, { shouldDirty: true, shouldValidate: true });
      form.setValue("isWalkIn", false, { shouldDirty: true, shouldValidate: true });

      if (!form.getValues("placeOfSupply")) {
        form.setValue(
          "placeOfSupply",
          (customer.shippingState ?? customer.billingState ?? companyProfile?.state ?? null) as string | null,
          { shouldDirty: true },
        );
      }

      setCustomerDrawerOpen(false);
      toast.success("Customer created");
    } catch (error) {
      applyFriendlyFieldErrors(error, setError);
      toast.error(getErrorMessage(error, "Failed to save customer"));
    } finally {
      setSubmittingCustomer(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          {mode === "invoice" ? (
            <Button type="button" variant="secondary" onClick={onBack}>
              <ArrowLeft className="mr-2 size-4" />
              Back to List
            </Button>
          ) : null}
          <h1 className="text-xl font-semibold text-slate-900">
            {mode === "pos" ? "POS Billing" : initialInvoice ? "Edit Sales Draft" : "New Sales Invoice"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialInvoice && onPrint ? (
            <Button type="button" variant="secondary" onClick={() => onPrint(initialInvoice)}>
              <FileText className="mr-2 size-4" />
              PDF / Print
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              form.reset({
                ...buildSalesFormDefaults(initialInvoice, invoiceSettings, mode === "pos" ? "pos" : "gst_invoice"),
                grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
              })
            }
          >
            Reset
          </Button>
          {mode === "invoice" ? (
            <Button
              type="button"
              variant="secondary"
              loading={submitting && submitMode === "draft"}
              onClick={form.handleSubmit(async (output) => {
                setSubmitMode("draft");
                try {
                  await onSubmit(createSalesPayload({ ...output, invoiceStatus: "draft" }), form.setError, "draft");
                } catch (error) {
                  applyFriendlyFieldErrors(error, form.setError);
                }
              })}
            >
              <Save className="mr-2 size-4" />
              Save Draft
            </Button>
          ) : null}
          <Button
            type="button"
            loading={submitting && submitMode === "posted"}
            onClick={form.handleSubmit(async (output) => {
              setSubmitMode("posted");
              try {
                await onSubmit(createSalesPayload({ ...output, invoiceStatus: "posted" }), form.setError, "posted");
              } catch (error) {
                applyFriendlyFieldErrors(error, form.setError);
              }
            })}
          >
            <Save className="mr-2 size-4" />
            {mode === "pos" ? "Save & Print" : "Save & Post"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title={mode === "pos" ? "Quick Entry" : "Header"} />
        <CardContent className={`grid gap-4 ${mode === "pos" ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4"}`}>
          {mode === "invoice" || !isWalkIn ? (
            <div className="flex flex-col gap-2">
              <AsyncLookupSelect
                label="Customer"
                value={customerLookupValue}
                loading={customerLoading}
                options={customerLookup}
                placeholder="Search customer"
                error={form.formState.errors.customerId?.message}
                onSearch={(value) => void loadCustomers(value)}
                onSelect={(option) => void handleCustomerSelect(option)}
                onClear={() => {
                  setCustomerLookupValue(null);
                  setCustomerDetail(null);
                  form.setValue("customerId", null, { shouldDirty: true, shouldValidate: true });
                }}
              />
              {canCreateCustomer ? (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-emerald-700 hover:bg-transparent hover:text-emerald-800"
                    onClick={() => setCustomerDrawerOpen(true)}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Customer
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={mode === "pos" ? "xl:col-span-2" : undefined}>
            <ToggleSwitch
              label="Walk-in Sale"
              checked={Boolean(isWalkIn)}
              onCheckedChange={(checked) => {
                form.setValue("isWalkIn", checked, { shouldDirty: true, shouldValidate: true });
                if (checked) {
                  form.setValue("customerId", null, { shouldDirty: true, shouldValidate: true });
                  setCustomerLookupValue(null);
                }
              }}
            />
          </div>
          {isWalkIn ? (
            <>
              <Input label="Walk-in Name" {...form.register("walkInName")} error={form.formState.errors.walkInName?.message} />
              <Input label="Walk-in Mobile" {...form.register("walkInMobile")} error={form.formState.errors.walkInMobile?.message} />
            </>
          ) : null}
          <Input type="date" label="Invoice Date" {...form.register("invoiceDate")} error={form.formState.errors.invoiceDate?.message} />
          {mode === "invoice" ? (
            <Input type="date" label="Due Date" {...form.register("dueDate")} error={form.formState.errors.dueDate?.message} />
          ) : null}
          <Input label="Place of Supply" {...form.register("placeOfSupply")} error={form.formState.errors.placeOfSupply?.message} />
          <SearchableSelect
            label="Warehouse"
            value={(form.watch("warehouseId") as string | null | undefined) ?? ""}
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name, description: warehouse.warehouseCode ?? null }))}
            placeholder="Select Warehouse"
            searchPlaceholder="Search warehouse"
            error={form.formState.errors.warehouseId?.message}
            onChange={(value) => form.setValue("warehouseId", value, { shouldDirty: true, shouldValidate: true })}
          />
          <Select label="Price Tax Type" {...form.register("priceTaxType")} error={form.formState.errors.priceTaxType?.message}>
            {SALES_PRICE_TAX_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {mode === "invoice" ? (
            <>
              <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
              <Textarea label="Terms" rows={3} {...form.register("termsConditions")} error={form.formState.errors.termsConditions?.message} />
            </>
          ) : null}
        </CardContent>
      </Card>

      <SalesItemsTable
        form={form}
        fields={fields}
        warehouses={warehouses}
        productLookupOptions={productLookup}
        productLookupLoading={productLookupLoading}
        productLookupNoResultsLabel={productLookupMessage ?? "No matching active products found"}
        batchOptions={batchOptions}
        loadingBatchIndex={loadingBatchIndex}
        preview={preview}
        compact={mode === "pos"}
        append={append}
        remove={remove}
        onProductSearch={(value) => void loadProductsWithFallback(value)}
        onProductSelect={(index, option) => void handleProductSelect(index, option)}
        onBatchLoad={(index) => void loadBatches(index)}
        onBatchSelect={handleBatchSelect}
        getLookupValue={(index) => {
          const item = values.items[index];
          if (!item?.productId) {
            return null;
          }

          const product = productDetails[item.productId];
          if (!product) {
            return productLookup.find((option) => option.id === item.productId) ?? null;
          }

          return {
            id: product.id,
            label: product.name,
            description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
            meta: product.unit.symbol,
          };
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Payment" />
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input type="number" min="0" step="0.01" label="Paid Amount" {...form.register("paidAmount")} error={form.formState.errors.paidAmount?.message} />
              <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
                <option value="">Select Payment Mode</option>
                {SALES_PAYMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {isBankPaymentMode(currentPaymentMode) ? (
                <Select label="Bank Account" {...form.register("bankAccountId")} error={form.formState.errors.bankAccountId?.message}>
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {bankAccount.bankName} · {bankAccount.accountNumber.slice(-4)}
                    </option>
                  ))}
                </Select>
              ) : (
                <div />
              )}
              <Input label="Payment Reference" {...form.register("paymentReference")} error={form.formState.errors.paymentReference?.message} />
            </CardContent>
          </Card>
        </div>

        <SalesTotalsPanel totals={preview} sticky={mode !== "pos"} />
      </div>
      <CustomerFormDrawer
        open={customerDrawerOpen}
        onClose={() => setCustomerDrawerOpen(false)}
        submitting={submittingCustomer}
        onSubmit={handleCustomerCreated}
      />
    </form>
  );
};

