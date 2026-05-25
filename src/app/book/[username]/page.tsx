"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, User } from "lucide-react";

export default function BookingPage() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const availableSlots = [
    { id: "1", date: "Monday, June 2", time: "10:00 AM - 10:30 AM", duration: "30 min" },
    { id: "2", date: "Monday, June 2", time: "2:00 PM - 2:30 PM", duration: "30 min" },
    { id: "3", date: "Tuesday, June 3", time: "11:00 AM - 11:30 AM", duration: "30 min" },
    { id: "4", date: "Wednesday, June 4", time: "3:00 PM - 3:30 PM", duration: "30 min" },
  ];

  const handleBook = () => {
    if (!selectedSlot) return;
    alert(`Booking confirmed for ${selectedSlot}! (Real booking coming soon)`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">Planxo</span>
          </div>
          <div className="text-sm text-zinc-400">Book with Brandon</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-900 rounded-full border border-zinc-800 mb-6">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm text-emerald-400">Available this week</span>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tighter mb-4">Book a meeting with Brandon</h1>
          <p className="text-xl text-zinc-400 max-w-md mx-auto">
            Choose a time that works for you. 30-minute meetings.
          </p>
        </div>

        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <div className="font-semibold text-2xl">Brandon</div>
              <div className="text-zinc-400">Founder @ Planxo</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
              <Calendar className="w-4 h-4" />
              <span>Available times</span>
            </div>

            <div className="space-y-3">
              {availableSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left
                    ${selectedSlot === slot.time 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="font-medium text-lg">{slot.date}</div>
                      <div className="text-emerald-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {slot.time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-zinc-400">{slot.duration}</div>
                    <div className="text-xs text-emerald-400">Free</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleBook}
            disabled={!selectedSlot}
            className="w-full py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed
              bg-white text-black hover:bg-zinc-200"
          >
            {selectedSlot ? `Confirm booking for ${selectedSlot}` : 'Select a time above'}
          </button>

          <p className="text-center text-xs text-zinc-500 mt-4">
            You will receive a confirmation email with meeting details
          </p>
        </div>

        <div className="text-center mt-8 text-sm text-zinc-500">
          Powered by <Link href="/" className="text-white hover:underline">Planxo</Link>
        </div>
      </div>
    </div>
  );
}
