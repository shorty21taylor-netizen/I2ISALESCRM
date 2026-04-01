import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      closerName = '',
      totalDials = 0,
      connects = 0,
      callsBooked = 0,
      callsTaken = 0,
      closes = 0,
      cashCollected = 0,
      pipelineNotes = '',
      biggestWin = '',
      biggestLoss = '',
      confidenceScore = 0,
    } = body;

    if (!closerName) {
      return NextResponse.json({ error: 'closerName is required' }, { status: 400 });
    }

    const submission = {
      id: `eod-${Date.now()}`,
      type: 'eod-report',
      closerName,
      date: new Date().toISOString().split('T')[0],
      totalDials: parseInt(totalDials),
      connects: parseInt(connects),
      callsBooked: parseInt(callsBooked),
      callsTaken: parseInt(callsTaken),
      closes: parseInt(closes),
      cashCollected: parseFloat(cashCollected),
      pipelineNotes,
      biggestWin,
      biggestLoss,
      confidenceScore: parseInt(confidenceScore),
      submittedAt: new Date().toISOString(),
    };

    console.log('[EOD Report Webhook]', JSON.stringify(submission));

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('[EOD Report Webhook Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'eod-report', method: 'POST required' });
}
