"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onChange(file);
  };

  const handleRemove = () => {
    setPreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    onRemove();
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative inline-block">
          <div className="relative h-32 w-32 overflow-hidden rounded-lg border">
            <Image
              src={preview}
              alt="Product preview"
              fill
              className="object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-md hover:bg-red-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Camera - mobile only (shows on desktop but opens file picker) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          {/* Gallery/file picker */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          
          {/* Mobile: Camera button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
            className="h-12 flex-1 gap-2 sm:hidden"
          >
            <Camera className="h-5 w-5" />
            Take Photo
          </Button>
          
          {/* Desktop & Mobile: Upload/Gallery button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => galleryInputRef.current?.click()}
            className="h-12 flex-1 gap-2"
          >
            <Upload className="h-5 w-5" />
            <span className="sm:hidden">Choose Photo</span>
            <span className="hidden sm:inline">Upload Image</span>
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, GIF, or HEIC. Max 5MB.
      </p>
    </div>
  );
}