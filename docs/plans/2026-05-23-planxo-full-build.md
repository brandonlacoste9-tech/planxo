# Planxo Full Build Plan
# Generated: 2026-05-23

> **For Hermes:** Execute via subagent-driven-development skill, one task at a time.

**Goal:** Close all gaps between Planxo and Cal.diy parity — settings save, duration picker, cancel/reschedule UI, email confirmations, event type advanced settings, dashboard filters, Google Calendar sync, date overrides, full timezone list.

**Stack:** Next.js 16.2.6, React 19, Tailwind v4, Supabase (vebwxcezwrrbirsiyyur), Stripe, Resend (email)
**Working dir:** C:\Users\booboo\rdv-qc
**Live:** https://rdv-qc.vercel.app
**Cal.diy reference:** C:\Users\booboo\cal.diy

**Deploy command:** cd /c/Users/booboo/rdv-qc && npx vercel deploy --prod --yes 2>&1 | tail -5
**Git push:** cd /c/Users/booboo/rdv-qc && git add -A && git commit -m "..." && git push origin master

---

## PHASE 1 — SETTINGS (profile + conferencing save)

### Task 1: Wire settings profile save

**Objective:** Make the Profile tab in settings actually save name, username, timezone to Supabase via a PATCH /api/v2/me endpoint.

**Files:**
- Modify: `src/app/settings/page.tsx` — add controlled state + save button
- Modify: `src/app/api/v2/me/route.ts` — add PATCH handler

**Cal.diy reference:** `C:\Users\booboo\cal.diy\apps\web\modules\settings\my-account\profile\ProfileForm.tsx`

**Implementation:**

In `src/app/api/v2/me/route.ts` add:
```typescript
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, username, timeZone } = body;

  const { error } = await supabase
    .from("users")
    .update({ name, username, timeZone })
    .eq("id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

In `src/app/settings/page.tsx`:
- Convert profile fields to controlled inputs (useState for name, username, timeZone)
- Add saveProfile() function that POSTs to PATCH /api/v2/me
- Add Save button with loading state
- Show success toast inline

**Commit:** `feat: wire settings profile save to Supabase`

---

### Task 2: Wire settings conferencing save

**Objective:** Save the user's conferencing preference (Google Meet / Zoom / Teams / Phone) to Supabase users table and surface it on booking pages.

**Files:**
- Modify: `src/app/settings/page.tsx` — wire conferencing radio to save
- Modify: `src/app/api/v2/me/route.ts` — include conferencing in PATCH
- DB: Add `conferencing` column to users table via Supabase SQL

**SQL to run on Supabase:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS conferencing TEXT DEFAULT 'google_meet';
```

**Implementation:**
- Add controlled state for conferencing in settings page
- Include `conferencing` in the PATCH /api/v2/me body
- Read `conferencing` in the booking page to show correct meeting link label

**Commit:** `feat: save conferencing preference, surface on booking page`

---

## PHASE 2 — BOOKING PAGE IMPROVEMENTS

### Task 3: Duration selector on public booking page

**Objective:** Show duration chips (15m / 30m / 45m / 1h) on the booking page that match the event type's `length`. When multiple durations are available (future: per event type), user picks one and slots recalculate.

**Files:**
- Modify: `src/app/[username]/[eventSlug]/page.tsx`

**Cal.diy reference:** EventMeta component shows duration chips at top of booking widget — see the screenshot in the plan.

**Implementation:**
The event type has a `length` field (integer, minutes). Show it as a styled chip at the top (non-clickable for now since each event type has one fixed duration). Matches the UI in the screenshot: `15m  [30m]  45m  1h` where the active one is circled.

```typescript
// Duration display chips (highlight the active one)
const DURATIONS = [15, 30, 45, 60];
// Show chips, highlight eventType.length
<div style={{ display:"flex", gap:8, marginBottom:16 }}>
  {DURATIONS.map(d => (
    <span key={d} style={{
      padding:"6px 14px", borderRadius:9999,
      border: d === eventType.length ? "1.5px solid #c8a96e" : "1px solid rgba(200,169,110,0.2)",
      color: d === eventType.length ? "#c8a96e" : "#8a7a60",
      fontSize:13, fontWeight: d === eventType.length ? 600 : 400
    }}>
      {d === 60 ? "1h" : `${d}m`}
    </span>
  ))}
</div>
```

**Commit:** `feat: duration chips on booking page`

---

### Task 4: Full timezone list on booking page

**Objective:** Replace the 4-hardcoded-timezone picker with a full searchable list using Intl API.

**Files:**
- Modify: `src/app/[username]/[eventSlug]/page.tsx`

**Cal.diy reference:** `C:\Users\booboo\cal.diy\packages\lib\timezonelist.ts` — has the full list

**Implementation:**
```typescript
// Generate from Intl API — works in all browsers
const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone'); // ~600 TZs

// Replace hardcoded array with a <select> or searchable input
// Show as: America/Toronto, America/New_York, etc.
// Default to user's detected TZ
```
Replace the current 4-item dropdown with a `<select>` containing all ~600 timezones from `Intl.supportedValuesOf('timeZone')`.

**Commit:** `feat: full timezone list on booking page via Intl API`

---

### Task 5: Booking cancellation page

**Objective:** Allow a booker to cancel their booking via a cancellation page. URL: `/booking/[uid]/cancel`

**Files:**
- Create: `src/app/booking/[uid]/cancel/page.tsx`
- Verify: `src/app/api/v2/bookings/[id]/cancel/route.ts` (already exists)

**Cal.diy reference:** `C:\Users\booboo\cal.diy\apps\web\app\(booking-page-wrapper)\booking\[uid]\cancel\` 

**Implementation:**
- Page fetches booking by uid from `/api/v2/bookings?uid=[uid]`
- Shows: event name, date/time, attendee name
- Cancel button POSTs to `/api/v2/bookings/[id]/cancel` with `{ reason: "" }`
- On success: show "Rendez-vous annulé" confirmation
- Style: dark cognac theme matching the booking page

**Commit:** `feat: booking cancellation page /booking/[uid]/cancel`

---

### Task 6: Booking reschedule page

**Objective:** Allow a booker to reschedule by picking a new time. URL: `/booking/[uid]/reschedule`

**Files:**
- Create: `src/app/booking/[uid]/reschedule/page.tsx`
- Verify: `src/app/api/v2/bookings/[id]/reschedule/route.ts` (already exists)

**Implementation:**
- Fetch the original booking by uid
- Show the same calendar + slot picker as the main booking page (reuse the calendar component logic)
- On slot selection + confirm: PATCH `/api/v2/bookings/[id]/reschedule` with new startTime/endTime
- Show confirmation with new date/time

**Commit:** `feat: booking reschedule page /booking/[uid]/reschedule`

---

### Task 7: Add cancel/reschedule links to confirmation screen

**Objective:** After booking, show "Annuler" and "Reprogrammer" links pointing to the new cancel/reschedule pages.

**Files:**
- Modify: `src/app/[username]/[eventSlug]/page.tsx` — booking confirmation screen

**Implementation:**
Find the booking confirmation JSX block. Add:
```tsx
<div style={{ marginTop:16, display:"flex", gap:12 }}>
  <a href={`/booking/${booking.uid}/reschedule`} style={linkStyle}>
    Reprogrammer
  </a>
  <a href={`/booking/${booking.uid}/cancel`} style={{ ...linkStyle, color:"#8a7a60" }}>
    Annuler
  </a>
</div>
```
The booking response from `/api/v2/bookings` must return `uid` — verify it does, fix if not.

**Commit:** `feat: add cancel/reschedule links on booking confirmation`

---

## PHASE 3 — EMAIL CONFIRMATIONS

### Task 8: Install and configure Resend

**Objective:** Add Resend SDK for transactional emails. Configure API key in Vercel env vars.

**Files:**
- Run: `cd /c/Users/booboo/rdv-qc && npm install resend`
- Create: `src/lib/email.ts`

**Resend API key:** Sign up at resend.com, get API key, add to Vercel:
```bash
cd /c/Users/booboo/rdv-qc && npx vercel env add RESEND_API_KEY production
```

**Implementation of `src/lib/email.ts`:**
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmation({
  to, guestName, hostName, eventTitle,
  startTime, endTime, meetingUrl, uid
}: {
  to: string; guestName: string; hostName: string;
  eventTitle: string; startTime: string; endTime: string;
  meetingUrl?: string; uid: string;
}) {
  const date = new Date(startTime).toLocaleDateString('fr-CA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
    timeZone:'America/Toronto'
  });
  const time = new Date(startTime).toLocaleTimeString('fr-CA', {
    hour:'2-digit', minute:'2-digit', timeZone:'America/Toronto'
  });

  await resend.emails.send({
    from: 'Planxo <noreply@planxo.ca>',
    to,
    subject: `Confirmation : ${eventTitle} avec ${hostName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#1a1208;color:#e8d5b0;border-radius:12px;">
        <h1 style="font-size:22px;color:#c8a96e;margin-bottom:8px;">✅ Rendez-vous confirmé</h1>
        <p style="color:#8a7a60;margin-bottom:24px;">Bonjour ${guestName},</p>
        <div style="background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.2);border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="font-size:16px;font-weight:600;margin:0 0 8px;">${eventTitle}</p>
          <p style="color:#c8a96e;margin:0 0 4px;">📅 ${date}</p>
          <p style="color:#c8a96e;margin:0 0 4px;">🕐 ${time} (Toronto)</p>
          ${meetingUrl ? `<p style="margin:8px 0 0;"><a href="${meetingUrl}" style="color:#c8a96e;">🔗 Rejoindre la réunion</a></p>` : ''}
        </div>
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <a href="https://rdv-qc.vercel.app/booking/${uid}/reschedule" style="color:#8a7a60;font-size:13px;">Reprogrammer</a>
          <span style="color:#3a2a10;">|</span>
          <a href="https://rdv-qc.vercel.app/booking/${uid}/cancel" style="color:#8a7a60;font-size:13px;">Annuler</a>
        </div>
        <p style="font-size:11px;color:#3a2a10;">Planxo — Planification de rendez-vous pour le Québec</p>
      </div>
    `
  });
}

export async function sendBookingNotificationToHost({
  to, hostName, guestName, eventTitle, startTime, meetingUrl
}: {
  to: string; hostName: string; guestName: string;
  eventTitle: string; startTime: string; meetingUrl?: string;
}) {
  const date = new Date(startTime).toLocaleDateString('fr-CA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
    timeZone:'America/Toronto'
  });
  const time = new Date(startTime).toLocaleTimeString('fr-CA', {
    hour:'2-digit', minute:'2-digit', timeZone:'America/Toronto'
  });

  await resend.emails.send({
    from: 'Planxo <noreply@planxo.ca>',
    to,
    subject: `Nouveau rendez-vous : ${guestName} — ${eventTitle}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#1a1208;color:#e8d5b0;border-radius:12px;">
        <h1 style="font-size:22px;color:#c8a96e;margin-bottom:8px;">📅 Nouveau rendez-vous</h1>
        <p style="color:#8a7a60;margin-bottom:24px;">Bonjour ${hostName},</p>
        <div style="background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.2);border-radius:10px;padding:20px;">
          <p style="font-size:16px;font-weight:600;margin:0 0 8px;">${guestName} — ${eventTitle}</p>
          <p style="color:#c8a96e;margin:0 0 4px;">📅 ${date}</p>
          <p style="color:#c8a96e;margin:0 0 4px;">🕐 ${time} (Toronto)</p>
          ${meetingUrl ? `<p style="margin:8px 0 0;"><a href="${meetingUrl}" style="color:#c8a96e;">🔗 Rejoindre</a></p>` : ''}
        </div>
      </div>
    `
  });
}
```

**Commit:** `feat: Resend email client + confirmation/notification templates`

---

### Task 9: Trigger emails on booking creation

**Objective:** Call sendBookingConfirmation (to guest) + sendBookingNotificationToHost (to host) from the bookings POST route.

**Files:**
- Modify: `src/app/api/v2/bookings/route.ts`

**Implementation:**
In the POST handler, after the booking is successfully inserted, add:
```typescript
import { sendBookingConfirmation, sendBookingNotificationToHost } from "@/lib/email";

// After successful booking insert:
try {
  const guestEmail = body.responses?.email || body.attendeeEmail;
  const guestName = body.responses?.name || body.attendeeName;
  await sendBookingConfirmation({
    to: guestEmail,
    guestName,
    hostName: user.name || user.username,
    eventTitle: eventType.title,
    startTime: booking.startTime,
    endTime: booking.endTime,
    meetingUrl: booking.location,
    uid: booking.uid,
  });
  await sendBookingNotificationToHost({
    to: user.email,
    hostName: user.name || user.username,
    guestName,
    eventTitle: eventType.title,
    startTime: booking.startTime,
    meetingUrl: booking.location,
  });
} catch (emailErr) {
  console.error("Email send failed:", emailErr);
  // Don't fail the booking if email fails
}
```

**Commit:** `feat: send confirmation + host notification emails on booking`

---

## PHASE 4 — EVENT TYPE ADVANCED SETTINGS

### Task 10: Event type advanced settings page

**Objective:** Add an edit page for event types with buffer time, minimum booking notice, and requires-confirmation toggle.

**Files:**
- Create: `src/app/event-types/[id]/page.tsx`
- Modify: `src/app/api/v2/event-types/[id]/route.ts` — ensure PATCH handles new fields
- Modify: `src/app/api/v2/slots/route.ts` — respect minimumBookingNotice
- Modify: `src/app/dashboard/page.tsx` — add Edit link to event type rows

**Cal.diy reference:** `C:\Users\booboo\cal.diy\apps\web\modules\event-types\` — EventTypeForm tabs

**DB:** Add columns to event_types table:
```sql
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "beforeEventBuffer" INTEGER DEFAULT 0;
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "afterEventBuffer" INTEGER DEFAULT 0;
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "minimumBookingNotice" INTEGER DEFAULT 120;
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "requiresConfirmation" BOOLEAN DEFAULT false;
```

**Implementation of `src/app/event-types/[id]/page.tsx`:**
- Fetch event type from /api/v2/event-types/[id]
- Form fields: title, description, duration, location, buffer before/after (0/5/10/15/30 min dropdowns), minimum booking notice (dropdown: 0h/1h/2h/4h/24h/48h), requires confirmation toggle, price
- Save via PATCH /api/v2/event-types/[id]
- Dark cognac theme consistent with rest of app

**In slots API:** Filter out slots within `minimumBookingNotice` minutes from now:
```typescript
const minNoticeMs = (eventType.minimumBookingNotice || 120) * 60 * 1000;
const cutoff = new Date(Date.now() + minNoticeMs);
// Filter: only return slots where slot.startTime > cutoff
```

**Commit:** `feat: event type edit page with buffer/notice/confirmation settings`

---

## PHASE 5 — DASHBOARD IMPROVEMENTS

### Task 11: Dashboard booking filters (upcoming/past/cancelled)

**Objective:** Add filter tabs to the bookings list on the dashboard: Upcoming | Past | Cancelled.

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/api/v2/bookings/route.ts` — support ?status= and ?timeFilter= params

**Cal.diy reference:** `C:\Users\booboo\cal.diy\apps\web\modules\bookings\` — BookingsList with status tabs

**Implementation:**
In bookings API, support query params:
```typescript
const status = url.searchParams.get("status"); // ACCEPTED, CANCELLED, PENDING
const timeFilter = url.searchParams.get("timeFilter"); // upcoming, past
// Add to query:
if (timeFilter === "upcoming") query.gte("startTime", new Date().toISOString());
if (timeFilter === "past") query.lt("startTime", new Date().toISOString());
if (status) query.eq("status", status);
```

In dashboard, add filter pills:
```tsx
const FILTERS = [
  { label: "À venir", value: "upcoming" },
  { label: "Passés", value: "past" },
  { label: "Annulés", value: "cancelled" },
];
```

**Commit:** `feat: booking filter tabs (upcoming/past/cancelled) on dashboard`

---

### Task 12: Cancel booking from dashboard

**Objective:** Add a Cancel button on each booking row in the dashboard that calls the cancel API.

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Implementation:**
Add a cancel button to each booking row. On click: confirm dialog ("Annuler ce rendez-vous?") → POST /api/v2/bookings/[id]/cancel → refresh booking list.

```tsx
const cancelBooking = async (bookingId: number) => {
  if (!confirm("Annuler ce rendez-vous?")) return;
  await fetch(`/api/v2/bookings/${bookingId}/cancel`, { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ reason: "Annulé par l'hôte" }) });
  // Re-fetch bookings
  fetchBookings();
};
```

**Commit:** `feat: cancel booking from dashboard`

---

## PHASE 6 — AVAILABILITY IMPROVEMENTS

### Task 13: Date overrides (block specific dates)

**Objective:** Allow blocking specific dates (holidays, vacations) on the availability page. These dates show no slots on the public booking page.

**Files:**
- Modify: `src/app/availability/page.tsx` — add date override section
- Create: `src/app/api/availability/overrides/route.ts`
- DB: Create table

**Cal.diy reference:** The `date` field in Availability model is used for date overrides. Same approach.

**DB SQL:**
```sql
CREATE TABLE IF NOT EXISTS availability_overrides (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own overrides" ON availability_overrides
  FOR ALL USING (auth.uid() = user_id);
```

**Implementation:**
Below the availability calendar, add a "Dates bloquées" section:
- Date input + "Bloquer ce jour" button
- List of blocked dates with X to remove
- On the slots API: check overrides table, return no slots for blocked dates

**Commit:** `feat: date overrides (block specific dates) on availability page`

---

### Task 14: Link schedule to event type

**Objective:** Allow assigning a specific schedule to an event type (so different event types can have different availability windows).

**Files:**
- Modify: `src/app/event-types/[id]/page.tsx` — add schedule picker dropdown
- Modify: `src/app/api/v2/slots/route.ts` — use event type's scheduleId if set
- DB: Add scheduleId to EventType

**Cal.diy reference:** EventType.scheduleId FK in schema.prisma (line 200ish).

**DB SQL:**
```sql
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "scheduleId" INTEGER REFERENCES "Schedule"(id);
```

**Implementation:**
In event type edit page: dropdown "Utiliser l'horaire:" → lists user's schedules. Default = user's primary schedule. In slots API: if eventType.scheduleId, load that schedule's availability instead of the user's default.

**Commit:** `feat: link schedule to event type for per-event availability`

---

## PHASE 7 — GOOGLE CALENDAR SYNC

### Task 15: Wire Google Calendar sync on booking

**Objective:** When a booking is created, add it to the host's Google Calendar (if connected). The `src/lib/calendar-sync.ts` already exists — just wire it.

**Files:**
- Modify: `src/app/api/v2/bookings/route.ts`
- Verify: `src/lib/calendar-sync.ts` — check what functions exist

**Implementation:**
Read `src/lib/calendar-sync.ts` first. It should have a `createCalendarEvent()` or similar. After booking insert, call it:
```typescript
import { createGoogleCalendarEvent } from "@/lib/calendar-sync";

// After booking + emails:
try {
  if (user.googleRefreshToken) {
    await createGoogleCalendarEvent({
      userId: user.id,
      title: `${eventType.title} avec ${guestName}`,
      startTime: booking.startTime,
      endTime: booking.endTime,
      attendeeEmail: guestEmail,
      meetingUrl: booking.location,
    });
  }
} catch (calErr) {
  console.error("Google Calendar sync failed:", calErr);
}
```

**Commit:** `feat: wire Google Calendar sync on booking creation`

---

## PHASE 8 — POLISH & PRODUCTION READINESS

### Task 16: Public profile page polish

**Objective:** The `[username]/page.tsx` (public profile showing all event types) should look polished and match the booking widget theme.

**Files:**
- Modify: `src/app/[username]/page.tsx`

**Cal.diy reference:** `/[username]/page.tsx` in cal.diy shows avatar, name, bio, event type cards.

**Implementation:**
- Show host avatar (initial circle), name, username
- Event type cards: title, duration chip, location icon, description
- Dark cognac theme consistent with booking page
- "Réserver" CTA on each card linking to `/[username]/[slug]`

**Commit:** `feat: polish public profile page`

---

### Task 17: Onboarding flow polish + schedule seeding

**Objective:** Ensure the onboarding page correctly seeds schedule, availability, and first event type so new users land in a working state.

**Files:**
- Modify: `src/app/onboarding/page.tsx`
- Verify: `src/app/api/me/route.ts` — auto-create schedule on first login

**Implementation:**
- After onboarding form submit: create user record → create default Schedule → create Availability (Mon-Fri 9-17) → create 3 default event types (15min, 30min, 1h)
- Redirect to `/dashboard` on complete
- Show progress steps: "1. Profil → 2. Disponibilités → 3. Prêt!"

**Commit:** `feat: onboarding seeds schedule + default event types`

---

### Task 18: Mobile responsiveness pass

**Objective:** Ensure booking page, dashboard, availability page all work on mobile (375px width).

**Files:**
- Modify: `src/app/[username]/[eventSlug]/page.tsx`
- Modify: `src/app/availability/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Implementation:**
Use CSS media queries or inline style checks via viewport. Key fixes:
- Booking page: stack calendar + slots vertically on mobile
- Availability: stack calendar + slot panel vertically
- Dashboard: collapse sidebar to hamburger or top nav
- All grids: wrap at 375px

**Commit:** `feat: mobile responsiveness pass — booking, availability, dashboard`

---

### Task 19: Deploy all phases + smoke test

**Objective:** Deploy everything to production and verify core flows end to end.

**Steps:**
1. `cd /c/Users/booboo/rdv-qc && npx vercel deploy --prod --yes`
2. Test: `/availability` — calendar loads, slots save
3. Test: `/planxo/consultation-30min` — booking flow end to end
4. Test: `/dashboard` — bookings list, filters, cancel button
5. Test: `/settings` — profile saves
6. Test: `/event-types/[id]` — edit saves
7. Verify email arrives (check Resend dashboard)

**Commit:** `chore: production deploy all phases`

---

## EXECUTION ORDER

Phase 1 (Tasks 1-2) → Phase 2 (Tasks 3-7) → Phase 3 (Tasks 8-9) → Phase 4 (Task 10) → Phase 5 (Tasks 11-12) → Phase 6 (Tasks 13-14) → Phase 7 (Task 15) → Phase 8 (Tasks 16-19)

**Total: 19 tasks across 8 phases.**
**Estimated wall time: 6-8 hours of sequential execution.**
