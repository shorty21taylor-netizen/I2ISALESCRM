import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      closerName = '',
      leadName = '',
      dealValue = 0,
      paymentMethod = 'full-pay',
      leadSource = 'inbound',
      fathomUrl = '',
      notes = '',
    } = body;

    if (!closerName || !leadName || !dealValue) {
      return NextResponse.json({ error: 'closerName, leadName, and dealValue are required' }, { status: 400 });
    }

    const submission = {
      id: `close-${Date.now()}`,
      type: 'close-deal',
      closerName,
      leadName,
      dealValue: parseFloat(dealValue),
      paymentMethod,
      leadSource,
      fathomUrl,
      notes,
      submittedAt: new Date().toISOString(),
    };

    console.log('[Close Deal Webhook]', JSON.stringify(submission));

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('[Close Deal Webhook Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'close-deal', method: 'POST required' });
}
