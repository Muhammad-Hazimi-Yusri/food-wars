"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Product, Location, QuantityUnit, ShoppingLocation } from "@/types/database";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { parseDateShorthand } from "@/lib/date-shorthands";
import { useRecentProducts } from "@/hooks/useRecentProducts";

type ProductWithUnits = Product & {
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

type QuantityUnitConversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

type Prefill = {
  productId?: string;
  amount?: number;
  quId?: string;
  shoppingLocationId?: string;
  price?: number;
};

type Props = {
  products: ProductWithUnits[];
  locations: Location[];
  quantityUnits: QuantityUnit[];
  shoppingLocations: ShoppingLocation[];
  conversions: QuantityUnitConversion[];
  prefill?: Prefill | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function AddStockEntryModal({
  products = [],
  locations = [],
  quantityUnits = [],
  shoppingLocations = [],
  conversions = [],
  prefill,
  externalOpen,
  onExternalOpenChange,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (val: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(val);
    else setInternalOpen(val);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { recentIds, addRecent } = useRecentProducts();

  // Date shorthand state
  const [dateShorthand, setDateShorthand] = useState("");

  // Form state
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedQuId, setSelectedQuId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [bestBeforeDate, setBestBeforeDate] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"unit" | "total">("unit");
  const [note, setNote] = useState("");

  // Apply prefill when dialog opens with prefill data
  useEffect(() => {
    if (open && prefill) {
      if (prefill.productId) setProductId(prefill.productId);
      if (prefill.amount) setAmount(String(prefill.amount));
      if (prefill.quId) setSelectedQuId(prefill.quId);
      if (prefill.shoppingLocationId) setStoreId(prefill.shoppingLocationId);
      if (prefill.price) setPrice(String(prefill.price));
    }
  }, [open, prefill]);

  // Selected product
  const selectedProduct = products.find((p) => p.id === productId);

  // Available units for this product (stock unit + all units with conversions)
  const availableUnits = selectedProduct
    ? (() => {
        const units: QuantityUnit[] = [];
        
        // Always include stock unit first
        if (selectedProduct.qu_stock) {
          units.push(selectedProduct.qu_stock);
        }
        
        // Find all units that have conversions TO this product's stock unit
        const productConversions = conversions.filter(
          (c) => 
            (c.product_id === selectedProduct.id || c.product_id === null) &&
            c.to_qu_id === selectedProduct.qu_id_stock
        );
        
        // Add each unique conversion unit
        productConversions.forEach((conv) => {
          const unit = quantityUnits.find((u) => u.id === conv.from_qu_id);
          if (unit && !units.some((u) => u.id === unit.id)) {
            units.push(unit);
          }
        });
        
        return units;
      })()
    : [];

  // Get conversion factor from conversions table
  const getConversionFactor = () => {
    if (!selectedProduct || !selectedQuId) return 1;
    
    // If selected unit is the stock unit, no conversion needed
    if (selectedQuId === selectedProduct.qu_id_stock) return 1;
    
    // Look for product-specific conversion first
    const productConversion = conversions.find(
      (c) =>
        c.product_id === selectedProduct.id &&
        c.from_qu_id === selectedQuId &&
        c.to_qu_id === selectedProduct.qu_id_stock
    );
    if (productConversion) return productConversion.factor;

    // Look for global conversion (product_id is null)
    const globalConversion = conversions.find(
      (c) =>
        c.product_id === null &&
        c.from_qu_id === selectedQuId &&
        c.to_qu_id === selectedProduct.qu_id_stock
    );
    if (globalConversion) return globalConversion.factor;

    return 1;
  };

  const conversionFactor = getConversionFactor();
  const enteredAmount = parseFloat(amount) || 0;
  const stockAmount = enteredAmount * conversionFactor;
  const stockUnitName = selectedProduct?.qu_stock?.name ?? "unit";
  const stockUnitNamePlural = selectedProduct?.qu_stock?.name_plural ?? stockUnitName + "s";
  const selectedUnitName = quantityUnits.find((u) => u.id === selectedQuId)?.name ?? "unit";

  // Price per stock unit calculation
  const pricePerStockUnit = () => {
    const p = parseFloat(price) || 0;
    if (p === 0 || stockAmount === 0) return 0;
    if (priceType === "total") {
      return p / stockAmount;
    }
    return p / conversionFactor;
  };

  // Check if date is in the past
  const isDatePast = bestBeforeDate && new Date(bestBeforeDate) < new Date();

  // When product selected, pre-fill defaults
  useEffect(() => {
    if (productId && selectedProduct) {
      // Set default unit to purchase unit if available, else stock unit
      setSelectedQuId(selectedProduct.qu_id_purchase || selectedProduct.qu_id_stock || "");
      
      // Set default location
      if (selectedProduct.location_id) {
        setLocationId(selectedProduct.location_id);
      }

      // Set default store
      if (selectedProduct.shopping_location_id) {
        setStoreId(selectedProduct.shopping_location_id);
      }
      
      // Set default due date
      if (selectedProduct.default_due_days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + selectedProduct.default_due_days);
        setBestBeforeDate(date.toISOString().split("T")[0]);
        setNeverExpires(false);
      } else if (selectedProduct.default_due_days === -1) {
        setBestBeforeDate("");
        setNeverExpires(true);
      }
    }
  }, [productId, selectedProduct]);

  // Handle never expires toggle
  useEffect(() => {
    if (neverExpires) {
      setBestBeforeDate("");
    }
  }, [neverExpires]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProductId("");
      setAmount("");
      setSelectedQuId("");
      setLocationId("");
      setStoreId("");
      setBestBeforeDate("");
      setNeverExpires(false);
      setPrice("");
      setPriceType("unit");
      setNote("");
      setDateShorthand("");
      setError(null);
    }
  }, [open]);

  const adjustAmount = (delta: number) => {
    const current = parseFloat(amount) || 0;
    const newAmount = Math.max(0, current + delta);
    setAmount(newAmount.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !amount || !selectedQuId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const isGuest = user.is_anonymous === true;
      let householdId: string;

      if (isGuest) {
        householdId = GUEST_HOUSEHOLD_ID;
      } else {
        const { data: household } = await supabase
          .from("households")
          .select("id")
          .eq("owner_id", user.id)
          .single();
        if (!household) throw new Error("No household found");
        householdId = household.id;
      }

      // Calculate final price (store as price per stock unit)
      let finalPrice = null;
      if (price) {
        const p = parseFloat(price);
        if (priceType === "total") {
          finalPrice = p / stockAmount;
        } else {
          finalPrice = p / conversionFactor;
        }
      }

      const { error: insertError } = await supabase.from("stock_entries").insert({
        household_id: householdId,
        product_id: productId,
        amount: stockAmount,
        location_id: locationId || null,
        shopping_location_id: storeId && storeId !== "none" ? storeId : null,
        best_before_date: neverExpires ? "2999-12-31" : (bestBeforeDate || null),
        price: finalPrice,
        note: note || null,
        purchased_date: new Date().toISOString().split("T")[0],
      });

      if (insertError) throw insertError;

      addRecent(productId);
      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <button className="inline-flex items-center justify-center gap-2 bg-megumi text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-megumi/90 transition-colors font-medium">
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span>Add Stock</span>
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Stock Entry</DialogTitle>
        </DialogHeader>

        {products.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              No products yet. Create a product first.
            </p>
            <Button onClick={() => { setOpen(false); router.push("/products/new"); }}>
              Create Product
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form Section */}
            <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Product */}
              <div>
                <Label htmlFor="product">Product *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Recent products first */}
                    {recentIds.length > 0 && (() => {
                      const recentProducts = recentIds
                        .map((id) => products.find((p) => p.id === id))
                        .filter(Boolean) as typeof products;
                      if (recentProducts.length === 0) return null;
                      return (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-gray-400">Recent</div>
                          {recentProducts.map((product) => (
                            <SelectItem key={`recent-${product.id}`} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-medium text-gray-400 border-t mt-1 pt-1">All products</div>
                        </>
                      );
                    })()}
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount + Unit */}
              <div>
                <Label>Amount *</Label>
                <div className="flex gap-2">
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-r-none"
                      onClick={() => adjustAmount(-1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 w-24 rounded-none text-center"
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-l-none"
                      onClick={() => adjustAmount(1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={selectedQuId} onValueChange={setSelectedQuId}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Conversion info */}
                {conversionFactor !== 1 && enteredAmount > 0 && (
                  <p className="text-sm text-teal-600 mt-1">
                    This equals {stockAmount} {stockAmount === 1 ? stockUnitName : stockUnitNamePlural}
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <Label htmlFor="bestBefore">Due Date</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="bestBefore"
                    type="date"
                    value={bestBeforeDate}
                    onChange={(e) => setBestBeforeDate(e.target.value)}
                    disabled={neverExpires}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={neverExpires}
                      onChange={(e) => setNeverExpires(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Never expires
                  </label>
                </div>
                {isDatePast && !neverExpires && (
                  <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    The given date is earlier than today, are you sure?
                  </p>
                )}
                <Input
                  type="text"
                  value={dateShorthand}
                  onChange={(e) => setDateShorthand(e.target.value)}
                  onBlur={() => {
                    const parsed = parseDateShorthand(dateShorthand);
                    if (parsed) {
                      if (parsed === "2999-12-31") {
                        setNeverExpires(true);
                        setBestBeforeDate("");
                      } else {
                        setNeverExpires(false);
                        setBestBeforeDate(parsed);
                      }
                      setDateShorthand("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const parsed = parseDateShorthand(dateShorthand);
                      if (parsed) {
                        if (parsed === "2999-12-31") {
                          setNeverExpires(true);
                          setBestBeforeDate("");
                        } else {
                          setNeverExpires(false);
                          setBestBeforeDate(parsed);
                        }
                        setDateShorthand("");
                      }
                    }
                  }}
                  placeholder="Quick: +7, +1m, x"
                  disabled={neverExpires}
                  className="mt-1 text-sm"
                />
              </div>

              {/* Price */}
              <div>
                <Label htmlFor="price">Price</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="priceType"
                        checked={priceType === "unit"}
                        onChange={() => setPriceType("unit")}
                        className="h-4 w-4"
                      />
                      Per {selectedUnitName}
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="priceType"
                        checked={priceType === "total"}
                        onChange={() => setPriceType("total")}
                        className="h-4 w-4"
                      />
                      Total
                    </label>
                  </div>
                </div>
                {price && parseFloat(price) > 0 && conversionFactor !== 1 && (
                  <p className="text-sm text-gray-500 mt-1">
                    means £{pricePerStockUnit().toFixed(2)} per {stockUnitName}
                  </p>
                )}
              </div>

              {/* Store */}
              <div>
                <Label htmlFor="store">Store</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {shoppingLocations.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="location">Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Note */}
              <div>
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Buy 1 get 1 free"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={loading || !productId || !amount || !selectedQuId}
                  className="flex-1 bg-soma hover:bg-soma/90"
                >
                  {loading ? "Adding..." : "Add Stock"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>

            {/* Product Insight Panel */}
            <div className="lg:col-span-2">
              {selectedProduct ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Default location:</span>
                      <span>{locations.find(l => l.id === selectedProduct.location_id)?.name ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Default store:</span>
                      <span>{shoppingLocations.find(s => s.id === selectedProduct.shopping_location_id)?.name ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Stock unit:</span>
                      <span>{selectedProduct.qu_stock?.name ?? "—"}</span>
                    </div>
                    {conversionFactor !== 1 && (
                      <div className="flex justify-between text-teal-600">
                        <span>Conversion:</span>
                        <span>1 {selectedProduct.qu_purchase?.name} = {conversionFactor} {stockUnitNamePlural}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Min. stock:</span>
                      <span>{selectedProduct.min_stock_amount ?? 0}</span>
                    </div>
                  </div>

                  {/* Placeholder for future features */}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs text-gray-400 italic">
                      Stock amount, value, last purchased, last price, average price, price history coming in v0.6
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400">
                  Select a product to see details
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}