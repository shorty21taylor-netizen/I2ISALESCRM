import { NextResponse } from 'next/server';
import { removeEODReport, initStore } from '@/lib/store';

export async function DELETE(req, { params }) {
  await initStore();
  try {
    var p = await params;
    var id = p.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    var result = await removeEODReport(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
