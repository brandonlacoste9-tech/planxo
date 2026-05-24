
"use client";

import React, { useState } from "react";

interface InteracWidgetProps {
  token: string;
  amount: number;
  emailTarget?: string;
}

export default function InteracInstructionWidget({
  token,
  amount,
  emailTarget = "depot@planxo.ca",
}: InteracWidgetProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyToClipboard = (text: string, setFlag: (flag: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-950 border border-amber-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-lg mb-3">
          $
        </div>
        <h3 className="text-xl font-bold text-zinc-100 font-sans tracking-wide">
          Virement Interac® Requis
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Votre plage horaire est réservée temporairement en attente du dépôt
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex justify-between items-center group hover:border-zinc-700 transition duration-150">
          <div>
            <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Envoyer à / Send to
            </span>
            <span className="font-mono text-zinc-200 font-medium text-sm select-all">
              {emailTarget}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(emailTarget, setCopiedEmail)}
            className="text-xs bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 hover:text-amber-400 text-zinc-400 px-2.5 py-1.5 rounded-lg transition"
          >
            {copiedEmail ? "Copié !" : "Copier"}
          </button>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Montant Exact / Exact Amount
            </span>
            <span className="font-mono text-zinc-100 font-bold text-xl tracking-tight">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </span>
          </div>
          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Taxes Inc.
          </span>
        </div>

        <div className="bg-amber-950/10 border border-amber-500/30 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <span className="block text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-2">
            ⚠️ Message Obligatoire / Required Message
          </span
          
          <div className="flex gap-2 items-center">
            <div className="flex-1 font-mono text-center font-bold text-2xl tracking-widest bg-zinc-900/90 text-amber-400 py-2 rounded-lg border border-zinc-800/80 select-all">
              {token}
            </div>
            <button
              onClick={() => copyToClipboard(token, setCopiedToken)}
              className="h-11 px-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:text-amber-400 text-zinc-400 font-medium text-xs rounded-lg transition"
            >
              {copiedToken ? "✓" : "Copier"}
            </button>
          </div>
          
          <p className="text-[11px] text-amber-400/80 mt-3 leading-relaxed">
            Inscrivez ce code exact sans espaces additionnels dans la section <strong className="text-amber-400">"Message"</strong> de votre application bancaire. Notre système l'associera automatiquement en moins de 2 minutes.
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-900/80 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Sécurisé par Planxo Core</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Traitement automatisé actif
        </span
      </div}
    </div>
  );
}
