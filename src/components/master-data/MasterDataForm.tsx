"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
};

type MasterDataFormProps = {
  table: string;
  title: string;
  fields: FieldConfig[];
  item: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
};

export function MasterDataForm({
  table,
  title,
  fields,
  item,
  open,
  onClose,
}: MasterDataFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Initialize form data
  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      // Default values for new item
      const defaults: Record<string, unknown> = {};
      fields.forEach((f) => {
        if (f.type === "checkbox") defaults[f.name] = f.name === "active" ? true : false;
        else if (f.type === "number") defaults[f.name] = 0;
        else defaults[f.name] = "";
      });
      setFormData(defaults);
    }
  }, [item, fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createClient();
      
      // Get user's household
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: household } = await supabase
        .from("households")
        .select("id")
        .single();
      
      if (!household) throw new Error("No household found");

      const payload: Record<string, unknown> = { ...formData };
      
      // Clean up empty strings to null
      Object.keys(payload).forEach(key => {
        if (payload[key] === "") payload[key] = null;
      });

      if (item?.id) {
        // Update
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        // Insert
        payload.household_id = household.id;
        const { error } = await supabase
          .from(table)
          .insert(payload);
        if (error) throw error;
      }

      onClose();
      router.refresh();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              {field.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <input
                    id={field.name}
                    type="checkbox"
                    checked={!!formData[field.name]}
                    onChange={(e) => updateField(field.name, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor={field.name} className="font-normal">
                    {field.label}
                  </Label>
                </div>
              ) : field.type === "textarea" ? (
                <>
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <textarea
                    id={field.name}
                    value={(formData[field.name] as string) ?? ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    type={field.type}
                    value={(formData[field.name] as string | number) ?? ""}
                    onChange={(e) =>
                      updateField(
                        field.name,
                        field.type === "number"
                          ? parseInt(e.target.value) || 0
                          : e.target.value
                      )
                    }
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                </>
              )}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}