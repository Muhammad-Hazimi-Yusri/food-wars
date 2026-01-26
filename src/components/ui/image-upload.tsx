"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

type ImageUploadProps = {
  value: string | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  previewUrl: string | null;
  disabled?: boolean;
};

export function ImageUpload({
  value,
  onChange,
  onRemove,
  previewUrl,
  disabled = false,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(previewUrl);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please select a valid image file (JPEG, PNG, WebP, GIF, or HEIC)");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onChange(file);
  };

  const handleRemove = () => {
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onRemove();
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative w-32 h-32">
          <Image
            src={preview}
            alt="Product preview"
            fill
            className="object-cover rounded-lg border"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
            id="product-picture-input"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, GIF, or HEIC. Max 5MB.
      </p>
    </div>
  );
}