import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: string[] = [];

  // Create user
  const { error: uErr } = await supabase.from("User").upsert({
    id: "u1", username: "planxo", name: "Planxo", email: "info@planxo.ca",
    timeZone: "America/Toronto", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }, { onConflict: "id" });
  results.push(uErr ? `User: ${uErr.message}` : "User: OK");

  // Event types
  const ets = [
    { id: "et1", userId: "u1", title: "Consultation de 30 minutes", slug: "consultation-30min", length: 30, location: "google-meet", price: 0, currency: "cad", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "et2", userId: "u1", title: "Reunion d'une heure", slug: "reunion-1h", length: 60, location: "google-meet", price: 0, currency: "cad", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "et3", userId: "u1", title: "Appel rapide de 15 minutes", slug: "appel-15min", length: 15, location: "phone", price: 0, currency: "cad", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "et4", userId: "u1", title: "Consultation premium (49$)", slug: "consultation-payante", description: "Consultation avec paiement Stripe requis.", length: 30, location: "google-meet", price: 4900, currency: "cad", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  for (const et of ets) {
    const { error } = await supabase.from("EventType").upsert(et, { onConflict: "id" });
    results.push(error ? `EventType ${et.slug}: ${error.message}` : `EventType ${et.slug}: OK`);
  }

  // Schedule
  const { error: sErr } = await supabase.from("Schedule").upsert({
    id: "s1", userId: "u1", name: "Heures de travail", timeZone: "America/Toronto", isDefault: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }, { onConflict: "id" });
  results.push(sErr ? `Schedule: ${sErr.message}` : "Schedule: OK");

  // Availability (Mon-Fri 9-5)
  const avails = [
    { id: "a1", scheduleId: "s1", dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
    { id: "a2", scheduleId: "s1", dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
    { id: "a3", scheduleId: "s1", dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true },
    { id: "a4", scheduleId: "s1", dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isActive: true },
    { id: "a5", scheduleId: "s1", dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isActive: true },
  ];
  for (const a of avails) {
    const { error } = await supabase.from("Availability").upsert(a, { onConflict: "id" });
    results.push(error ? `Availability day ${a.dayOfWeek}: ${error.message}` : `Availability day ${a.dayOfWeek}: OK`);
  }

  return NextResponse.json({ status: "success", results });
}
