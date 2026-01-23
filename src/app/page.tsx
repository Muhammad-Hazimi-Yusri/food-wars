import { Noren } from "@/components/diner/Noren";
import { GuestStorageTest } from "@/components/GuestStorageTest";
import { AuthStatus } from "@/components/AuthStatus";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Noren />
      <main className="p-8">
        <AuthStatus />
        <p className="text-lg my-4">Welcome to Food Wars!</p>
        <GuestStorageTest />
      </main>
    </div>
  );
}