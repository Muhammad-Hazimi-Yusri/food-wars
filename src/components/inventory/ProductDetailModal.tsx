"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ImageIcon,
  Pencil,
  Trash2,
  Utensils,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  X,
  RefreshCw,
  Loader2,
  BookOpen,
  Plus,
  BarChart2,
  TrendingDown,
  MapPin,
} from "lucide-react";
import {
  StockEntryWithProduct,
  ProductWithRelations,
  Location,
  ShoppingLocation,
  ProductNutrition,
  QuantityUnit,
} from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { consumeStock, undoConsume, undoDeleteEntry } from "@/lib/stock-actions";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EditStockEntryModal } from "./EditStockEntryModal";
import { TransferModal } from "./TransferModal";
import { AddStockEntryModal } from "./AddStockEntryModal";
import { NutritionLabel } from "./NutritionLabel";
import { NutriScoreBadge } from "./NutriScoreBadge";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { refetchProductFromOFF, applyOFFUpdates } from "@/lib/product-actions";
import type { OFFProduct } from "@/lib/openfoodfacts";
import {
  getProductPurchaseHistory, type ProductPurchaseHistory,
  getProductConsumptionStats, type ProductConsumptionStats,
} from "@/lib/analytics-actions";

type ProductDetailModalProps = {
  entries: StockEntryWithProduct[];
  product?: ProductWithRelations;
  open: boolean;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  fresh: "bg-green-100 text-green-700",
  due_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  overdue: "bg-gray-200 text-gray-700",
};

export function ProductDetailModal({
  entries,
  product: propProduct,
  open,
  onClose,
}: ProductDetailModalProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shoppingLocations, setShoppingLocations] = useState<ShoppingLocation[]>([]);
  const [quantityUnits, setQuantityUnits] = useState<QuantityUnit[]>([]);
  const [conversions, setConversions] = useState<
    { id: string; product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[]
  >([]);
  const [editingEntry, setEditingEntry] = useState<StockEntryWithProduct | null>(null);
  const [transferringEntry, setTransferringEntry] = useState<StockEntryWithProduct | null>(null);
  const [consumingEntry, setConsumingEntry] = useState<{ id: string; amount: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<ProductNutrition | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [offData, setOffData] = useState<OFFProduct | null>(null);
  const [refetchFlags, setRefetchFlags] = useState({
    updateImage: true,
    updateBrand: true,
    updateNutrition: true,
  });
  const [applying, setApplying] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<ProductPurchaseHistory | null>(null);
  const [consumptionStats, setConsumptionStats] = useState<ProductConsumptionStats | null>(null);
  const [priceView, setPriceView] = useState<"purchase" | "stock">("purchase");

  const product = propProduct ?? entries[0]?.product;

  useEffect(() => {
    if (product?.picture_file_name) {
      getProductPictureSignedUrl(product.picture_file_name).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [product?.picture_file_name]);

  useEffect(() => {
    if (!open) {
      setPurchaseHistory(null);
      setConsumptionStats(null);
      setPriceView("purchase");
      return;
    }
    const supabase = createClient();

    supabase.from("locations").select("*").eq("active", true).order("name")
      .then(({ data }) => { if (data) setLocations(data); });

    supabase.from("shopping_locations").select("*").eq("active", true).order("name")
      .then(({ data }) => { if (data) setShoppingLocations(data); });

    supabase.from("quantity_units").select("*").eq("active", true).order("name")
      .then(({ data }) => { if (data) setQuantityUnits(data); });

    supabase.from("quantity_unit_conversions").select("id, product_id, from_qu_id, to_qu_id, factor")
      .then(({ data }) => { if (data) setConversions(data); });

    if (product?.id) {
      supabase.from("product_nutrition").select("*").eq("product_id", product.id).maybeSingle()
        .then(({ data }) => { setNutrition(data); });

      getProductPurchaseHistory(product.id).then(setPurchaseHistory);
      getProductConsumptionStats(product.id).then(setConsumptionStats);
    }
  }, [open, product?.id]);

  // Per-location stock breakdown (only shown when stock spans 2+ locations)
  const byLocation = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {};
    for (const entry of entries) {
      const id = entry.location_id ?? "none";
      const name = entry.location?.name ?? "No location";
      if (!map[id]) map[id] = { name, amount: 0 };
      map[id].amount += entry.amount;
    }
    return Object.values(map);
  }, [entries]);

  // Single-product list for the inline Add Stock modal, pre-filling qu_purchase from fetched units
  const productForStockModal = useMemo(() => {
    if (!product) return [];
    return [{
      ...product,
      qu_stock: product.qu_stock ?? null,
      qu_purchase: quantityUnits.find((u) => u.id === product.qu_id_purchase) ?? null,
    }];
  }, [product, quantityUnits]);

  // Conversion factor: how many stock units = 1 purchase unit (null = no conversion / same unit)
  const purchaseFactor = useMemo(() => {
    if (!product) return null;
    const { qu_id_purchase, qu_id_stock } = product;
    if (!qu_id_purchase || !qu_id_stock || qu_id_purchase === qu_id_stock) return null;
    const specific = conversions.find(
      (c) => c.from_qu_id === qu_id_purchase && c.to_qu_id === qu_id_stock && c.product_id === product.id,
    );
    const global = conversions.find(
      (c) => c.from_qu_id === qu_id_purchase && c.to_qu_id === qu_id_stock && c.product_id === null,
    );
    return specific?.factor ?? global?.factor ?? null;
  }, [product, conversions]);

  const handleDeleteEntry = async (entry: StockEntryWithProduct) => {
    setDeleting(entry.id);
    try {
      const snapshot = {
        household_id: entry.household_id,
        product_id: entry.product_id,
        amount: entry.amount,
        best_before_date: entry.best_before_date,
        purchased_date: entry.purchased_date,
        price: entry.price,
        location_id: entry.location_id,
        shopping_location_id: entry.shopping_location_id,
        open: entry.open,
        opened_date: entry.opened_date,
        stock_id: entry.stock_id,
        note: entry.note,
      };
      const supabase = createClient();
      const { error } = await supabase.from("stock_entries").delete().eq("id", entry.id);
      if (error) throw error;
      const unitName = product?.qu_stock?.name ?? "unit";
      const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
      const unit = entry.amount === 1 ? unitName : unitNamePlural;
      onClose();
      router.refresh();
      toast(`Deleted ${entry.amount} ${unit} of ${product?.name}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoDeleteEntry(snapshot);
            if (undo.success) router.refresh();
            else toast.error(undo.error ?? "Failed to undo");
          },
        },
      });
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete entry");
    } finally {
      setDeleting(null);
    }
  };

  const handleConsumeEntry = async (entry: StockEntryWithProduct) => {
    const numAmount = parseFloat(consumingEntry?.amount ?? "");
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > entry.amount) {
      alert(`Enter a valid amount (1–${entry.amount})`);
      return;
    }
    setActionLoading(entry.id);
    const result = await consumeStock(entry.product_id, [entry], numAmount);
    setActionLoading(null);
    setConsumingEntry(null);
    if (result.success) {
      const unitName = product?.qu_stock?.name ?? "unit";
      const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
      const unit = numAmount === 1 ? unitName : unitNamePlural;
      onClose();
      router.refresh();
      toast(`Consumed ${numAmount} ${unit} of ${product?.name}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoConsume(result.correlationId!);
            if (undo.success) router.refresh();
            else toast.error(undo.error ?? "Failed to undo");
          },
        },
      });
    } else {
      alert(result.error ?? "Failed to consume");
    }
  };

  const handleSpoilEntry = async (entry: StockEntryWithProduct) => {
    const unitName = product?.qu_stock?.name ?? "unit";
    const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
    const unit = entry.amount === 1 ? unitName : unitNamePlural;
    setActionLoading(entry.id);
    const result = await consumeStock(entry.product_id, [entry], entry.amount, { spoiled: true });
    setActionLoading(null);
    if (result.success) {
      onClose();
      router.refresh();
      toast(`Marked ${entry.amount} ${unit} of ${product?.name} as spoiled`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoConsume(result.correlationId!);
            if (undo.success) router.refresh();
            else toast.error(undo.error ?? "Failed to undo");
          },
        },
      });
    } else {
      alert(result.error ?? "Failed to mark as spoiled");
    }
  };

  const handleRefetch = async () => {
    if (!product?.id) return;
    setRefetching(true);
    setOffData(null);
    const result = await refetchProductFromOFF(product.id);
    setRefetching(false);
    if (result.success && result.offData) {
      setOffData(result.offData);
      setRefetchFlags({
        updateImage: !!result.offData.imageUrl,
        updateBrand: !!result.offData.brands,
        updateNutrition: !!result.offData.nutriments,
      });
    } else {
      toast.error(result.error ?? "Failed to fetch from OFF");
    }
  };

  const handleApplyUpdates = async () => {
    if (!product?.id || !offData) return;
    setApplying(true);
    const result = await applyOFFUpdates(product.id, offData, refetchFlags);
    setApplying(false);
    if (result.success) {
      toast("Product updated from Open Food Facts");
      setOffData(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to apply updates");
    }
  };

  if (!open || !product) return null;

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const openedAmount = entries.filter((e) => e.open).reduce((sum, e) => sum + e.amount, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.price ?? 0) * e.amount, 0);
  const unitName = product.qu_stock?.name ?? "unit";
  const unitNamePlural = product.qu_stock?.name_plural ?? unitName + "s";

  // Price view: multiply raw stock-unit price by the purchase factor for "per purchase unit" display
  const purchaseUnitName = quantityUnits.find((u) => u.id === product.qu_id_purchase)?.name ?? unitName;
  const activeFactor = priceView === "purchase" && purchaseFactor !== null ? purchaseFactor : 1;
  const activeUnitName = priceView === "purchase" && purchaseFactor !== null ? purchaseUnitName : unitName;
  const displayRows = purchaseHistory?.rows.map((r) => ({
    ...r,
    price: r.price != null ? r.price * activeFactor : null,
  })) ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <span className="truncate">{product.name}</span>
              <NutriScoreBadge grade={nutrition?.nutrition_grade ?? null} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto shrink-0 text-gray-400 hover:text-megumi"
                onClick={handleRefetch}
                disabled={refetching}
                title="Refetch from Open Food Facts"
              >
                {refetching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Product hero: image + summary stats */}
          <div className="px-6 pb-3 shrink-0">
            <div className="flex gap-4">
              <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm content-center">
                <div className="flex justify-between col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Total stock</span>
                  <span className="font-medium">{totalAmount} {totalAmount === 1 ? unitName : unitNamePlural}</span>
                </div>
                {openedAmount > 0 && (
                  <div className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="text-gray-500">Opened</span>
                    <span>{openedAmount} {openedAmount === 1 ? unitName : unitNamePlural}</span>
                  </div>
                )}
                {totalValue > 0 && (
                  <div className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="text-gray-500">Stock value</span>
                    <span>£{totalValue.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Batches</span>
                  <span>{entries.length}</span>
                </div>
                {product.location_id && (
                  <div className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="text-gray-500">Default location</span>
                    <span>
                      {product.location?.name ??
                        locations.find((l) => l.id === product.location_id)?.name ??
                        "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Per-location breakdown pill row */}
            {byLocation.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {byLocation.map((loc) => (
                  <span
                    key={loc.name}
                    className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                  >
                    <MapPin className="h-3 w-3" />
                    {loc.name}: {loc.amount} {loc.amount === 1 ? unitName : unitNamePlural}
                  </span>
                ))}
              </div>
            )}

            {/* OFF refetch panel */}
            {offData && (
              <div className="mt-3 rounded-lg border border-megumi/30 bg-megumi/5 p-3 space-y-2">
                <p className="text-sm font-medium text-megumi">Data from Open Food Facts</p>
                <div className="space-y-1.5 text-sm">
                  {offData.imageUrl && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateImage}
                        onChange={(e) => setRefetchFlags((f) => ({ ...f, updateImage: e.target.checked }))}
                      />
                      <span>Update image</span>
                    </label>
                  )}
                  {offData.brands && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateBrand}
                        onChange={(e) => setRefetchFlags((f) => ({ ...f, updateBrand: e.target.checked }))}
                      />
                      <span>Brand: {product.brand ?? "—"} &rarr; {offData.brands}</span>
                    </label>
                  )}
                  {offData.nutriments && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateNutrition}
                        onChange={(e) => setRefetchFlags((f) => ({ ...f, updateNutrition: e.target.checked }))}
                      />
                      <span>Update nutrition data</span>
                    </label>
                  )}
                  {!offData.imageUrl && !offData.brands && !offData.nutriments && (
                    <p className="text-gray-500">No new data available from OFF.</p>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleApplyUpdates}
                    disabled={applying || (!refetchFlags.updateImage && !refetchFlags.updateBrand && !refetchFlags.updateNutrition)}
                  >
                    {applying && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOffData(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Tabs — flex-1 so they fill remaining height, min-h-0 to allow overflow */}
          <Tabs defaultValue="stock" className="flex-1 min-h-0 border-t">
            <TabsList className="mx-6 mt-3 mb-1 w-auto justify-start shrink-0">
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Stock tab */}
            <TabsContent value="stock" className="min-h-0 overflow-y-auto px-6 py-3 space-y-4">
              <NutritionLabel nutrition={nutrition} />

              <div>
                <h4 className="font-medium mb-2">Stock entries</h4>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const status = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
                    const expiryLabel = getExpiryLabel(entry.best_before_date, entry.product?.due_type ?? 1);
                    const storeName = shoppingLocations.find((s) => s.id === entry.shopping_location_id)?.name;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {entry.amount} {entry.amount === 1 ? unitName : unitNamePlural}
                            </span>
                            {entry.open && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                opened
                              </span>
                            )}
                            <span className={cn("text-xs px-2 py-0.5 rounded", STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600")}>
                              {expiryLabel}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                            {entry.location && <span>📍 {entry.location.name}</span>}
                            {storeName && <span>🏪 {storeName}</span>}
                            {entry.price && <span>£{entry.price.toFixed(2)}</span>}
                            {entry.note && <span>📝 {entry.note}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {consumingEntry?.id === entry.id ? (
                            <>
                              <Input
                                type="number"
                                step="any"
                                min="0.01"
                                max={entry.amount}
                                value={consumingEntry.amount}
                                onChange={(e) => setConsumingEntry({ id: entry.id, amount: e.target.value })}
                                className="h-8 w-16 text-xs"
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => handleConsumeEntry(entry)}
                                disabled={actionLoading === entry.id}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-gray-700"
                                onClick={() => setConsumingEntry(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-green-600"
                                onClick={() => setConsumingEntry({ id: entry.id, amount: String(entry.amount) })}
                                disabled={actionLoading === entry.id}
                                title="Consume"
                              >
                                <Utensils className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-amber-600"
                                onClick={() => handleSpoilEntry(entry)}
                                disabled={actionLoading === entry.id}
                                title="Mark as spoiled"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-indigo-600"
                                onClick={() => setTransferringEntry(entry)}
                                title="Transfer"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-blue-600"
                                onClick={() => setEditingEntry(entry)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-red-600"
                                onClick={() => handleDeleteEntry(entry)}
                                disabled={deleting === entry.id}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="min-h-0 overflow-y-auto px-6 py-3 space-y-4">
              {!purchaseHistory || purchaseHistory.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <BarChart2 className="h-10 w-10 text-gray-200" />
                  <div>
                    <p className="font-medium text-gray-500">No purchase history yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Purchase history will appear here after your next stock addition.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stat pills */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Last purchased</p>
                      <p className="text-sm font-medium">
                        {purchaseHistory.lastPurchasedAt
                          ? new Date(purchaseHistory.lastPurchasedAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Last price</p>
                      <p className="text-sm font-medium">
                        {purchaseHistory.lastPrice != null
                          ? `£${(purchaseHistory.lastPrice * activeFactor).toFixed(2)}`
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Avg price</p>
                      <p className="text-sm font-medium">
                        {purchaseHistory.avgPrice != null
                          ? `£${(purchaseHistory.avgPrice * activeFactor).toFixed(2)}`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Purchase log table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">Purchase log</h4>
                      {purchaseFactor !== null && (
                        <div className="flex rounded-full bg-gray-100 p-0.5 text-xs">
                          <button
                            className={cn("rounded-full px-2 py-0.5 transition-colors", priceView === "purchase" ? "bg-gray-900 text-white" : "text-gray-600")}
                            onClick={() => setPriceView("purchase")}
                          >
                            Per {purchaseUnitName}
                          </button>
                          <button
                            className={cn("rounded-full px-2 py-0.5 transition-colors", priceView === "stock" ? "bg-gray-900 text-white" : "text-gray-600")}
                            onClick={() => setPriceView("stock")}
                          >
                            Per {unitName}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">Date</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">Store</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-500">Amount</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-500">Price/{activeUnitName}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {displayRows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(row.purchasedAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{row.storeName ?? "—"}</td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {row.amount} {row.amount === 1 ? unitName : unitNamePlural}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {row.price != null ? `£${row.price.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Price history chart — collapsible, shown when 2+ priced rows */}
                  {purchaseHistory.rows.filter((r) => r.price != null).length >= 2 && (
                    <details open>
                      <summary className="text-sm font-medium cursor-pointer select-none">
                        Price over time
                      </summary>
                      <div className="mt-2">
                        <PriceHistoryChart rows={displayRows} unitName={activeUnitName} />
                      </div>
                    </details>
                  )}
                </>
              )}
            </TabsContent>

            {/* Analytics tab */}
            <TabsContent value="analytics" className="min-h-0 overflow-y-auto px-6 py-3 space-y-4">
              {!consumptionStats || consumptionStats.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <TrendingDown className="h-10 w-10 text-gray-200" />
                  <div>
                    <p className="font-medium text-gray-500">No consumption data yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Consumption analytics will appear as you use and consume this product.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stat pills */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Last consumed</p>
                      <p className="text-sm font-medium">
                        {consumptionStats.lastConsumedAt
                          ? new Date(consumptionStats.lastConsumedAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Spoil rate</p>
                      <p className={cn(
                        "text-sm font-medium",
                        consumptionStats.spoilRate != null && consumptionStats.spoilRate >= 30
                          ? "text-red-600"
                          : consumptionStats.spoilRate != null && consumptionStats.spoilRate >= 10
                          ? "text-amber-600"
                          : "text-green-600",
                      )}>
                        {consumptionStats.spoilRate != null ? `${consumptionStats.spoilRate}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Avg shelf life</p>
                      <p className="text-sm font-medium">
                        {consumptionStats.avgShelfLifeDays != null
                          ? `${consumptionStats.avgShelfLifeDays}d`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Consume history table */}
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Consumption log</h4>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">Date</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-500">Amount</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {consumptionStats.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(row.consumedAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {row.amount} {row.amount === 1 ? unitName : unitNamePlural}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.spoiled ? (
                                  <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                    spoiled
                                  </span>
                                ) : (
                                  <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    consumed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Quick links footer */}
          <div className="px-6 py-3 border-t bg-gray-50 shrink-0 flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link href="/journal">
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Journal
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingStock(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Stock
            </Button>
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <Link href={`/products/${product.id}/edit`}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit Product
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <EditStockEntryModal
        entry={editingEntry}
        locations={locations}
        shoppingLocations={shoppingLocations}
        quantityUnits={quantityUnits}
        conversions={conversions}
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => {
          setEditingEntry(null);
          onClose();
        }}
      />

      {/* Transfer Modal */}
      <TransferModal
        entries={transferringEntry ? [transferringEntry] : null}
        locations={locations}
        preSelectedEntryId={transferringEntry?.id}
        onClose={() => {
          setTransferringEntry(null);
          onClose();
        }}
      />

      {/* Add Stock Modal — pre-filled with this product */}
      <AddStockEntryModal
        products={productForStockModal}
        locations={locations}
        quantityUnits={quantityUnits}
        shoppingLocations={shoppingLocations}
        conversions={conversions}
        prefill={{ productId: product?.id }}
        externalOpen={addingStock}
        onExternalOpenChange={setAddingStock}
        onSuccess={() => {
          setAddingStock(false);
          onClose();
          router.refresh();
        }}
      />
    </>
  );
}
