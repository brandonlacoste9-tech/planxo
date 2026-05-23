# Planxo Production Gap Closure — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Close 8 production gaps identified in architecture audit — Quebec tax, Law 25 consent, data residency, multi-step booking, locale routing, and payment pipeline hardening.

**Architecture:** Next.js 16 App Router, Prisma 5.22 schema → Supabase PostgreSQL, Tailwind v4, Stripe 22. Runtime uses Supabase JS client (not Prisma) via `lib/supabase.ts`. Prisma is used for schema/types + `prisma generate`. All DB changes need both Prisma schema edits AND Supabase migration SQL + `prisma db push` to sync.

**Tech Stack:** Next.js 16.2.6, React 19, PrismaClient 5.22, Supabase JS 2.106, Stripe 22.1, Tailwind v4, Node 22

**Working dir:** `C:\Users\booboo\rdv-qc`

---

## PHASE 1: COMPLIANCE-CRITICAL (must ship before paid bookings go live)

### Task 1: Create Law25Consent model in Prisma schema

**Objective:** Add consent tracking table for Law 25 compliance (granular consent, versioning, IP logging)

**Files:**
- Modify: `prisma/schema.prisma` — add `Law25Consent` model + relation on `User`
- Create: `supabase/migrations/003_law25_consent.sql`

**Step 1: Add to schema.prisma**

Add to `prisma/schema.prisma`:

```prisma
model Law25Consent {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  consentVersion        String   // e.g., "consent_v1_2026"
  dataCollectionAllowed Boolean  @default(false)
  crossBorderAllowed    Boolean  @default(false)
  ipAddress             String
  timestamp             DateTime @default(now())

  @@index([userId])
}
```

Add to `User` model:
```prisma
consents Law25Consent[]
```

**Step 2: Create migration SQL**

```sql
-- supabase/migrations/003_law25_consent.sql
CREATE TABLE "Law25Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "dataCollectionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "crossBorderAllowed" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Law25Consent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Law25Consent_userId_idx" ON "Law25Consent"("userId");
ALTER TABLE "Law25Consent" ADD CONSTRAINT "Law25Consent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
```

**Step 3: Run prisma generate** — `npx prisma generate`

**Step 4: Apply migration to Supabase** — run SQL via Supabase dashboard or API

**Step 5: Commit**
```bash
git add prisma/schema.prisma supabase/migrations/003_law25_consent.sql
git commit -m "feat: add Law25Consent model for Quebec privacy compliance"
```

---

### Task 2: Create Law 25 Consent API route (Server Action)

**Objective:** POST endpoint that records consent with IP and version, isolated from public booking API

**Files:**
- Create: `src/app/api/consent/route.ts`

**Step 1: Write the route**

```typescript
// src/app/api/consent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, dataCollectionAllowed, crossBorderAllowed } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const { error } = await supabase.from("Law25Consent").insert({
    userId,
    consentVersion: "consent_v1_2026",
    dataCollectionAllowed: !!dataCollectionAllowed,
    crossBorderAllowed: !!crossBorderAllowed,
    ipAddress: ip,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
```

**Step 2: Commit**
```bash
git add src/app/api/consent/route.ts
git commit -m "feat: Law 25 consent recording API endpoint"
```

---

### Task 3: Create Law25Consent React component

**Objective:** Granular consent checkboxes component with Quebec Law 25 language, to be embedded in booking flow

**Files:**
- Create: `src/components/Law25Consent.tsx`

```tsx
"use client";
import { useState } from "react";

export function Law25Consent({ onAccept }: { onAccept: (data: { dataCollection: boolean; crossBorder: boolean }) => void }) {
  const [dataCollection, setDataCollection] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);

  return (
    <div className="p-4 border rounded-lg bg-gray-50 mt-4">
      <h3 className="font-bold text-base text-gray-900">Protection des renseignements personnels</h3>
      <p className="text-xs text-gray-500 mb-3">
        Conformément à la Loi 25 du Québec (Loi sur la protection des renseignements personnels),
        nous devons obtenir votre consentement explicite.
      </p>
      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={dataCollection} onChange={() => setDataCollection(!dataCollection)} className="mt-0.5" />
        <span className="text-sm text-gray-700">J&apos;accepte la collecte de mes données personnelles nécessaires à la prise de rendez-vous.</span>
      </label>
      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={crossBorder} onChange={() => setCrossBorder(!crossBorder)} className="mt-0.5" />
        <span className="text-sm text-gray-700">Je comprends que mes données peuvent être traitées sur des serveurs situés hors du Québec.</span>
      </label>
      <button
        disabled={!dataCollection}
        onClick={() => onAccept({ dataCollection, crossBorder })}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Accepter et continuer
      </button>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/Law25Consent.tsx
git commit -m "feat: Law 25 granular consent React component"
```

---

### Task 4: Create Quebec Tax Engine (cents-based)

**Objective:** Utility that calculates TPS (5%) + TVQ (9.975%) in integer cents — no floating point

**Files:**
- Create: `src/lib/taxEngine.ts`

```typescript
// src/lib/taxEngine.ts
export interface TaxBreakout {
  subtotalCents: number;
  tpsCents: number;
  tvqCents: number;
  totalCents: number;
}

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

export function calculateQuebecTaxes(baseAmountCents: number): TaxBreakout {
  const tpsCents = Math.round(baseAmountCents * TPS_RATE);
  const tvqCents = Math.round(baseAmountCents * TVQ_RATE);
  const totalCents = baseAmountCents + tpsCents + tvqCents;

  return { subtotalCents: baseAmountCents, tpsCents, tvqCents, totalCents };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
```

**Step 2: Commit**
```bash
git add src/lib/taxEngine.ts
git commit -m "feat: Quebec tax engine — cents-based TPS/TVQ calculation"
```

---

### Task 5: Add tax fields to Booking model + migration

**Objective:** Extend Booking with basePriceCents, tpsCents, tvqCents, totalCents

**Files:**
- Modify: `prisma/schema.prisma` — add fields to Booking
- Create: `supabase/migrations/004_booking_tax_fields.sql`

**Step 1: Add to Booking model in schema.prisma**

```prisma
model Booking {
  // ... existing fields ...
  basePriceCents Int      @default(0)
  tpsCents       Int      @default(0)
  tvqCents       Int      @default(0)
  totalCents     Int      @default(0)
}
```

**Step 2: Migration SQL**

```sql
ALTER TABLE "Booking" ADD COLUMN "basePriceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "tpsCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "tvqCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "totalCents" INTEGER NOT NULL DEFAULT 0;
```

**Step 3: Run prisma generate + apply migration**

**Step 4: Commit**
```bash
git add prisma/schema.prisma supabase/migrations/004_booking_tax_fields.sql
git commit -m "feat: add tax breakdown fields to Booking (TPS/TVQ cents)"
```

---

### Task 6: Wire tax into Stripe checkout

**Objective:** Calculate TPS/TVQ in Stripe checkout route, pass tax amounts in metadata, store on webhook

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts` — import taxEngine, add tax line items
- Modify: `src/app/api/webhooks/stripe/route.ts` — store tax fields on booking creation

**Step 1: Update checkout route**

In `src/app/api/stripe/checkout/route.ts`:
- Import `{ calculateQuebecTaxes, formatCents }` from `@/lib/taxEngine`
- After `const lengthMin = ...`, add:
```typescript
const tax = calculateQuebecTaxes(et.price);
```
- Change line_items from single unit_amount to:
```typescript
line_items: [
  {
    price_data: {
      currency: et.currency || "cad",
      product_data: { name: et.title, description: `...` },
      unit_amount: et.price, // base price only
    },
    quantity: 1,
  },
  {
    price_data: {
      currency: et.currency || "cad",
      product_data: { name: "TPS (5%)" },
      unit_amount: tax.tpsCents,
    },
    quantity: 1,
  },
  {
    price_data: {
      currency: et.currency || "cad",
      product_data: { name: "TVQ (9.975%)" },
      unit_amount: tax.tvqCents,
    },
    quantity: 1,
  },
],
```
- Add to metadata: `basePriceCents: String(et.price)`, `tpsCents: String(tax.tpsCents)`, `tvqCents: String(tax.tvqCents)`, `totalCents: String(tax.totalCents)`

**Step 2: Update webhook handler**

In `src/app/api/webhooks/stripe/route.ts`, in the `booking.insert()` call, add:
```typescript
basePriceCents: parseInt(meta.basePriceCents || "0"),
tpsCents: parseInt(meta.tpsCents || "0"),
tvqCents: parseInt(meta.tvqCents || "0"),
totalCents: parseInt(meta.totalCents || "0"),
```

**Step 3: Commit**
```bash
git add src/app/api/stripe/checkout/route.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat: wire Quebec TPS/TVQ tax into Stripe checkout + webhook"
```

---

### Task 7: Add dataRegion to User model

**Objective:** Sovereignty audit trail — track where each user's data lives

**Files:**
- Modify: `prisma/schema.prisma` — add dataRegion to User
- Create: `supabase/migrations/005_user_data_region.sql`

**Step 1: Add to User:**
```prisma
dataRegion String @default("ca-central-1")
```

**Step 2: Migration:**
```sql
ALTER TABLE "User" ADD COLUMN "dataRegion" TEXT NOT NULL DEFAULT 'ca-central-1';
```

**Step 3: Commit**
```bash
git add prisma/schema.prisma supabase/migrations/005_user_data_region.sql
git commit -m "feat: add dataRegion to User for sovereignty audit trail"
```

---

## PHASE 2: BOOKING PIPELINE UPGRADE

### Task 8: Add BookingStatus enum to Prisma schema

**Objective:** Replace magic strings with typed enum: PENDING, PENDING_INTERAC, CONFIRMED, CANCELLED

**Files:**
- Modify: `prisma/schema.prisma`

Add enum:
```prisma
enum BookingStatus {
  PENDING
  PENDING_INTERAC
  CONFIRMED
  CANCELLED
}
```

Change Booking.status from `String @default("confirmed")` to `BookingStatus @default(CONFIRMED)`.

Run `prisma generate` and update any TS references from `"confirmed"` to `"CONFIRMED"`.

**Step 2: Commit**
```bash
git add prisma/schema.prisma
git commit -m "refactor: add BookingStatus enum — PENDING, PENDING_INTERAC, CONFIRMED, CANCELLED"
```

---

### Task 9: Extract slotEngine as reusable lib

**Objective:** Move slot generation logic from API route into `src/lib/scheduling/slotEngine.ts` for reuse in multi-step booking

**Files:**
- Create: `src/lib/scheduling/slotEngine.ts`
- Modify: `src/app/api/v2/slots/route.ts` — import from lib

The lib exports `generateSlots()` — a pure function that takes working hours, busy slots, duration, and buffers, returns `Slot[]`. The API route becomes a thin wrapper that queries DB and calls the lib.

**Commit:**
```bash
git add src/lib/scheduling/slotEngine.ts src/app/api/v2/slots/route.ts
git commit -m "refactor: extract slot engine as reusable lib"
```

---

### Task 10: Multi-step booking — SlotPicker → IntakeForm → TaxCheckout → Confirmation

**Objective:** Convert monolithic `[slug]/page.tsx` into 4-step pipeline

**Files:**
- Create: `src/app/[slug]/steps/SlotPicker.tsx`
- Create: `src/app/[slug]/steps/IntakeForm.tsx`
- Create: `src/app/[slug]/steps/TaxCheckout.tsx`
- Create: `src/app/[slug]/steps/Confirmation.tsx`
- Modify: `src/app/[slug]/page.tsx` — becomes step router

Flow:
1. **SlotPicker** — calendar + time slot selection (extracted from current page)
2. **IntakeForm** — name, email, notes + Law25Consent component + optional custom questions ("Demande de soumission")
3. **TaxCheckout** — shows price breakdown (subtotal + TPS + TVQ = total), payment button if paid
4. **Confirmation** — success page (extracted from current page)

**Commit:** per-step commits

---

### Task 11: Create middleware.ts — locale default + Law 25 headers

**Objective:** Auto-route to fr-CA, inject Law 25 notice headers, log IP for consent audit

**Files:**
- Create: `src/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Planxo-Law25-Notice", "consent_v1_2026");
  response.headers.set("X-Data-Region", "ca-central-1");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
```

**Commit:**
```bash
git add src/middleware.ts
git commit -m "feat: middleware — Law 25 headers + data region assertion"
```

---

## PHASE 3: OPERATIONS

### Task 12: Reminder system (cron-based alternative to BullMQ)

**Objective:** Since Planxo has no Redis, use Vercel Cron Jobs or Hermes cron to send reminders

**Files:**
- Create: `src/app/api/cron/reminders/route.ts`

A GET endpoint that:
1. Queries bookings starting in 24h and 1h
2. Sends email via Supabase email or a simple fetch to a notification service
3. Protected by a `CRON_SECRET` header

Registered as a Vercel Cron Job in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "*/15 * * * *" }
  ]
}
```

**Commit:**
```bash
git add src/app/api/cron/reminders/route.ts vercel.json
git commit -m "feat: reminder cron — checks bookings 24h/1h before and sends alerts"
```

---

### Task 13: Interac PENDING_INTERAC status + timeout

**Objective:** Add payment-in-progress status for async payments like Interac e-Transfer

**Files:**
- Modify: `src/lib/scheduling/slotEngine.ts` — exclude PENDING_INTERAC slots like cancelled
- Modify: `src/app/api/v2/slots/route.ts` — filter PENDING_INTERAC from busy check
- Create: `src/app/api/cron/release-interac/route.ts` — release stale PENDING_INTERAC after 30 min

When a user selects "Interac" payment, booking is created as PENDING_INTERAC. A cron job every 5 min releases any PENDING_INTERAC older than 30 min back to CANCELLED.

**Commit:** per-file commits

---

## EXECUTION ORDER

```
Phase 1 (compliance):
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7

Phase 2 (pipeline):
  Task 8 → Task 9 → Task 10 → Task 11

Phase 3 (operations):
  Task 12 → Task 13
```

## VERIFICATION AFTER EACH PHASE

- **Phase 1:** `npx prisma generate` succeeds, Stripe checkout shows TPS/TVQ line items, consent API responds 200
- **Phase 2:** Booking flow works end-to-end, middleware sets headers (check with `curl -I`), slot engine returns same results as before
- **Phase 3:** Cron endpoint returns 200, PENDING_INTERAC slots auto-release after 30 min

## RISKS

1. **Prisma migration on live Supabase** — always test migration SQL on staging first. The `supabase/migrations/` SQL files use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` which are safe for live DBs
2. **Tax calculation changes prices** — if existing paid bookings were $49 flat, they now show as $49 + $2.45 TPS + $4.89 TVQ = $56.34. May need to adjust EventType base price down so total matches old price
3. **Multi-step refactor** — don't break existing booking URLs. Keep same `[slug]` path, just change internal flow. Old `?booked=ID` confirmation must still work
