import { NextResponse } from 'next/server';
import { getWorkspaces, createWorkspace, initStore } from '@/lib/store';

export var dynamic = 'force-dynamic';

export async function GET(req) {
  await initStore();
  return NextResponse.json({ success: true, workspaces: getWorkspaces() });
}

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.companyName) return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    var ws = await createWorkspace(body);
    return NextResponse.json({ success: true, workspace: ws });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
