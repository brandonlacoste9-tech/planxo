"use client";

import { Shield, RefreshCw, Layers, DollarSign, Clock, CheckCircle } from "lucide-react";
import { getDashboardMetrics, triggerManualSyncAction } from '@/lib/actions';
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    recoveredRevenueCents: 0,
    pendingLeakingCount: 0,
    lastSync: "N/A",
    deltaStatus: "Inactive"
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoadingMetrics(true);
      const fetchedMetrics = await getDashboardMetrics();
      setMetrics(fetchedMetrics);
      setLoadingMetrics(false);
    }
    fetchMetrics();

    const intervalId = setInterval(fetchMetrics, 15000); // Refresh metrics every 15 seconds
    return () => clearInterval(intervalId);
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await triggerManualSyncAction();
      setSyncMessage(result.message);
      // Re-fetch metrics after sync
      const fetchedMetrics = await getDashboardMetrics();
      setMetrics(fetchedMetrics);
    } catch (error: any) {
      setSyncMessage(error.message || "An unknown error occurred during sync.");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000); // Clear message after 5 seconds
    }
  };

  if (loadingMetrics) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-slate-100 p-8 font-sans antialiased flex items-center justify-center">
        <p className="text-lg animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 p-8 font-sans antialiased selection:bg-amber-500/20">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-amber-400">
            PLANXO COMMAND CENTER
          </h1>
          <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest">Autonomous Business Infrastructure Deck</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-lg px-4 py-2 text-xs font-mono text-emerald-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SWARM ENGINE OPERATIONAL
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0E1424] to-[#121B32] border border-amber-500/30 rounded-xl p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">Recovered Revenue</p>
              <h3 className="text-3xl font-black text-slate-50 font-mono">
                ${(metrics.recoveredRevenueCents / 100).toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">Proactive Swarm</span> monitoring live corridors
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-[#0E1424] to-[#161224] border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Active Leaks (Pending)</p>
              <h3 className="text-3xl font-black text-rose-400 font-mono">
                {metrics.pendingLeakingCount}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Awaiting automatic Interac ledger reconciliation
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-[#0E1424] to-[#0E1E24] border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Calendar Delta Status</p>
              <h3 className="text-lg font-bold text-emerald-400 mt-2 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Locked Anchor
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-5 truncate font-mono">
            Last Sync: {metrics.lastSync}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-1 bg-[#0E1322] border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-200 mb-2 uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" /> Synchronization Core
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Manually override the Graph API background loops to execute immediate differential event polling and state ingestion.
            </p>
            
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-900 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Protocol:</span>
                <span className="text-slate-300">Microsoft Graph Delta</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">State Matrix:</span>
                <span className="text-amber-400 truncate max-w-[150px]">{metrics.deltaStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto-Rotation:</span>
                <span className="text-emerald-400">5-Min Buffer Active</span>
              </div>
            </div>
          </div>

          {syncMessage && (
            <p className={`text-xs mt-4 ${syncMessage.includes("Failed") ? "text-rose-400" : "text-emerald-400"}`}>
              {syncMessage}
            </p>
          )}

          <button 
            onClick={handleManualSync}
            disabled={syncing}
            className="w-full mt-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-2.5 px-4 rounded-lg transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncing ? "TRIGGERING SYNC..." : "TRIGGER MANUAL DELTA FORCE"}
          </button>
        </div>

        <div className="lg:col-span-2 bg-[#0E1322] border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-slate-200 mb-4 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Transactional Execution Ledger
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Reference</th>
                  <th className="p-3 font-semibold">Customer</th>
                  <th className="p-3 font-semibold">Volume</th>
                  <th className="p-3 font-semibold text-right">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {/* This will be populated by a separate Server Action for ledger items */}
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-3 text-slate-300 font-bold">PLX-49201X</td>
                  <td className="p-3 text-slate-400">Brandon Lacoste</td>
                  <td className="p-3 text-slate-200">$450.00</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold">PAID</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-3 text-slate-300 font-bold">PLX-77310K</td>
                  <td className="p-3 text-slate-400">Sarah Jenkins</td>
                  <td className="p-3 text-slate-200">$500.00</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold">PENDING</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
