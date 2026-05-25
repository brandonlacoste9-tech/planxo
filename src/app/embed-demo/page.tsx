"use client";

import PlanxoEmbed from "@/components/PlanxoEmbed";

export default function EmbedDemo() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Planxo Embed Demo</h1>
        <p className="text-slate-400 mb-8">
          This is how your booking pages will look when embedded on other websites.
        </p>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <PlanxoEmbed 
            calLink="brandon/30min" 
            height={650} 
          />
        </div>

        <div className="mt-8 text-sm text-slate-500">
          Replace <code>brandon/30min</code> with your actual Planxo username/event slug.
        </div>
      </div>
    </div>
  );
}