"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useTimeTrackingStore } from "@/lib/stores/timeTrackingStore";
import { useLeadStore } from "@/lib/stores/leadStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import { formatDuration, formatDate } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

export default function TimeTrackerPage() {
  const [workspaceId] = useState("default");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    leadId: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    hours: "",
    minutes: "",
    billable: false,
  });

  const {
    timer,
    entries,
    loading,
    totalSeconds,
    startTimer,
    stopTimer,
    resetTimer,
    setTimerDescription,
    setTimerBillable,
    initialize,
    addManualEntry,
    deleteEntry,
  } = useTimeTrackingStore();

  const { leads } = useLeadStore();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        initialize(workspaceId);
      }
    });
    return () => unsub();
  }, [workspaceId, initialize]);

  // Timer tick
  const [displayElapsed, setDisplayElapsed] = useState(0);
  useEffect(() => {
    if (!timer.isRunning || !timer.startTime) {
      setDisplayElapsed(timer.elapsed);
      return;
    }
    const interval = setInterval(() => {
      setDisplayElapsed(Math.floor((Date.now() - timer.startTime!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startTime, timer.elapsed]);

  const handleStopTimer = async () => {
    const u = auth.currentUser;
    if (!u) return;
    const id = await stopTimer(workspaceId, u.uid);
    if (id) {
      toast.success("Time entry saved");
    } else {
      toast.error("Failed to save time entry");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = auth.currentUser;
    if (!u || !manualEntry.description) {
      toast.error("Description is required");
      return;
    }

    const hours = parseInt(manualEntry.hours) || 0;
    const minutes = parseInt(manualEntry.minutes) || 0;
    const duration = hours * 3600 + minutes * 60;

    if (duration === 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    const date = new Date(manualEntry.date);
    const startTime = Timestamp.fromDate(date);
    const endTime = Timestamp.fromDate(new Date(date.getTime() + duration * 1000));

    await addManualEntry(workspaceId, u.uid, {
      leadId: manualEntry.leadId || null,
      description: manualEntry.description,
      startTime,
      endTime,
      duration,
      billable: manualEntry.billable,
      hourlyRate: null,
    });

    setManualEntry({
      leadId: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      hours: "",
      minutes: "",
      billable: false,
    });
    setShowManualForm(false);
    toast.success("Time entry added");
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    toast.success("Entry deleted");
  };

  // Group entries by date
  const groupedEntries: Record<string, typeof entries> = {};
  for (const entry of entries) {
    const dateStr = entry.startTime?.toDate().toLocaleDateString() || "Unknown";
    if (!groupedEntries[dateStr]) groupedEntries[dateStr] = [];
    groupedEntries[dateStr].push(entry);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Time Tracker</h2>
          <p className="text-muted-foreground">
            Track time spent on leads and tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: {formatDuration(totalSeconds)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowManualForm(!showManualForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Timer Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Timer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="timer-lead">Lead (optional)</Label>
              <Select
                value={timer.leadId || ""}
                onValueChange={(v) =>
                  startTimer(v || undefined, timer.description)
                }
                disabled={timer.isRunning}
              >
                <SelectTrigger id="timer-lead">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.firstName} {lead.lastName}
                      {lead.company ? ` — ${lead.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="timer-desc">Description</Label>
              <Input
                id="timer-desc"
                placeholder="What are you working on?"
                value={timer.description}
                onChange={(e) => setTimerDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="timer-billable"
                  checked={timer.billable}
                  onCheckedChange={(c) => setTimerBillable(!!c)}
                />
                <Label htmlFor="timer-billable" className="text-sm">
                  Billable
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-[100px] text-center">
                <span className="text-3xl font-mono font-bold tabular-nums">
                  {String(Math.floor(displayElapsed / 3600)).padStart(2, "0")}:
                  {String(Math.floor((displayElapsed % 3600) / 60)).padStart(2, "0")}:
                  {String(displayElapsed % 60).padStart(2, "0")}
                </span>
              </div>
              {!timer.isRunning ? (
                <Button
                  size="icon"
                  className="h-10 w-10 bg-green-600 hover:bg-green-700"
                  onClick={() => startTimer(timer.leadId || undefined, timer.description)}
                >
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-10 w-10"
                  onClick={handleStopTimer}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
              {!timer.isRunning && timer.elapsed > 0 && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10"
                  onClick={resetTimer}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Form */}
      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Time Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Lead (optional)</Label>
                  <Select
                    value={manualEntry.leadId}
                    onValueChange={(v) =>
                      setManualEntry({ ...manualEntry, leadId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.firstName} {lead.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={manualEntry.date}
                    onChange={(e) =>
                      setManualEntry({ ...manualEntry, date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What did you work on?"
                  value={manualEntry.description}
                  onChange={(e) =>
                    setManualEntry({ ...manualEntry, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={manualEntry.hours}
                    onChange={(e) =>
                      setManualEntry({ ...manualEntry, hours: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={manualEntry.minutes}
                    onChange={(e) =>
                      setManualEntry({ ...manualEntry, minutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="manual-billable"
                  checked={manualEntry.billable}
                  onCheckedChange={(c) =>
                    setManualEntry({ ...manualEntry, billable: !!c })
                  }
                />
                <Label htmlFor="manual-billable">Billable</Label>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowManualForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Entry</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Time Entries */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No time entries</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start the timer or add a manual entry to track your time.
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedEntries).map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((s, e) => s + e.duration, 0);
            return (
              <Card key={date}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                  <CardTitle className="text-sm font-medium">
                    {date}
                  </CardTitle>
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatDuration(dayTotal)}
                  </span>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {dayEntries.map((entry) => {
                    const lead = leads.find((l) => l.id === entry.leadId);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {entry.description}
                          </p>
                          {lead && (
                            <p className="text-xs text-muted-foreground">
                              {lead.firstName} {lead.lastName}
                              {lead.company ? ` — ${lead.company}` : ""}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(entry.startTime?.toDate())} ·{" "}
                            {entry.startTime?.toDate().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-mono font-medium">
                              {formatDuration(entry.duration)}
                            </p>
                            {entry.billable && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                Billable
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
