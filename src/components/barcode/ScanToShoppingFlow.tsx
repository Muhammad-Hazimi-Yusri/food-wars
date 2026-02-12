"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { ScannerDialog } from "@/components/barcode/ScannerDialog";
import { lookupBarcodeLocal } from "@/lib/barcode-actions";
import { lookupBarcodeOFF } from "@/lib/openfoodfacts";
import { addItemToList, purchaseItem } from "@/lib/shopping-list-actions";
import type { ShoppingListItemWithRelations } from "@/types/database";

type ConversionInfo = {
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
  product_id: string | null;
};

type Props = {
  listId: string;
  items: ShoppingListItemWithRelations[];
  conversions: ConversionInfo[];
  onRefresh: () => void;
};

export function ScanToShoppingFlow({
  listId,
  items,
  conversions,
  onRefresh,
}: Props) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  const handleScan = useCallback(
    async (barcode: string) => {
      // Don't close the scanner — continuous mode
      setResolving(true);

      try {
        // 1. Look up barcode locally
        const localMatch = await lookupBarcodeLocal(barcode);

        if (localMatch) {
          const productId = localMatch.product.id;
          const productName = localMatch.product.name;

          // Check if product is on the list (undone)
          const onList = items.find(
            (i) => i.product?.id === productId && !i.done
          );

          if (onList) {
            // Product is on the list — purchase it
            const result = await purchaseItem(
              onList.id,
              productId,
              onList.amount,
              onList.qu_id ?? onList.product?.qu_id_purchase ?? null,
              conversions,
              {
                qu_id_stock: onList.product?.qu_id_stock ?? null,
                location_id: onList.product?.location_id ?? null,
                shopping_location_id:
                  onList.product?.shopping_location_id ?? null,
                default_due_days: onList.product?.default_due_days ?? 0,
              }
            );

            if (result.success) {
              toast(`Purchased "${productName}"`);
              onRefresh();
            } else {
              toast.error(result.error ?? "Failed to purchase");
            }
          } else {
            // Product not on the list — add then purchase
            const addResult = await addItemToList(
              listId,
              {
                productId,
                amount: localMatch.barcode.amount ?? 1,
                quId: localMatch.barcode.qu_id ?? null,
              },
              items
            );

            if (!addResult.success) {
              toast.error(addResult.error ?? "Failed to add to list");
              return;
            }

            // Now purchase the just-added item
            // We need the item ID from the add result
            if (addResult.itemId) {
              // Look up the product defaults from the list item's product relation
              const product = items.find(
                (i) => i.product?.id === productId
              )?.product;

              const purchaseResult = await purchaseItem(
                addResult.itemId,
                productId,
                localMatch.barcode.amount ?? 1,
                localMatch.barcode.qu_id ?? null,
                conversions,
                {
                  qu_id_stock: product?.qu_id_stock ?? null,
                  location_id: product?.location_id ?? null,
                  shopping_location_id:
                    product?.shopping_location_id ?? null,
                  default_due_days: product?.default_due_days ?? 0,
                }
              );

              if (purchaseResult.success) {
                toast(`Added & purchased "${productName}"`);
                onRefresh();
              } else {
                toast.error(purchaseResult.error ?? "Failed to purchase");
                onRefresh(); // Still refresh — item was added
              }
            }
          }
          return;
        }

        // 2. Not found locally — try OFF, redirect to create
        const offResult = await lookupBarcodeOFF(barcode);
        setScannerOpen(false);

        if (offResult?.name) {
          toast(`Found "${offResult.name}" on Open Food Facts — create it first`);
        } else {
          toast("Unknown barcode — create the product first");
        }

        router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`);
      } catch {
        toast.error("Failed to look up barcode");
      } finally {
        setResolving(false);
      }
    },
    [listId, items, conversions, onRefresh, router]
  );

  return (
    <>
      {/* Floating scan button */}
      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        disabled={resolving}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-600/90 transition-colors flex items-center justify-center"
        title="Scan barcode"
      >
        <ScanBarcode className="h-6 w-6" />
      </button>

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title={resolving ? "Processing..." : "Scan to purchase"}
        continuous
      />
    </>
  );
}
