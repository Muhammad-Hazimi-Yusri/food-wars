// Guest household UUID - shared by all anonymous users
export const GUEST_HOUSEHOLD_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Cook Now — cooking role constants
// ---------------------------------------------------------------------------

/** The 6 roles shown in the Cook Now Setup UI (subset of the 8 DB-valid values). */
export const COOKING_ROLES = [
  'protein',
  'produce',
  'starch',
  'seasoning_system',
  'form_factor_base',
  'other',
] as const;

export type SetupCookingRole = (typeof COOKING_ROLES)[number];

export const COOKING_ROLE_LABELS: Record<SetupCookingRole, string> = {
  protein: 'Protein',
  produce: 'Produce',
  starch: 'Starch',
  seasoning_system: 'Seasoning',
  form_factor_base: 'Base',
  other: 'Other',
};

/**
 * Auto-suggest mapping: product-group name keywords → cooking role.
 * Matching is case-insensitive substring against the group name; first match wins.
 */
export const COOKING_ROLE_AUTO_SUGGEST: { keywords: string[]; role: SetupCookingRole }[] = [
  { keywords: ['meat', 'seafood', 'fish', 'poultry', 'chicken'], role: 'protein' },
  { keywords: ['dairy', 'egg', 'cheese'], role: 'protein' },
  { keywords: ['produce', 'vegetable', 'fruit', 'veg'], role: 'produce' },
  { keywords: ['bakery', 'bread', 'pasta', 'rice', 'grain', 'cereal'], role: 'starch' },
  { keywords: ['pantry', 'staple'], role: 'starch' },
  { keywords: ['spice', 'seasoning', 'herb'], role: 'seasoning_system' },
  { keywords: ['condiment', 'sauce'], role: 'seasoning_system' },
  { keywords: ['snack', 'beverage', 'drink', 'frozen'], role: 'other' },
];

// ---------------------------------------------------------------------------
// Cook Now — dashboard bucket constants
// ---------------------------------------------------------------------------

export const DASHBOARD_BUCKETS = [
  'seasoning_system',
  'protein',
  'form_factor_base',
  'produce',
  'starch',
  'other',
  'untagged',
] as const;

export type DashboardBucketKey = (typeof DASHBOARD_BUCKETS)[number];

export const DASHBOARD_BUCKET_LABELS: Record<DashboardBucketKey, string> = {
  seasoning_system: 'Seasoning System',
  protein: 'Protein',
  form_factor_base: 'Form Factor',
  produce: 'Produce',
  starch: 'Starch',
  other: 'Other',
  untagged: 'Untagged',
};

/**
 * Maps all 8 DB-valid cooking_role values to a dashboard bucket.
 * 'vegetable' → produce, 'sauce' → other (valid in DB but not in setup UI).
 */
export const COOKING_ROLE_TO_BUCKET: Record<string, DashboardBucketKey> = {
  protein: 'protein',
  produce: 'produce',
  starch: 'starch',
  seasoning_system: 'seasoning_system',
  form_factor_base: 'form_factor_base',
  other: 'other',
  vegetable: 'produce',
  sauce: 'other',
};