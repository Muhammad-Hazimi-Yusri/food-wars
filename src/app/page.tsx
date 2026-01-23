import { Noren } from "@/components/diner/Noren";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Noren />
      <main className="p-8">
        <p className="text-lg">Welcome to Food Wars!</p>
      </main>
    </div>
  );
}