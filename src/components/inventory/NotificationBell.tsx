"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ExpiringItem = {
  id: string;
  name: string;
  best_before_date: string;
  daysUntil: number;
};

type Payload = {
  enabled: boolean;
  notifyBrowser: boolean;
  notifyDaysBefore: number;
  expired: ExpiringItem[];
  overdue: ExpiringItem[];
  dueSoon: ExpiringItem[];
  total: number;
};

function daysLabel(d: number): string {
  if (d < 0) {
    const abs = Math.abs(d);
    return abs === 1 ? "1 day ago" : `${abs} days ago`;
  }
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

export function NotificationBell() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/expiring")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        /* silent — non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !data.enabled || data.total === 0) {
    return null;
  }

  const badge = Math.min(data.total, 99);
  const urgent = data.expired.length + data.overdue.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-1.5 text-xs text-muted-foreground hover:text-megumi"
          title={`${data.total} items need attention`}
        >
          <Bell className="h-4 w-4" />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              urgent > 0 ? "bg-kurokiba" : "bg-takumi"
            )}
          >
            {badge}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 border-b">
          <div className="text-sm font-semibold text-megumi">Expiring Soon</div>
          <div className="text-xs text-gray-500">
            {data.total} {data.total === 1 ? "item" : "items"} to use up
          </div>
        </div>

        {data.expired.length > 0 && (
          <Section
            title="Expired"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-kurokiba" />}
            items={data.expired}
            tone="text-kurokiba"
          />
        )}
        {data.overdue.length > 0 && (
          <Section
            title="Overdue"
            icon={<AlertCircle className="h-3.5 w-3.5 text-gray-500" />}
            items={data.overdue}
            tone="text-gray-700"
          />
        )}
        {data.dueSoon.length > 0 && (
          <Section
            title={`Due within ${data.notifyDaysBefore} day${data.notifyDaysBefore === 1 ? "" : "s"}`}
            icon={<Clock className="h-3.5 w-3.5 text-takumi" />}
            items={data.dueSoon}
            tone="text-gray-800"
          />
        )}

        <div className="px-3 py-2 border-t">
          <Link
            href="/reports/expiring"
            className="text-xs text-megumi hover:underline"
          >
            View all expiring items →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function Section({
    title,
    icon,
    items,
    tone,
  }: {
    title: string;
    icon: React.ReactNode;
    items: ExpiringItem[];
    tone: string;
  }) {
    return (
      <div className="px-3 py-2 border-b last:border-b-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          {icon}
          <span className="text-xs font-semibold uppercase text-gray-500">
            {title}
          </span>
          <span className="text-xs text-gray-400">({items.length})</span>
        </div>
        <ul className="space-y-1">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="flex justify-between gap-2 text-xs">
              <span className={cn("truncate", tone)}>{item.name}</span>
              <span className="text-gray-500 flex-shrink-0">
                {daysLabel(item.daysUntil)}
              </span>
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-xs text-gray-400 italic">
              +{items.length - 5} more
            </li>
          )}
        </ul>
      </div>
    );
  }
}
