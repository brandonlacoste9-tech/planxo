-- CreateTable voice_agent_configs
CREATE TABLE "public"."voice_agent_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'Planxo Scheduler',
    "systemPrompt" TEXT,
    "voiceId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable voice_agent_conversations
CREATE TABLE "public"."voice_agent_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "voice_agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for voice_agent_configs
CREATE UNIQUE INDEX "voice_agent_configs_userId_key" ON "public"."voice_agent_configs"("userId");

-- CreateIndex for voice_agent_conversations
CREATE INDEX "voice_agent_conversations_userId_idx" ON "public"."voice_agent_conversations"("userId");
CREATE INDEX "voice_agent_conversations_agentId_idx" ON "public"."voice_agent_conversations"("agentId");
CREATE INDEX "voice_agent_conversations_conversationId_idx" ON "public"."voice_agent_conversations"("conversationId");

-- AddForeignKey for voice_agent_configs
ALTER TABLE "public"."voice_agent_configs" ADD CONSTRAINT "voice_agent_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
