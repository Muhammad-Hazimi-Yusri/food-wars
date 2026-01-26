"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { Product, Location, QuantityUnit } from "@/types/database";

type ProductWithUnits = Product & {
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

export function AddStockEntryModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master data
  const [products, setProducts] = useState<ProductWithUnits[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Form state
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("1");
  const [locationId, setLocationId] = useState("");
  const [bestBeforeDate, setBestBeforeDate] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  // Load master data when modal opens
  useEffect(() => {
    if (open) {
      loadMasterData();
    }
  }, [open]);

  const loadMasterData = async () => {
    const supabase = createClient();

    const [productsRes, locationsRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
          *,
          qu_stock:quantity_units!products_qu_id_stock_fkey(*),
          qu_purchase:quantity_units!products_qu_id_purchase_fkey(*)
        `)
        .eq("active", true)
        .order("name"),
      supabase.from("locations").select("*").eq("active", true).order("sort_order"),
    ]);

    setProducts(productsRes.data ?? []);
    setLocations(locationsRes.data ?? []);
  };

  // When product selected, pre-fill location and expiry
  useEffect(() => {
    if (productId) {
      const product = products.find((p) => p.id === productId);
      if (product?.location_id) {
        setLocationId(product.location_id);
      }
      if (product && product.default_due_days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + product.default_due_days);
        setBestBeforeDate(date.toISOString().split("T")[0]);
      } else if (product && product.default_due_days === -1) {
        // Never expires
        setBestBeforeDate("");
      }
    }
  }, [productId, products]);

  const selectedProduct = products.find((p) => p.id === productId);
  
  // Determine if we're using purchase units
  const hasPurchaseConversion = selectedProduct && 
    selectedProduct.qu_id_purchase && 
    selectedProduct.qu_id_purchase !== selectedProduct.qu_id_stock &&
    selectedProduct.qu_factor_purchase_to_stock > 1;

  const purchaseUnitName = selectedProduct?.qu_purchase?.name ?? "unit";
  const stockUnitName = selectedProduct?.qu_stock?.name ?? "unit";
  const stockUnitNamePlural = selectedProduct?.qu_stock?.name_plural ?? stockUnitName + "s";
  const factor = selectedProduct?.qu_factor_purchase_to_stock ?? 1;

  // Calculate what will be stored
  const purchaseAmount = parseFloat(amount) || 0;
  const stockAmount = purchaseAmount * factor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: household } = await supabase
        .from("households")
        .select("id")
        .single();

      if (!household) {
        throw new Error("No household found");
      }

      // Store the converted stock amount (pieces), not purchase amount (packs)
      const { error: insertError } = await supabase.from("stock_entries").insert({
        household_id: household.id,
        product_id: productId,
        amount: stockAmount, // Converted to stock units
        location_id: locationId || null,
        best_before_date: bestBeforeDate || null,
        price: price ? parseFloat(price) : null,
        note: note || null,
        purchased_date: new Date().toISOString().split("T")[0],
      });

      if (insertError) throw insertError;

      // Reset form
      setProductId("");
      setAmount("1");
      setLocationId("");
      setBestBeforeDate("");
      setPrice("");
      setNote("");
      setOpen(false);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stock");
    } finally {
      setLoading(false);
    }
  };

  const adjustAmount = (delta: number) => {
    const current = parseFloat(amount) || 0;
    const newAmount = Math.max(0.1, current + delta);
    setAmount(newAmount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center gap-2 bg-megumi text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-megumi/90 transition-colors font-medium">
          <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
          <span>Add Stock</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Product */}
            <div>
              <Label htmlFor="product">Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount with +/- buttons */}
            <div>
              <Label htmlFor="amount">
                Amount {hasPurchaseConversion ? `(${purchaseUnitName}s)` : ""}*
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={() => adjustAmount(-1)}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Input
                  id="amount"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="h-12 text-center text-lg font-medium"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={() => adjustAmount(1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              {/* Show conversion info */}
              {hasPurchaseConversion && stockAmount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  = {stockAmount} {stockAmount === 1 ? stockUnitName : stockUnitNamePlural} in stock
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} {location.is_freezer && "❄️"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Best Before Date */}
            <div>
              <Label htmlFor="bestBefore">Best Before Date</Label>
              <Input
                id="bestBefore"
                type="date"
                value={bestBeforeDate}
                onChange={(e) => setBestBeforeDate(e.target.value)}
                className="h-12"
              />
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="price">Price (optional)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-12"
              />
            </div>

            {/* Note */}
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Buy 1 get 1 free"
                className="h-12"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button 
                type="submit" 
                disabled={loading || !productId}
                className="flex-1 h-12"
              >
                {loading ? "Adding..." : "Add Stock"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="h-12"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}