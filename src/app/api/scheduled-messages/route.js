import { NextResponse } from 'next/server';
import { addCustomMessage, removeCustomMessage, updateCustomMessage, getCustomMessages, getSchedulerConfig, sendCustomMessageNow } from '@/lib/scheduler';

export async function GET() {
  return NextResponse.json({ success: true, messages: getCustomMessages() });
}

export async function POST(req) {
  try {
    var body = await req.json();

    if (body.action === 'create') {
      var msg = addCustomMessage(body);
      return NextResponse.json({ success: true, message: msg, messages: getCustomMessages() });
    }

    if (body.action === 'delete') {
      removeCustomMessage(body.id);
      return NextResponse.json({ success: true, messages: getCustomMessages() });
    }

    if (body.action === 'update') {
      var updated = updateCustomMessage(body.id, body);
      return NextResponse.json({ success: true, message: updated, messages: getCustomMessages() });
    }

    if (body.action === 'send') {
      var msgs = getCustomMessages();
      var target = msgs.find(function(m) { return m.id === body.id; });
      if (!target) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      await sendCustomMessageNow(target);
      return NextResponse.json({ success: true, sent: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
