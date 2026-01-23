import { Menu } from "lucide-react";

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
        <h1 className="font-[family-name:var(--font-display)] text-xl">
          🏮 Food Wars <span className="text-soma-light">食戟</span>
        </h1>
        <button className="p-2 hover:bg-megumi-light rounded">
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}