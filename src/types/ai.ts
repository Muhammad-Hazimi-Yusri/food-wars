// ============================================
// AI RESPONSE TYPES
// Used by /api/ai/chat route and AiChatWidget
// ============================================

export type RecipeRef = {
  recipe_id: string;
  recipe_name: string;
  can_make: boolean;
  missing_count: number;
};

export type RecipeAction = {
  action: "add_missing_to_shopping_list";
  recipe_id: string;
  recipe_name: string;
};

export type RecipeDraftIngredient = {
  product_name: string;
  product_id: string | null;
  qu_id: string | null;
  amount: number;
  unit_name: string;
  ingredient_group: string | null;
  note: string | null;
  variable_amount: string | null;
};

export type RecipeDraft = {
  name: string;
  description: string | null;
  instructions: string | null;
  base_servings: number;
  ingredients: RecipeDraftIngredient[];
};
