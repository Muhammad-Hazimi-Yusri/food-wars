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
