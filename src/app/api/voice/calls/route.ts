import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    // Get user from auth header or session
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch voice calls for this user
    const { data: calls, error } = await supabase
      .from('voice_calls')
      .select('*')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ calls });
  } catch (error: any) {
    console.error('Error fetching voice calls:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
