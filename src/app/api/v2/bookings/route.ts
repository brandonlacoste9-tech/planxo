import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { eventTypeId, guestName, guestEmail, guestNotes, date, time } = body;
  if (!eventTypeId || !guestName || !guestEmail || !date || !time)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: eventType } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
  if (!eventType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Daily cap
  if (eventType.maxPerDay) {
    const { count } = await supabase.from("Booking").select("*", { count: "exact", head: true }).eq("eventTypeId", eventTypeId).neq("status", "cancelled").gte("startTime", date + "T00:00:00").lte("startTime", date + "T23:59:59");
    if (count && count >= eventType.maxPerDay)
      return NextResponse.json({ error: "Limite quotidienne atteinte." }, { status: 409 });
  }

  const startTime = new Date(`${date}T${time}:00`).toISOString();
  const endTime = new Date(new Date(`${date}T${time}:00`).getTime() + eventType.length * 60000).toISOString();

  // Conflict check
  const { data: conflict } = await supabase.from("Booking").select("id").eq("eventTypeId", eventTypeId).neq("status", "cancelled").lt("startTime", endTime).gt("endTime", startTime).limit(1);
  if (conflict?.length)
    return NextResponse.json({ error: "Créneau non disponible." }, { status: 409 });

  // Meeting URL
  let meetingUrl: string | null = null;
  if (eventType.location === "google-meet") meetingUrl = `https://meet.google.com/${rand()}`;
  else if (eventType.location === "zoom") meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
  else if (eventType.location === "teams") meetingUrl = `https://teams.microsoft.com/l/meetup-join/${rand()}`;

  const now = new Date().toISOString();
  const { data: booking, error } = await supabase.from("Booking").insert({
    eventTypeId, userId: eventType.userId, guestName, guestEmail,
    guestNotes: guestNotes || "", startTime, endTime, status: "confirmed",
    paid: eventType.price === 0, meetingUrl, updatedAt: now,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(booking, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventTypeId = searchParams.get("eventTypeId");
  let q = supabase.from("Booking").select("*, eventType:EventType(*)").order("startTime", { ascending: true });
  if (eventTypeId) q = q.eq("eventTypeId", eventTypeId);
  const { data } = await q;
  return NextResponse.json(data || []);
}

function rand(): string {
  const c = "abcdefghijklmnopqrstuvwxyz";
  let r = "";
  for (let i = 0; i < 3; i++) { for (let j = 0; j < 4; j++) r += c[Math.floor(Math.random() * c.length)]; if (i < 2) r += "-"; }
  return r;
}
