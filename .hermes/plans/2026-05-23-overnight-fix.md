# Planxo Overnight Fix Plan — DB Schema Alignment & Booking Flow Completion

> **For Hermes:** Execute autonomously. Deploy after each task. Test via curl + browser.
> **Goal:** Align all API routes and frontend pages with the actual cal.diy Supabase schema, then complete the full booking flow.
> **Architecture:** Node.js 20+, Next.js 16 (App Router), Supabase (cal.diy schema), Vercel deployments.
> **Tech Stack:** TypeScript, React 19, Supabase SDK, pg (direct pooler for DB ops)
> **Working dir:** `C:\Users\booboo\rdv-qc`
> **GitHub:** brandonlacoste9-tech/planxo (master)
> **Vercel:** prj_Poa7d26ig1aVvtjoOOcCBkBYGd3v, token: `$VERCEL_TOKEN`
> **Supabase:** vebwxcezwrrbirsiyyur, pooler: `postgres.vebwxcezwrrbirsiyyur:$DB_PASSWORD@aws-1-us-west-1.pooler.supabase.com:6543`
> **Supabase PAT:** `$SUPABASE_PAT`
> **Test user:** username=planxo, email=info@planxo.ca, userId=3

---

## DB Schema Reality (cal.diy)

| Table | Key Columns |
|-------|------------|
| `users` | id:integer, uuid:uuid, username, name, email, timeZone, completedOnboarding |
| `EventType` | id:integer, userId:integer, title, slug, length, location, isActive, price, currency |
| `Schedule` | id:integer, userId:integer, name, timeZone |
| `Availability` | id:integer, userId:integer, scheduleId:integer, eventTypeId:integer, days:integer[], startTime:time, endTime:time, date |
| `Booking` | id:integer, eventTypeId:integer, userId:integer, guestName, guestEmail, startTime, endTime, status, paid, meetingUrl |

**Critical differences from what API code expects:**
- `Schedule` has NO `isDefault`, `createdAt`, `updatedAt` columns
- `Availability` uses `days` ARRAY (e.g. `[0,1,2,3,4,5,6]`) — NOT `dayOfWeek` int per row
- `Availability` uses `startTime`/`endTime` as TIME type (returns `"09:00:00"`) — NOT `"09:00"`
- `Availability` has NO `isActive` column
- `Schedule.id` and `Availability.id` are INTEGER — NOT UUID strings

---

### Task 1: Fix Schedule seeding — add schedule for every new user

**Objective:** When a user completes onboarding, auto-create a Schedule + Availability row (days array format).

**Files:**
- Modify: `src/app/api/me/route.ts` (PUT handler, lines 48-58)

**Step 1: Add schedule creation after user upsert**

After line 58 (closing of insert), add:

```typescript
  // Auto-create default schedule + availability for new users
  const { data: existingSched } = await supabase
    .from("Schedule").select("id").eq("userId", existing?.id || null).single();
  
  if (!existingSched) {
    const userId = existing?.id;
    if (userId) {
      const { data: sched } = await supabase
        .from("Schedule")
        .insert({ userId, name: "Heures de travail", timeZone: timeZone || "America/Toronto" })
        .select("id").single();
      
      if (sched) {
        await supabase.from("Availability").insert({
          userId,
          scheduleId: sched.id,
          days: [0, 1, 2, 3, 4, 5, 6],
          startTime: "09:00:00",
          endTime: "17:00:00",
        });
      }
    }
  }
```

**Step 2: Commit**

```bash
git add src/app/api/me/route.ts
git commit -m "feat: auto-create Schedule + Availability on onboarding completion"
git push origin master
```

**Verification:** After deploy, visiting `/api/setup` should show all rows already exist. New user signup → Schedule + Availability auto-created.

---

### Task 2: Fix Availability page — load from real DB schema

**Objective:** The availability page loads from `/api/v2/me` expecting `schedules[0].intervals` with `dayOfWeek` per row. Fix to convert `days` array to per-day intervals.

**Files:**
- Modify: `src/app/api/v2/me/route.ts` (lines 31-41)

**Step 1: Rewrite the schedules join to expand days array**

Replace lines 31-41 (the schedules query block):

```typescript
  const { data: schedules } = await supabase
    .from("Schedule")
    .select("*, availabilities:Availability(*)")
    .eq("userId", user.id);

  // Expand days array into per-day interval objects for frontend compatibility
  const expandedSchedules = (schedules || []).map((s: any) => ({
    ...s,
    intervals: (s.availabilities || []).flatMap((a: any) => {
      const st = typeof a.startTime === "string" ? a.startTime.slice(0, 5) : "09:00";
      const et = typeof a.endTime === "string" ? a.endTime.slice(0, 5) : "17:00";
      if (Array.isArray(a.days)) {
        return a.days.map((d: number) => ({
          id: `avail-${a.id}-${d}`,
          scheduleId: a.scheduleId,
          dayOfWeek: d,
          startTime: st,
          endTime: et,
          isActive: true,
        }));
      }
      return [];
    }),
  }));
```

And update the return:

```typescript
  return NextResponse.json({
    ...user,
    eventTypes: eventTypes || [],
    schedules: expandedSchedules,
  });
```

**Step 2: Commit**

```bash
git add src/app/api/v2/me/route.ts
git commit -m "fix: /api/v2/me expands Availability.days array to per-day intervals for frontend"
git push origin master
```

**Verification:** `curl https://rdv-qc.vercel.app/api/v2/me?username=planxo` — schedules should have intervals array with 7 entries (dayOfWeek 0-6).

---

### Task 3: Fix Event Types page — test CRUD against real DB

**Objective:** Verify create/edit/delete event types work with the fixed `/api/v2/event-types` routes.

**Files:**
- Verify: `src/app/api/v2/event-types/route.ts` (already fixed `"users"`)
- Verify: `src/app/api/v2/event-types/[id]/route.ts` (already fixed `"users"`)
- Check: `src/app/event-types/page.tsx`

**Step 1: Test GET event types**

```bash
curl -s "https://rdv-qc.vercel.app/api/v2/event-types?userId=3"
```
Expected: 3+ event types returned.

**Step 2: Test POST (create)**

```bash
curl -s -X POST "https://rdv-qc.vercel.app/api/v2/event-types" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test RDV","slug":"test-rdv","length":15,"location":"phone"}'
```
Expected: 201 with new event type data.

**Step 3: Test PATCH (update)**

```bash
curl -s -X PATCH "https://rdv-qc.vercel.app/api/v2/event-types/<id>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test RDV Updated"}'
```
Expected: 200 with updated data.

**Step 4: Test DELETE**

```bash
curl -s -X DELETE "https://rdv-qc.vercel.app/api/v2/event-types/<id>"
```
Expected: 200 with `{status:"success", data:{id:"<id>"}}`.

If any fail, investigate the API route and fix column mismatches (EventType columns: id:integer, userId:integer — NOT UUID strings).

**Step 5: Commit (if fixes needed)**

---

### Task 4: Fix Dashboard — bookings display

**Objective:** Verify the dashboard loads and displays bookings correctly from the real DB.

**Files:**
- Check: `src/app/dashboard/page.tsx` (lines 30-60 likely fetch bookings)
- Verify: `src/app/api/v2/bookings/route.ts`

**Step 1: Test bookings API**

```bash
curl -s "https://rdv-qc.vercel.app/api/v2/bookings?userId=3"
```

If 404/no route for GET, add a GET handler to `/api/v2/bookings/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const eventTypeId = searchParams.get("eventTypeId");
  
  let query = supabase.from("Booking").select("*, eventType:EventType(title,slug)").order("startTime", { ascending: false });
  if (userId) query = query.eq("userId", userId);
  if (eventTypeId) query = query.eq("eventTypeId", eventTypeId);
  
  const { data, error } = await query;
  if (error) return NextResponse.json({ status: "error", error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ status: "success", data: data || [] });
}
```

**Step 2: Verify dashboard renders bookings**

Navigate `https://rdv-qc.vercel.app/dashboard` (requires auth — test via browser after deploy).

If the dashboard fetch URL doesn't match the API, fix it in `dashboard/page.tsx`.

**Step 3: Commit any fixes**

---

### Task 5: End-to-end booking test

**Objective:** Complete a full booking from the public page and verify it appears in the dashboard.

**Step 1: Book a slot via the API**

```bash
# Get a slot
SLOT=$(curl -s "https://rdv-qc.vercel.app/api/v2/slots?username=planxo&eventTypeSlug=consultation-30min&timeZone=America/Toronto" | python3 -c "import sys,json; d=json.load(sys.stdin); firstDay=list(d['data'].keys())[0]; print(d['data'][firstDay][0])")

# Book it
curl -s -X POST "https://rdv-qc.vercel.app/api/v2/bookings" \
  -H "Content-Type: application/json" \
  -d "{\"eventTypeSlug\":\"consultation-30min\",\"start\":\"$SLOT\",\"attendee\":{\"name\":\"Test User\",\"email\":\"test@example.com\",\"timeZone\":\"America/Toronto\"}}"
```

Expected: 201 with booking data including `calendarLinks`.

**Step 2: Verify booking appears**

```bash
curl -s "https://rdv-qc.vercel.app/api/v2/bookings?userId=3"
```

**Step 3: Test booking conflict detection**

Try booking the same slot again — expect 409 (conflict).

**Step 4: Test the public booking page**

Navigate `https://rdv-qc.vercel.app/planxo/consultation-30min` → click a future date → select a slot → fill form → confirm.

**Step 5: Commit any fixes**

---

### Task 6: Fix settings page

**Objective:** Verify the settings page loads and saves user preferences.

**Files:**
- Check: `src/app/settings/page.tsx`
- Verify: `/api/me` PUT still works

**Step 1: Test settings save**

```bash
curl -s -X PUT "https://rdv-qc.vercel.app/api/me" \
  -H "Content-Type: application/json" \
  -d '{"name":"Planxo Updated","username":"planxo","timeZone":"America/Toronto"}'
```
Expected: `{"status":"success"}`

Requires auth — this tests the Supabase auth flow. If it fails, the settings page may need to use the auth session differently.

---

### Task 7: Landing page polish

**Objective:** Verify the landing page renders correctly with all assets.

**Files:**
- Check: `src/app/page.tsx`

**Step 1: Navigate landing page**

`https://rdv-qc.vercel.app/` — verify:
- Hero section renders
- Buttons link correctly
- No broken images or layout issues
- Mobile responsive (resize browser to 375px)

**Step 2: Fix any visual issues**

Common Next.js 16 issues: Tailwind v4 class changes, Turbopack incompatibilities.

---

### Task 8: Final verification — full checklist

Run all these curls against production:

```bash
# 1. User endpoint
curl -s "https://rdv-qc.vercel.app/api/v2/me?username=planxo" | python3 -c "import sys,json; d=json.load(sys.stdin); print('User:', d.get('username'), '| Schedules:', len(d.get('schedules',[])), '| EventTypes:', len(d.get('eventTypes',[])))"

# 2. Event types
curl -s "https://rdv-qc.vercel.app/api/v2/event-types?userId=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('EventTypes:', len(d.get('data',[])))"

# 3. Slots
curl -s "https://rdv-qc.vercel.app/api/v2/slots?username=planxo&eventTypeSlug=consultation-30min&timeZone=America/Toronto" | python3 -c "import sys,json; d=json.load(sys.stdin); days = list(d.get('data',{}).keys()); print(f'Days with slots: {len(days)}, First day: {days[0] if days else \"none\"}')"

# 4. Availability (load)
curl -s "https://rdv-qc.vercel.app/api/v2/me?username=planxo" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('schedules',[]); print('Intervals:', len(s[0].get('intervals',[])) if s else 0)"

# 5. Landing page
curl -s -o /dev/null -w "%{http_code}" "https://rdv-qc.vercel.app/"
```

All should return HTTP 200 with non-empty data.

---

### If Time Permits — Bonus Tasks

**A. Google Calendar sync stub**
- Verify `src/lib/calendar-sync.ts` is imported but unused in slots route
- Wire `getExternalBusyTimes()` into slot conflict detection

**B. Email confirmation (Resend/Brevo)**
- Add email sending after successful booking
- Template: French confirmation with calendar links

**C. Reminder emails via cron Job**
- Create a cron job that checks upcoming bookings and sends reminders

**D. Interac e-Transfer payment option**
- Add payment method selector to booking form
- Interac flow: show instructions + auto-verify

---

**Deploy after every task.** Test with curl before moving to the next task.
**Commit message prefix:** `fix:` for fixes, `feat:` for features.
**If a test fails:** fix it, don't skip it.
