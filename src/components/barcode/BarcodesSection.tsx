"use client";

import { useState } from "react";
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
import { Barcode, Plus, Pencil, Trash2, Camera, X } from "lucide-react";
import {
  addBarcode,
  updateBarcode,
  deleteBarcode,
} from "@/lib/barcode-actions";
import { BarcodeScanner } from "@/components/barcode/BarcodeScanner";
import type { ProductBarcode } from "@/types/database";

type QuantityUnit = {
  id: string;
  name: string;
};

type ShoppingLocation = {
  id: string;
  name: string;
};

type Props = {
  productId: string;
  barcodes: ProductBarcode[];
  quantityUnits: QuantityUnit[];
  shoppingLocations: ShoppingLocation[];
};

export function BarcodesSection({
  productId,
  barcodes: initialBarcodes,
  quantityUnits,
  shoppingLocations,
}: Props) {
  const [barcodes, setBarcodes] = useState(initialBarcodes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Form state
  const [barcodeValue, setBarcodeValue] = useState("");
  const [quId, setQuId] = useState("none");
  const [amount, setAmount] = useState("");
  const [storeId, setStoreId] = useState("none");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const resetForm = () => {
    setBarcodeValue("");
    setQuId("none");
    setAmount("");
    setStoreId("none");
    setPrice("");
    setNote("");
    setShowForm(false);
    setEditingId(null);
    setScanning(false);
  };

  const handleEdit = (bc: ProductBarcode) => {
    setBarcodeValue(bc.barcode);
    setQuId(bc.qu_id ?? "none");
    setAmount(bc.amount != null ? String(bc.amount) : "");
    setStoreId(bc.shopping_location_id ?? "none");
    setPrice(bc.last_price != null ? String(bc.last_price) : "");
    setNote(bc.note ?? "");
    setEditingId(bc.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!barcodeValue.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const result = await updateBarcode(editingId, {
          barcode: barcodeValue.trim(),
          qu_id: quId !== "none" ? quId : null,
          amount: amount ? parseFloat(amount) : null,
          shopping_location_id: storeId !== "none" ? storeId : null,
          last_price: price ? parseFloat(price) : null,
          note: note.trim() || null,
        });
        if (!result.success) throw new Error(result.error);

        setBarcodes((prev) =>
          prev.map((bc) =>
            bc.id === editingId
              ? {
                  ...bc,
                  barcode: barcodeValue.trim(),
                  qu_id: quId !== "none" ? quId : null,
                  amount: amount ? parseFloat(amount) : null,
                  shopping_location_id: storeId !== "none" ? storeId : null,
                  last_price: price ? parseFloat(price) : null,
                  note: note.trim() || null,
                }
              : bc
          )
        );
      } else {
        const result = await addBarcode({
          productId,
          barcode: barcodeValue.trim(),
          quId: quId !== "none" ? quId : null,
          amount: amount ? parseFloat(amount) : null,
          shoppingLocationId: storeId !== "none" ? storeId : null,
          lastPrice: price ? parseFloat(price) : null,
          note: note.trim() || null,
        });
        if (!result.success) throw new Error(result.error);

        setBarcodes((prev) => [
          ...prev,
          {
            id: result.barcodeId!,
            household_id: "",
            product_id: productId,
            barcode: barcodeValue.trim(),
            qu_id: quId !== "none" ? quId : null,
            amount: amount ? parseFloat(amount) : null,
            shopping_location_id: storeId !== "none" ? storeId : null,
            last_price: price ? parseFloat(price) : null,
            note: note.trim() || null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      resetForm();
    } catch (err) {
      console.error("Barcode save error:", err);
      alert("Failed to save barcode");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this barcode?")) return;

    try {
      const result = await deleteBarcode(id);
      if (!result.success) throw new Error(result.error);
      setBarcodes((prev) => prev.filter((bc) => bc.id !== id));
    } catch (err) {
      console.error("Barcode delete error:", err);
      alert("Failed to delete barcode");
    }
  };

  const handleScan = (scanned: string) => {
    setBarcodeValue(scanned);
    setScanning(false);
  };

  const getUnitName = (id: string | null) => {
    if (!id) return null;
    return quantityUnits.find((u) => u.id === id)?.name ?? null;
  };

  const getStoreName = (id: string | null) => {
    if (!id) return null;
    return shoppingLocations.find((s) => s.id === id)?.name ?? null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold">Barcodes</h2>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Barcode Form */}
      {showForm && (
        <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-4">
          {/* Scanner */}
          {scanning && (
            <div className="relative">
              <BarcodeScanner
                onScan={handleScan}
                className="max-w-sm mx-auto"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 h-8 w-8"
                onClick={() => setScanning(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Barcode input + scan button */}
          <div>
            <Label>Barcode</Label>
            <div className="flex gap-2">
              <Input
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                placeholder="e.g. 5000159484695"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setScanning(!scanning)}
                title="Scan barcode"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Quantity unit</Label>
              <Select value={quId} onValueChange={setQuId}>
                <SelectTrigger>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default</SelectItem>
                  {quantityUnits.map((qu) => (
                    <SelectItem key={qu.id} value={qu.id}>
                      {qu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 6"
              />
            </div>
            <div>
              <Label>Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {shoppingLocations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Last price</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1.50"
              />
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !barcodeValue.trim()}
            >
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Barcodes List */}
      {barcodes.length > 0 ? (
        <div className="space-y-2">
          {barcodes.map((bc) => (
            <div
              key={bc.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{bc.barcode}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                  {bc.amount != null && (
                    <span>
                      {bc.amount}
                      {getUnitName(bc.qu_id)
                        ? ` ${getUnitName(bc.qu_id)}`
                        : ""}
                    </span>
                  )}
                  {getStoreName(bc.shopping_location_id) && (
                    <span>{getStoreName(bc.shopping_location_id)}</span>
                  )}
                  {bc.last_price != null && <span>${bc.last_price}</span>}
                  {bc.note && <span>{bc.note}</span>}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(bc)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  onClick={() => handleDelete(bc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          No barcodes linked to this product.
        </p>
      )}
    </div>
  );
}
