import { Noren } from "@/components/diner/Noren";
import { GuestStorageTest } from "@/components/GuestStorageTest";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Noren />
      <main className="p-8">
        <p className="text-lg mb-4">Welcome to Food Wars!</p>
        <GuestStorageTest />
      </main>
    </div>
  );
}