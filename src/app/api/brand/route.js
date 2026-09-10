import { NextResponse } from 'next/server';
import { initStore, getWorkspaces } from '@/lib/store';

export var dynamic = 'force-dynamic';

// The mark and name for the screens that run before anyone has signed in — the
// sign-in page and the transition into the app. A logo is a public asset by
// definition, so this carries only the brand and never touches a record.
export async function GET() {
  await initStore();
  try {
    var ws = getWorkspaces()[0] || null;
    var branding = (ws && ws.branding) || {};
    return NextResponse.json({
      success: true,
      logoUrl: branding.logoUrl || '',
      name: branding.reportName || (ws && ws.name) || '',
      accentColor: branding.accentColor || '',
    });
  } catch (e) {
    // The sign-in page must render whatever happens here.
    return NextResponse.json({ success: true, logoUrl: '', name: '', accentColor: '' });
  }
}
