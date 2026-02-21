"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";
import { Settings, BookOpen, ShoppingCart, Bot, ChefHat } from "lucide-react";
import Link from "next/link";

export function UserMenu() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("hasVisitedBefore");
    window.location.reload();
  };

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-megumi-light animate-pulse" />;
  }

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.name ?? "Guest";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 p-1 rounded hover:bg-megumi-light">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-hayama flex items-center justify-center">
            <User className="w-4 h-4 text-megumi" />
          </div>
        )}
        <span className="text-sm hidden sm:inline">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user ? (
          <DropdownMenuItem onClick={handleSignOut}>
            Sign out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleSignIn}>
            Sign in with Google
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/shopping-lists" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Shopping Lists
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/recipes" className="flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Recipes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/journal" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Journal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/master-data" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Master Data
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}