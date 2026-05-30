"use client";
import { useEffect, useState } from "react";
import { Law25Consent } from "./Law25Consent";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "law25_consent_v1_2026";

export function Law25ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = async (data: { dataCollection: boolean; crossBorder: boolean }) => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // localStorage unavailable (private mode) — still dismiss for this session
    }
    setVisible(false);

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dataCollectionAllowed: data.dataCollection,
          crossBorderAllowed: data.crossBorder,
        }),
      });
    } catch {
      // Best-effort persistence; local consent already recorded.
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-2xl shadow-lg rounded-lg bg-white">
        <Law25Consent onAccept={handleAccept} />
      </div>
    </div>
  );
}
