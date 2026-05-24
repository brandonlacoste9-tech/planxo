-- Voice calls table for AI phone agent
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    callSid TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    bookingId UUID REFERENCES bookings(id) ON DELETE SET NULL,
    eventTypeId UUID REFERENCES "EventType"(id) ON DELETE SET NULL,
    
    -- Call metadata
    purpose TEXT NOT NULL DEFAULT 'inbound_booking', -- inbound_booking, reminder, no_show_followup, custom
    direction TEXT NOT NULL DEFAULT 'inbound', -- inbound, outbound
    status TEXT NOT NULL DEFAULT 'queued', -- queued, ringing, in_progress, completed, failed, cancelled
    
    -- Phone numbers
    "from" TEXT,
    "to" TEXT,
    
    -- Professional info
    professionalName TEXT,
    
    -- Conversation data
    transcript JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    finalState TEXT,
    
    -- Recording
    recordingUrl TEXT,
    recordingDuration INTEGER, -- seconds
    
    -- Analytics
    confidence DECIMAL(3,2), -- average confidence from STT
    sentiment TEXT, -- positive, neutral, negative
    
    -- Timestamps
    startedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    answeredAt TIMESTAMP WITH TIME ZONE,
    endedAt TIMESTAMP WITH TIME ZONE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_voice_calls_userId ON voice_calls(userId);
CREATE INDEX IF NOT EXISTS idx_voice_calls_bookingId ON voice_calls(bookingId);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status);
CREATE INDEX IF NOT EXISTS idx_voice_calls_createdAt ON voice_calls(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_purpose ON voice_calls(purpose);

-- Trigger to update updatedAt
CREATE OR REPLACE FUNCTION update_voice_calls_updatedAt()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_voice_calls_updatedAt ON voice_calls;
CREATE TRIGGER trigger_voice_calls_updatedAt
    BEFORE UPDATE ON voice_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_calls_updatedAt();

-- Add phone number to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phoneNumber TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voiceAgentEnabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voiceAgentConfig JSONB DEFAULT '{}'::jsonb;

-- Create index on phone number for incoming call lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phoneNumber ON users(phoneNumber) WHERE phoneNumber IS NOT NULL;

-- Voice agent settings table for advanced configuration
CREATE TABLE IF NOT EXISTS voice_agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Agent personality
    agentName TEXT DEFAULT 'Planxo Assistant',
    greeting TEXT,
    personality TEXT DEFAULT 'friendly_professional', -- friendly_professional, formal, casual
    language TEXT DEFAULT 'fr', -- fr, en
    
    -- Voice settings
    voiceProvider TEXT DEFAULT 'elevenlabs', -- elevenlabs, twilio_native
    voiceId TEXT,
    
    -- Business rules
    maxCallDuration INTEGER DEFAULT 600, -- 10 minutes
    requireConfirmation BOOLEAN DEFAULT true,
    allowedPurposes TEXT[] DEFAULT ARRAY['booking', 'reschedule', 'cancel'],
    
    -- Hours of operation
    businessHours JSONB DEFAULT '{
        "monday": {"start": "09:00", "end": "17:00"},
        "tuesday": {"start": "09:00", "end": "17:00"},
        "wednesday": {"start": "09:00", "end": "17:00"},
        "thursday": {"start": "09:00", "end": "17:00"},
        "friday": {"start": "09:00", "end": "17:00"},
        "saturday": null,
        "sunday": null
    }'::jsonb,
    
    -- Voicemail
    voicemailEnabled BOOLEAN DEFAULT true,
    voicemailMessage TEXT,
    
    -- Notifications
    emailNotifications BOOLEAN DEFAULT true,
    smsNotifications BOOLEAN DEFAULT false,
    
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_agent_settings_userId ON voice_agent_settings(userId);

-- Trigger function for voice_agent_settings
DROP TRIGGER IF EXISTS trigger_voice_agent_settings_updatedAt ON voice_agent_settings;
CREATE TRIGGER trigger_voice_agent_settings_updatedAt
    BEFORE UPDATE ON voice_agent_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_calls_updatedAt();

-- Enable RLS
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_calls
DROP POLICY IF EXISTS "Users can view own voice calls" ON voice_calls;
CREATE POLICY "Users can view own voice calls"
    ON voice_calls FOR SELECT
    USING (userId = auth.uid()::text);

DROP POLICY IF EXISTS "Service role can manage voice calls" ON voice_calls;
CREATE POLICY "Service role can manage voice calls"
    ON voice_calls FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for voice_agent_settings
DROP POLICY IF EXISTS "Users can manage own voice agent settings" ON voice_agent_settings;
CREATE POLICY "Users can manage own voice agent settings"
    ON voice_agent_settings FOR ALL
    USING (userId = auth.uid()::text)
    WITH CHECK (userId = auth.uid()::text);

-- Workflow triggers table for automated calls
CREATE TABLE IF NOT EXISTS voice_workflow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    triggerType TEXT NOT NULL, -- booking_reminder, no_show_followup, post_booking_confirm, custom
    triggerTiming TEXT NOT NULL, -- 24h_before, 1h_before, immediately, etc.
    
    isActive BOOLEAN DEFAULT true,
    templateMessage TEXT,
    
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_workflow_triggers_userId ON voice_workflow_triggers(userId);

-- Insert default workflow triggers for all users
INSERT INTO voice_workflow_triggers (userId, triggerType, triggerTiming, templateMessage)
SELECT 
    id as userId,
    'booking_reminder' as triggerType,
    '24h_before' as triggerTiming,
    'Bonjour {{name}}, je vous appelle pour vous rappeler de votre rendez-vous demain avec {{professional}} à {{time}}.' as templateMessage
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM voice_workflow_triggers WHERE userId = users.id AND triggerType = 'booking_reminder'
);
