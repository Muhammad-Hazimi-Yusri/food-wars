"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, X, Send, Loader2, MessageSquare, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage } from "./ChatMessage";
import { StockEntryCard } from "./StockEntryCard";
import { ReceiptCaptureDialog, loadReceiptState } from "./ReceiptCaptureDialog";
import { ParsedStockItem } from "@/types/database";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "stock_entry";
  items?: ParsedStockItem[];
};

type HouseholdData = {
  products: { id: string; name: string; qu_id_stock: string | null; location_id: string | null; shopping_location_id: string | null }[];
  locations: { id: string; name: string }[];
  quantityUnits: { id: string; name: string; name_plural: string | null }[];
  shoppingLocations: { id: string; name: string }[];
  conversions: { id: string; product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[];
};

type ReceiptState = {
  items: ParsedStockItem[];
  checkedIndices: number[];
  wizardIndex: number;
};

export function AiChatWidget() {
  const [aiConfigured, setAiConfigured] = useState(false);
  const [hasVisionModel, setHasVisionModel] = useState(false);
  const [configChecked, setConfigChecked] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastOffset, setToastOffset] = useState(0);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [restoredReceiptState, setRestoredReceiptState] = useState<ReceiptState | null>(null);
  const householdDataRef = useRef<HouseholdData | null>(null);
  const dataLoadedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check AI config on mount + check for receipt return
  useEffect(() => {
    fetch("/api/ai/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data.settings;
        setAiConfigured(!!(settings?.ollama_url && settings?.text_model));
        setHasVisionModel(!!settings?.vision_model);
      })
      .catch(() => setAiConfigured(false))
      .finally(() => setConfigChecked(true));

    // Check for receipt return from product creation
    const params = new URLSearchParams(window.location.search);
    if (params.get("receiptReturn") === "1") {
      const savedState = loadReceiptState();
      if (savedState) {
        setRestoredReceiptState(savedState);
      }
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("receiptReturn");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  // When restored state is ready and AI is configured, open the receipt dialog
  useEffect(() => {
    if (restoredReceiptState && configChecked && aiConfigured) {
      setIsOpen(true);
      setReceiptDialogOpen(true);
      // Refresh household data to pick up newly created products
      dataLoadedRef.current = false;
      loadHouseholdData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredReceiptState, configChecked, aiConfigured]);

  // Load household data when chat first opens
  const loadHouseholdData = useCallback(async () => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    try {
      const supabase = createClient();
      const [productsRes, locsRes, unitsRes, storesRes, conversionsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, qu_id_stock, location_id, shopping_location_id")
          .eq("active", true)
          .order("name"),
        supabase
          .from("locations")
          .select("id, name")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("quantity_units")
          .select("id, name, name_plural")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("shopping_locations")
          .select("id, name")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("quantity_unit_conversions")
          .select("*"),
      ]);

      householdDataRef.current = {
        products: productsRes.data ?? [],
        locations: locsRes.data ?? [],
        quantityUnits: unitsRes.data ?? [],
        shoppingLocations: storesRes.data ?? [],
        conversions: conversionsRes.data ?? [],
      };
    } catch {
      // Silently fail — stock entry cards will just have empty dropdowns
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadHouseholdData();
  }, [isOpen, loadHouseholdData]);

  // Track sonner toast height so FAB slides above toasts
  useEffect(() => {
    let frameId: number;

    const measure = () => {
      const toasts = document.querySelectorAll<HTMLElement>("[data-sonner-toast]");
      if (toasts.length === 0) {
        setToastOffset(0);
        return;
      }
      let minTop = Infinity;
      toasts.forEach((t) => {
        const rect = t.getBoundingClientRect();
        if (rect.height > 0 && rect.top < minTop) minTop = rect.top;
      });
      if (minTop === Infinity) {
        setToastOffset(0);
        return;
      }
      const fromBottom = window.innerHeight - minTop;
      setToastOffset(fromBottom > 0 ? fromBottom : 0);
    };

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      type: "text",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Build history from last 10 messages
      const history = [...messages, userMessage].slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: history.slice(0, -1), // exclude the current message
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get response");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || "I couldn't generate a response.",
        type: data.type ?? "text",
        items: data.items,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: errMsg,
          type: "text",
        },
      ]);

      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const refreshHouseholdData = () => {
    dataLoadedRef.current = false;
    loadHouseholdData();
  };

  // Don't render anything until we've checked config
  if (!configChecked || !aiConfigured) return null;

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{ bottom: `${24 + toastOffset}px` }}
          className="fixed right-6 z-50 h-14 w-14 rounded-full
                     bg-megumi text-white shadow-lg hover:bg-megumi-light
                     flex items-center justify-center transition-[bottom] duration-300
                     hover:scale-105 active:scale-95"
          aria-label="Open AI assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 z-50
                     w-full sm:w-[400px] sm:bottom-6 sm:right-6
                     h-[100dvh] sm:h-[min(500px,80vh)] sm:rounded-xl
                     bg-white border border-gray-200 shadow-2xl
                     flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-megumi text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">Food Wars AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  loadHouseholdData();
                  setReceiptDialogOpen(true);
                }}
                className="hover:bg-white/20 rounded-full p-1 transition-colors"
                aria-label="Scan receipt"
                title="Scan receipt"
              >
                <Receipt className="h-4 w-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="hover:bg-white/20 rounded-full p-1 transition-colors"
                  aria-label="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-1 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Welcome */}
            {messages.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="h-12 w-12 rounded-full bg-megumi/10 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-megumi" />
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">
                  Food Wars AI Assistant
                </p>
                <p className="text-xs text-gray-400">
                  Add stock, ask about your inventory, get cooking ideas, or
                  check expiry dates.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                  {[
                    "2 cans of tomatoes, aldi, £1",
                    "What's expiring soon?",
                    "What can I cook?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-megumi/20
                                 text-megumi hover:bg-megumi/5 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content}>
                {msg.type === "stock_entry" && msg.items && msg.items.length > 0 && (
                  <StockEntryCard
                    items={msg.items}
                    householdData={householdDataRef.current}
                    onSaved={refreshHouseholdData}
                  />
                )}
              </ChatMessage>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="shrink-0 h-7 w-7 rounded-full bg-megumi text-white flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="border-t border-gray-200 p-3 flex gap-2 shrink-0"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="icon"
              className="bg-megumi hover:bg-megumi/90 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Receipt scanning dialog */}
      <ReceiptCaptureDialog
        open={receiptDialogOpen}
        onOpenChange={(val) => {
          setReceiptDialogOpen(val);
          if (!val) setRestoredReceiptState(null);
        }}
        householdData={householdDataRef.current}
        hasVisionModel={hasVisionModel}
        onImported={refreshHouseholdData}
        initialState={restoredReceiptState}
      />
    </>
  );
}
