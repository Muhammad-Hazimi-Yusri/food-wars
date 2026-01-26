-- ============================================
-- FOOD WARS STORAGE v0.4.1
-- Supabase Storage buckets and policies
-- ============================================

-- ============================================
-- PRODUCT PICTURES BUCKET
-- ============================================

-- Create bucket (5MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-pictures',
  'product-pictures',
  false,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
);

-- Policy: Users can upload to their household folder
CREATE POLICY "Users can upload product pictures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-pictures'
  AND auth.role() = 'authenticated'
);

-- Policy: Users can view pictures
CREATE POLICY "Users can view product pictures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-pictures'
  AND auth.role() = 'authenticated'
);

-- Policy: Users can update their pictures
CREATE POLICY "Users can update product pictures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-pictures'
  AND auth.role() = 'authenticated'
);

-- Policy: Users can delete their pictures
CREATE POLICY "Users can delete product pictures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-pictures'
  AND auth.role() = 'authenticated'
);

-- ============================================
-- RECIPE PICTURES BUCKET (for v0.9)
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-pictures',
  'recipe-pictures',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
);

CREATE POLICY "Users can upload recipe pictures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recipe-pictures'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view recipe pictures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'recipe-pictures'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update recipe pictures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'recipe-pictures'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete recipe pictures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recipe-pictures'
  AND auth.role() = 'authenticated'
);