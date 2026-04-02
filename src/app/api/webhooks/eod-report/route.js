import { NextResponse } from 'next/server';
import { addEODReport, getStore, registerCloser } from '@/lib/store';

export async function POST(req) {
  try {
    var body = await req.json();
    if (!body.salesRep) {
      return NextResponse.json({ error: 'salesRep required' }, { status: 400 });
    }
    var entry = addEODReport(body);
    // Auto-register closer on submission
    if (body.closerEmail || body.salesRep) {
      registerCloser(body.closerEmail || '', body.salesRep || body.closerName || '');
    }
    var totalCash = entry.cashCollectedMYFM + entry.cashCollectedI2I;
    console.log('[EOD]', entry.salesRep, '- dials:', entry.outboundDials, 'closes:', entry.closes, 'cash:', totalCash);
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
