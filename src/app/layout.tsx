import type { Metadata } from "next";
import { Suspense } from "react";
import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { GuestBanner } from "@/components/diner/GuestBanner";
import { Toaster } from "@/components/ui/sonner";
import { AiChatWidget } from "@/components/ai/AiChatWidget";

const delaGothic = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Food Wars | 食戟",
  description: "FOSS kitchen inventory app with Japanese diner aesthetic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${delaGothic.variable} ${zenKaku.variable} antialiased`}>
        <GuestBanner />
        {children}
        <Toaster />
        <Suspense>
          <AiChatWidget />
        </Suspense>
      </body>
    </html>
  );
}