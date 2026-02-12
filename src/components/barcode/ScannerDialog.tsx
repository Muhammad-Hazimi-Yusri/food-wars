"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/barcode/BarcodeScanner";
import { Keyboard } from "lucide-react";

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
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <BarcodeScanner onScan={handleScan} enabled={open} />

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
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            <Keyboard className="h-4 w-4" />
            Type barcode manually
          </button>
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
