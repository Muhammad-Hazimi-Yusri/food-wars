import { createClient } from "@/lib/supabase/client";

export async function uploadProductPicture(
  file: File,
  householdId: string
): Promise<string | null> {
  const supabase = createClient();

  // Generate unique filename
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${householdId}/${crypto.randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("product-pictures")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  return fileName;
}

export async function deleteProductPicture(
  fileName: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from("product-pictures")
    .remove([fileName]);

  if (error) {
    console.error("Delete error:", error);
    return false;
  }

  return true;
}

export async function getProductPictureSignedUrl(
  fileName: string | null
): Promise<string | null> {
  if (!fileName) return null;

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("product-pictures")
    .createSignedUrl(fileName, 3600); // 1 hour expiry

  if (error) {
    console.error("Signed URL error:", error);
    return null;
  }

  return data?.signedUrl || null;
}