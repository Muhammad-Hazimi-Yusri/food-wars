import { ReactNode } from "react";
import Link from "next/link";
import { Noren } from "@/components/diner/Noren";
import { Trash2, ShoppingBag, Package, Clock } from "lucide-react";

const navItems = [
  { href: "/reports/waste",       label: "Waste",        icon: Trash2 },
  { href: "/reports/spending",    label: "Spending",     icon: ShoppingBag },
  { href: "/reports/stock-value", label: "Stock Value",  icon: Package },
  { href: "/reports/expiring",    label: "Expiring Soon", icon: Clock },
];

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Noren />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports</h1>
          <p className="text-sm text-gray-500">Insights across your household inventory</p>
        </div>

        {/* Mobile: horizontal scroll tabs */}
        <nav className="mb-6 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-gray-200 text-sm font-medium text-gray-700 hover:bg-megumi hover:text-white hover:border-megumi transition-colors whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {children}
      </main>
    </div>
  );
}
