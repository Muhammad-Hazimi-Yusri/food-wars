"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { ScannerDialog } from "@/components/barcode/ScannerDialog";
import { AddStockEntryModal } from "@/components/inventory/AddStockEntryModal";
import { lookupBarcodeLocal } from "@/lib/barcode-actions";
import { lookupBarcodeOFF } from "@/lib/openfoodfacts";
import type { Product, Location, QuantityUnit, ShoppingLocation } from "@/types/database";

type ProductWithUnits = Product & {
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

type QuantityUnitConversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

type Props = {
  products: ProductWithUnits[];
  locations: Location[];
  quantityUnits: QuantityUnit[];
  shoppingLocations: ShoppingLocation[];
  conversions: QuantityUnitConversion[];
};

type Prefill = {
  productId?: string;
  amount?: number;
  quId?: string;
  shoppingLocationId?: string;
  price?: number;
};

export function ScanToStockFlow({
  products,
  locations,
  quantityUnits,
  shoppingLocations,
  conversions,
}: Props) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [resolving, setResolving] = useState(false);

  const handleScan = async (barcode: string) => {
    setScannerOpen(false);
    setResolving(true);

    try {
      // 1. Check local product_barcodes
      const localMatch = await lookupBarcodeLocal(barcode);

      if (localMatch) {
        // Known barcode — open AddStockEntryModal pre-filled
        const fill: Prefill = {
          productId: localMatch.product.id,
        };
        if (localMatch.barcode.amount) fill.amount = localMatch.barcode.amount;
        if (localMatch.barcode.qu_id) fill.quId = localMatch.barcode.qu_id;
        if (localMatch.barcode.shopping_location_id)
          fill.shoppingLocationId = localMatch.barcode.shopping_location_id;
        if (localMatch.barcode.last_price)
          fill.price = localMatch.barcode.last_price;

        setPrefill(fill);
        setStockModalOpen(true);
        toast(`Scanned: ${localMatch.product.name}`);
        return;
      }

      // 2. Not found locally — try Open Food Facts
      const offResult = await lookupBarcodeOFF(barcode);

      if (offResult?.name) {
        toast(`Found "${offResult.name}" on Open Food Facts — create it first`);
      } else {
        toast("Unknown barcode — create the product first");
      }

      // Redirect to product creation with barcode pre-filled
      router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`);
    } catch {
      toast.error("Failed to look up barcode");
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        disabled={resolving}
        className="inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-amber-600/90 transition-colors font-medium"
      >
        <ScanBarcode className="h-5 w-5 sm:h-4 sm:w-4" />
        <span>{resolving ? "Looking up..." : "Scan"}</span>
      </button>

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Scan barcode to add stock"
      />

      <AddStockEntryModal
        products={products}
        locations={locations}
        quantityUnits={quantityUnits}
        shoppingLocations={shoppingLocations}
        conversions={conversions}
        prefill={prefill}
        externalOpen={stockModalOpen}
        onExternalOpenChange={(val) => {
          setStockModalOpen(val);
          if (!val) setPrefill(null);
        }}
      />
    </>
  );
}
