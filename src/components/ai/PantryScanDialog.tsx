"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ParsedStockItem } from "@/types/database";
import { ReceiptReviewTable } from "./ReceiptReviewTable";
import type { HouseholdData } from "./StockEntryCard";

type Step = "capture" | "processing" | "review";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdData: HouseholdData | null;
  hasVisionModel: boolean;
  onImported: () => void;
};

export function PantryScanDialog({
  open,
  onOpenChange,
  householdData,
  hasVisionModel,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [items, setItems] = useState<ParsedStockItem[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processPantryImage = useCallback(async () => {
    if (!imageFile) return;

    setStep("processing");
    setProgress(0);
    setProgressLabel("Analyzing pantry image with AI...");
    setProgress(30);

    try {
      const base64 = await fileToBase64(imageFile);
      setProgress(50);

      const res = await fetch("/api/ai/scan-pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to scan pantry");

      setProgress(100);
      setItems(data.items ?? []);
      setRawResponse(data.rawResponse ?? null);
      setStep("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      toast.error(message);
      setStep("capture");
    }
  }, [imageFile]);

  const reset = () => {
    setStep("capture");
    setImageFile(null);
    setImagePreview(null);
    setItems([]);
    setProgress(0);
    setProgressLabel("");
    setRawResponse(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] flex flex-col",
          step === "review" && imagePreview
            ? "sm:max-w-5xl"
            : "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "capture" && "Scan Pantry"}
            {step === "processing" && "Analyzing Image"}
            {step === "review" && "Review Items"}
          </DialogTitle>
        </DialogHeader>

        {/* CAPTURE STEP */}
        {step === "capture" && (
          <div className="space-y-4">
            {!hasVisionModel && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Pantry scanning requires a vision model. Go to Settings to configure one.
              </div>
            )}

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Pantry preview"
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
                    <span className="hidden sm:inline">Upload Pantry Image</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Take a photo of your pantry, fridge, or shelf. JPEG, PNG, WebP, or HEIC. Max 10MB.
                </p>
              </div>
            )}

            {imagePreview && hasVisionModel && (
              <Button
                onClick={processPantryImage}
                className="w-full bg-megumi hover:bg-megumi/90"
              >
                Scan Pantry
              </Button>
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
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 overflow-hidden">
            {imagePreview && (
              <div className="shrink-0 max-h-48 md:max-h-none md:w-[340px] md:shrink-0 overflow-auto rounded-lg border border-gray-200 bg-gray-50">
                <img
                  src={imagePreview}
                  alt="Pantry"
                  className="w-full h-auto"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 min-w-0">
              <ReceiptReviewTable
                items={items}
                householdData={householdData}
                onItemsChange={setItems}
                onImported={onImported}
                emptyMessage="No products identified in photo."
                rawResponse={rawResponse}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="w-full text-xs text-gray-500 gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Scan another shelf
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
