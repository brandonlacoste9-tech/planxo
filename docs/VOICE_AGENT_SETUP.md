# Planxo Voice Agent - Setup Guide

Ce guide explique comment configurer l'agent vocal AI de Planxo avec Twilio pour recevoir et effectuer des appels automatiques.

---

## Prérequis

- Compte Twilio (https://www.twilio.com/try-twilio)
- Compte Deepgram (https://console.deepgram.com)
- Compte ElevenLabs (https://elevenlabs.io)
- Planxo déployé et accessible (https://rdv-qc.vercel.app)

---

## Étape 1: Twilio Setup

### 1.1 Créer un compte Twilio

1. Allez sur https://www.twilio.com/try-twilio
2. Créez un compte avec votre email
3. Vérifiez votre numéro de téléphone
4. Obtenez votre **Account SID** et **Auth Token** sur la console

### 1.2 Acheter un numéro de téléphone

1. Dans la console Twilio, allez sur **Phone Numbers** > **Manage** > **Buy a number**
2. Choisissez un numéro canadien (indicatif +1)
3. Notez le numéro complet (ex: +15141234567)

### 1.3 Configurer le webhook

1. Allez sur **Phone Numbers** > **Manage** > **Active numbers**
2. Cliquez sur votre numéro
3. Dans la section **Voice & Fax**:
   - **Accept incoming**: Voice calls
   - **Configure with**: Webhooks, TwiML Bins, Functions, Studio, or Proxy
   - **A call comes in**: Webhook
   - **URL**: `https://rdv-qc.vercel.app/api/voice/incoming`
   - **HTTP**: HTTP POST
   
4. Dans la section **Messaging** (optionnel):
   - Configurez pour les confirmations SMS si désiré

### 1.4 Configurer les URL de statut

Pour recevoir les mises à jour de statut des appels:

1. Dans les paramètres de votre numéro
2. **Call status changes**: Webhook
3. **URL**: `https://rdv-qc.vercel.app/api/voice/status`

---

## Étape 2: Deepgram Setup

### 2.1 Créer un compte Deepgram

1. Allez sur https://console.deepgram.com
2. Créez un compte
3. Obtenez votre **API Key** dans le dashboard

### 2.2 Vérifier la langue française

Deepgram supporte le français (fr) et le français canadien (fr-CA). Le système utilise `fr` par défaut.

---

## Étape 3: ElevenLabs Setup

### 3.1 Créer un compte ElevenLabs

1. Allez sur https://elevenlabs.io
2. Créez un compte
3. Obtenez votre **API Key** dans les paramètres

### 3.2 Choisir une voix

1. Allez dans la section **Voices**
2. Choisissez une voix française (recommandé: **Céline** pour le français québécois)
3. Notez le **Voice ID** (ex: `pNInz6obpgDQGcFmaJgB`)

### 3.3 Tester la voix

Utilisez le playground ElevenLabs pour tester des phrases comme:
- "Bonjour, je suis l'assistant virtuel de Planxo."
- "Pouvez-vous me confirmer votre nom?"

---

## Étape 4: Configuration Vercel

### 4.1 Ajouter les variables d'environnement

Dans votre projet Vercel (https://vercel.com/dashboard):

1. Allez sur **Settings** > **Environment Variables**
2. Ajoutez les variables suivantes:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15141234567
DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
```

3. Redéployez le projet pour appliquer les changements

---

## Étape 5: Configuration Supabase

### 5.1 Exécuter la migration

Exécutez le fichier SQL dans Supabase:

```bash
psql "postgresql://postgres.vebwxcezwrrbirsiyyur:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:6543/postgres" -f supabase/migrations/20250524000000_voice_calls.sql
```

Ou via l'interface Supabase Dashboard > SQL Editor > New query > Copy/paste le contenu du fichier

### 5.2 Activer l'agent vocal pour un utilisateur

```sql
UPDATE users 
SET voiceAgentEnabled = true,
    phoneNumber = '+15141234567'
WHERE username = 'planxo';
```

---

## Étape 6: Test

### 6.1 Test de l'appel entrant

1. Appelez votre numéro Twilio depuis votre téléphone
2. Vous devriez entendre le message d'accueil de l'agent
3. Testez la conversation:
   - "Je veux prendre un rendez-vous"
   - Donnez votre nom
   - Donnez votre email
   - Choisissez une date ("demain", "vendredi")
   - Choisissez une heure ("14h30")
   - Confirmez

### 6.2 Test de la démo web

1. Allez sur https://rdv-qc.vercel.app/demo/voice
2. Testez la conversation en mode texte
3. Vérifiez que les états changent correctement

### 6.3 Test de l'appel sortant (reminder)

1. Créez un rendez-vous dans 25 heures
2. Assurez-vous que le client a un numéro de téléphone
3. Exécutez manuellement le cron:
   ```bash
   curl https://rdv-qc.vercel.app/api/voice/workflow
   ```
4. Vérifiez que l'appel est déclenché

---

## Dépannage

### Problème: Twilio ne reçoit pas les webhooks

**Vérifications:**
1. Vérifiez que l'URL est correcte: `https://rdv-qc.vercel.app/api/voice/incoming`
2. Vérifiez que le site est accessible (pas de protection par mot de passe)
3. Vérifiez les logs Vercel pour les erreurs

### Problème: Pas d'audio retourné

**Vérifications:**
1. Vérifiez que DEEPGRAM_API_KEY est correct
2. Vérifiez que ELEVENLABS_API_KEY est correct
3. Vérifiez les quotas ElevenLabs (limite gratuite: 10k caractères/mois)

### Problème: La conversation ne comprend pas le français

**Solutions:**
1. Vérifiez la langue configurée dans DeepgramSTT.connect('fr')
2. Testez avec des phrases simples d'abord
3. Vérifiez la qualité audio (bruit de fond)

### Problème: Les appels sortants ne fonctionnent pas

**Vérifications:**
1. Vérifiez que TWILIO_PHONE_NUMBER est configuré
2. Vérifiez que le numéro de destination est valide
3. Vérifiez les logs de la route /api/voice/outbound

---

## Architecture du système

```
┌─────────────┐     Appel entrant      ┌──────────────┐
│   Appelant  │───────────────────────>│    Twilio    │
│  (Client)   │                        └──────┬───────┘
└─────────────┘                               │
       ˆ                                     │ Webhook
       ˆ                                     │
       ˆ                              ┌──────┴───────┐
       ˆ                              │   Planxo     │
       ˆ                              │  /api/voice  │
       ˆ                              └──────┬───────┘
       ˆ                                     │
       ˆ                              WebSocket
       ˆ                                     │
┌─────────────┐                        ┌──────┴───────┐
│ Deepgram    │<──────Audio stream────>│   Socket.io  │
│    (STT)    │                        │   Server     │
└──────┬──────┘                        └──────────────┘
       │
       │ Texte
       ˆ
┌──────┴──────┐
│ Conversation│
│   Manager   │
└──────┬──────┘
       │
       │ Texte
       ˆ
┌──────┴──────┐
│ ElevenLabs  │
│    (TTS)    │
└─────────────┘
```

---

## Coûts estimés

### Twilio
- Numéro de téléphone: ~$1.50/mois
- Appels entrants: ~$0.0085/minute
- Appels sortants: ~$0.013/minute (Canada)

### Deepgram
- Nova-2 model: ~$0.0043/minute
- Premier 200$ gratuits (crédit de départ)

### ElevenLabs
- ~$0.10-0.30/minute selon la voix
- Plan gratuit: 10k caractères/mois (~10 minutes)
- Plan Starter: $5/mois pour 100k caractères (~100 minutes)

### Total par minute d'appel
**~$0.12 - $0.32 CAD** selon la qualité de la voix choisie

---

## Prochaines étapes

1. **Personnaliser le script de conversation**
   - Modifier `lib/voice/conversation.ts`
   - Ajuster les messages pour votre marque

2. **Ajouter des intégrations**
   - Calendrier Google/Outlook
   - Confirmation par SMS après l'appel

3. **Améliorer l'analyse**
   - Dashboard de statistiques d'appels
   - A/B testing des messages

4. **Multi-professionnels**
   - Chaque pro peut avoir sa propre voix
   - Numéros dédiés par professionnel

---

## Support

Pour obtenir de l'aide:
1. Consultez les logs Vercel (Runtime Logs)
2. Vérifiez les logs Supabase (Database > Logs)
3. Testez la démo: https://rdv-qc.vercel.app/demo/voice
