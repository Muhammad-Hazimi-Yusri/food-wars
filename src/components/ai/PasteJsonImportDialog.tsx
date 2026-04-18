"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { parseImportJson, type ImportMatchContext } from "@/lib/ai-parse-import";
import {
  bulkCreateProductsAndStock,
  type ImportBatchResult,
  type ImportHouseholdData,
} from "@/lib/ai-import";
import type { HouseholdData } from "./StockEntryCard";
import type { ParsedImportItem } from "@/types/ai-import";
import { ParsedItemsReview, type ReviewMasterData } from "./ParsedItemsReview";

type Step = "paste" | "review" | "importing" | "result";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdData: HouseholdData | null;
  onImported: () => void;
};

// Extended master-data (includes product_groups + barcodes which aren't in
// HouseholdData). Loaded lazily when the dialog opens.
type ExtendedMasterData = {
  productGroups: { id: string; name: string }[];
  barcodes: { barcode: string; product_id: string }[];
};

export function PasteJsonImportDialog({
  open,
  onOpenChange,
  householdData,
  onImported,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("paste");
  const [jsonText, setJsonText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [includedIndices, setIncludedIndices] = useState<Set<number>>(new Set());
  const [extended, setExtended] = useState<ExtendedMasterData | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportBatchResult | null>(null);

  // Load extended master-data (product_groups + barcodes) when dialog opens
  useEffect(() => {
    if (!open || extended) return;
    const supabase = createClient();
    (async () => {
      const [groupsRes, barcodesRes] = await Promise.all([
        supabase.from("product_groups").select("id, name").eq("active", true),
        supabase.from("product_barcodes").select("barcode, product_id"),
      ]);
      setExtended({
        productGroups: groupsRes.data ?? [],
        barcodes: (barcodesRes.data ?? []) as { barcode: string; product_id: string }[],
      });
    })();
  }, [open, extended]);

  const reset = useCallback(() => {
    setStep("paste");
    setJsonText("");
    setParseErrors([]);
    setRawResponse("");
    setShowRaw(false);
    setItems([]);
    setIncludedIndices(new Set());
    setProgress({ done: 0, total: 0 });
    setResult(null);
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleParse = () => {
    if (!householdData || !extended) {
      toast.error("Household data still loading — try again in a moment");
      return;
    }

    const ctx: ImportMatchContext = {
      products: householdData.products.map((p) => ({
        id: p.id,
        name: p.name,
        qu_id_stock: p.qu_id_stock,
        location_id: p.location_id,
        shopping_location_id: p.shopping_location_id,
      })),
      units: householdData.quantityUnits.map((u) => ({
        id: u.id,
        name: u.name,
        name_plural: u.name_plural,
      })),
      stores: householdData.shoppingLocations,
      locations: householdData.locations,
      groups: extended.productGroups,
      barcodes: extended.barcodes,
    };

    const parsed = parseImportJson(jsonText, ctx);
    setRawResponse(parsed.rawResponse);
    setParseErrors(parsed.errors);
    setItems(parsed.items);
    setIncludedIndices(new Set(parsed.items.map((_, i) => i)));

    if (parsed.items.length === 0) {
      // Stay on paste step — errors will render below
      return;
    }
    setStep("review");
  };

  const handleImport = async () => {
    if (!householdData) return;

    const itemsToImport = items.filter((_, i) => includedIndices.has(i));
    if (itemsToImport.length === 0) {
      toast.error("Select at least one item");
      return;
    }

    setStep("importing");
    setProgress({ done: 0, total: itemsToImport.length * 2 });

    try {
      const importData: ImportHouseholdData = {
        products: householdData.products.map((p) => ({
          id: p.id,
          qu_id_stock: p.qu_id_stock,
          qu_id_purchase: null,
          location_id: p.location_id,
          shopping_location_id: p.shopping_location_id,
        })),
        quantityUnits: householdData.quantityUnits,
        conversions: householdData.conversions,
      };

      const res = await bulkCreateProductsAndStock(
        itemsToImport,
        importData,
        (done, total) => setProgress({ done, total }),
      );
      setResult(res);
      setStep("result");
      router.refresh();
      if (res.created_stock > 0) onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("review");
    }
  };

  const toggleIncluded = (index: number) => {
    setIncludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setIncludedIndices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  };

  const updateItem = (index: number, next: ParsedImportItem) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  const reviewMasterData: ReviewMasterData = {
    products: householdData?.products.map((p) => ({ id: p.id, name: p.name })) ?? [],
    quantityUnits: householdData?.quantityUnits.map((u) => ({ id: u.id, name: u.name })) ?? [],
    locations: householdData?.locations ?? [],
    shoppingLocations: householdData?.shoppingLocations ?? [],
    productGroups: extended?.productGroups ?? [],
  };

  const includedCount = includedIndices.size;
  const firstTimeUser =
    (householdData?.products.length ?? 0) === 0 && step === "review";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "paste" && "Import from AI JSON"}
            {step === "review" && `Review ${items.length} item${items.length !== 1 ? "s" : ""}`}
            {step === "importing" && "Importing..."}
            {step === "result" && "Import complete"}
          </DialogTitle>
          {step === "paste" && (
            <DialogDescription>
              Paste the JSON response from Claude.ai or ChatGPT. We&apos;ll match
              items to existing products where possible, and create new ones
              where needed.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* PASTE */}
        {step === "paste" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`{\n  "version": "1",\n  "items": [ ... ]\n}`}
              className="flex-1 min-h-[240px] font-mono text-xs"
              spellCheck={false}
            />
            {parseErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <div className="font-medium mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Couldn&apos;t parse
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {parseErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {rawResponse && (
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="mt-1.5 underline text-red-700"
                  >
                    {showRaw ? "Hide" : "Show"} raw response
                  </button>
                )}
                {showRaw && (
                  <pre className="mt-1 text-[10px] whitespace-pre-wrap max-h-32 overflow-auto">
                    {rawResponse}
                  </pre>
                )}
              </div>
            )}
            <Button
              onClick={handleParse}
              disabled={!jsonText.trim() || !householdData || !extended}
              className="w-full bg-megumi hover:bg-megumi/90 gap-2"
            >
              Parse JSON
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* REVIEW */}
        {step === "review" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {firstTimeUser && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                First import — review each new product&apos;s location, unit, and
                category carefully. They&apos;ll become reusable defaults.
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-1">
              <ParsedItemsReview
                items={items}
                masterData={reviewMasterData}
                includedIndices={includedIndices}
                onToggleIncluded={toggleIncluded}
                onItemChange={updateItem}
                onRemove={removeItem}
              />
            </div>
            <div className="flex gap-2 items-center justify-between border-t pt-3">
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs">
                <RotateCcw className="h-3 w-3" />
                Start over
              </Button>
              <Button
                onClick={handleImport}
                disabled={includedCount === 0}
                className="bg-megumi hover:bg-megumi/90 gap-2"
              >
                Import {includedCount} item{includedCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* IMPORTING */}
        {step === "importing" && (
          <div className="py-8 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-megumi" />
              <p className="text-sm text-gray-600">
                Creating products and stock entries...
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-megumi h-2 rounded-full transition-all"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-center text-xs text-gray-500">
              {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {/* RESULT */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">
                {result.created_stock} stock entr
                {result.created_stock !== 1 ? "ies" : "y"} added
              </p>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                New products: <strong>{result.created_products}</strong>
              </p>
              <p>
                New locations: <strong>{result.created_master_data.locations}</strong>
                {" · "}
                stores:{" "}
                <strong>{result.created_master_data.shopping_locations}</strong>
                {" · "}
                groups:{" "}
                <strong>{result.created_master_data.product_groups}</strong>
              </p>
            </div>
            {result.failed.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
                <div className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {result.failed.length} item
                  {result.failed.length !== 1 ? "s" : ""} failed
                </div>
                <ul className="space-y-0.5 text-amber-900">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      Item #{f.index + 1}: {f.reason}
                      {f.detail ? ` — ${f.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1 gap-1">
                <RotateCcw className="h-3 w-3" />
                Import more
              </Button>
              <Button
                onClick={() => handleClose(false)}
                className="flex-1 bg-megumi hover:bg-megumi/90 gap-1"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
