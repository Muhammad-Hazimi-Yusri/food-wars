import { UserMenu } from "@/components/diner/UserMenu";
import Link from "next/link";

export function Noren() {
  return (
    <header className="bg-megumi text-hayama-light">
      {/* Curtain fringe effect */}
      <div className="flex justify-center gap-1 py-1 bg-soma">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-2 h-4 bg-soma-dark rounded-b" />
        ))}
      </div>
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-xl hover:opacity-80 transition-opacity">
          🏮 Food Wars <span className="text-soma-light">食戟</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}