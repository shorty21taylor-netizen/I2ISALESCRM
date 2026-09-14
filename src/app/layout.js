import './globals.css';
import AuthGate from '@/components/AuthGate';
import ThemeInit from '@/components/ThemeInit';

export var metadata = {
  title: 'Summit OS \u2014 Sales Performance Intelligence',
  description: 'Sales team performance tracking with AI-powered insights.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Summit',
    statusBarStyle: 'default',
  },
};

// viewport-fit=cover is what makes env(safe-area-inset-*) resolve to anything
// other than zero on a notched iPhone — without it the bottom tab bar sits under
// the home indicator. No maximum-scale and no user-scalable: pinch zoom is how
// somebody with poor eyesight reads a deal figure.
export var viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#D11A1A',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeInit />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
