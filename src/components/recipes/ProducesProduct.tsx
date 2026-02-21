"use client";

import { useState, useMemo } from "react";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { setProducesProduct } from "@/lib/recipe-actions";

type Product = {
  id: string;
  name: string;
};

type Props = {
  recipeId: string;
  initialProductId: string | null;
  initialProductName: string | null;
  products: Product[];
};

export function ProducesProduct({
  recipeId,
  initialProductId,
  initialProductName,
  products,
}: Props) {
  const [productId, setProductId] = useState<string | null>(initialProductId);
  const [productName, setProductName] = useState(initialProductName ?? "");
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 10);
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [products, search]);

  const handleSelect = async (p: Product) => {
    setSaving(true);
    const result = await setProducesProduct(recipeId, p.id);
    setSaving(false);
    if (result.success) {
      setProductId(p.id);
      setProductName(p.name);
      setSearch("");
      setShowPicker(false);
    } else {
      toast.error(result.error ?? "Failed to set product.");
    }
  };

  const handleClear = async () => {
    setSaving(true);
    const result = await setProducesProduct(recipeId, null);
    setSaving(false);
    if (result.success) {
      setProductId(null);
      setProductName("");
    } else {
      toast.error(result.error ?? "Failed to clear product.");
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-hayama-dark shrink-0" />
        <span className="text-base font-semibold text-megumi">Produces product</span>
      </div>

      {productId ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800 flex-1">{productName}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => { setShowPicker(true); setSearch(""); }}
            disabled={saving}
          >
            Change
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div>
          {!showPicker ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setShowPicker(true)}
            >
              Set product
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        When cooked, this recipe adds the selected product to your stock.
      </p>

      {showPicker && (
        <div className="space-y-1.5">
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              autoFocus
              className="h-8 text-sm"
            />
            {search.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border rounded-md bg-white shadow-md">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No products found.</p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-hayama border-b last:border-b-0"
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setShowPicker(false); setSearch(""); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
