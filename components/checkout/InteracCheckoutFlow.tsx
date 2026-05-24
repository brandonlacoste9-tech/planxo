
"use client";

import { useState, useEffect } from "react";
import InteracInstructionWidget from "./InteracInstructionWidget";

interface Financials {
  basePrice: number;
  tps: number;
  tvq: number;
  total: number;
}

export default function InteracCheckoutFlow({ eventTypeId }: { eventTypeId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [bookingData, setBookingData] = useState<{
    bookingId: string;
    interacRef: string;
    financials: Financials;
  } | null>(null);

  useEffect(() => {
    if (!bookingData || isPaid) return;

    let intervalId: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 60; 

    const checkPaymentStatus = async () => {
      try {
        attempts++;
        const response = await fetch(`/api/booking/verify?token=${bookingData.interacRef}`);
        const data = await response.json();

        if (response.ok && data.paymentStatus === "PAID") {
          setIsPaid(true);
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Polling validation tick failed:", err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
      }
    };

    intervalId = setInterval(checkPaymentStatus, 10000);

    return () => clearInterval(intervalId);
  }, [bookingData, isPaid]);

  const handleConfirmBooking = async (formData: { name: string; email: string; startTime: string; endTime: string }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          ...formData,
          paymentMethod: "INTERAC",
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erreur d'initialisation.");

      setBookingData({
        bookingId: data.bookingId,
        interacRef: data.interacRef,
        financials: data.financials,
      });
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  if (isPaid) {
    return (
      <div className="max-w-md mx-auto my-8 bg-zinc-950 border border-emerald-500/30 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-3xl mb-4">
          ✓
        </div>
        <h3 className="text-2xl font-bold text-zinc-100 font-sans">Paiement Confirmé !</h3>
        <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto">
          Nous avons reçu votre virement Interac. Votre rendez-vous est officiellement confirmé et synchronisé.
        </p>
        <div className="mt-6 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-xs text-zinc-500">
          Un courriel de confirmation contenant vos accès et les liens de gestion vous a été envoyé.
        </div>
      </div>
    );
  }

  if (bookingData) {
    return (
      <div className="animate-fade-in">
        <InteracInstructionWidget 
          token={bookingData.interacRef} 
          amount={bookingData.financials.total} 
          emailTarget="depot@planxo.ca" 
        />
        
        <div className="max-w-md mx-auto mt-4 flex items-center justify-center gap-2 text-xs text-amber-500/80 bg-amber-500/5 border border-amber-500/10 py-2 rounded-xl">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
          <span>En attente de détection du virement bancaire...</span>
        </div>

        <div className="max-w-md mx-auto mt-4 px-6 text-xs text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span>Prix de base / Base Price:</span>
            <span>{bookingData.financials.basePrice.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between">
            <span>TPS / GST (5%):</span>
            <span>{bookingData.financials.tps.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between">
            <span>TVQ / QST (9.975%):</span>
            <span>{bookingData.financials.tvq.toFixed(2)} $</span>
          </div>
          <div className="border-t border-zinc-900 my-1" />
          <div className="flex justify-between text-zinc-400 font-medium">
            <span>Total:</span>
            <span>{bookingData.financials.total.toFixed(2)} $ CAD</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 max-w-md mx-auto">
      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
      <button 
        onClick={() => handleConfirmBooking({
          name: "Brandon Lacoste",
          email: "brandon@planxo.ca",
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 86400000 + 1800000).toISOString(),
        })}
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-950 font-bold py-3.5 px-4 rounded-xl transition duration-150 cursor-pointer text-center tracking-wide"
      >
        {loading ? "Génération de la facture..." : "Réserver avec Virement Interac"}
      </button>
    </div>
  );
}
