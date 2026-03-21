"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/barcode/BarcodeScanner";
import { Keyboard, SwitchCamera } from "lucide-react";

type ScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
  title?: string;
  /** Keep dialog open after each scan (for rapid scanning). */
  continuous?: boolean;
};

export function ScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan barcode",
  continuous = false,
}: ScannerDialogProps) {
  const [manualValue, setManualValue] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();

  // Enumerate video input devices when the dialog opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setCameras(devices.filter((d) => d.kind === "videoinput"));
      } catch {
        // enumerateDevices not supported or failed — switch button stays hidden
      }
    };

    enumerate();
    // Re-enumerate after stream starts so labels are populated
    const timer = setTimeout(enumerate, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  const handleSwitchCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const currentIndex = selectedCameraId
      ? cameras.findIndex((c) => c.deviceId === selectedCameraId)
      : -1;
    // If on default (index -1), jump to 1 (index 0 is likely the environment cam)
    const nextIndex =
      currentIndex === -1 ? 1 : (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].deviceId);
  }, [cameras, selectedCameraId]);

  const handleScan = (barcode: string) => {
    onScan(barcode);
    if (!continuous) {
      onOpenChange(false);
    }
    setManualValue("");
    setShowManual(false);
  };

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (trimmed) {
      handleScan(trimmed);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) {
          setManualValue("");
          setShowManual(false);
          setSelectedCameraId(undefined);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <BarcodeScanner
          key={selectedCameraId ?? "default"}
          onScan={handleScan}
          enabled={open}
          deviceId={selectedCameraId}
        />

        {/* Manual entry fallback */}
        {showManual ? (
          <div className="flex gap-2">
            <Input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Type barcode number"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
              autoFocus
            />
            <Button onClick={handleManualSubmit} disabled={!manualValue.trim()}>
              Go
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {cameras.length >= 2 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleSwitchCamera}
                title="Switch camera"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              <Keyboard className="h-4 w-4" />
              Type barcode manually
            </button>
          </div>
        )}

        {continuous && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
