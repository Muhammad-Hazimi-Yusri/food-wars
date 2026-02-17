"use client";

import { Bot, User } from "lucide-react";

type Props = {
  role: "user" | "assistant";
  content: string;
  children?: React.ReactNode;
};

export function ChatMessage({ role, content, children }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
          isUser ? "bg-megumi/10 text-megumi" : "bg-megumi text-white"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>
      <div
        className={`max-w-[80%] space-y-2 ${isUser ? "text-right" : "text-left"}`}
      >
        <div
          className={`inline-block px-3 py-2 rounded-xl text-sm ${
            isUser
              ? "bg-megumi text-white rounded-br-sm"
              : "bg-gray-100 text-gray-800 rounded-bl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
