import { Noren } from "@/components/diner/Noren";
import { InventoryList } from "@/components/inventory/InventoryList";
import { WelcomeModal } from "@/components/diner/WelcomeModal";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Noren />
      <main className="p-4 sm:p-8 max-w-5xl mx-auto">
        <InventoryList />
      </main>
      <WelcomeModal />
    </div>
  );
}