"use client";

import { useState } from "react";
import Link from "next/link";
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
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { BarcodesSection } from "@/components/barcode/BarcodesSection";
import type { ProductBarcode } from "@/types/database";

type QuantityUnit = {
  id: string;
  name: string;
  name_plural?: string;
};

type Conversion = {
  id: string;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
  from_qu?: { name: string };
  to_qu?: { name: string };
};

type Product = {
  id: string;
  name: string;
  qu_id_stock: string | null;
  qu_stock?: { name: string }[] | { name: string } | null;
};

type ShoppingLocation = {
  id: string;
  name: string;
};

type Props = {
  product: Product;
  conversions: Conversion[];
  quantityUnits: QuantityUnit[];
  barcodes: ProductBarcode[];
  shoppingLocations: ShoppingLocation[];
};

export function ProductConversionsClient({
  product,
  conversions: initialConversions,
  quantityUnits,
  barcodes,
  shoppingLocations,
}: Props) {
  const [conversions, setConversions] = useState(initialConversions);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fromQuId, setFromQuId] = useState("");
  const [toQuId, setToQuId] = useState("");
  const [factor, setFactor] = useState("1");

  const resetForm = () => {
    setFromQuId("");
    setToQuId("");
    setFactor("1");
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (conv: Conversion) => {
    setFromQuId(conv.from_qu_id);
    setToQuId(conv.to_qu_id);
    setFactor(conv.factor.toString());
    setEditingId(conv.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!fromQuId || !toQuId || !factor) return;

    setSaving(true);
    try {
      const supabase = createClient();

      // Get household
      const { data: { user } } = await supabase.auth.getUser();
      const isGuest = user?.is_anonymous === true;

      let householdId: string;
      if (isGuest) {
        householdId = GUEST_HOUSEHOLD_ID;
      } else {
        const { data: household } = await supabase
          .from("households")
          .select("id")
          .eq("owner_id", user!.id)
          .single();
        if (!household) throw new Error("No household found");
        householdId = household.id;
      }

      if (editingId) {
        // Update
        const { error } = await supabase
          .from("quantity_unit_conversions")
          .update({
            from_qu_id: fromQuId,
            to_qu_id: toQuId,
            factor: parseFloat(factor),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("quantity_unit_conversions")
          .insert({
            household_id: householdId,
            product_id: product.id,
            from_qu_id: fromQuId,
            to_qu_id: toQuId,
            factor: parseFloat(factor),
          });
        if (error) throw error;
      }

      // Re-fetch conversions
      const { data: updatedConversions } = await supabase
      .from("quantity_unit_conversions")
      .select("*, from_qu:quantity_units!quantity_unit_conversions_from_qu_id_fkey(name), to_qu:quantity_units!quantity_unit_conversions_to_qu_id_fkey(name)")
      .eq("product_id", product.id)
      .order("created_at");
  
      if (updatedConversions) {
      setConversions(updatedConversions);
      }
      resetForm();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save conversion");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this conversion?")) return;
  
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quantity_unit_conversions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      
      // Update local state
      setConversions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete conversion");
    }
  };

  const getUnitName = (id: string) => {
    return quantityUnits.find((u) => u.id === id)?.name ?? "unit";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/master-data/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-sm text-gray-500">
            Stock unit: {Array.isArray(product.qu_stock) ? product.qu_stock[0]?.name : product.qu_stock?.name ?? "not set"}
          </p>
        </div>
      </div>

      {/* QU Conversions Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Quantity unit conversions</h2>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Conversion Form */}
        {showForm && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>From unit</Label>
                <Select value={fromQuId} onValueChange={setFromQuId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {quantityUnits.map((qu) => (
                      <SelectItem key={qu.id} value={qu.id}>
                        {qu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To unit</Label>
                <Select value={toQuId} onValueChange={setToQuId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {quantityUnits.map((qu) => (
                      <SelectItem key={qu.id} value={qu.id}>
                        {qu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Factor</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
            </div>
            {fromQuId && toQuId && factor && (
              <p className="text-sm text-gray-600">
                1 {getUnitName(fromQuId)} = {factor} {getUnitName(toQuId)}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !fromQuId || !toQuId}>
                {saving ? "Saving..." : editingId ? "Update" : "Add"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Conversions Table */}
        {conversions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">From</th>
                <th className="py-2 font-medium">To</th>
                <th className="py-2 font-medium">Factor</th>
                <th className="py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((conv) => (
                <tr key={conv.id} className="border-b">
                  <td className="py-2">{conv.from_qu?.name}</td>
                  <td className="py-2">{conv.to_qu?.name}</td>
                  <td className="py-2">{conv.factor}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(conv)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={() => handleDelete(conv.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">
            No product-specific conversions. Default conversions still apply.
          </p>
        )}
      </div>

      {/* Barcodes Section */}
      <BarcodesSection
        productId={product.id}
        barcodes={barcodes}
        quantityUnits={quantityUnits}
        shoppingLocations={shoppingLocations}
      />

      {/* Footer */}
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/master-data/products">Done</Link>
        </Button>
      </div>
    </div>
  );
}