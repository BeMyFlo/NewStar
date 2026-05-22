"use client";

import React, { useState } from "react";
import { 
  Upload, 
  Search, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrentCreatorState } from "@/lib/types";

interface OwnerDashboardProps {
  creators: CurrentCreatorState[];
  periods: any[];
  weeklyReports: any[];
  monthlyReports: any[];
  userDisplayName: string;
}

export default function OwnerDashboard({
  creators,
  periods,
  weeklyReports: initialWeeklyReports,
  monthlyReports: initialMonthlyReports,
  userDisplayName
}: OwnerDashboardProps) {
  // State for CSV upload
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // State for Reports Generation
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPeriodId, setReportPeriodId] = useState("");
  const [weeklyReports, setWeeklyReports] = useState(initialWeeklyReports);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  const [generatingCashback, setGeneratingCashback] = useState(false);
  const [cashbackMonth, setCashbackMonth] = useState("");
  const [monthlyReports, setMonthlyReports] = useState(initialMonthlyReports);
  const [showCashbackModal, setShowCashbackModal] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  // Unique groups list
  const groups = Array.from(new Set(creators.map(c => c.group_name).filter(Boolean))) as string[];

  // Calculate statistics
  const totalDiamonds = creators.reduce((sum, c) => sum + BigInt(c.diamonds || 0), 0n);
  
  // Basic mock/estimated cashback based on current tier (we can estimate it for display)
  const estimatedCashback = creators.reduce((sum, c) => {
    // Estimating cashback based on tier name
    const tier = c.tier_status;
    if (!tier || tier === "No Tier") return sum;
    const match = tier.match(/Tier (\d+)/);
    if (!match) return sum;
    const level = parseInt(match[1]);
    const cashbackMap: Record<number, number> = { 1: 20, 2: 35, 3: 60, 4: 150, 5: 225, 6: 300, 7: 550, 8: 850 };
    return sum + (cashbackMap[level] || 0);
  }, 0);

  const activeCreatorsCount = creators.length;
  const atRiskCreatorsCount = creators.filter(c => c.creator_status === "risk").length;

  // Filtered creators list
  const filteredCreators = creators.filter(c => {
    const matchesSearch = 
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tiktok_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.manager_name && c.manager_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || c.creator_status === statusFilter;
    const matchesGroup = groupFilter === "all" || c.group_name === groupFilter;

    return matchesSearch && matchesStatus && matchesGroup;
  });

  // Calculate Manager Rankings
  const managerMap: Record<string, { name: string; email: string; creatorsCount: number; diamonds: bigint }> = {};
  creators.forEach(c => {
    const managerEmail = c.manager_email || "unassigned@newstar.com";
    const managerName = c.manager_name || "Unassigned";
    if (!managerMap[managerEmail]) {
      managerMap[managerEmail] = {
        name: managerName,
        email: managerEmail,
        creatorsCount: 0,
        diamonds: 0n
      };
    }
    managerMap[managerEmail].creatorsCount += 1;
    managerMap[managerEmail].diamonds += BigInt(c.diamonds || 0);
  });
  const managerRankings = Object.values(managerMap).sort((a, b) => b.diamonds > a.diamonds ? 1 : -1);

  // File Upload handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !startDate || !endDate) {
      setUploadError("Please select a file and period dates");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);

    try {
      const res = await fetch("/api/backstage-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import CSV");
      }

      setUploadResult(data);
      // Clean form on success
      setFile(null);
      // Reload page data by refreshing path or setting states (here we ask user to reload or we refresh)
    } catch (err: any) {
      setUploadError(err.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  // Weekly Report Generation handler
  const handleGenerateWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportPeriodId) return;

    setGeneratingReport(true);
    try {
      const res = await fetch("/api/weekly-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: reportPeriodId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate weekly report");

      alert("Weekly report generated successfully!");
      setShowWeeklyModal(false);
      // Append to list
      setWeeklyReports([data.summary, ...weeklyReports]);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Monthly Cashback Report Generation handler
  const handleGenerateCashback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashbackMonth) return;

    setGeneratingCashback(true);
    try {
      const res = await fetch("/api/cashback-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: `${cashbackMonth}-01` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate monthly cashback report");

      alert("Monthly cashback report generated successfully!");
      setShowCashbackModal(false);
      setMonthlyReports([data, ...monthlyReports]);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingCashback(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Owner Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back, {userDisplayName}. Manage network growth and payouts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowUploadModal(true)} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setShowWeeklyModal(true)} variant="outline" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> Weekly Report
          </Button>
          <Button onClick={() => setShowCashbackModal(true)} variant="outline" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> Cashback Report
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Diamonds</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalDiamonds.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Cumulative backstage sum</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Cashback Payout</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${estimatedCashback.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Based on current qualified tiers</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Creators</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeCreatorsCount}</div>
            <p className="text-xs text-muted-foreground">Total imported creators</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Creators At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{atRiskCreatorsCount}</div>
            <p className="text-xs text-muted-foreground">Declining or below run-rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Creator Roster & Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Creator Roster */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Creator Roster</CardTitle>
              <CardDescription>Real-time creator state from current_creator_state view</CardDescription>
              {/* Search & Filter tools */}
              <div className="flex flex-col gap-2 mt-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search username, TikTok ID, or manager..." 
                    className="pl-8 bg-zinc-900 border-zinc-800 text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select 
                  className="h-10 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-white text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="stable">Stable</option>
                  <option value="rising">Rising</option>
                  <option value="close">Close</option>
                  <option value="risk">Risk</option>
                </select>
                <select 
                  className="h-10 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-white text-sm"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="all">All Groups</option>
                  {groups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Creator</TableHead>
                    <TableHead className="text-zinc-400">Group</TableHead>
                    <TableHead className="text-zinc-400 text-right">Diamonds</TableHead>
                    <TableHead className="text-zinc-400 text-right">Hours/Days</TableHead>
                    <TableHead className="text-zinc-400">Current Tier</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreators.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No creators found matching criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCreators.map((c) => (
                      <TableRow key={c.creator_id} className="border-zinc-800 hover:bg-zinc-900/50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{c.username}</p>
                            <p className="text-xs text-muted-foreground">ID: {c.tiktok_id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-300">{c.group_name || "None"}</TableCell>
                        <TableCell className="text-right font-mono text-white">{(c.diamonds || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">
                          {c.live_hours}h / {c.valid_days}d
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-300">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar panels */}
        <div className="space-y-6">
          {/* Manager Rankings */}
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Manager Leaderboard</CardTitle>
              <CardDescription>Top managers sorted by total diamonds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {managerRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No managers data available</p>
              ) : (
                managerRankings.map((m, index) => (
                  <div key={m.email} className="flex items-center justify-between border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold text-zinc-500">#{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.creatorsCount} creators</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{Number(m.diamonds).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Diamonds</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Reports Status</CardTitle>
              <CardDescription>Latest frozen reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Weekly Snapshots</h4>
                {weeklyReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No weekly reports generated</p>
                ) : (
                  <div className="space-y-2">
                    {weeklyReports.slice(0, 3).map((w: any) => (
                      <div key={w.report_id || w.id} className="flex items-center justify-between bg-zinc-900/50 p-2.5 rounded border border-zinc-900">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-xs text-white">Period: {w.period_id || "Report"}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-300">
                          ${w.total_cashback || 0} payout
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Monthly Cashback</h4>
                {monthlyReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No monthly payouts frozen</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyReports.slice(0, 3).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between bg-zinc-900/50 p-2.5 rounded border border-zinc-900">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-white">{m.month}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            ${m.total_cashback || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSV Uploader Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle onClose={() => setShowUploadModal(false)}>Import Backstage CSV</DialogTitle>
            <DialogDescription>
              Upload a TikTok Backstage CSV export. System will upsert groups, managers, and creators automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Select Date Range for Period</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Start Date</label>
                  <Input 
                    type="date" 
                    className="bg-zinc-900 border-zinc-800 text-white"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">End Date</label>
                  <Input 
                    type="date" 
                    className="bg-zinc-900 border-zinc-800 text-white"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Upload CSV File</label>
              <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 rounded-lg p-6 text-center cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv"
                  className="hidden"
                  id="csv-file-input"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                  <Upload className="mx-auto h-8 w-8 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-300 block">
                    {file ? file.name : "Click to select CSV file"}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Only .csv files generated by TikTok Backstage
                  </span>
                </label>
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center p-3 rounded bg-red-950/30 border border-red-500/50 text-red-400 text-xs">
                <AlertCircle className="mr-2 h-4 w-4" /> {uploadError}
              </div>
            )}

            {uploadResult && (
              <div className="flex items-center p-3 rounded bg-emerald-950/30 border border-emerald-500/50 text-emerald-400 text-xs">
                <CheckCircle className="mr-2 h-4 w-4" /> 
                Successfully processed {uploadResult.summary?.successRows} rows! (Total {uploadResult.summary?.totalRows})
              </div>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="cursor-pointer"
              >
                Close
              </Button>
              <Button 
                type="submit" 
                disabled={uploading || !file || !startDate || !endDate}
                className="bg-primary text-white hover:bg-primary/90 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  "Start Import"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Weekly Report Modal */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle onClose={() => setShowWeeklyModal(false)}>Generate Weekly Report</DialogTitle>
            <DialogDescription>
              Select an open period to generate an aggregate weekly snapshot of creator earnings and statuses.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateWeekly} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Select Backstage Period</label>
              <select 
                className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-white text-sm"
                value={reportPeriodId}
                onChange={(e) => setReportPeriodId(e.target.value)}
                required
              >
                <option value="">Select period...</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.start_date} to {p.end_date} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowWeeklyModal(false)}
                disabled={generatingReport}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={generatingReport || !reportPeriodId}
                className="bg-primary text-white hover:bg-primary/90 cursor-pointer"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Monthly Cashback Report Modal */}
      <Dialog open={showCashbackModal} onOpenChange={setShowCashbackModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle onClose={() => setShowCashbackModal(false)}>Generate Monthly Cashback Report</DialogTitle>
            <DialogDescription>
              Enter the month to aggregate and freeze all payouts and tier details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateCashback} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Target Month</label>
              <Input 
                type="month" 
                className="bg-zinc-900 border-zinc-800 text-white"
                value={cashbackMonth}
                onChange={(e) => setCashbackMonth(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCashbackModal(false)}
                disabled={generatingCashback}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={generatingCashback || !cashbackMonth}
                className="bg-primary text-white hover:bg-primary/90 cursor-pointer"
              >
                {generatingCashback ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
