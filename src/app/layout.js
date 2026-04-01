import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'Summit CRM \u2014 Sales Performance Intelligence',
  description: 'Sales team performance tracking with AI-powered insights.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-[240px] transition-all duration-300">{children}</main>
        </div>
      </body>
    </html>
  );
}
