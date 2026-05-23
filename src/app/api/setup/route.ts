import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: string[] = [];

  // Check if tables exist by trying to select
  const { error: checkUser } = await supabase.from("users").select("id").limit(1);

  if (checkUser?.message?.includes("does not exist") || checkUser?.message?.includes("schema cache")) {
    // Tables don't exist — need to run migration
    results.push("Tables missing — run supabase/migrations/001_planxo_schema.sql in Supabase SQL Editor");
    results.push("Then visit /api/setup again to seed data");
    return NextResponse.json({ status: "pending_migration", results });
  }

  // Tables exist, seed data
  const now = new Date().toISOString();

  const { error: ue } = await supabase.from("users").upsert({
    id: "u1", username: "planxo", name: "Planxo",
    email: "info@planxo.ca", timeZone: "America/Toronto",
    createdAt: now, updatedAt: now,
  });
  results.push(ue ? `User error: ${ue.message}` : "User OK");

  const { error: e1 } = await supabase.from("EventType").upsert({
    id: "et1", userId: "u1", title: "Consultation de 30 minutes", slug: "consultation-30min",
    length: 30, location: "google-meet", color: "#242424", isActive: true,
    minNotice: 60, bufferBefore: 10, bufferAfter: 10, maxPerDay: 12,
    price: 0, currency: "cad", createdAt: now, updatedAt: now,
  });
  results.push(e1 ? `ET1: ${e1.message}` : "ET1 OK");

  const { error: e2 } = await supabase.from("EventType").upsert({
    id: "et2", userId: "u1", title: "Reunion d'une heure", slug: "reunion-1h",
    length: 60, location: "google-meet", color: "#242424", isActive: true,
    minNotice: 60, bufferBefore: 15, bufferAfter: 15, maxPerDay: 8,
    price: 0, currency: "cad", createdAt: now, updatedAt: now,
  });
  results.push(e2 ? `ET2: ${e2.message}` : "ET2 OK");

  const { error: e3 } = await supabase.from("EventType").upsert({
    id: "et3", userId: "u1", title: "Appel rapide de 15 minutes", slug: "appel-15min",
    length: 15, location: "phone", color: "#242424", isActive: true,
    minNotice: 30, bufferBefore: 5, bufferAfter: 5, maxPerDay: 20,
    price: 0, currency: "cad", createdAt: now, updatedAt: now,
  });
  results.push(e3 ? `ET3: ${e3.message}` : "ET3 OK");

  const { error: e4 } = await supabase.from("EventType").upsert({
    id: "et4", userId: "u1", title: "Consultation premium (49$)", slug: "consultation-payante",
    description: "Consultation avec paiement Stripe requis.",
    length: 30, location: "google-meet", color: "#242424", isActive: true,
    minNotice: 60, bufferBefore: 10, bufferAfter: 10, maxPerDay: 12,
    price: 4900, currency: "cad", createdAt: now, updatedAt: now,
  });
  results.push(e4 ? `ET4: ${e4.message}` : "ET4 OK");

  const { error: se } = await supabase.from("Schedule").upsert({
    id: "s1", userId: "u1", name: "Heures de travail",
    timeZone: "America/Toronto", isDefault: true,
    createdAt: now, updatedAt: now,
  });
  results.push(se ? `Schedule: ${se.message}` : "Schedule OK");

  for (let d = 1; d <= 5; d++) {
    const { error: ae } = await supabase.from("Availability").upsert({
      id: `a${d}`, scheduleId: "s1", dayOfWeek: d,
      startTime: "09:00", endTime: "17:00", isActive: true,
    });
    results.push(ae ? `Avail day${d}: ${ae.message}` : `Avail day${d} OK`);
  }

  return NextResponse.json({ status: "success", results });
}
