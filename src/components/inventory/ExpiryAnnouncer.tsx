"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const TOAST_SESSION_KEY = "fw:expiryToastShown";
const BROWSER_NOTIFY_KEY = "fw:lastBrowserNotify";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mounted on the dashboard. On first load per browser session:
 *   1. Fetches expiring items.
 *   2. Shows one Sonner toast summary (guarded by sessionStorage).
 *   3. Fires a browser Web Notification once per day (guarded by localStorage).
 *   4. If browser permission is 'default', renders a small prompt button
 *      (permission requests must come from a user gesture, so no auto-ask).
 *
 * Hidden completely when there's nothing to warn about.
 */
export function ExpiryAnnouncer() {
  const [data, setData] = useState<Payload | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return null;
      }
      return Notification.permission;
    }
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/notifications/expiring")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Payload | null) => {
        if (cancelled || !json || !json.enabled || json.total === 0) return;
        setData(json);

        // 1. Sonner toast — once per browser session
        try {
          if (!sessionStorage.getItem(TOAST_SESSION_KEY)) {
            const topNames = [
              ...json.expired,
              ...json.overdue,
              ...json.dueSoon,
            ]
              .slice(0, 3)
              .map((i) => i.name)
              .join(", ");

            toast.warning(
              `${json.total} item${json.total === 1 ? "" : "s"} expiring soon`,
              {
                description: topNames,
                duration: 10000,
                action: {
                  label: "View",
                  onClick: () => {
                    window.location.href = "/reports/expiring";
                  },
                },
              }
            );
            sessionStorage.setItem(TOAST_SESSION_KEY, "1");
          }
        } catch {
          /* sessionStorage may be blocked */
        }

        // 2. Browser Web Notification — once per day
        if (
          json.notifyBrowser &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const lastDate = localStorage.getItem(BROWSER_NOTIFY_KEY);
            const today = todayIso();
            if (lastDate !== today) {
              const topNames = [
                ...json.expired,
                ...json.overdue,
                ...json.dueSoon,
              ]
                .slice(0, 3)
                .map((i) => i.name)
                .join(", ");
              new Notification("Food Wars — items expiring", {
                body: `${json.total} items need attention: ${topNames}`,
                icon: "/favicon.ico",
                tag: "food-wars-expiry",
              });
              localStorage.setItem(BROWSER_NOTIFY_KEY, today);
            }
          } catch {
            /* localStorage may be blocked */
          }
        }
      })
      .catch(() => {
        /* silent — non-critical */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Only render UI when the user could opt into browser notifications
  const showPermissionPrompt =
    data &&
    data.notifyBrowser &&
    permission === "default" &&
    typeof window !== "undefined" &&
    "Notification" in window;

  if (!showPermissionPrompt) return null;

  const handleEnable = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Browser notifications enabled");
      }
    } catch {
      toast.error("Could not request notification permission");
    }
  };

  return (
    <div className="mb-3 p-3 rounded-lg border border-takumi/40 bg-takumi/5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Bell className="h-4 w-4 text-takumi" />
        <span>
          Enable browser notifications to get OS-level alerts when food is about
          to expire.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleEnable}
        className="flex-shrink-0"
      >
        Enable
      </Button>
    </div>
  );
}
