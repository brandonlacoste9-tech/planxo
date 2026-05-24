import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 1000, price: 1000, name: 'Starter', description: '~66 minutes of calls' },
  { id: 'professional', credits: 2750, price: 2500, name: 'Professional', description: '~183 minutes of calls' },
  { id: 'business', credits: 6000, price: 5000, name: 'Business', description: '~400 minutes of calls' }
];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageId, userId, userEmail } = body;

    if (!packageId || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const package_ = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!package_) {
      return NextResponse.json(
        { error: 'Invalid package' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Planxo AI - ${package_.name} Package`,
              description: `${package_.credits} voice credits - ${package_.description}`,
            },
            unit_amount: package_.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId,
        credits: package_.credits.toString(),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/voice/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/voice/credits`,
      customer_email: userEmail,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
