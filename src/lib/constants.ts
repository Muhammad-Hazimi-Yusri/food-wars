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