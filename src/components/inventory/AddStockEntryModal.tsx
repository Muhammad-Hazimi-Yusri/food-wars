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
import { Plus } from "lucide-react";
import { Product, Location } from "@/types/database";

export function AddStockEntryModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master data
  const [products, setProducts] = useState<Product[]>([]);
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
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.from("locations").select("*").order("sort_order"),
    ]);

    setProducts(productsRes.data ?? []);
    setLocations(locationsRes.data ?? []);
  };

  // When product selected, pre-fill location
  useEffect(() => {
    if (productId) {
      const product = products.find((p) => p.id === productId);
      if (product?.location_id) {
        setLocationId(product.location_id);
      }
      // Pre-fill expiry date if default_due_days is set
      if (product && product.default_due_days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + product.default_due_days);
        setBestBeforeDate(date.toISOString().split("T")[0]);
      }
    }
  }, [productId, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get household
      const { data: household } = await supabase
        .from("households")
        .select("id")
        .single();

      if (!household) {
        throw new Error("No household found");
      }

      const { error: insertError } = await supabase.from("stock_entries").insert({
        household_id: household.id,
        product_id: productId,
        amount: parseFloat(amount),
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

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-megumi hover:bg-megumi-light">
          <Plus className="h-4 w-4 mr-2" />
          Add Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
                <SelectTrigger>
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

            {/* Amount */}
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="amount"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="flex-1"
                />
                {selectedProduct && (
                  <span className="text-sm text-muted-foreground">
                    {selectedProduct.qu_id_stock ? "units" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
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
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !productId}>
                {loading ? "Adding..." : "Add Stock"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}