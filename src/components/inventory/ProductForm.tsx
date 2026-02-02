"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
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
import { ImageUpload } from "@/components/ui/image-upload";
import {
  uploadProductPicture,
  getProductPictureSignedUrl,
} from "@/lib/supabase/storage";
import {
  Location,
  ShoppingLocation,
  ProductGroup,
  QuantityUnit,
} from "@/types/database";
import { Info, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  picture_file_name: string | null;
  product_group_id: string | null;
  parent_product_id: string | null;
  location_id: string | null;
  default_consume_location_id: string | null;
  shopping_location_id: string | null;
  move_on_open: boolean;
  min_stock_amount: number;
  cumulate_min_stock_amount_of_sub_products: boolean;
  treat_opened_as_out_of_stock: boolean;
  due_type: number;
  default_due_days: number;
  default_due_days_after_open: number;
  default_due_days_after_freezing: number;
  default_due_days_after_thawing: number;
  should_not_be_frozen: boolean;
  qu_id_stock: string | null;
  qu_id_purchase: string | null;
  enable_tare_weight_handling: boolean;
  tare_weight: number;
  calories: number | null;
  quick_consume_amount: number;
  quick_open_amount: number;
  default_stock_label_type: number;
  auto_reprint_stock_label: boolean;
  not_check_stock_fulfillment_for_recipes: boolean;
  hide_on_stock_overview: boolean;
  no_own_stock: boolean;
};

type ProductFormProps = {
  product?: Product | null;
  products: { id: string; name: string }[];
  locations: Location[];
  shoppingLocations: ShoppingLocation[];
  productGroups: ProductGroup[];
  quantityUnits: QuantityUnit[];
  mode: "create" | "edit";
};

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1">
      <Info className="h-4 w-4 text-gray-400 cursor-help" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
        {text}
      </span>
    </span>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  step = 1,
  className,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex", className)}>
      <Input
        id={id}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="rounded-r-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border border-l-0 rounded-r-md bg-gray-50">
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="px-2 flex-1 hover:bg-gray-100 border-b text-gray-600 text-xs"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-2 flex-1 hover:bg-gray-100 text-gray-600 text-xs"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export function ProductForm({
  product,
  products,
  locations,
  shoppingLocations,
  productGroups,
  quantityUnits,
  mode,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState(() => ({
    // Basic
    name: product?.name ?? "",
    description: product?.description ?? "",
    active: product?.active ?? true,
    picture_file_name: product?.picture_file_name ?? null,
    product_group_id: product?.product_group_id ?? "",
    parent_product_id: product?.parent_product_id ?? "",
    // Locations
    location_id: product?.location_id ?? "",
    default_consume_location_id: product?.default_consume_location_id ?? "",
    shopping_location_id: product?.shopping_location_id ?? "",
    move_on_open: product?.move_on_open ?? false,
    // Stock
    min_stock_amount: product?.min_stock_amount ?? 0,
    cumulate_min_stock_amount_of_sub_products: product?.cumulate_min_stock_amount_of_sub_products ?? false,
    treat_opened_as_out_of_stock: product?.treat_opened_as_out_of_stock ?? true,
    // Due dates
    due_type: product?.due_type ?? 1,
    default_due_days: product?.default_due_days ?? 0,
    default_due_days_after_open: product?.default_due_days_after_open ?? 0,
    default_due_days_after_freezing: product?.default_due_days_after_freezing ?? 0,
    default_due_days_after_thawing: product?.default_due_days_after_thawing ?? 0,
    should_not_be_frozen: product?.should_not_be_frozen ?? false,
    // Units
    qu_id_stock: product?.qu_id_stock ?? "",
    qu_id_purchase: product?.qu_id_purchase ?? "",
    enable_tare_weight_handling: product?.enable_tare_weight_handling ?? false,
    tare_weight: product?.tare_weight ?? 0,
    // Misc
    calories: product?.calories?.toString() ?? "",
    quick_consume_amount: product?.quick_consume_amount ?? 1,
    quick_open_amount: product?.quick_open_amount ?? 1,
    default_stock_label_type: product?.default_stock_label_type ?? 0,
    auto_reprint_stock_label: product?.auto_reprint_stock_label ?? false,
    not_check_stock_fulfillment_for_recipes: product?.not_check_stock_fulfillment_for_recipes ?? false,
    hide_on_stock_overview: product?.hide_on_stock_overview ?? false,
    no_own_stock: product?.no_own_stock ?? false,
  }));

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent, returnToList = false) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.qu_id_stock) {
      setError("Stock quantity unit is required");
      return;
    }

    setLoading(true);
    setError(null);

    let productId = product?.id;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Determine household ID
      let householdId: string;
      
      // Check if anonymous user (guest mode)
      const isAnonymous = user.is_anonymous || user.app_metadata?.provider === "anonymous";
      
      if (isAnonymous) {
        // Use guest household ID
        householdId = GUEST_HOUSEHOLD_ID;
      } else {
        // Regular user - get household by owner_id
        const { data: household, error: householdError } = await supabase
          .from("households")
          .select("id")
          .eq("owner_id", user.id)
          .single();

        if (householdError || !household) {
          console.error("Household lookup error:", householdError);
          throw new Error("No household found. Please sign out and sign in again.");
        }

        householdId = household.id;
      }

      // Handle image upload
      let pictureName = formData.picture_file_name;
      if (imageFile) {
        const uploadResult = await uploadProductPicture(imageFile, householdId);
        if (uploadResult) {
          pictureName = uploadResult;
        }
      } else if (removeImage && formData.picture_file_name) {
        pictureName = null;
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        active: formData.active,
        picture_file_name: pictureName,
        product_group_id: formData.product_group_id || null,
        parent_product_id: formData.parent_product_id || null,
        location_id: formData.location_id || null,
        default_consume_location_id: formData.default_consume_location_id || null,
        shopping_location_id: formData.shopping_location_id || null,
        move_on_open: formData.move_on_open,
        min_stock_amount: formData.min_stock_amount,
        cumulate_min_stock_amount_of_sub_products: formData.cumulate_min_stock_amount_of_sub_products,
        treat_opened_as_out_of_stock: formData.treat_opened_as_out_of_stock,
        due_type: formData.due_type,
        default_due_days: formData.default_due_days,
        default_due_days_after_open: formData.default_due_days_after_open,
        default_due_days_after_freezing: formData.default_due_days_after_freezing,
        default_due_days_after_thawing: formData.default_due_days_after_thawing,
        should_not_be_frozen: formData.should_not_be_frozen,
        qu_id_stock: formData.qu_id_stock,
        qu_id_purchase: formData.qu_id_purchase || formData.qu_id_stock,
        enable_tare_weight_handling: formData.enable_tare_weight_handling,
        tare_weight: formData.tare_weight,
        calories: formData.calories ? parseInt(formData.calories) : null,
        quick_consume_amount: formData.quick_consume_amount,
        quick_open_amount: formData.quick_open_amount,
        default_stock_label_type: formData.default_stock_label_type,
        auto_reprint_stock_label: formData.auto_reprint_stock_label,
        not_check_stock_fulfillment_for_recipes: formData.not_check_stock_fulfillment_for_recipes,
        hide_on_stock_overview: formData.hide_on_stock_overview,
        no_own_stock: formData.no_own_stock,
        household_id: householdId,
      };

      let saveError;
      if (mode === "edit" && product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);
        saveError = error;
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        saveError = error;
        if (newProduct) {
          productId = newProduct.id;
        }
      }

      if (saveError) {
        console.error("Supabase save error:", saveError);
        throw new Error(saveError.message || "Failed to save product");
      }

     if (returnToList) {
      router.push("/master-data/products");
    } else {
      // Save & continue → go to conversions page
      router.push(`/products/${productId}/conversions`);
    }
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  // Filter out current product from parent selection
  const availableParents = products.filter((p) => p.id !== product?.id);

  // Get unit name for display
  const getUnitName = (id: string) => {
    return quantityUnits.find((u) => u.id === id)?.name ?? "";
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/master-data/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "edit" ? "Edit product" : "Create product"}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid grid-cols-4 w-full mb-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="locations">Locations</TabsTrigger>
                  <TabsTrigger value="duedates">Due dates</TabsTrigger>
                  <TabsTrigger value="units">Units</TabsTrigger>
                </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Product name"
                    className={!formData.name ? "border-red-300" : ""}
                    autoFocus
                  />
                  {!formData.name && (
                    <p className="text-sm text-red-500 mt-1">A name is required</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="active" className="font-normal">
                    Active
                  </Label>
                </div>

                <div>
                  <Label htmlFor="parent_product">Parent product</Label>
                  <Select
                    value={formData.parent_product_id}
                    onValueChange={(v) => updateField("parent_product_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableParents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Optional notes"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="product_group">Product group</Label>
                  <Select
                    value={formData.product_group_id}
                    onValueChange={(v) => updateField("product_group_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {productGroups.map((pg) => (
                        <SelectItem key={pg.id} value={pg.id}>
                          {pg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="calories">Energy (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    min="0"
                    value={formData.calories}
                    onChange={(e) => updateField("calories", e.target.value)}
                    placeholder="per stock unit"
                  />
                </div>

                {/* Misc options */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="not_check_stock_fulfillment_for_recipes"
                      checked={formData.not_check_stock_fulfillment_for_recipes}
                      onChange={(e) => updateField("not_check_stock_fulfillment_for_recipes", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="not_check_stock_fulfillment_for_recipes" className="font-normal">
                      Disable stock fulfillment checking for this ingredient
                      <Tooltip text="When enabled, this product will be ignored for recipe fulfillment" />
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hide_on_stock_overview"
                      checked={formData.hide_on_stock_overview}
                      onChange={(e) => updateField("hide_on_stock_overview", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="hide_on_stock_overview" className="font-normal">
                      Never show on stock overview
                      <Tooltip text="This product will be hidden from the stock overview page" />
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="no_own_stock"
                      checked={formData.no_own_stock}
                      onChange={(e) => updateField("no_own_stock", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="no_own_stock" className="font-normal">
                      Disable own stock
                      <Tooltip text="This product can't have own stock (useful for parent products)" />
                    </Label>
                  </div>
                </div>
              </TabsContent>

              {/* Locations Tab */}
              <TabsContent value="locations" className="space-y-4">
                <div>
                  <Label htmlFor="location">Default location</Label>
                  <Select
                    value={formData.location_id}
                    onValueChange={(v) => updateField("location_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="default_consume_location">
                    Default consume location
                    <Tooltip text="Stock at this location will be consumed first" />
                  </Label>
                  <Select
                    value={formData.default_consume_location_id}
                    onValueChange={(v) => updateField("default_consume_location_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="move_on_open"
                    checked={formData.move_on_open}
                    onChange={(e) => updateField("move_on_open", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="move_on_open" className="font-normal">
                    Move on open
                    <Tooltip text="When opened, move to default consume location" />
                  </Label>
                </div>

                <div>
                  <Label htmlFor="shopping_location">Default store</Label>
                  <Select
                    value={formData.shopping_location_id}
                    onValueChange={(v) => updateField("shopping_location_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {shoppingLocations.map((sl) => (
                        <SelectItem key={sl.id} value={sl.id}>
                          {sl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <Label htmlFor="min_stock">Minimum stock amount</Label>
                  <NumberInput
                    id="min_stock"
                    value={formData.min_stock_amount}
                    onChange={(v) => updateField("min_stock_amount", v)}
                    min={0}
                    step={1}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cumulate_min_stock"
                    checked={formData.cumulate_min_stock_amount_of_sub_products}
                    onChange={(e) => updateField("cumulate_min_stock_amount_of_sub_products", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="cumulate_min_stock" className="font-normal">
                    Accumulate sub products min. stock amount
                    <Tooltip text="If enabled, the min. stock amount includes sub products" />
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="treat_opened_as_out_of_stock"
                    checked={formData.treat_opened_as_out_of_stock}
                    onChange={(e) => updateField("treat_opened_as_out_of_stock", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="treat_opened_as_out_of_stock" className="font-normal">
                    Treat opened as out of stock
                    <Tooltip text="Opened items won't count towards min. stock amount" />
                  </Label>
                </div>
              </TabsContent>

              {/* Due Dates Tab */}
              <TabsContent value="duedates" className="space-y-4">
                <div>
                  <Label>Due date type</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="due_type"
                        checked={formData.due_type === 1}
                        onChange={() => updateField("due_type", 1)}
                        className="h-4 w-4"
                      />
                      <span>
                        Best before date
                        <Tooltip text="Item is still safe but quality may decrease" />
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="due_type"
                        checked={formData.due_type === 2}
                        onChange={() => updateField("due_type", 2)}
                        className="h-4 w-4"
                      />
                      <span>
                        Expiration date
                        <Tooltip text="Item should not be consumed after this date" />
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="default_due_days">
                    Default due days
                    <Tooltip text="Days from purchase until due date" />
                  </Label>
                  <NumberInput
                    id="default_due_days"
                    value={formData.default_due_days}
                    onChange={(v) => updateField("default_due_days", v)}
                    min={0}
                  />
                </div>

                <div>
                  <Label htmlFor="default_due_days_after_open">
                    Default due days after opened
                    <Tooltip text="Days until due after opening" />
                  </Label>
                  <NumberInput
                    id="default_due_days_after_open"
                    value={formData.default_due_days_after_open}
                    onChange={(v) => updateField("default_due_days_after_open", v)}
                    min={0}
                  />
                </div>

                <div>
                  <Label htmlFor="default_due_days_after_freezing">
                    Default due days after freezing
                    <Tooltip text="Days until due after freezing" />
                  </Label>
                  <NumberInput
                    id="default_due_days_after_freezing"
                    value={formData.default_due_days_after_freezing}
                    onChange={(v) => updateField("default_due_days_after_freezing", v)}
                    min={0}
                  />
                </div>

                <div>
                  <Label htmlFor="default_due_days_after_thawing">
                    Default due days after thawing
                    <Tooltip text="Days until due after thawing" />
                  </Label>
                  <NumberInput
                    id="default_due_days_after_thawing"
                    value={formData.default_due_days_after_thawing}
                    onChange={(v) => updateField("default_due_days_after_thawing", v)}
                    min={0}
                  />
                </div>

                <div className="flex items-center gap-2 pt-4 border-t">
                  <input
                    type="checkbox"
                    id="should_not_be_frozen"
                    checked={formData.should_not_be_frozen}
                    onChange={(e) => updateField("should_not_be_frozen", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="should_not_be_frozen" className="font-normal">
                    Should not be frozen
                    <Tooltip text="Warn if this product is moved to a freezer" />
                  </Label>
                </div>
              </TabsContent>

              {/* Units Tab */}
              <TabsContent value="units" className="space-y-4">
                <div>
                  <Label htmlFor="qu_stock">Quantity unit stock *</Label>
                  <Select
                    value={formData.qu_id_stock}
                    onValueChange={(v) => updateField("qu_id_stock", v === "none" ? "" : v)}
                  >
                    <SelectTrigger className={!formData.qu_id_stock ? "border-red-300" : ""}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {quantityUnits.map((qu) => (
                        <SelectItem key={qu.id} value={qu.id}>
                          {qu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="qu_purchase">Default quantity unit purchase</Label>
                  <Select
                    value={formData.qu_id_purchase}
                    onValueChange={(v) => updateField("qu_id_purchase", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Same as stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Same as stock</SelectItem>
                      {quantityUnits.map((qu) => (
                        <SelectItem key={qu.id} value={qu.id}>
                          {qu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable_tare_weight_handling"
                      checked={formData.enable_tare_weight_handling}
                      onChange={(e) => updateField("enable_tare_weight_handling", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="enable_tare_weight_handling" className="font-normal">
                      Enable tare weight handling
                      <Tooltip text="Track product weight minus container" />
                    </Label>
                  </div>

                  {formData.enable_tare_weight_handling && (
                    <div className="mt-2 pl-6">
                      <Label htmlFor="tare_weight">
                        Tare weight ({getUnitName(formData.qu_id_stock) || "unit"})
                      </Label>
                      <NumberInput
                        id="tare_weight"
                        value={formData.tare_weight}
                        onChange={(v) => updateField("tare_weight", v)}
                        min={0}
                        step={0.1}
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div>
                    <Label htmlFor="quick_consume_amount">
                      Quick consume amount ({getUnitName(formData.qu_id_stock) || "unit"})
                    </Label>
                    <NumberInput
                      id="quick_consume_amount"
                      value={formData.quick_consume_amount}
                      onChange={(v) => updateField("quick_consume_amount", v)}
                      min={1}
                      step={1}
                    />
                  </div>

                  <div>
                    <Label htmlFor="quick_open_amount">
                      Quick open amount ({getUnitName(formData.qu_id_stock) || "unit"})
                    </Label>
                    <NumberInput
                      id="quick_open_amount"
                      value={formData.quick_open_amount}
                      onChange={(v) => updateField("quick_open_amount", v)}
                      min={1}
                      step={1}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div>
                    <Label htmlFor="default_stock_label_type">Default stock entry label</Label>
                    <Select
                      value={formData.default_stock_label_type.toString()}
                      onValueChange={(v) => updateField("default_stock_label_type", parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No label</SelectItem>
                        <SelectItem value="1">Single label</SelectItem>
                        <SelectItem value="2">Label per unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto_reprint_stock_label"
                      checked={formData.auto_reprint_stock_label}
                      onChange={(e) => updateField("auto_reprint_stock_label", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="auto_reprint_stock_label" className="font-normal">
                      Auto reprint stock entry label
                    </Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            </div>

            {/* Picture on mobile (after form, before buttons) */}
            <div className="lg:hidden bg-white rounded-lg shadow-sm p-6 mb-20">
              <Label>Picture</Label>
              <div className="mt-2">
                <ImageUpload
                  value={formData.picture_file_name}
                  onChange={(file) => {
                    setImageFile(file);
                    setRemoveImage(false);
                    if (file) {
                      setImagePreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  onRemove={() => {
                    setImageFile(null);
                    setImagePreviewUrl(null);
                    setRemoveImage(true);
                  }}
                  previewUrl={imagePreviewUrl}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Picture (desktop only) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <Label>Picture</Label>
              <div className="mt-2">
                <ImageUpload
                  value={formData.picture_file_name}
                  onChange={(file) => {
                    setImageFile(file);
                    setRemoveImage(false);
                    if (file) {
                      setImagePreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  onRemove={() => {
                    setImageFile(null);
                    setImagePreviewUrl(null);
                    setRemoveImage(true);
                  }}
                  previewUrl={imagePreviewUrl}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-50 py-4 px-4 border-t z-40">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:items-center">
            <p className="text-sm text-gray-500 flex-1 hidden sm:block">
              Save & continue to add quantity unit conversions & barcodes
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
              >
                {loading ? "Saving..." : "Save & continue"}
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, true)}
                className="flex-1 sm:flex-none bg-megumi hover:bg-megumi/90"
              >
                Save & return
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}