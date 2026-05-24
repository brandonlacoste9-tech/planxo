import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const credits = parseInt(session.metadata?.credits || '0');
      const packageId = session.metadata?.packageId;

      if (!userId || !credits) {
        console.error('Missing metadata in checkout session:', session.id);
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      // Add credits to user's account directly
      const now = new Date().toISOString();
      
      // Upsert credit balance
      const { error: upsertError } = await supabase
        .from('voice_credits')
        .upsert({
          user_id: userId,
          balance: credits, // This will be added via RPC
          lifetime_credits: credits,
          updated_at: now
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to upsert credits:', upsertError);
        return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
      }

      // Add to balance using increment
      const { error: incrementError } = await supabase.rpc('add_voice_credits', {
        p_user_id: userId,
        p_amount: credits
      });

      if (incrementError) {
        // Fallback: try direct update
        const { data: current } = await supabase
          .from('voice_credits')
          .select('balance, lifetime_credits')
          .eq('user_id', userId)
          .single();

        const { error: updateError } = await supabase
          .from('voice_credits')
          .update({
            balance: (current?.balance || 0) + credits,
            lifetime_credits: (current?.lifetime_credits || 0) + credits,
            updated_at: now
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Failed to update credits:', updateError);
          return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
        }
      }

      // Record transaction
      await supabase.from('voice_credit_transactions').insert({
        user_id: userId,
        amount: credits,
        type: 'purchase',
        description: `Purchased ${packageId} package`,
        call_sid: null,
        payment_intent_id: session.payment_intent as string,
        stripe_session_id: session.id
      });

      console.log(`Added ${credits} credits to user ${userId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
