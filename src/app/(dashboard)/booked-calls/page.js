'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// These four record books live on /records now, as tabs. The route is kept so
// every bookmark, every old link and anything n8n was pointed at still lands on
// the right record instead of a 404.
export default function BookedCallsRedirect() {
  var router = useRouter();
  useEffect(function() { router.replace('/records?tab=booked-calls'); }, [router]);
  return null;
}
