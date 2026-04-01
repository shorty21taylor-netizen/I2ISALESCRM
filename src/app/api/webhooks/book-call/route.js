import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      closerName = '',
      leadName = '',
      leadPhone = '',
      leadEmail = '',
      leadSource = 'inbound',
      channel = '',
      callDateTime = '',
      notes = '',
    } = body;

    if (!closerName || !leadName) {
      return NextResponse.json({ error: 'closerName and leadName are required' }, { status: 400 });
    }

    const submission = {
      id: `book-${Date.now()}`,
      type: 'book-call',
      closerName,
      leadName,
      leadPhone,
      leadEmail,
      leadSource,
      channel,
      callDateTime,
      notes,
      submittedAt: new Date().toISOString(),
    };

    console.log('[Book Call Webhook]', JSON.stringify(submission));

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('[Book Call Webhook Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'book-call', method: 'POST required' });
}
