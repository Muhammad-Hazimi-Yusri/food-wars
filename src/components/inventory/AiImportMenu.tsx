"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wand2, FileJson, FileOutput } from "lucide-react";
import { ExportContextDialog } from "@/components/ai/ExportContextDialog";
import { PasteJsonImportDialog } from "@/components/ai/PasteJsonImportDialog";
import type { HouseholdData } from "@/components/ai/StockEntryCard";

type Props = {
  householdData: HouseholdData;
};

/**
 * Header menu that groups the copy-paste AI import flow:
 *   - "Export context" — copyable prompt bundle for Claude.ai / ChatGPT
 *   - "Import from AI JSON" — paste a JSON response to bulk-create products + stock
 */
export function AiImportMenu({ householdData }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-megumi"
            title="AI import tools"
          >
            <Wand2 className="h-3.5 w-3.5" />
            AI Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setExportOpen(true)} className="gap-2">
            <FileOutput className="h-4 w-4" />
            Export context for AI
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2">
            <FileJson className="h-4 w-4" />
            Import from AI JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportContextDialog open={exportOpen} onOpenChange={setExportOpen} />
      <PasteJsonImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        householdData={householdData}
        onImported={() => {
          // Parent refresh happens automatically via router.refresh() inside the dialog.
        }}
      />
    </>
  );
}
