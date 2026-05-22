"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Grid, 
  List, 
  MessageSquare, 
  ChevronRight,
  BookOpen,
  Send,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrentCreatorState } from "@/lib/types";
import { getTierGap, TIERS } from "@/lib/cashback/engine";

interface ManagerDashboardProps {
  creators: CurrentCreatorState[];
  userDisplayName: string;
}

export default function ManagerDashboard({
  creators,
  userDisplayName
}: ManagerDashboardProps) {
  const [viewMode, setViewMode] = useState<"matrix" | "roster">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Coaching notes dialog state
  const [selectedCreator, setSelectedCreator] = useState<CurrentCreatorState | null>(null);
  const [notesList, setNotesList] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Stats calculations
  const totalDiamonds = creators.reduce((sum, c) => sum + BigInt(c.diamonds || 0), 0n);
  const activeCount = creators.length;
  const atRiskCount = creators.filter(c => c.creator_status === "risk").length;
  
  // Estimate close count
  const closeCount = creators.filter(c => c.creator_status === "close").length;

  // Filter creators
  const filteredCreators = creators.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tiktok_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group creators for Matrix view
  const matrix = {
    risk: filteredCreators.filter(c => c.creator_status === "risk"),
    close: filteredCreators.filter(c => c.creator_status === "close"),
    rising: filteredCreators.filter(c => c.creator_status === "rising"),
    stable: filteredCreators.filter(c => c.creator_status === "stable" || !c.creator_status)
  };

  // Fetch coaching notes for selected creator
  const fetchNotes = async (creatorId: string) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/coaching-notes?creatorId=${creatorId}`);
      const data = await res.json();
      if (res.ok) {
        setNotesList(data.notes || []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (selectedCreator) {
      fetchNotes(selectedCreator.creator_id);
    }
  }, [selectedCreator]);

  // Save new coaching note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreator || !newNote.trim()) return;

    setSavingNote(true);
    try {
      const res = await fetch("/api/coaching-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: selectedCreator.creator_id,
          notes: newNote.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewNote("");
        fetchNotes(selectedCreator.creator_id);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Render priority matrix column
  const renderMatrixColumn = (
    title: string, 
    list: CurrentCreatorState[], 
    colorClass: string, 
    bgClass: string
  ) => {
    return (
      <Card className="bg-zinc-950 border-zinc-800 flex flex-col h-[600px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white uppercase tracking-wider">{title}</CardTitle>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bgClass} ${colorClass}`}>
              {list.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-4 space-y-3">
          {list.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground py-8">
              No creators
            </div>
          ) : (
            list.map(c => (
              <div 
                key={c.creator_id}
                onClick={() => setSelectedCreator(c)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 rounded-lg p-3.5 space-y-2 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm text-white">{c.username}</h4>
                    <p className="text-[10px] text-muted-foreground">ID: {c.tiktok_id}</p>
                  </div>
                  <span className="text-[10px] font-semibold bg-zinc-800 text-zinc-300 rounded px-1.5 py-0.5">
                    {c.tier_status || "No Tier"}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-zinc-400">
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase">Diamonds</span>
                    <span className="text-white">{(c.diamonds || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase">Hours</span>
                    <span className="text-white">{c.live_hours}h</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase">Valid Days</span>
                    <span className="text-white">{c.valid_days}d</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Manager Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome, {userDisplayName}. Oversee and coach your assigned creators.</p>
        </div>
        <div className="inline-flex rounded-lg bg-zinc-900 p-1 border border-zinc-800">
          <Button 
            onClick={() => setViewMode("matrix")}
            variant={viewMode === "matrix" ? "default" : "ghost"}
            size="sm"
            className="cursor-pointer"
          >
            <Grid className="mr-2 h-4 w-4" /> Matrix View
          </Button>
          <Button 
            onClick={() => setViewMode("roster")}
            variant={viewMode === "roster" ? "default" : "ghost"}
            size="sm"
            className="cursor-pointer"
          >
            <List className="mr-2 h-4 w-4" /> Roster View
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Creators</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Assigned creators</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned Diamonds</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalDiamonds.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total diamonds accumulated</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{atRiskCount}</div>
            <p className="text-xs text-muted-foreground">Need urgent guidance</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close to Tier Upgrade</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{closeCount}</div>
            <p className="text-xs text-muted-foreground">Creators within 10% of next tier</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search creators by username or TikTok ID..." 
          className="pl-8 bg-zinc-900 border-zinc-800 text-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content Render */}
      {viewMode === "matrix" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {renderMatrixColumn("Urgent Risk", matrix.risk, "text-red-400", "bg-red-950/50 border border-red-500/50")}
          {renderMatrixColumn("Close to Next Tier", matrix.close, "text-amber-400", "bg-amber-950/50 border border-amber-500/50")}
          {renderMatrixColumn("Rising Star", matrix.rising, "text-blue-400", "bg-blue-950/50 border border-blue-500/50")}
          {renderMatrixColumn("Stable", matrix.stable, "text-emerald-400", "bg-emerald-950/50 border border-emerald-500/50")}
        </div>
      ) : (
        <Card className="bg-zinc-950 border-zinc-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Creator</TableHead>
                  <TableHead className="text-zinc-400 text-right">Diamonds</TableHead>
                  <TableHead className="text-zinc-400 text-right">Live Hours</TableHead>
                  <TableHead className="text-zinc-400 text-right">Valid Days</TableHead>
                  <TableHead className="text-zinc-400">Current Tier</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No creators found matching search query
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCreators.map(c => (
                    <TableRow key={c.creator_id} className="border-zinc-800 hover:bg-zinc-900/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{c.username}</p>
                          <p className="text-xs text-muted-foreground">ID: {c.tiktok_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-white">{(c.diamonds || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-300">{c.live_hours}h</TableCell>
                      <TableCell className="text-right font-mono text-zinc-300">{c.valid_days}d</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-300">
                          {c.tier_status || "No Tier"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          c.creator_status === "stable" ? "bg-emerald-950/50 border-emerald-500 text-emerald-400" :
                          c.creator_status === "rising" ? "bg-blue-950/50 border-blue-500 text-blue-400" :
                          c.creator_status === "close" ? "bg-amber-950/50 border-amber-500 text-amber-400" :
                          "bg-red-950/50 border-red-500 text-red-400"
                        }`}>
                          {c.creator_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          onClick={() => setSelectedCreator(c)}
                          size="sm" 
                          variant="outline"
                          className="cursor-pointer"
                        >
                          <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Coaching
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Coaching Notes Modal */}
      <Dialog open={selectedCreator !== null} onOpenChange={(open) => { if (!open) setSelectedCreator(null); }}>
        <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle onClose={() => setSelectedCreator(null)}>
              Coaching Notes: {selectedCreator?.username}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              ID: {selectedCreator?.tiktok_id} | Group: {selectedCreator?.group_name || "None"}
            </DialogDescription>
          </DialogHeader>

          {/* Tier Progress Details in Modal */}
          {selectedCreator && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Current Level: <strong className="text-white">{selectedCreator.tier_status || "No Tier"}</strong></span>
                
                {/* Calculate next tier target */}
                {(() => {
                  const currentTier = TIERS.find(t => t.name === selectedCreator.tier_status);
                  const currentLevel = currentTier ? currentTier.level : 0;
                  const nextTier = TIERS.find(t => t.level === currentLevel + 1);
                  
                  if (!nextTier) return <span className="text-emerald-400 font-bold">Max Tier Reached</span>;
                  
                  const gap = getTierGap(selectedCreator.valid_days, selectedCreator.live_hours, Number(selectedCreator.diamonds));
                  
                  return (
                    <span className="text-zinc-400">
                      Next Target: <strong className="text-primary">{nextTier.name}</strong>
                    </span>
                  );
                })()}
              </div>

              {/* Progress bars to next tier */}
              {(() => {
                const currentTier = TIERS.find(t => t.name === selectedCreator.tier_status);
                const currentLevel = currentTier ? currentTier.level : 0;
                const nextTier = TIERS.find(t => t.level === currentLevel + 1);
                
                if (!nextTier) return null;

                const diamondsPct = Math.min(100, Math.round((Number(selectedCreator.diamonds) / nextTier.minDiamonds) * 100));
                const hoursPct = Math.min(100, Math.round((selectedCreator.live_hours / nextTier.minHours) * 100));
                const daysPct = Math.min(100, Math.round((selectedCreator.valid_days / nextTier.minDays) * 100));

                return (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">Diamonds Progress: {(selectedCreator.diamonds).toLocaleString()} / {nextTier.minDiamonds.toLocaleString()}</span>
                        <span className="text-zinc-300 font-bold">{diamondsPct}%</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${diamondsPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">Hours Progress: {selectedCreator.live_hours}h / {nextTier.minHours}h</span>
                        <span className="text-zinc-300 font-bold">{hoursPct}%</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${hoursPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">Valid Days Progress: {selectedCreator.valid_days}d / {nextTier.minDays}d</span>
                        <span className="text-zinc-300 font-bold">{daysPct}%</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${daysPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Notes display */}
          <div className="space-y-4 my-2">
            <h4 className="text-sm font-semibold border-b border-zinc-900 pb-2">History Logs</h4>
            <div className="h-[250px] overflow-y-auto space-y-3 pr-2">
              {loadingNotes ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : notesList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">No coaching logs written yet for this creator.</p>
              ) : (
                notesList.map((n: any) => (
                  <div key={n.id} className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-900 space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                      <span>By: {n.profiles?.display_name || "Manager"}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap">{n.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New note form */}
          <form onSubmit={handleSaveNote} className="space-y-3 pt-2 border-t border-zinc-900">
            <div className="space-y-1.5">
              <label htmlFor="new-note-textarea" className="text-xs font-semibold text-zinc-400">Add Coaching Session Log</label>
              <textarea
                id="new-note-textarea"
                rows={3}
                placeholder="Write recommendations, call highlights, goals discussed..."
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 p-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setSelectedCreator(null)}
                className="cursor-pointer"
              >
                Close
              </Button>
              <Button 
                type="submit" 
                disabled={savingNote || !newNote.trim()} 
                className="bg-primary text-white hover:bg-primary/90 cursor-pointer"
              >
                {savingNote ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" /> Save Log
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
