"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { createRecipe, updateRecipe } from "@/lib/recipe-actions";
import {
  uploadRecipePicture,
  deleteRecipePicture,
  getRecipePictureSignedUrl,
} from "@/lib/supabase/storage";
import { getHouseholdId } from "@/lib/supabase/get-household";
import type { Recipe } from "@/types/database";

type Props = {
  recipe?: Recipe; // undefined = create mode
};

export function RecipeForm({ recipe }: Props) {
  const router = useRouter();
  const isEdit = !!recipe;

  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [instructionsTab, setInstructionsTab] = useState<"edit" | "preview">("edit");
  const [baseServings, setBaseServings] = useState(
    recipe?.base_servings?.toString() ?? "1"
  );

  // Picture state
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(
    recipe?.picture_file_name ?? null
  );
  const [removePicture, setRemovePicture] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load signed URL for existing picture
  useEffect(() => {
    if (recipe?.picture_file_name) {
      getRecipePictureSignedUrl(recipe.picture_file_name).then((url) => {
        setPreviewUrl(url);
      });
    }
  }, [recipe?.picture_file_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Recipe name is required.");
      return;
    }

    const servings = parseFloat(baseServings);
    if (isNaN(servings) || servings < 0.25) {
      setError("Servings must be at least 0.25.");
      return;
    }

    setSaving(true);
    try {
      let pictureFileName = currentFileName;

      // Handle picture changes
      if (removePicture && currentFileName) {
        await deleteRecipePicture(currentFileName);
        pictureFileName = null;
      }

      if (pictureFile) {
        const household = await getHouseholdId();
        if (household.success) {
          // Remove old picture if replacing
          if (currentFileName && !removePicture) {
            await deleteRecipePicture(currentFileName);
          }
          pictureFileName = await uploadRecipePicture(
            pictureFile,
            household.householdId
          );
        }
      }

      if (isEdit) {
        const result = await updateRecipe(recipe.id, {
          name: trimmedName,
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          base_servings: servings,
          picture_file_name: pictureFileName,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await createRecipe({
          name: trimmedName,
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          base_servings: servings,
          picture_file_name: pictureFileName,
        });
        if (!result.success) throw new Error(result.error);
      }

      router.push("/recipes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form fields */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spaghetti Carbonara"
                disabled={saving}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of the dish..."
                disabled={saving}
                rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              />
            </div>

            {/* Instructions (Markdown) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="instructions">Instructions</Label>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setInstructionsTab("edit")}
                    className={`px-2 py-0.5 rounded ${instructionsTab === "edit" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructionsTab("preview")}
                    disabled={!instructions.trim()}
                    className={`px-2 py-0.5 rounded ${instructionsTab === "preview" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"} disabled:opacity-40`}
                  >
                    Preview
                  </button>
                </div>
              </div>
              {instructionsTab === "edit" ? (
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={"1. Preheat oven to 200°C\n2. Mix flour and butter...\n\nTip: Use room-temperature eggs for best results."}
                  disabled={saving}
                  rows={8}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              ) : (
                <div className="min-h-[10rem] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm prose prose-sm max-w-none overflow-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {instructions}
                  </ReactMarkdown>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Supports Markdown: **bold**, numbered lists, etc.
              </p>
            </div>

            {/* Base servings */}
            <div className="space-y-1.5">
              <Label htmlFor="servings">Base Servings</Label>
              <div className="flex items-center gap-2 max-w-[180px]">
                <button
                  type="button"
                  disabled={saving || parseFloat(baseServings) <= 0.25}
                  onClick={() =>
                    setBaseServings((prev) =>
                      Math.max(0.25, parseFloat(prev) - 0.25).toString()
                    )
                  }
                  className="h-9 w-9 rounded-md border border-input flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <Input
                  id="servings"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={baseServings}
                  onChange={(e) => setBaseServings(e.target.value)}
                  disabled={saving}
                  className="text-center"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setBaseServings((prev) =>
                      (parseFloat(prev) + 0.25).toString()
                    )
                  }
                  className="h-9 w-9 rounded-md border border-input flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="bg-soma text-white hover:bg-soma-dark">
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Recipe"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => router.push("/recipes")}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Picture sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <Label>Recipe Photo</Label>
            <ImageUpload
              value={currentFileName}
              previewUrl={previewUrl}
              onChange={(file) => {
                setPictureFile(file);
                setRemovePicture(false);
              }}
              onRemove={() => {
                setPictureFile(null);
                setPreviewUrl(null);
                setRemovePicture(true);
                setCurrentFileName(null);
              }}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
