-- Compound index for barcode scan resolution: WHERE household_id = ? AND barcode = ?
CREATE INDEX IF NOT EXISTS idx_product_barcodes_household_barcode
  ON product_barcodes (household_id, barcode);
