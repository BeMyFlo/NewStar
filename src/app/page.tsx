import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Terminal, Award, FileSpreadsheet, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] -z-10" />

      {/* Navigation Header */}
      <header className="h-16 border-b border-zinc-900 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm font-serif">N</span>
          </div>
          <span className="font-bold tracking-wider text-base">NEWSTAR</span>
        </div>
        <Link href="/login">
          <Button variant="outline" className="border-zinc-800 hover:bg-zinc-900 cursor-pointer">
            Sign In <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-zinc-900 border border-zinc-800 text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Phase 1 Live
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-serif">
          The Operating System for <span className="text-primary block sm:inline">TikTok LIVE Networks</span>
        </h1>
        
        <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl leading-relaxed">
          Replace messy spreadsheets and manual calculations. NewStar automates CSV data ingestion, cashback tier calculations, and coaching note logs in a single premium dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
          <Link href="/login" className="w-full">
            <Button className="w-full h-12 bg-primary text-white hover:bg-primary/90 font-semibold cursor-pointer">
              Launch Console <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid gap-6 md:grid-cols-3 w-full pt-16 text-left">
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg space-y-2">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">CSV Data Engine</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Upload weekly TikTok Backstage CSVs. Auto-parse records and upsert creators and group assignments.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg space-y-2">
            <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 mb-4">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Cashback Engine</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Track creator performance thresholds. Automatically calculate eligible monthly cashback commissions.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg space-y-2">
            <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 mb-4">
              <Terminal className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Coaching Logs</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Equip managers with logs to track coaching sessions and monitor creator target progressions.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-zinc-900 flex items-center justify-between px-6 lg:px-12 text-xs text-zinc-500">
        <p>&copy; 2026 NewStar Network. All rights reserved.</p>
        <div className="flex space-x-4">
          <a href="#" className="hover:text-white">Privacy Policy</a>
          <a href="#" className="hover:text-white">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
