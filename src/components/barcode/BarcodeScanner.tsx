"use client";

import { useState, useCallback } from "react";
import { useZxing, type Result } from "react-zxing";
import { VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

type BarcodeScannerProps = {
  onScan: (barcode: string) => void;
  onError?: (message: string) => void;
  enabled?: boolean;
  className?: string;
};

export function BarcodeScanner({
  onScan,
  onError,
  enabled = true,
  className,
}: BarcodeScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const handleDecodeResult = useCallback(
    (result: Result) => {
      const text = result.getText();
      if (text && text !== lastScanned) {
        setLastScanned(text);
        // Haptic feedback on successful scan
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(100);
        }
        onScan(text);
        // Reset after 2s to allow re-scanning same code
        setTimeout(() => setLastScanned(null), 2000);
      }
    },
    [lastScanned, onScan]
  );

  const handleError = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      if (
        message.includes("NotAllowedError") ||
        message.includes("Permission")
      ) {
        setCameraError(
          "Camera access denied. Please allow camera permissions."
        );
      } else if (
        message.includes("NotFoundError") ||
        message.includes("Requested device not found")
      ) {
        setCameraError("No camera found on this device.");
      } else if (
        message.includes("NotReadableError") ||
        message.includes("Could not start video source")
      ) {
        setCameraError("Camera is in use by another app.");
      }
      onError?.(message);
    },
    [onError]
  );

  const { ref } = useZxing({
    paused: !enabled,
    constraints: {
      video: { facingMode: "environment" },
      audio: false,
    },
    timeBetweenDecodingAttempts: 300,
    onDecodeResult: handleDecodeResult,
    onError: handleError,
  });

  if (cameraError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg text-center",
          className
        )}
      >
        <VideoOff className="h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">{cameraError}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden bg-black",
        className
      )}
    >
      <video ref={ref} className="w-full aspect-[4/3] object-cover" />
      {/* Targeting reticle overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2/3 h-1/3 border-2 border-white/50 rounded-lg" />
      </div>
    </div>
  );
}
