"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Location,
  ShoppingLocation,
  ProductGroup,
  QuantityUnit,
} from "@/types/database";

type ProductFormProps = {
  locations: Location[];
  shoppingLocations: ShoppingLocation[];
  productGroups: ProductGroup[];
  quantityUnits: QuantityUnit[];
};

export function ProductForm({
  locations,
  shoppingLocations,
  productGroups,
  quantityUnits,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Basic
    name: "",
    description: "",
    product_group_id: "",
    // Locations
    location_id: "",
    shopping_location_id: "",
    // Quantity Units
    qu_id_stock: "",
    qu_id_purchase: "",
    qu_factor_purchase_to_stock: 1,
    // Stock Settings
    min_stock_amount: 0,
    quick_consume_amount: 1,
    quick_open_amount: 1,
    // Due Dates
    due_type: 1 as 1 | 2,
    default_due_days: 0,
    default_due_days_after_open: 0,
    default_due_days_after_freezing: 0,
    default_due_days_after_thawing: 0,
    // Additional
    calories: "",
    treat_opened_as_out_of_stock: false,
    should_not_be_frozen: false,
  });

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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

      const { error: insertError } = await supabase.from("products").insert({
        household_id: household.id,
        name: formData.name,
        description: formData.description || null,
        product_group_id: formData.product_group_id || null,
        location_id: formData.location_id || null,
        shopping_location_id: formData.shopping_location_id || null,
        qu_id_stock: formData.qu_id_stock || null,
        qu_id_purchase: formData.qu_id_purchase || null,
        qu_factor_purchase_to_stock: formData.qu_factor_purchase_to_stock,
        min_stock_amount: formData.min_stock_amount,
        quick_consume_amount: formData.quick_consume_amount,
        quick_open_amount: formData.quick_open_amount,
        due_type: formData.due_type,
        default_due_days: formData.default_due_days,
        default_due_days_after_open: formData.default_due_days_after_open,
        default_due_days_after_freezing: formData.default_due_days_after_freezing,
        default_due_days_after_thawing: formData.default_due_days_after_thawing,
        calories: formData.calories ? parseInt(formData.calories) : null,
        treat_opened_as_out_of_stock: formData.treat_opened_as_out_of_stock,
        should_not_be_frozen: formData.should_not_be_frozen,
      });

      if (insertError) throw insertError;

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
        </TabsList>

        {/* Basic Tab */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              placeholder="e.g., Milk, Eggs, Bread"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <div>
            <Label htmlFor="product_group">Product Group</Label>
            <Select
              value={formData.product_group_id}
              onValueChange={(v) => updateField("product_group_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent position="popper">
                {productGroups.map((pg) => (
                  <SelectItem key={pg.id} value={pg.id}>
                    {pg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="calories">Calories (per stock unit)</Label>
            <Input
              id="calories"
              type="number"
              value={formData.calories}
              onChange={(e) => updateField("calories", e.target.value)}
              placeholder="e.g., 150"
            />
          </div>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="location">Default Storage Location</Label>
            <Select
              value={formData.location_id}
              onValueChange={(v) => updateField("location_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Where is this stored?" />
              </SelectTrigger>
              <SelectContent position="popper">
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} {loc.is_freezer && "❄️"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="shopping_location">Default Store</Label>
            <Select
              value={formData.shopping_location_id}
              onValueChange={(v) => updateField("shopping_location_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Where do you buy this?" />
              </SelectTrigger>
              <SelectContent position="popper">
                {shoppingLocations.map((sl) => (
                  <SelectItem key={sl.id} value={sl.id}>
                    {sl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {shoppingLocations.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                No stores added yet
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="should_not_be_frozen"
              checked={formData.should_not_be_frozen}
              onChange={(e) =>
                updateField("should_not_be_frozen", e.target.checked)
              }
              className="h-4 w-4"
            />
            <Label htmlFor="should_not_be_frozen" className="font-normal">
              Warn if moved to freezer
            </Label>
          </div>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="qu_stock">Stock Quantity Unit *</Label>
            <Select
              value={formData.qu_id_stock}
              onValueChange={(v) => updateField("qu_id_stock", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="How do you count this?" />
              </SelectTrigger>
              <SelectContent position="popper">
                {quantityUnits.map((qu) => (
                  <SelectItem key={qu.id} value={qu.id}>
                    {qu.name} {qu.name_plural && `(${qu.name_plural})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Cannot be changed after first stock entry
            </p>
          </div>

          <div>
            <Label htmlFor="qu_purchase">Purchase Quantity Unit</Label>
            <Select
              value={formData.qu_id_purchase}
              onValueChange={(v) => updateField("qu_id_purchase", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Same as stock unit" />
              </SelectTrigger>
              <SelectContent position="popper">
                {quantityUnits.map((qu) => (
                  <SelectItem key={qu.id} value={qu.id}>
                    {qu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="qu_factor">Purchase to Stock Factor</Label>
            <Input
              id="qu_factor"
              type="number"
              step="0.01"
              value={formData.qu_factor_purchase_to_stock}
              onChange={(e) =>
                updateField(
                  "qu_factor_purchase_to_stock",
                  parseFloat(e.target.value) || 1
                )
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              e.g., 1 pack = 6 pieces → factor is 6
            </p>
          </div>
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="min_stock">Minimum Stock Amount</Label>
            <Input
              id="min_stock"
              type="number"
              step="0.1"
              value={formData.min_stock_amount}
              onChange={(e) =>
                updateField("min_stock_amount", parseFloat(e.target.value) || 0)
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              Get warned when stock falls below this
            </p>
          </div>

          <div>
            <Label htmlFor="quick_consume">Quick Consume Amount</Label>
            <Input
              id="quick_consume"
              type="number"
              step="0.1"
              value={formData.quick_consume_amount}
              onChange={(e) =>
                updateField(
                  "quick_consume_amount",
                  parseFloat(e.target.value) || 1
                )
              }
            />
          </div>

          <div>
            <Label htmlFor="quick_open">Quick Open Amount</Label>
            <Input
              id="quick_open"
              type="number"
              step="0.1"
              value={formData.quick_open_amount}
              onChange={(e) =>
                updateField("quick_open_amount", parseFloat(e.target.value) || 1)
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="treat_opened_as_out_of_stock"
              checked={formData.treat_opened_as_out_of_stock}
              onChange={(e) =>
                updateField("treat_opened_as_out_of_stock", e.target.checked)
              }
              className="h-4 w-4"
            />
            <Label htmlFor="treat_opened_as_out_of_stock" className="font-normal">
              Treat opened as out of stock (for min stock calculation)
            </Label>
          </div>
        </TabsContent>

        {/* Expiry Tab */}
        <TabsContent value="expiry" className="space-y-4 mt-4">
          <div>
            <Label>Due Date Type</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="due_type"
                  checked={formData.due_type === 1}
                  onChange={() => updateField("due_type", 1)}
                  className="h-4 w-4"
                />
                <span>Best before (still safe after)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="due_type"
                  checked={formData.due_type === 2}
                  onChange={() => updateField("due_type", 2)}
                  className="h-4 w-4"
                />
                <span>Expiration (unsafe after)</span>
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="default_due_days">Default Due Days</Label>
            <Input
              id="default_due_days"
              type="number"
              value={formData.default_due_days}
              onChange={(e) =>
                updateField("default_due_days", parseInt(e.target.value) || 0)
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              Auto-fill expiry date. Use -1 for never expires.
            </p>
          </div>

          <div>
            <Label htmlFor="default_due_days_after_open">Days After Opening</Label>
            <Input
              id="default_due_days_after_open"
              type="number"
              value={formData.default_due_days_after_open}
              onChange={(e) =>
                updateField(
                  "default_due_days_after_open",
                  parseInt(e.target.value) || 0
                )
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              New expiry when opened. 0 = no change.
            </p>
          </div>

          <div>
            <Label htmlFor="default_due_days_after_freezing">
              Days After Freezing
            </Label>
            <Input
              id="default_due_days_after_freezing"
              type="number"
              value={formData.default_due_days_after_freezing}
              onChange={(e) =>
                updateField(
                  "default_due_days_after_freezing",
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>

          <div>
            <Label htmlFor="default_due_days_after_thawing">
              Days After Thawing
            </Label>
            <Input
              id="default_due_days_after_thawing"
              type="number"
              value={formData.default_due_days_after_thawing}
              onChange={(e) =>
                updateField(
                  "default_due_days_after_thawing",
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" disabled={loading || !formData.name}>
          {loading ? "Creating..." : "Create Product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}