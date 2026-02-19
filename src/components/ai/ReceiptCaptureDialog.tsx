"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Upload,
  Loader2,
  Send,
  ScanBarcode,
  SkipForward,
  Eye,
  FileText,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ParsedStockItem } from "@/types/database";
import { ReceiptReviewTable } from "./ReceiptReviewTable";
import { ScannerDialog } from "@/components/barcode/ScannerDialog";
import { lookupBarcodeLocal } from "@/lib/barcode-actions";
import { findBestMatch } from "@/lib/fuzzy-match";
import type { HouseholdData } from "./StockEntryCard";

type Step = "capture" | "processing" | "review" | "wizard";

type ReceiptState = {
  items: ParsedStockItem[];
  checkedIndices: number[];
  wizardIndex: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdData: HouseholdData | null;
  hasVisionModel: boolean;
  onImported: () => void;
  /** When restoring from sessionStorage after product creation */
  initialState?: ReceiptState | null;
};

const RECEIPT_STATE_KEY = "receipt-scan-state";

/** Save receipt state to sessionStorage for product creation round-trip */
export function saveReceiptState(state: ReceiptState) {
  try {
    sessionStorage.setItem(RECEIPT_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

/** Load and clear receipt state from sessionStorage */
export function loadReceiptState(): ReceiptState | null {
  try {
    const raw = sessionStorage.getItem(RECEIPT_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RECEIPT_STATE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ReceiptCaptureDialog({
  open,
  onOpenChange,
  householdData,
  hasVisionModel,
  onImported,
  initialState,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialState ? "review" : "capture");
  const [method, setMethod] = useState<"ocr" | "vlm">(hasVisionModel ? "vlm" : "ocr");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [items, setItems] = useState<ParsedStockItem[]>(initialState?.items ?? []);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  // Wizard state
  const [wizardIndex, setWizardIndex] = useState(initialState?.wizardIndex ?? 0);
  const [scannerOpen, setScannerOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const tesseractWorkerRef = useRef<import("tesseract.js").Worker | null>(null);

  // Initialize from restored state
  useEffect(() => {
    if (initialState) {
      setItems(initialState.items);
      setStep("review");
      // Re-run fuzzy matching with fresh household data
      if (householdData) {
        const rematched = initialState.items.map((item) => {
          if (item.product_id) {
            // Verify the product still exists
            const exists = householdData.products.find((p) => p.id === item.product_id);
            if (exists) return item;
          }
          // Try to fuzzy match
          if (item.product_name) {
            const match = findBestMatch(
              item.product_name,
              householdData.products,
              (p) => p.name
            );
            if (match) {
              return {
                ...item,
                product_id: match.item.id,
                product_name: match.item.name,
              };
            }
          }
          return item;
        });
        setItems(rematched);
      }
    }
  }, [initialState, householdData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPEG, PNG, WebP, or HEIC)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data URL prefix: "data:image/jpeg;base64,"
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processReceipt = useCallback(async () => {
    if (!imageFile) return;

    setStep("processing");
    setProgress(0);

    try {
      if (method === "vlm") {
        // VLM path — send image directly to vision model
        setProgressLabel("Analyzing image with AI...");
        setProgress(30);

        const base64 = await fileToBase64(imageFile);
        setProgress(50);

        const res = await fetch("/api/ai/parse-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "vlm", imageBase64: base64 }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to parse receipt");

        setProgress(100);
        setItems(data.items ?? []);
        setRawResponse(data.rawResponse ?? null);
        setStep("review");
      } else {
        // OCR path — extract text with Tesseract, then send to text model
        setProgressLabel("Loading OCR engine...");
        setProgress(10);

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", undefined, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(10 + Math.round(m.progress * 50));
              setProgressLabel("Extracting text...");
            }
          },
        });
        tesseractWorkerRef.current = worker;

        setProgress(20);
        setProgressLabel("Extracting text...");

        const { data: ocrData } = await worker.recognize(imageFile);
        const ocrText = ocrData.text;

        await worker.terminate();
        tesseractWorkerRef.current = null;

        if (!ocrText.trim()) {
          toast.error("Could not extract text from image. Try a clearer photo.");
          setStep("capture");
          return;
        }

        setProgress(70);
        setProgressLabel("Parsing items with AI...");

        const res = await fetch("/api/ai/parse-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "ocr", text: ocrText }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to parse receipt");

        setProgress(100);
        setItems(data.items ?? []);
        setRawResponse(data.rawResponse ?? null);
        setStep("review");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      toast.error(message);
      setStep("capture");
    }
  }, [imageFile, method]);

  const handleRefine = async () => {
    if (!refineInput.trim() || refining) return;

    setRefining(true);
    try {
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine",
          text: refineInput.trim(),
          currentItems: items.map((item) => ({
            product_name: item.product_name,
            product_id: item.product_id,
            amount: item.amount,
            unit_name: item.unit_name,
            best_before_date: item.best_before_date,
            store_name: item.store_name,
            price: item.price,
            location_name: item.location_name,
            note: item.note,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to refine");

      setItems(data.items ?? []);
      setRefineInput("");
      toast.success("Items updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  };

  // Unmatched wizard
  const unmatchedItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.product_id);

  const currentUnmatched = unmatchedItems[wizardIndex] ?? null;

  const startWizard = () => {
    setWizardIndex(0);
    setStep("wizard");
  };

  const advanceWizard = () => {
    const nextIndex = wizardIndex + 1;
    if (nextIndex >= unmatchedItems.length) {
      setStep("review");
      setWizardIndex(0);
    } else {
      setWizardIndex(nextIndex);
    }
  };

  const handleWizardBarcodeScan = async (barcode: string) => {
    setScannerOpen(false);
    if (!currentUnmatched) return;

    // Check local DB first
    const localMatch = await lookupBarcodeLocal(barcode);
    if (localMatch) {
      // Found existing product — assign it
      const updated = [...items];
      updated[currentUnmatched.index] = {
        ...updated[currentUnmatched.index],
        product_id: localMatch.product.id,
        product_name: localMatch.product.name,
      };
      setItems(updated);
      toast.success(`Matched to "${localMatch.product.name}"`);
      advanceWizard();
      return;
    }

    // Not found locally — navigate to product creation
    // Save receipt state first
    saveReceiptState({
      items,
      checkedIndices: Array.from({ length: items.length }, (_, i) => i),
      wizardIndex,
    });

    // Navigate to product creation with returnTo
    router.push(`/products/new?barcode=${encodeURIComponent(barcode)}&returnTo=receipt-scan`);
  };

  const reset = () => {
    setStep("capture");
    setImageFile(null);
    setImagePreview(null);
    setItems([]);
    setProgress(0);
    setProgressLabel("");
    setRefineInput("");
    setRawResponse(null);
    setWizardIndex(0);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      // Cleanup Tesseract worker if still running
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
        tesseractWorkerRef.current = null;
      }
    }
    onOpenChange(val);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "capture" && "Scan Receipt"}
              {step === "processing" && "Processing Receipt"}
              {step === "review" && "Review Items"}
              {step === "wizard" && "Resolve Unmatched Products"}
            </DialogTitle>
          </DialogHeader>

          {/* CAPTURE STEP */}
          {step === "capture" && (
            <div className="space-y-4">
              {/* Image capture */}
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-white/80 rounded-full p-1 hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => cameraInputRef.current?.click()}
                      className="h-12 flex-1 gap-2 sm:hidden"
                    >
                      <Camera className="h-5 w-5" />
                      Take Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => galleryInputRef.current?.click()}
                      className="h-12 flex-1 gap-2"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="sm:hidden">Choose Photo</span>
                      <span className="hidden sm:inline">Upload Receipt Image</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    JPEG, PNG, WebP, or HEIC. Max 10MB.
                  </p>
                </div>
              )}

              {/* Method toggle */}
              {imagePreview && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">Processing method</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMethod("ocr")}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                        method === "ocr"
                          ? "border-megumi bg-megumi/5 text-megumi"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">OCR + Text AI</div>
                        <div className="text-[10px] text-gray-400">Extract text, then parse</div>
                      </div>
                    </button>
                    <button
                      onClick={() => hasVisionModel && setMethod("vlm")}
                      disabled={!hasVisionModel}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                        method === "vlm"
                          ? "border-megumi bg-megumi/5 text-megumi"
                          : hasVisionModel
                          ? "border-gray-200 hover:border-gray-300"
                          : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Vision AI</div>
                        <div className="text-[10px] text-gray-400">
                          {hasVisionModel ? "Read image directly" : "No vision model set"}
                        </div>
                      </div>
                    </button>
                  </div>

                  <Button
                    onClick={processReceipt}
                    className="w-full bg-megumi hover:bg-megumi/90"
                  >
                    Process Receipt
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* PROCESSING STEP */}
          {step === "processing" && (
            <div className="py-8 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-megumi" />
                <p className="text-sm text-gray-600">{progressLabel}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-megumi h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === "review" && (
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              <ReceiptReviewTable
                items={items}
                householdData={householdData}
                onItemsChange={setItems}
                onImported={onImported}
                onResolveUnmatched={unmatchedItems.length > 0 ? startWizard : undefined}
                rawResponse={rawResponse}
              />

              {/* NL Refinement input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRefine();
                }}
                className="flex gap-2 pt-2 border-t border-gray-100"
              >
                <Input
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  placeholder="Refine... e.g. 'remove the total row'"
                  disabled={refining}
                  className="flex-1 text-xs"
                />
                <Button
                  type="submit"
                  disabled={refining || !refineInput.trim()}
                  size="icon"
                  variant="outline"
                  className="shrink-0 h-9 w-9"
                >
                  {refining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </form>

              {/* Scan another / Reset */}
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="w-full text-xs text-gray-500 gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Scan another receipt
              </Button>
            </div>
          )}

          {/* WIZARD STEP */}
          {step === "wizard" && currentUnmatched && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">
                  Unmatched {wizardIndex + 1} of {unmatchedItems.length}
                </p>
                <p className="font-semibold text-lg">
                  {currentUnmatched.item.product_name}
                </p>
                {currentUnmatched.item.price != null && (
                  <p className="text-sm text-gray-500">
                    {"\u00A3"}{currentUnmatched.item.price.toFixed(2)}
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Scan the barcode on this product to create or match it.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setScannerOpen(true)}
                  className="bg-megumi hover:bg-megumi/90 gap-2"
                >
                  <ScanBarcode className="h-4 w-4" />
                  Scan Barcode
                </Button>
                <Button
                  variant="outline"
                  onClick={advanceWizard}
                  className="gap-2"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </Button>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 pt-2">
                {unmatchedItems.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < wizardIndex
                        ? "bg-green-400"
                        : i === wizardIndex
                        ? "bg-megumi"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Wizard done — back to review */}
          {step === "wizard" && !currentUnmatched && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-gray-600">All unmatched items processed!</p>
              <Button onClick={() => setStep("review")} className="bg-megumi hover:bg-megumi/90">
                Back to Review
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode scanner for wizard */}
      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleWizardBarcodeScan}
        title="Scan product barcode"
      />
    </>
  );
}
