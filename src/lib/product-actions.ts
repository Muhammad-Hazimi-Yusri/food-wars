"use server";

import { createClient } from "@/lib/supabase/server";
import {
  lookupBarcodeOFF,
  mapOFFNutrimentsToNutrition,
  type OFFProduct,
} from "@/lib/openfoodfacts";
import { detectStoreBrand } from "@/lib/store-brand-map";

type ActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Download an external image and upload it to Supabase Storage (server-side).
 * Runs on the server so there are no CORS issues with external image hosts.
 * Returns the stored file name, or null on failure.
 */
export async function downloadAndUploadOffImage(
  url: string,
  householdId: string
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error("OFF image download failed:", res.status, res.statusText);
      return null;
    }

    const blob = await res.blob();
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const fileName = `${householdId}/${crypto.randomUUID()}.${ext}`;

    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("product-pictures")
      .upload(fileName, blob, {
        contentType: blob.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("OFF image upload error:", error);
      return null;
    }

    return fileName;
  } catch (err) {
    console.error("downloadAndUploadOffImage error:", err);
    return null;
  }
}

/**
 * Fetch fresh product data from Open Food Facts for a product that has a linked barcode.
 * Returns the OFF data alongside the current product data for comparison.
 */
export async function refetchProductFromOFF(productId: string): Promise<
  ActionResult & {
    offData?: OFFProduct;
    currentBrand?: string | null;
    currentImageFileName?: string | null;
    hasNutrition?: boolean;
  }
> {
  try {
    const supabase = await createClient();

    // Get the product's barcodes
    const { data: barcodes, error: barcodeError } = await supabase
      .from("product_barcodes")
      .select("barcode")
      .eq("product_id", productId)
      .limit(1);

    if (barcodeError) {
      return { success: false, error: barcodeError.message };
    }

    if (!barcodes || barcodes.length === 0) {
      return { success: false, error: "No barcode linked to this product" };
    }

    // Look up on OFF
    const offData = await lookupBarcodeOFF(barcodes[0].barcode);
    if (!offData) {
      return {
        success: false,
        error: "Product not found on Open Food Facts",
      };
    }

    // Get current product data for comparison
    const { data: product } = await supabase
      .from("products")
      .select("brand, picture_file_name")
      .eq("id", productId)
      .single();

    // Check if nutrition exists
    const { data: nutrition } = await supabase
      .from("product_nutrition")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();

    return {
      success: true,
      offData,
      currentBrand: product?.brand ?? null,
      currentImageFileName: product?.picture_file_name ?? null,
      hasNutrition: !!nutrition,
    };
  } catch (err) {
    console.error("refetchProductFromOFF error:", err);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Apply selected updates from OFF data to a product.
 */
export async function applyOFFUpdates(
  productId: string,
  offData: OFFProduct,
  flags: {
    updateImage: boolean;
    updateBrand: boolean;
    updateNutrition: boolean;
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get household_id from the product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("household_id")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { success: false, error: "Product not found" };
    }

    const householdId = product.household_id;

    // Update image
    if (flags.updateImage && offData.imageUrl) {
      const fileName = await downloadAndUploadOffImage(
        offData.imageUrl,
        householdId
      );
      if (fileName) {
        await supabase
          .from("products")
          .update({ picture_file_name: fileName })
          .eq("id", productId);
      }
    }

    // Update brand
    if (flags.updateBrand && offData.brands) {
      const storeName = detectStoreBrand(offData.brands);
      await supabase
        .from("products")
        .update({
          brand: offData.brands,
          is_store_brand: !!storeName,
        })
        .eq("id", productId);
    }

    // Update nutrition
    if (flags.updateNutrition && offData.nutriments) {
      const nutritionData = {
        household_id: householdId,
        product_id: productId,
        ...mapOFFNutrimentsToNutrition(offData.nutriments, offData.nutritionGrade),
      };

      // Check if nutrition row exists
      const { data: existing } = await supabase
        .from("product_nutrition")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("product_nutrition")
          .update(nutritionData)
          .eq("id", existing.id);
      } else {
        await supabase.from("product_nutrition").insert(nutritionData);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("applyOFFUpdates error:", err);
    return { success: false, error: "Unexpected error" };
  }
}
