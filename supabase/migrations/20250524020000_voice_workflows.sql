-- Voice workflows for automated AI calls
-- Enables non-technical users to configure call triggers

-- Workflow templates table
CREATE TABLE IF NOT EXISTS voice_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger configuration
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'booking_reminder',      -- X hours before booking
        'no_show_followup',      -- X minutes after missed booking
        'post_meeting',          -- X minutes after meeting ends
        'custom'                 -- User-defined
    )),
    trigger_timing INTEGER NOT NULL, -- minutes (positive = before, negative = after)
    
    -- Filter conditions
    event_type_ids TEXT[] DEFAULT NULL, -- NULL = all event types
    min_duration INTEGER DEFAULT NULL,  -- minimum meeting duration in minutes
    
    -- Action configuration
    action_type TEXT NOT NULL DEFAULT 'ai_phone_call' CHECK (action_type = 'ai_phone_call'),
    
    -- Message template with variables
    message_template TEXT NOT NULL DEFAULT 'Bonjour {{attendeeName}}, ceci est un rappel pour votre rendez-vous {{eventTitle}} prévu le {{eventDate}} à {{eventTime}}.',
    
    -- Voice settings
    voice_provider TEXT DEFAULT 'custom' CHECK (voice_provider IN ('custom', 'retell')),
    voice_id TEXT DEFAULT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution log
CREATE TABLE IF NOT EXISTS voice_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES voice_workflows(id) ON DELETE CASCADE,
    booking_id TEXT NOT NULL,
    
    -- Execution details
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
    
    -- Call details
    call_sid TEXT,
    credits_used INTEGER,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_workflows_user_id ON voice_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_workflows_active ON voice_workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_voice_workflow_executions_workflow ON voice_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_voice_workflow_executions_status ON voice_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_voice_workflow_executions_scheduled ON voice_workflow_executions(scheduled_for) WHERE status = 'pending';

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_voice_workflows_updated_at ON voice_workflows;
CREATE TRIGGER update_voice_workflows_updated_at
    BEFORE UPDATE ON voice_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at();

-- Row Level Security
ALTER TABLE voice_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_workflows_user_isolation ON voice_workflows
    FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY voice_workflow_executions_user_isolation ON voice_workflow_executions
    FOR ALL USING (
        workflow_id IN (
            SELECT id FROM voice_workflows WHERE user_id = auth.uid()::text
        )
    );

-- Pre-defined workflow templates
INSERT INTO voice_workflows (
    user_id, name, description, trigger_type, trigger_timing, 
    message_template, is_active
) 
SELECT 
    id,
    '24h Booking Reminder',
    'Call attendees 24 hours before their appointment',
    'booking_reminder',
    1440, -- 24 hours in minutes
    'Bonjour {{attendeeName}}, ceci est un rappel de Planxo. Vous avez un rendez-vous "{{eventTitle}}" demain à {{eventTime}}. Répondez oui pour confirmer.',
    false
FROM users
ON CONFLICT DO NOTHING;

INSERT INTO voice_workflows (
    user_id, name, description, trigger_type, trigger_timing,
    message_template, is_active
)
SELECT
    id,
    'No-Show Follow-up',
    'Call 15 minutes after a missed appointment',
    'no_show_followup',
    -15, -- 15 minutes after
    'Bonjour {{attendeeName}}, nous avons remarqué que vous avez manqué votre rendez-vous {{eventTitle}} prévu à {{eventTime}}. Souhaitez-vous reprogrammer?',
    false
FROM users
ON CONFLICT DO NOTHING;

COMMENT ON TABLE voice_workflows IS 'User-defined workflows for automated AI phone calls';
COMMENT ON COLUMN voice_workflows.trigger_timing IS 'Minutes: positive = before event, negative = after event';
COMMENT ON COLUMN voice_workflows.message_template IS 'Message with variables: {{attendeeName}}, {{eventTitle}}, {{eventDate}}, {{eventTime}}, {{professionalName}}';

-- RPC function to add credits atomically
CREATE OR REPLACE FUNCTION add_voice_credits(p_user_id TEXT, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE voice_credits
    SET balance = balance + p_amount,
        lifetime_credits = lifetime_credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
