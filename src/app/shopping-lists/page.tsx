import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { ShoppingListsClient } from "@/components/shopping/ShoppingListsClient";
import { ShoppingList } from "@/types/database";

async function getShoppingLists(): Promise<ShoppingList[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("shopping_lists")
    .select("*")
    .order("created_at", { ascending: false });

  return (data as ShoppingList[]) ?? [];
}

export default async function ShoppingListsPage() {
  const lists = await getShoppingLists();

  return (
    <div className="min-h-screen bg-gray-50">
      <Noren />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ShoppingListsClient lists={lists} />
      </main>
    </div>
  );
}
