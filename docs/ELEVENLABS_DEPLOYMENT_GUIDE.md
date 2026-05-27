# ElevenLabs Integration Deployment Guide

**Purpose:** Step-by-step guide for deploying ElevenLabs Conversational AI integration to Vercel  
**Last Updated:** May 27, 2026

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Migrations](#database-migrations)
4. [Vercel Deployment](#vercel-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

### Code Review

- [ ] All code changes reviewed and approved
- [ ] No console errors or warnings
- [ ] All tests passing locally
- [ ] No hardcoded secrets or API keys
- [ ] TypeScript compilation successful
- [ ] ESLint checks passing

### Testing

- [ ] Unit tests: 100% pass rate
- [ ] Integration tests: 100% pass rate
- [ ] E2E tests: 100% pass rate
- [ ] Performance tests: All benchmarks met
- [ ] Security tests: No vulnerabilities
- [ ] Accessibility tests: WCAG 2.1 AA compliant

### Documentation

- [ ] Integration guide completed
- [ ] Testing guide completed
- [ ] API documentation updated
- [ ] Troubleshooting guide prepared
- [ ] Team trained on new features

### Dependencies

- [ ] All packages up to date
- [ ] No breaking changes in dependencies
- [ ] Security vulnerabilities resolved
- [ ] Lock file committed

---

## Environment Configuration

### 1. Prepare Environment Variables

Create a `.env.production` file with all required variables:

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_elevenlabs_xxxxx
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Vercel Configuration
VERCEL_URL=https://your-domain.vercel.app
NODE_ENV=production

# Logging
LOG_LEVEL=info
DEBUG=false
```

### 2. Add to Vercel Project Settings

1. **Navigate to Vercel Dashboard:**
   ```
   https://vercel.com/dashboard
   ```

2. **Select Your Project:**
   - Click on your Planxo project

3. **Go to Settings → Environment Variables:**
   - Add each variable from `.env.production`
   - Select environments: Production, Preview, Development
   - Save changes

4. **Verify Variables:**
   - All required variables are set
   - No typos in variable names
   - Secrets are properly masked

### 3. Configure Webhook URL

1. **Get Vercel Deployment URL:**
   ```
   https://your-domain.vercel.app
   ```

2. **Update ElevenLabs Dashboard:**
   - Go to ElevenLabs console
   - Navigate to Agent Settings → Webhooks
   - Set webhook URL: `https://your-domain.vercel.app/api/v2/elevenlabs/webhooks`
   - Set webhook secret: (use `ELEVENLABS_WEBHOOK_SECRET`)
   - Enable webhook events: `conversation_completed`, `conversation_started`, `tool_called`

3. **Test Webhook:**
   ```bash
   curl -X POST "https://your-domain.vercel.app/api/v2/elevenlabs/webhooks" \
     -H "Content-Type: application/json" \
     -H "x-elevenlabs-signature: test_signature" \
     -d '{"event_type": "conversation_started"}'
   ```

---

## Database Migrations

### 1. Prepare Database

```bash
# Generate migration
npx prisma migrate dev --name add_elevenlabs_agent_config

# Verify migration file
cat prisma/migrations/add_elevenlabs_agent_config/migration.sql
```

### 2. Apply Migrations to Production

**Option A: Using Vercel Deployment Hooks**

1. Create a deployment hook in Vercel:
   ```
   Settings → Git → Deploy Hooks → Create Hook
   ```

2. Set hook command:
   ```bash
   npx prisma migrate deploy
   ```

3. Trigger hook before deployment

**Option B: Manual Migration**

1. Connect to production database:
   ```bash
   npx prisma db push --skip-generate
   ```

2. Verify migration applied:
   ```bash
   npx prisma migrate status
   ```

### 3. Backup Database

```bash
# Backup Supabase database
# Via Supabase dashboard:
# Settings → Backups → Create Manual Backup

# Or via CLI:
supabase db push --dry-run
```

---

## Vercel Deployment

### 1. Prepare Git Repository

```bash
# Ensure all changes are committed
git status

# Create deployment branch
git checkout -b deploy/elevenlabs-integration

# Push to remote
git push origin deploy/elevenlabs-integration
```

### 2. Deploy to Vercel

**Option A: Automatic Deployment (Recommended)**

1. **Create Pull Request:**
   ```bash
   # GitHub CLI
   gh pr create --title "Deploy: ElevenLabs Integration" \
     --body "Integrates ElevenLabs Conversational AI for appointment scheduling"
   ```

2. **Vercel Preview Deployment:**
   - Vercel automatically creates preview deployment
   - Review preview at: `https://your-domain-preview.vercel.app`
   - Run tests on preview deployment

3. **Merge to Main:**
   ```bash
   git checkout main
   git pull origin main
   git merge deploy/elevenlabs-integration
   git push origin main
   ```

4. **Production Deployment:**
   - Vercel automatically deploys to production
   - Monitor deployment progress in Vercel dashboard

**Option B: Manual Deployment**

```bash
# Deploy directly to production
vercel deploy --prod

# Or via Vercel CLI
vercel --prod
```

### 3. Monitor Deployment

```bash
# Check deployment status
vercel status

# View deployment logs
vercel logs --tail

# Check function logs
vercel logs --function api/v2/elevenlabs/tools/availability
```

---

## Post-Deployment Verification

### 1. Verify API Endpoints

**Test Availability Endpoint:**

```bash
curl -X GET "https://your-domain.vercel.app/api/v2/elevenlabs/tools/availability?date=2026-05-28" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "availableSlots": [...],
  "message": "Found X available slots"
}
```

**Test Booking Endpoint:**

```bash
curl -X POST "https://your-domain.vercel.app/api/v2/elevenlabs/tools/booking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "start_time": "2026-05-28T14:00:00Z"
  }'
```

**Test Agent Configuration:**

```bash
curl -X GET "https://your-domain.vercel.app/api/v2/elevenlabs/agent" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Verify Database Connection

```bash
# Check database is accessible
npx prisma db execute --stdin < /dev/null

# Verify tables exist
npx prisma db execute --stdin << EOF
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'voice_%';
EOF
```

### 3. Test End-to-End Flow

1. **Navigate to Voice Agent Page:**
   ```
   https://your-domain.vercel.app/dashboard/voice/agent
   ```

2. **Start Test Conversation:**
   - Click "Start Call" button
   - Verify agent responds
   - Complete booking flow
   - Verify confirmation email

3. **Check Database Records:**
   ```bash
   # Verify conversation logged
   npx prisma db execute --stdin << EOF
   SELECT * FROM voice_agent_conversations 
   ORDER BY startTime DESC LIMIT 1;
   EOF
   ```

### 4. Verify Webhook Integration

1. **Trigger Test Webhook:**
   ```bash
   curl -X POST "https://your-domain.vercel.app/api/v2/elevenlabs/webhooks" \
     -H "Content-Type: application/json" \
     -d '{"event_type": "conversation_completed", "conversation_id": "test_123"}'
   ```

2. **Check Webhook Logs:**
   ```bash
   vercel logs --function api/v2/elevenlabs/webhooks
   ```

3. **Verify Data Stored:**
   ```bash
   npx prisma db execute --stdin << EOF
   SELECT * FROM voice_agent_conversations 
   WHERE conversationId = 'test_123';
   EOF
   ```

### 5. Performance Verification

**Check Response Times:**

```bash
# Benchmark availability endpoint
ab -n 100 -c 10 "https://your-domain.vercel.app/api/v2/elevenlabs/tools/availability?date=2026-05-28"

# Expected: Mean time per request < 500ms
```

**Monitor Vercel Analytics:**
- Go to Vercel Dashboard → Analytics
- Check response times
- Monitor error rates
- Review bandwidth usage

---

## Monitoring & Maintenance

### 1. Set Up Monitoring

**Vercel Monitoring:**

```bash
# Enable Vercel Analytics
# In vercel.json:
{
  "analytics": true,
  "webAnalytics": {
    "enabled": true
  }
}
```

**Error Tracking:**

```bash
# Configure error notifications
# Settings → Notifications → Deployment Failed
```

### 2. Monitor ElevenLabs Agent

1. **Check Agent Status:**
   - Go to ElevenLabs dashboard
   - Review agent analytics
   - Check conversation quality metrics

2. **Monitor Tool Calls:**
   - Track tool success rate
   - Monitor tool response times
   - Review tool error logs

### 3. Database Monitoring

```bash
# Monitor database performance
# Supabase dashboard → Database → Monitoring

# Check query performance
# Supabase dashboard → Database → Query Performance
```

### 4. Set Up Alerts

**Vercel Alerts:**
- Failed deployments
- High error rates
- Performance degradation

**Supabase Alerts:**
- Database connection issues
- High query latency
- Storage limits

---

## Rollback Procedures

### 1. Rollback to Previous Deployment

**Via Vercel Dashboard:**

1. Go to Deployments
2. Find previous stable deployment
3. Click "Promote to Production"
4. Confirm rollback

**Via Vercel CLI:**

```bash
# List deployments
vercel list

# Promote specific deployment
vercel promote <deployment-id>
```

### 2. Rollback Database

**If migrations cause issues:**

```bash
# Check migration history
npx prisma migrate status

# Rollback to previous migration
npx prisma migrate resolve --rolled-back add_elevenlabs_agent_config

# Reapply correct migration
npx prisma migrate deploy
```

### 3. Verify Rollback

```bash
# Test endpoints after rollback
curl https://your-domain.vercel.app/api/v2/elevenlabs/agent

# Check logs
vercel logs --tail

# Verify database state
npx prisma db execute --stdin < /dev/null
```

---

## Troubleshooting Deployment Issues

### Issue: Environment Variables Not Loaded

**Symptom:**
```
Error: ELEVENLABS_API_KEY is not defined
```

**Solution:**
1. Verify variables in Vercel dashboard
2. Redeploy to apply changes
3. Check variable names match exactly

### Issue: Database Migration Failed

**Symptom:**
```
Error: Migration failed: table already exists
```

**Solution:**
1. Check migration status: `npx prisma migrate status`
2. Resolve migration: `npx prisma migrate resolve --rolled-back`
3. Reapply migration: `npx prisma migrate deploy`

### Issue: Webhook Not Receiving Events

**Symptom:**
- No conversation data in database
- Webhook logs show no activity

**Solution:**
1. Verify webhook URL in ElevenLabs dashboard
2. Check webhook secret matches
3. Test webhook manually
4. Check firewall/network settings

### Issue: High Response Times

**Symptom:**
- API responses > 1 second
- User reports slow experience

**Solution:**
1. Check Vercel function logs
2. Optimize database queries
3. Add caching if appropriate
4. Scale function resources

---

## Post-Deployment Checklist

- [ ] All endpoints responding correctly
- [ ] Database migrations applied successfully
- [ ] Webhooks receiving events
- [ ] E2E tests passing on production
- [ ] Performance metrics within acceptable range
- [ ] Error rate < 1%
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## Support & Escalation

**For Issues:**

1. **Check Vercel Logs:**
   ```bash
   vercel logs --tail
   ```

2. **Check ElevenLabs Dashboard:**
   - Agent logs
   - Webhook delivery status
   - Tool call history

3. **Check Supabase Dashboard:**
   - Database logs
   - Query performance
   - Connection status

4. **Contact Support:**
   - Vercel: https://vercel.com/support
   - ElevenLabs: https://help.elevenlabs.io
   - Supabase: https://supabase.com/support

---

**Document Version:** 1.0  
**Status:** Ready for Deployment
