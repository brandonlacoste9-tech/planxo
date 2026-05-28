import { CallSession, ConversationState, CallContext, TranscriptMessage } from './types';

const SYSTEM_PROMPT = `You are Planxo, an AI phone assistant for a Quebec-based scheduling platform called Planxo. You help callers book appointments with professionals.

IMPORTANT RULES:
1. Speak naturally in French (Quebec French is preferred) or English depending on the caller's language
2. Be polite, professional, and concise
3. Ask ONE question at a time and wait for the response
4. Confirm details before proceeding
5. If you don't understand, ask the caller to repeat
6. Handle interruptions gracefully
7. Never make up availability - only use provided slots

CONVERSATION FLOW:
1. Greet and identify purpose (booking, reschedule, cancel, question)
2. If booking: collect caller's name, email, preferred date/time
3. Check availability from the provided list
4. Confirm all details
5. Complete booking
6. Provide confirmation

TONE: Friendly, helpful, efficient. Use "vous" form in French.`;

export interface AITools {
  checkAvailability?: (date: string) => Promise<{ availableTimes: string[]; rawSlots?: any[] }>;
  createBooking?: (params: {
    name: string;
    email: string;
    start: string; // ISO 8601
    date: string;
    time: string;
  }) => Promise<{ success: boolean; message?: string; booking?: any }>;
}

export class ConversationManager {
  private session: CallSession;
  private onStateChange?: (state: ConversationState) => void;
  private onResponse?: (text: string) => void;
  private tools?: AITools;

  constructor(
    session: CallSession,
    callbacks?: {
      onStateChange?: (state: ConversationState) => void;
      onResponse?: (text: string) => void;
    },
    tools?: AITools
  ) {
    this.session = session;
    this.onStateChange = callbacks?.onStateChange;
    this.onResponse = callbacks?.onResponse;
    this.tools = tools;
  }

  getState(): ConversationState {
    return this.session.state;
  }

  getContext(): CallContext {
    return this.session.context;
  }

  updateContext(updates: Partial<CallContext>) {
    this.session.context = { ...this.session.context, ...updates };
  }

  private setState(newState: ConversationState) {
    this.session.state = newState;
    this.onStateChange?.(newState);
  }

  private addToTranscript(role: 'user' | 'assistant', text: string) {
    this.session.transcript.push({
      role,
      text,
      timestamp: new Date(),
    });
  }

  async generateGreeting(): Promise<string> {
    const response = await this.generateResponse('');
    this.addToTranscript('assistant', response);
    this.onResponse?.(response);
    return response;
  }

  async processUserInput(input: string): Promise<void> {
    this.addToTranscript('user', input);

    // Check for missing fields
    const context = this.getContext();
    if (!context.name) {
      this.addToTranscript('assistant', "Quel est votre nom complet ?");
      this.updateContext({ name: input });
      return;
    }

    if (!context.email) {
      this.addToTranscript('assistant', "Quelle est votre adresse e-mail ?");
      this.updateContext({ email: input });
      return;
    }

    if (!context.startTime) {
      this.addToTranscript('assistant', "À quelle heure souhaitez-vous réserver ?");
      this.updateContext({ startTime: input });
      return;
    }

    // All fields are collected, proceed to booking
    this.addToTranscript('assistant', "Je vérifie la disponibilité...");
    const tools = this.tools;
    if (!tools?.createBooking) {
      this.addToTranscript('assistant', "Désolé, je ne peux pas effectuer de réservation pour le moment.");
      return;
    }

    try {
      const result = await tools.createBooking({
        name: context.name,
        email: context.email,
        start: context.startTime,
        date: context.date || new Date().toISOString().split('T')[0],
        time: context.startTime,
      });

      if (result.success) {
        this.addToTranscript('assistant', "Votre rendez-vous a été réservé avec succès !");
      } else {
        this.addToTranscript('assistant', `Échec de la réservation : ${result.message}`);
      }
    } catch (error) {
      this.addToTranscript('assistant', "Une erreur s'est produite lors de la réservation. Veuillez réessayer plus tard.");
    }
  }

  private async generateResponse(userText: string): Promise<string> {
    const state = this.session.state;
    const ctx = this.session.context;
    const lowerText = userText.toLowerCase();

    // Handle booking intent detection early
    if (state === 'greeting') {
      this.setState('identify_purpose');
      return this.getGreeting();
    }

    if (state === 'identify_purpose') {
      if (this.isBookingIntent(lowerText)) {
        this.setState('collect_name');
        return ctx.professionalName 
          ? `Parfait! Je vais vous aider à réserver avec ${ctx.professionalName}. Pour commencer, quel est votre nom?`
          : "Parfait! Je vais vous aider à réserver un rendez-vous. Pour commencer, quel est votre nom?";
      }
      if (this.isRescheduleIntent(lowerText)) {
        return "Pour reprogrammer un rendez-vous, j'ai besoin de votre numéro de confirmation. Pouvez-vous me le donner?";
      }
      if (this.isCancelIntent(lowerText)) {
        return "Pour annuler un rendez-vous, j'ai besoin de votre numéro de confirmation. Pouvez-vous me le donner?";
      }
      return "Je peux vous aider à réserver, reprogrammer ou annuler un rendez-vous. Que souhaitez-vous faire?";
    }

    if (state === 'collect_name') {
      ctx.attendeeName = this.extractName(userText);
      this.setState('collect_email');
      return `Merci ${ctx.attendeeName}! Maintenant, quel est votre adresse courriel?`;
    }

    if (state === 'collect_email') {
      const email = this.extractEmail(userText);
      if (email) {
        ctx.attendeeEmail = email;
        this.setState('select_date');
        return "Parfait! Quelle date préférez-vous pour votre rendez-vous? Vous pouvez dire par exemple 'demain', 'mardi prochain', ou une date comme 'le 15 juin'.";
      }
      return "Je n'ai pas bien compris l'adresse courriel. Pouvez-vous la répéter plus lentement?";
    }

    if (state === 'select_date') {
      const date = this.parseDate(userText);
      if (date) {
        ctx.selectedDate = date;
        this.setState('select_time');

        // If we have a real availability tool, fetch slots now
        if (this.tools?.checkAvailability) {
          this.tools.checkAvailability(date).then((result) => {
            ctx.availability = result.availableTimes || [];
            // Optionally surface availability in a follow-up message (handled by caller if needed)
          }).catch(() => {});
        }

        return `D'accord pour le ${this.formatDate(date)}. À quelle heure? Vous pouvez dire par exemple '14 heures' ou '2 heures de l'après-midi'.`;
      }
      return "Je n'ai pas compris la date. Pouvez-vous la répéter? Vous pouvez dire 'demain', 'vendredi', ou une date comme 'le 20 juin'.";
    }

    if (state === 'select_time') {
      const time = this.parseTime(userText);
      if (time) {
        ctx.selectedTime = time;
        this.setState('confirm_booking');
        return this.getConfirmationPrompt();
      }
      return "Je n'ai pas compris l'heure. Pouvez-vous la répéter? Par exemple '14h30' ou '2 heures et demie'.";
    }

    if (state === 'confirm_booking') {
      if (this.isAffirmative(lowerText)) {
        this.setState('booking_confirmed');
        return await this.completeBooking();
      }
      if (this.isNegative(lowerText)) {
        this.setState('select_date');
        return "Pas de problème. Quelle autre date vous conviendrait?";
      }
      return this.getConfirmationPrompt();
    }

    if (state === 'booking_confirmed') {
      this.setState('goodbye');
      return "Y a-t-il autre chose que je puisse faire pour vous aujourd'hui?";
    }

    if (state === 'goodbye') {
      if (this.isNegative(lowerText) || lowerText.includes('non')) {
        return "Très bien. Merci d'avoir appelé Planxo et bonne journée!";
      }
      return "Comment puis-je vous aider?";
    }

    return "Je n'ai pas bien compris. Pouvez-vous répéter?";
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonjour' : 'Bonsoir';
    
    if (this.session.context.professionalName) {
      return `${timeGreeting}! Je suis l'assistant virtuel de ${this.session.context.professionalName} sur Planxo. Je peux vous aider à réserver un rendez-vous. Comment puis-je vous aider aujourd'hui?`;
    }
    
    return `${timeGreeting}! Bienvenue chez Planxo, votre plateforme de prise de rendez-vous. Je suis votre assistant virtuel. Souhaitez-vous réserver un rendez-vous, reprogrammer ou annuler?`;
  }

  private getConfirmationPrompt(): string {
    const ctx = this.session.context;
    return `Permettez-moi de confirmer. Vous souhaitez réserver avec ${ctx.professionalName || 'notre professionnel'} pour le ${this.formatDate(ctx.selectedDate!)} à ${ctx.selectedTime}, au nom de ${ctx.attendeeName}. Est-ce correct?`;
  }

  private async completeBooking(): Promise<string> {
    const ctx = this.session.context;

    if (!ctx.attendeeName || !ctx.attendeeEmail || !ctx.selectedDate || !ctx.selectedTime) {
      return "Il manque des informations pour finaliser la réservation. Pouvez-vous répéter votre nom, courriel et l'heure?";
    }

    // Build an ISO start time. We assume America/Toronto for the demo.
    // The V2 /ai/book endpoint expects full ISO UTC.
    const dateTimeStr = `${ctx.selectedDate}T${ctx.selectedTime}:00`;
    const startDate = new Date(dateTimeStr);
    // Treat the local time as Toronto time
    const torontoOffset = -4; // EDT (adjust if needed for EST)
    const utcStart = new Date(startDate.getTime() - (torontoOffset * 60 * 60 * 1000));
    const isoStart = utcStart.toISOString();

    if (this.tools?.createBooking) {
      try {
        const result = await this.tools.createBooking({
          name: ctx.attendeeName,
          email: ctx.attendeeEmail,
          start: isoStart,
          date: ctx.selectedDate,
          time: ctx.selectedTime,
        });

        if (result.success) {
          return `Excellent! Votre rendez-vous est confirmé pour le ${this.formatDate(ctx.selectedDate)} à ${ctx.selectedTime}. Vous recevrez une confirmation par courriel à ${ctx.attendeeEmail}. Merci d'avoir utilisé Planxo !`;
        } else {
          return `Désolé, la réservation n'a pas pu être complétée. ${result.message || 'Veuillez réessayer ou choisir un autre créneau.'}`;
        }
      } catch (err) {
        console.error('[Conversation] Booking failed:', err);
        return "Une erreur est survenue lors de la réservation. Voulez-vous essayer à nouveau ou choisir une autre date?";
      }
    }

    // Fallback (no tools provided)
    return `Parfait! Votre rendez-vous est confirmé pour le ${this.formatDate(ctx.selectedDate)} à ${ctx.selectedTime}. Vous recevrez une confirmation par courriel à ${ctx.attendeeEmail}. (Mode démo - réservation simulée)`;
  }

  // Helper methods for intent detection
  private isBookingIntent(text: string): boolean {
    const keywords = ['réserver', 'booking', 'appointment', 'rendez-vous', 'prendre', 'schedule', 'book'];
    return keywords.some(k => text.includes(k));
  }

  private isRescheduleIntent(text: string): boolean {
    const keywords = ['reprogrammer', 'reschedule', 'changer', 'déplacer', 'move', 'change'];
    return keywords.some(k => text.includes(k));
  }

  private isCancelIntent(text: string): boolean {
    const keywords = ['annuler', 'cancel', 'supprimer', 'delete', 'remove'];
    return keywords.some(k => text.includes(k));
  }

  private isAffirmative(text: string): boolean {
    const keywords = ['oui', 'yes', 'correct', 'c\'est ça', 'exact', 'parfait', 'ok'];
    return keywords.some(k => text.includes(k));
  }

  private isNegative(text: string): boolean {
    const keywords = ['non', 'no', 'cancel', 'annuler', 'wrong', 'faux', 'incorrect'];
    return keywords.some(k => text.includes(k));
  }

  private extractName(text: string): string {
    // Simple extraction - in production, use NER or ask for clarification
    const cleaned = text.replace(/^(je m'appelle|mon nom est|je suis|c'est|moi c'est)\s+/i, '');
    return cleaned.split(/[,.]/)[0].trim();
  }

  private extractEmail(text: string): string | null {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
  }

  private parseDate(text: string): string | null {
    const today = new Date();
    const lower = text.toLowerCase();
    
    // Handle relative dates
    if (lower.includes('aujourd\'hui')) {
      return today.toISOString().split('T')[0];
    }
    if (lower.includes('demain')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    // Try to parse French date formats
    // "15 juin", "le 15 juin", "juin 15"
    const monthMap: Record<string, number> = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };
    
    for (const [monthName, monthNum] of Object.entries(monthMap)) {
      if (lower.includes(monthName)) {
        const dayMatch = text.match(/(\d{1,2})/);
        if (dayMatch) {
          const date = new Date(today.getFullYear(), monthNum, parseInt(dayMatch[1]));
          if (date < today) {
            date.setFullYear(date.getFullYear() + 1);
          }
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Try ISO format fallback
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[0];
    }
    
    return null;
  }

  private parseTime(text: string): string | null {
    const lower = text.toLowerCase().replace(/[h\s]/g, ':');
    
    // Match patterns like "14:30", "2:30", "14h30"
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      
      // Handle 12-hour format with AM/PM indicators
      if (lower.includes('après-midi') || lower.includes('pm') || lower.includes('soir')) {
        if (hours < 12) {
          return `${hours + 12}:${minutes}`;
        }
      }
      if (lower.includes('matin') || lower.includes('am') || lower.includes('midi')) {
        if (hours === 12) {
          return `00:${minutes}`;
        }
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    // Match just hours like "14 heures"
    const hourOnly = lower.match(/(\d{1,2})(?:\s*heures?|\s*h)?/);
    if (hourOnly) {
      const hours = parseInt(hourOnly[1]);
      if (lower.includes('après-midi') || lower.includes('pm') || lower.includes('soir')) {
        return hours < 12 ? `${hours + 12}:00` : `${hours}:00`;
      }
      return `${hours.toString().padStart(2, '0')}:00`;
    }
    
    return null;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    };
    return date.toLocaleDateString('fr-CA', options);
  }
}
