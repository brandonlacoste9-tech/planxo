# ElevenLabs Integration Testing Guide

**Purpose:** Comprehensive testing procedures for ElevenLabs Conversational AI integration in Planxo  
**Last Updated:** May 27, 2026

---

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Testing Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Add ElevenLabs configuration
ELEVENLABS_API_KEY=sk_elevenlabs_xxxxx
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here
```

### Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Seed test data (optional)
npx prisma db seed
```

### Start Development Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

---

## Unit Testing

### Test Tool Endpoints

#### 1. Test Availability Endpoint

**Endpoint:** `GET /api/v2/elevenlabs/tools/availability`

**Test Case 1: Valid Request**

```bash
curl -X GET "http://localhost:3000/api/v2/elevenlabs/tools/availability?date=2026-05-28&timezone=America/Toronto" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "date": "2026-05-28",
  "timezone": "America/Toronto",
  "duration": 30,
  "availableSlots": [
    {
      "time": "09:00 AM",
      "isoTime": "2026-05-28T09:00:00Z",
      "available": true
    },
    {
      "time": "10:00 AM",
      "isoTime": "2026-05-28T10:00:00Z",
      "available": true
    }
  ],
  "slotCount": 2,
  "message": "Found 2 available slots for 2026-05-28"
}
```

**Test Case 2: Missing Date Parameter**

```bash
curl -X GET "http://localhost:3000/api/v2/elevenlabs/tools/availability?timezone=America/Toronto" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Expected Response:**

```json
{
  "error": "date parameter is required (YYYY-MM-DD format)",
  "status": 400
}
```

**Test Case 3: Invalid Date Format**

```bash
curl -X GET "http://localhost:3000/api/v2/elevenlabs/tools/availability?date=05-28-2026&timezone=America/Toronto" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Expected Response:**

```json
{
  "success": false,
  "error": "Invalid date format. Use YYYY-MM-DD",
  "status": 400
}
```

#### 2. Test Booking Endpoint

**Endpoint:** `POST /api/v2/elevenlabs/tools/booking`

**Test Case 1: Valid Booking**

```bash
curl -X POST "http://localhost:3000/api/v2/elevenlabs/tools/booking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "start_time": "2026-05-28T14:00:00Z",
    "duration": 30,
    "notes": "Initial consultation"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Appointment confirmed for John Doe",
  "booking": {
    "id": "booking_123",
    "attendeeName": "John Doe",
    "attendeeEmail": "john@example.com",
    "startTime": "2026-05-28T14:00:00Z",
    "duration": 30
  },
  "confirmationDetails": {
    "name": "John Doe",
    "email": "john@example.com",
    "date": "Wednesday, May 28, 2026",
    "time": "02:00 PM",
    "duration": "30 minutes",
    "confirmationNumber": "CONF-1234567890"
  },
  "agentMessage": "Perfect! I've confirmed your appointment for Wednesday, May 28, 2026 at 02:00 PM. A confirmation email has been sent to john@example.com. Is there anything else I can help you with?"
}
```

**Test Case 2: Missing Required Fields**

```bash
curl -X POST "http://localhost:3000/api/v2/elevenlabs/tools/booking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "John Doe"
  }'
```

**Expected Response:**

```json
{
  "success": false,
  "error": "Missing required fields",
  "message": "I need your name, email, and preferred time to complete the booking."
}
```

**Test Case 3: Invalid Email**

```bash
curl -X POST "http://localhost:3000/api/v2/elevenlabs/tools/booking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "invalid-email",
    "start_time": "2026-05-28T14:00:00Z"
  }'
```

**Expected Response:**

```json
{
  "success": false,
  "error": "Invalid email format",
  "message": "Please provide a valid email address."
}
```

### Test Agent Configuration Endpoint

**Endpoint:** `GET/POST /api/v2/elevenlabs/agent`

**Test Case 1: Get Agent Config**

```bash
curl -X GET "http://localhost:3000/api/v2/elevenlabs/agent" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Test Case 2: Create Agent Config**

```bash
curl -X POST "http://localhost:3000/api/v2/elevenlabs/agent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "agentId": "agent_123",
    "agentName": "Planxo Scheduler",
    "voiceId": "aria",
    "language": "en",
    "isActive": true
  }'
```

---

## Integration Testing

### Test Tool Call Flow

**Scenario:** User requests appointment, agent calls tools

1. **User Speaks to Agent:**
   ```
   "I'd like to book an appointment for May 28th"
   ```

2. **Agent Calls Availability Tool:**
   - Endpoint: `/api/v2/elevenlabs/tools/availability`
   - Params: `date=2026-05-28`
   - Verify response contains available slots

3. **User Selects Time:**
   ```
   "I'd like 2 PM"
   ```

4. **Agent Calls Booking Tool:**
   - Endpoint: `/api/v2/elevenlabs/tools/booking`
   - Body: Name, email, start_time
   - Verify booking is created in database

5. **Verify Database Entry:**
   ```sql
   SELECT * FROM voice_agent_conversations 
   WHERE conversationId = 'conv_123'
   AND userId = 'user_123';
   ```

### Test Webhook Integration

**Setup Webhook Listener:**

```bash
# Using ngrok for local testing
ngrok http 3000

# Configure webhook URL in ElevenLabs:
# https://your-ngrok-url.ngrok.io/api/v2/elevenlabs/webhooks
```

**Test Webhook Payload:**

```bash
curl -X POST "http://localhost:3000/api/v2/elevenlabs/webhooks" \
  -H "Content-Type: application/json" \
  -H "x-elevenlabs-signature: your_signature_here" \
  -d '{
    "event_type": "conversation_completed",
    "conversation_id": "conv_123",
    "user_id": "user_123",
    "agent_id": "agent_123",
    "transcript": [
      {
        "role": "user",
        "text": "I want to book an appointment"
      },
      {
        "role": "assistant",
        "text": "Sure! When would you like to schedule?"
      }
    ],
    "status": "completed",
    "duration_ms": 45000
  }'
```

**Verify Webhook Processing:**

```sql
SELECT * FROM voice_agent_conversations 
WHERE conversationId = 'conv_123';
```

---

## End-to-End Testing

### Complete Booking Flow

**Test Scenario:** Full appointment booking via voice

1. **Start Development Server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Voice Agent Page:**
   ```
   http://localhost:3000/dashboard/voice/agent
   ```

3. **Test Conversation Flow:**
   - Click "Start Call" button
   - Speak naturally: "Hi, I'd like to book an appointment"
   - Agent responds with greeting
   - Say: "I'm available on May 28th"
   - Agent checks availability
   - Say: "2 PM works for me"
   - Agent asks for name and email
   - Provide information
   - Agent confirms booking
   - Verify confirmation email received

4. **Verify Database Records:**
   ```sql
   -- Check booking created
   SELECT * FROM Booking 
   WHERE attendeeEmail = 'your-email@example.com'
   ORDER BY createdAt DESC LIMIT 1;

   -- Check conversation logged
   SELECT * FROM voice_agent_conversations 
   WHERE userId = 'your-user-id'
   ORDER BY startTime DESC LIMIT 1;
   ```

### Test Multiple Concurrent Calls

**Setup Load Test:**

```bash
# Using Apache Bench
ab -n 10 -c 5 "http://localhost:3000/api/v2/elevenlabs/tools/availability?date=2026-05-28"
```

**Expected Results:**
- All requests complete successfully
- Response time < 500ms
- No database connection errors

---

## Performance Testing

### Response Time Benchmarks

| Endpoint | Target | Acceptable |
|----------|--------|-----------|
| `/api/v2/elevenlabs/tools/availability` | < 200ms | < 500ms |
| `/api/v2/elevenlabs/tools/booking` | < 300ms | < 1000ms |
| `/api/v2/elevenlabs/agent` | < 100ms | < 300ms |
| `/api/v2/elevenlabs/webhooks` | < 500ms | < 2000ms |

### Load Testing Script

```bash
#!/bin/bash

echo "Testing availability endpoint..."
for i in {1..100}; do
  curl -s "http://localhost:3000/api/v2/elevenlabs/tools/availability?date=2026-05-28" \
    -H "Authorization: Bearer YOUR_AUTH_TOKEN" > /dev/null
done
echo "Completed 100 requests"
```

### Monitor Performance

```bash
# Check server logs
tail -f .next/logs/server.log

# Monitor database queries
# Enable Prisma query logging in .env.local
DATABASE_URL="postgresql://...?schema=public"
DEBUG="prisma:*"
```

---

## Troubleshooting

### Common Issues

#### 1. "Unauthorized" Error

**Symptom:**
```json
{ "error": "Unauthorized", "status": 401 }
```

**Solution:**
- Verify auth token is valid
- Check user is logged in
- Verify session hasn't expired

#### 2. "No available slots" Response

**Symptom:**
```json
{
  "success": true,
  "availableSlots": [],
  "message": "No available slots found for 2026-05-28"
}
```

**Solution:**
- Check calendar has events configured
- Verify date is in the future
- Check timezone is correct
- Ensure event type is active

#### 3. Webhook Not Received

**Symptom:**
- Conversation data not appearing in database
- No logs in webhook handler

**Solution:**
- Verify webhook URL is correct in ElevenLabs dashboard
- Check webhook secret is configured
- Verify firewall allows inbound requests
- Check server logs for errors
- Use ngrok for local testing

#### 4. Database Connection Error

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Verify Supabase connection string is correct
- Check database is running
- Verify network connectivity
- Check credentials in .env.local

### Debug Mode

Enable detailed logging:

```bash
# In .env.local
DEBUG=planxo:*
LOG_LEVEL=debug
```

### Check Logs

```bash
# Server logs
tail -f .next/logs/server.log

# Browser console
# Open DevTools → Console tab

# ElevenLabs dashboard
# Check agent logs in ElevenLabs console
```

---

## Deployment Testing

### Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests completed successfully
- [ ] Performance benchmarks met
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Webhook URL configured in ElevenLabs
- [ ] Error handling verified
- [ ] Logging configured
- [ ] Security review completed

### Vercel Deployment

```bash
# Deploy to Vercel
git push origin main

# Verify deployment
curl https://your-domain.vercel.app/api/v2/elevenlabs/agent

# Check logs
vercel logs --tail
```

### Post-Deployment Verification

1. **Test tool endpoints on production:**
   ```bash
   curl https://your-domain.vercel.app/api/v2/elevenlabs/tools/availability?date=2026-05-28
   ```

2. **Verify webhook connectivity:**
   - Configure webhook URL in ElevenLabs dashboard
   - Test webhook delivery

3. **Monitor error rates:**
   - Check Vercel error tracking
   - Monitor database performance
   - Review ElevenLabs agent analytics

---

## Success Criteria

✅ **All tests passing:**
- Unit tests: 100% pass rate
- Integration tests: 100% pass rate
- E2E tests: 100% pass rate

✅ **Performance metrics:**
- API response time < 500ms
- Webhook processing < 2s
- Database queries < 100ms

✅ **Reliability:**
- Error rate < 1%
- Uptime > 99.9%
- No data loss

✅ **User experience:**
- Smooth voice conversation
- Quick booking confirmation
- Clear error messages

---

**Document Version:** 1.0  
**Status:** Ready for Testing
