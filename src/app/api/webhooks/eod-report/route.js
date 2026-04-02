import { NextResponse } from 'next/server';
import { addEODReport, getStore } from '@/lib/store';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.closerName) {
      return NextResponse.json({ error: 'closerName required' }, { status: 400 });
    }
    var entry = addEODReport(body);
    console.log('[EOD]', entry.closerName, '- dials:', entry.totalDials, 'closes:', entry.closes, 'cash:', entry.cashCollected);
    return NextResponse.json({ success: true, submission: entry });
  } catch (e) {
    console.error('[EOD Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  var store = getStore();
  return NextResponse.json({ success: true, data: store.eodReports });
}
