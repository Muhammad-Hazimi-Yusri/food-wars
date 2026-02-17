"use client";

import React from "react";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      style={{ "--z-index": "45" } as React.CSSProperties}
      toastOptions={{
        duration: 8000,
      }}
    />
  );
}
