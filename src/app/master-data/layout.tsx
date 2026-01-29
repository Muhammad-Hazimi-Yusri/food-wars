import { ReactNode } from "react";
import Link from "next/link";
import { Noren } from "@/components/diner/Noren";
import { MapPin, ShoppingCart, Tags, Scale, Package } from "lucide-react";

const navItems = [
  { href: "/master-data/products", label: "Products", icon: Package },
  { href: "/master-data/locations", label: "Locations", icon: MapPin },
  { href: "/master-data/product-groups", label: "Product Groups", icon: Tags },
  { href: "/master-data/quantity-units", label: "Quantity Units", icon: Scale },
  { href: "/master-data/shopping-locations", label: "Stores", icon: ShoppingCart },
];

export default function MasterDataLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Noren />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
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