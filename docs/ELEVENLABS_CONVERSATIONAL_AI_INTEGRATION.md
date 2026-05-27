# ElevenLabs Conversational AI Integration Guide for Planxo

**Author:** Manus AI  
**Date:** May 27, 2026  
**Purpose:** Integrate ElevenLabs Conversational AI agents for native voice-based appointment scheduling in Planxo

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Strategy](#implementation-strategy)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [API Integration](#api-integration)
6. [Environment Configuration](#environment-configuration)
7. [Testing & Deployment](#testing--deployment)
8. [References](#references)

---

## Overview

### Current State

Planxo currently uses a **hybrid approach** for voice scheduling:

- **Speech-to-Text (STT)**: Deepgram for transcription
- **Conversation Management**: Custom `ConversationManager` class handling state machine
- **Text-to-Speech (TTS)**: ElevenLabs for audio synthesis
- **Booking Logic**: Custom endpoints (`/api/v2/ai/availability`, `/api/v2/ai/book`)

This approach works but requires manual orchestration of multiple services.

### Proposed Enhancement

**ElevenLabs Conversational AI** provides a unified, production-ready solution:

- **Native ASR (Automatic Speech Recognition)**: Fine-tuned speech recognition model
- **Built-in Conversation Management**: Proprietary turn-taking and conversation flow management
- **Native TTS**: 5,000+ voices across 70+ languages
- **Tool Integration**: Direct API calls to backend services (availability checks, booking creation)
- **Multimodal Support**: Voice, chat, web widgets, mobile apps, telephony
- **Production Features**: Analytics, monitoring, A/B testing, conversation analysis

### Key Benefits

| Feature | Current | ElevenLabs Agents |
|---------|---------|-------------------|
| **Speech Recognition** | Deepgram (external) | Native fine-tuned model |
| **Conversation Logic** | Custom state machine | Built-in with turn-taking |
| **Tool Integration** | Manual API calls | Native tool system |
| **Deployment** | Browser + server | Browser, mobile, telephony, web |
| **Monitoring** | Manual logging | Built-in analytics & monitoring |
| **Scalability** | Limited by infrastructure | Enterprise-grade |
| **Cost** | Per-service pricing | Unified pricing model |

---

## Architecture

### ElevenLabs Conversational AI Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    ElevenLabs Agents                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   ASR Model  │  │  LLM/Claude  │  │  TTS Engine  │      │
│  │ (Speech→Text)│  │(Conversation)│  │(Text→Speech) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                  │
│                  ┌─────────▼─────────┐                       │
│                  │  Turn-Taking      │                       │
│                  │  & Timing Model   │                       │
│                  └─────────┬─────────┘                       │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│    ┌────▼────┐        ┌────▼────┐      ┌────▼────┐         │
│    │  Tools  │        │Knowledge│      │ Events  │         │
│    │ (Webhooks)       │  Base   │      │ (Real-  │         │
│    │         │        │         │      │  time)  │         │
│    └─────────┘        └─────────┘      └─────────┘         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
   │   Web   │         │ Mobile  │        │Telephony│
   │ Widget  │         │   SDK   │        │ (SIP)   │
   └─────────┘         └─────────┘        └─────────┘
```

### Integration with Planxo

```
┌────────────────────────────────────────────────────────────┐
│                  Planxo Application                         │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ElevenLabs Agent Widget/Embed                │  │
│  │  (Replaces VoiceSchedulingAgent component)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                    │
│                        │ Tool Calls                         │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Planxo Backend (Next.js API Routes)             │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  /api/v2/elevenlabs/tools                       │ │  │
│  │  │  - checkAvailability()                          │ │  │
│  │  │  - createBooking()                              │ │  │
│  │  │  - getCalendarSlots()                           │ │  │
│  │  │  - confirmAppointment()                         │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  /api/v2/elevenlabs/agent                       │ │  │
│  │  │  - createAgent()                                │ │  │
│  │  │  - updateAgent()                                │ │  │
│  │  │  - getAgentStatus()                             │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Prisma/Supabase Database                     │  │
│  │  - bookings                                          │  │
│  │  - eventTypes                                        │  │
│  │  - schedules                                         │  │
│  │  - voice_calls (new)                                │  │
│  │  - voice_agent_configs (new)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)

1. **Create ElevenLabs Agent Configuration**
   - Set up agent in ElevenLabs dashboard
   - Configure system prompt for appointment scheduling
   - Define conversation flow and turn-taking behavior

2. **Implement Backend Tool Handlers**
   - Create `/api/v2/elevenlabs/tools` endpoint
   - Implement tool handlers for availability checking
   - Implement tool handlers for booking creation

3. **Database Schema Updates**
   - Add `voice_agent_configs` table to track agent settings
   - Add `voice_agent_conversations` table for conversation history
   - Update `voice_calls` table with ElevenLabs agent ID

### Phase 2: Integration (Week 2)

1. **Create Agent Management Routes**
   - `/api/v2/elevenlabs/agent` - CRUD operations
   - `/api/v2/elevenlabs/agent/status` - Health checks
   - `/api/v2/elevenlabs/agent/config` - Configuration updates

2. **Implement Webhook Handlers**
   - Post-call webhook handler for conversation data
   - Event webhook handler for real-time updates
   - Error handling and retry logic

3. **Frontend Integration**
   - Replace `VoiceSchedulingAgent` component with ElevenLabs widget
   - Update dashboard to show agent status
   - Add agent configuration UI

### Phase 3: Production Hardening (Week 3)

1. **Monitoring & Analytics**
   - Integrate conversation analytics
   - Set up call quality metrics
   - Create monitoring dashboard

2. **Error Handling & Fallbacks**
   - Implement graceful degradation
   - Add retry logic for failed tool calls
   - Create error recovery workflows

3. **Testing & Optimization**
   - Load testing with multiple concurrent calls
   - Conversation quality evaluation
   - Cost optimization analysis

---

## Step-by-Step Implementation

### Step 1: Create ElevenLabs Agent

**In ElevenLabs Dashboard:**

1. Navigate to **Agents** → **Create New Agent**
2. Configure basic settings:
   - **Name**: "Planxo Appointment Scheduler"
   - **Model**: Claude 3.5 Sonnet (recommended for complex reasoning)
   - **Voice**: Select professional voice (e.g., "Aria" or "Sage")
   - **Language**: French (Quebec) + English

3. Write System Prompt:

```
You are Planxo, a professional AI appointment scheduling assistant for healthcare and service providers.

YOUR ROLE:
- Help callers book appointments with professionals
- Check real-time calendar availability
- Collect necessary information (name, email, preferred time)
- Confirm bookings and provide confirmation details

CONVERSATION FLOW:
1. Greet the caller warmly
2. Ask about their appointment needs
3. Collect their contact information (name, email)
4. Check available time slots
5. Confirm the appointment
6. Provide confirmation details and next steps

GUIDELINES:
- Be professional, friendly, and efficient
- Ask one question at a time
- Confirm all details before booking
- If a time is unavailable, suggest alternatives
- Handle cancellations and rescheduling requests
- Always verify email addresses for accuracy
- Provide clear confirmation with date, time, and next steps

TONE: Professional, helpful, and conversational. Use "vous" form in French.
```

4. Configure Tools (see Step 2 below)

### Step 2: Configure Tools in ElevenLabs

Create two webhook tools in the ElevenLabs dashboard:

#### Tool 1: Check Availability

```yaml
Name: check_availability
Description: Check available appointment slots for a specific date
Type: Webhook
Method: GET
URL: https://your-domain.com/api/v2/elevenlabs/tools/availability
Headers:
  Authorization: Bearer YOUR_ELEVENLABS_API_KEY
  Content-Type: application/json

Parameters:
  - date (required): YYYY-MM-DD format
  - duration (optional): appointment duration in minutes (default: 30)
  - timezone (optional): IANA timezone (default: America/Toronto)
```

#### Tool 2: Create Booking

```yaml
Name: create_booking
Description: Create a new appointment booking
Type: Webhook
Method: POST
URL: https://your-domain.com/api/v2/elevenlabs/tools/booking
Headers:
  Authorization: Bearer YOUR_ELEVENLABS_API_KEY
  Content-Type: application/json

Body Parameters:
  - name (required): Attendee full name
  - email (required): Attendee email address
  - start_time (required): ISO 8601 datetime
  - duration (optional): appointment duration in minutes
  - notes (optional): additional notes from caller
```

### Step 3: Create Backend Tool Handlers

Create `/src/app/api/v2/elevenlabs/tools/availability/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const duration = parseInt(searchParams.get("duration") || "30");
  const timezone = searchParams.get("timezone") || "America/Toronto";

  if (!date) {
    return NextResponse.json(
      { error: "date parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's event types and schedules
    const { data: eventTypes } = await supabase
      .from("EventType")
      .select("*, schedule:Schedule(*)")
      .eq("userId", user.id)
      .eq("isActive", true);

    if (!eventTypes || eventTypes.length === 0) {
      return NextResponse.json({
        availableSlots: [],
        message: "No active event types found"
      });
    }

    // Get availability for the date
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    const slotsUrl = new URL(`${baseUrl}/api/v2/slots`);
    slotsUrl.searchParams.set("username", user.id);
    slotsUrl.searchParams.set("date", date);
    slotsUrl.searchParams.set("timeZone", timezone);

    const slotsResponse = await fetch(slotsUrl.toString());
    const slotsData = await slotsResponse.json();

    if (!slotsResponse.ok) {
      throw new Error(slotsData.error?.message || "Failed to fetch slots");
    }

    const slots = slotsData.data?.slots || [];
    const availableSlots = slots.map((slot: any) => ({
      time: new Date(slot.time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone
      }),
      isoTime: slot.time,
      available: true
    }));

    return NextResponse.json({
      date,
      timezone,
      availableSlots,
      count: availableSlots.length,
      message: `Found ${availableSlots.length} available slots for ${date}`
    });
  } catch (error: any) {
    console.error("[ElevenLabs Tools] Availability error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check availability" },
      { status: 500 }
    );
  }
}
```

Create `/src/app/api/v2/elevenlabs/tools/booking/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, start_time, duration = 30, notes } = body;

    if (!name || !email || !start_time) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, start_time" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Call the booking API
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    const bookingResponse = await fetch(`${baseUrl}/api/v2/ai/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        start: start_time,
        notes: notes || `Voice booking via ElevenLabs agent. Duration: ${duration}min`
      })
    });

    const bookingData = await bookingResponse.json();

    if (!bookingResponse.ok) {
      throw new Error(bookingData.error || "Booking failed");
    }

    // Log the booking in voice_calls table
    await supabase.from("voice_calls").insert({
      userId: user.id,
      callSid: `elevenlabs-${Date.now()}`,
      direction: "inbound",
      status: "completed",
      purpose: "appointment_booking",
      transcript: [{
        role: "system",
        text: `Booking created: ${name} (${email}) for ${start_time}`
      }],
      context: {
        attendeeName: name,
        attendeeEmail: email,
        bookingId: bookingData.booking?.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `Appointment confirmed for ${name}`,
      booking: bookingData.booking,
      confirmationDetails: {
        name,
        email,
        dateTime: start_time,
        duration: `${duration} minutes`
      }
    });
  } catch (error: any) {
    console.error("[ElevenLabs Tools] Booking error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create booking" },
      { status: 500 }
    );
  }
}
```

### Step 4: Create Agent Management Routes

Create `/src/app/api/v2/elevenlabs/agent/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Retrieve agent configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("voice_agent_configs")
      .select("*")
      .eq("userId", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      agentConfig: data || null,
      message: data ? "Agent config found" : "No agent config found"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Agent] GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve agent" },
      { status: 500 }
    );
  }
}

// POST: Create or update agent configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      agentId,
      agentName,
      systemPrompt,
      voiceId,
      language,
      isActive
    } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("voice_agent_configs")
      .upsert({
        userId: user.id,
        agentId,
        agentName: agentName || "Planxo Scheduler",
        systemPrompt,
        voiceId,
        language: language || "en",
        isActive: isActive !== false,
        updatedAt: new Date().toISOString()
      }, { onConflict: "userId" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      agentConfig: data,
      message: "Agent configuration saved"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Agent] POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save agent" },
      { status: 500 }
    );
  }
}
```

### Step 5: Update Database Schema

Create a new Prisma migration:

```bash
npx prisma migrate dev --name add_elevenlabs_agent_config
```

Add to `prisma/schema.prisma`:

```prisma
model VoiceAgentConfig {
  id          String   @id @default(cuid())
  userId      String   @unique
  agentId     String   // ElevenLabs agent ID
  agentName   String   @default("Planxo Scheduler")
  systemPrompt String? @db.Text
  voiceId     String?
  language    String   @default("en")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@schema("public")
}

model VoiceAgentConversation {
  id              String   @id @default(cuid())
  userId          String
  agentId         String
  conversationId  String   // ElevenLabs conversation ID
  transcript      Json[]   // Array of {role, text, timestamp}
  status          String   @default("active") // active, completed, failed
  startTime       DateTime @default(now())
  endTime         DateTime?
  metadata        Json?    // Additional context

  @@index([userId])
  @@index([agentId])
  @@index([conversationId])
  @@schema("public")
}
```

### Step 6: Create Frontend Component

Replace the `VoiceSchedulingAgent` component with ElevenLabs widget integration:

Create `/src/components/voice/ElevenLabsAgentWidget.tsx`:

```typescript
'use client';

import React, { useEffect, useState } from 'react';

interface ElevenLabsAgentWidgetProps {
  agentId: string;
  mode?: 'demo' | 'dashboard';
  className?: string;
}

export function ElevenLabsAgentWidget({
  agentId,
  mode = 'dashboard',
  className = ''
}: ElevenLabsAgentWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load ElevenLabs widget script
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => {
      setIsLoading(false);
      // Initialize widget with agent ID
      if (window.ElevenLabsConvAI) {
        window.ElevenLabsConvAI.setAgentId(agentId);
      }
    };
    script.onerror = () => {
      setError('Failed to load ElevenLabs widget');
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [agentId]);

  if (error) {
    return (
      <div style={{
        padding: 20,
        textAlign: 'center',
        color: '#ef4444',
        border: '1px solid #fecaca',
        borderRadius: 8,
        backgroundColor: '#fef2f2'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ minHeight: 400 }}>
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          color: '#666'
        }}>
          Loading voice agent...
        </div>
      )}
      <div id="elevenlabs-convai-widget" />
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ElevenLabsConvAI?: {
      setAgentId: (id: string) => void;
      [key: string]: any;
    };
  }
}
```

---

## API Integration

### Authentication

All API requests must include the ElevenLabs API key in the authorization header:

```
Authorization: Bearer YOUR_ELEVENLABS_API_KEY
```

Store this in your environment variables:

```bash
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
```

### Tool Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User speaks to ElevenLabs Agent                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Agent processes speech and determines tool needed        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Agent makes HTTP request to Planxo tool endpoint         │
│    POST /api/v2/elevenlabs/tools/booking                    │
│    {                                                         │
│      "name": "John Doe",                                    │
│      "email": "john@example.com",                           │
│      "start_time": "2026-05-28T14:00:00Z"                  │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Planxo backend processes booking                         │
│    - Validates input                                        │
│    - Checks availability                                    │
│    - Creates booking in database                            │
│    - Returns confirmation                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. ElevenLabs agent receives response and continues         │
│    conversation with confirmation                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Required Environment Variables

Add to your `.env.local`:

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_elevenlabs_xxxxx
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Planxo Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Deployment
VERCEL_URL=https://your-domain.vercel.app
```

### Vercel Deployment

1. **Add environment variables** to Vercel project settings
2. **Configure webhook URL** in ElevenLabs dashboard:
   - `https://your-domain.vercel.app/api/v2/elevenlabs/webhooks`
3. **Test deployment** with sample conversation

---

## Testing & Deployment

### Local Testing

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Test tool endpoints:**
   ```bash
   # Check availability
   curl -X GET "http://localhost:3000/api/v2/elevenlabs/tools/availability?date=2026-05-28&timezone=America/Toronto"

   # Create booking
   curl -X POST "http://localhost:3000/api/v2/elevenlabs/tools/booking" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "John Doe",
       "email": "john@example.com",
       "start_time": "2026-05-28T14:00:00Z"
     }'
   ```

3. **Test agent in ElevenLabs dashboard:**
   - Use "Test AI Agent" button
   - Simulate conversation flow
   - Verify tool calls are working

### Production Deployment

1. **Deploy to Vercel:**
   ```bash
   git push origin main
   ```

2. **Verify deployment:**
   - Check Vercel logs
   - Test tool endpoints on production URL
   - Monitor ElevenLabs agent performance

3. **Monitor conversation quality:**
   - Check ElevenLabs analytics dashboard
   - Review conversation transcripts
   - Monitor booking success rate

### Success Criteria

- ✅ Agent responds to appointment booking requests
- ✅ Tool calls successfully check availability
- ✅ Bookings are created in Planxo database
- ✅ Confirmation messages are sent to users
- ✅ Conversation history is logged
- ✅ Error handling works correctly
- ✅ Performance meets SLA requirements

---

## References

1. **ElevenLabs Conversational AI Overview**  
   https://elevenlabs.io/docs/eleven-agents/overview

2. **ElevenLabs Agent Configuration**  
   https://elevenlabs.io/docs/eleven-agents/build/overview

3. **ElevenLabs Tools Integration**  
   https://elevenlabs.io/docs/eleven-agents/customization/tools

4. **ElevenLabs Cal.com Integration Example**  
   https://elevenlabs.io/docs/eleven-agents/customization/integrations/calcom

5. **ElevenLabs API Reference**  
   https://elevenlabs.io/docs/api-reference/introduction

6. **ElevenLabs Webhook Events**  
   https://elevenlabs.io/docs/eleven-agents/advanced/events

---

## Next Steps

1. **Create ElevenLabs Agent** in dashboard (5 minutes)
2. **Implement backend tool handlers** (2-3 hours)
3. **Update database schema** (30 minutes)
4. **Create frontend component** (1-2 hours)
5. **Test locally** (1 hour)
6. **Deploy to Vercel** (30 minutes)
7. **Monitor and optimize** (ongoing)

**Total estimated time: 6-8 hours for initial implementation**

---

**Document Version:** 1.0  
**Last Updated:** May 27, 2026  
**Status:** Ready for Implementation
