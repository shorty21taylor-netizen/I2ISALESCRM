import { NextResponse } from 'next/server';
import { removeCloserProfile, initStore } from '@/lib/store';

export async function DELETE(req, { params }) {
  await initStore();
  try {
    var p = await params;
    var email = decodeURIComponent(p.email);
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    var result = await removeCloserProfile(email);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
