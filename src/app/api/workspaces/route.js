import { NextResponse } from 'next/server';
import { initStore, getWorkspaces, addWorkspace, updateWorkspace, deleteWorkspace } from '@/lib/store';
import { slugifyWorkspaceId } from '@/lib/workspaces';

export var dynamic = 'force-dynamic';

export async function GET() {
  await initStore();
  try {
    return NextResponse.json({ success: true, workspaces: getWorkspaces() });
  } catch (e) {
    console.error('[Workspaces API GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }
    var ws = addWorkspace({
      id: body.id ? slugifyWorkspaceId(body.id) : slugifyWorkspaceId(body.name),
      name: String(body.name).trim(),
      shortName: body.shortName ? String(body.shortName).trim() : '',
      commissionRate: body.commissionRate !== undefined ? parseFloat(body.commissionRate) : 0.10,
      offers: Array.isArray(body.offers) ? body.offers : [],
    });
    return NextResponse.json({ success: true, workspace: ws });
  } catch (e) {
    console.error('[Workspaces API POST]', e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  await initStore();
  try {
    var body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 });
    var ws = updateWorkspace(body.id, body);
    return NextResponse.json({ success: true, workspace: ws });
  } catch (e) {
    console.error('[Workspaces API PATCH]', e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  await initStore();
  try {
    var url = new URL(req.url);
    var id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 });
    var result = deleteWorkspace(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[Workspaces API DELETE]', e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
