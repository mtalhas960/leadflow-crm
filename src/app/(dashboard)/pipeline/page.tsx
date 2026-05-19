"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeadStore } from "@/lib/stores/leadStore";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { Loader2 } from "lucide-react";

export default function PipelinePage() {
  const [workspaceId] = useState("default");
  const { loading, initialize, refreshStats } = useLeadStore();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        initialize(workspaceId);
        refreshStats(workspaceId);
      }
    });
    return () => unsub();
  }, [workspaceId, initialize, refreshStats]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pipeline</h2>
        <p className="text-muted-foreground">
          Drag and drop leads between stages to update their status.
        </p>
      </div>
      <KanbanBoard />
    </div>
  );
}
