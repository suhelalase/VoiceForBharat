import { Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/app/theme-provider';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        'dark scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="theme-color" content="#020b14" />
      </head>
      <body className="overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
          disableTransitionOnChange
        >
          {/* ZeroxAI HUD Header */}
          <header className="fixed top-0 left-0 z-50 hidden w-full flex-row items-center justify-between px-8 py-5 md:flex">
            {/* Left: ZeroxAI Logo */}
            <div className="flex items-center gap-3">
              {/* Hexagon icon */}
              <div className="relative flex items-center justify-center">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ filter: 'drop-shadow(0 0 6px #00d4ff)' }}
                >
                  <polygon
                    points="16,2 28,9 28,23 16,30 4,23 4,9"
                    stroke="#00d4ff"
                    strokeWidth="1.5"
                    fill="rgba(0,212,255,0.08)"
                  />
                  <polygon
                    points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5"
                    stroke="rgba(0,212,255,0.4)"
                    strokeWidth="1"
                    fill="rgba(0,212,255,0.05)"
                  />
                  <circle cx="16" cy="16" r="3" fill="#00d4ff" opacity="0.9" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span
                  className="font-mono text-sm font-bold tracking-widest uppercase"
                  style={{
                    color: '#00d4ff',
                    textShadow: '0 0 10px rgba(0,212,255,0.8), 0 0 20px rgba(0,212,255,0.4)',
                  }}
                >
                  ZeroxAI
                </span>
                <span
                  className="font-mono text-[9px] tracking-wider uppercase"
                  style={{ color: 'rgba(0,212,255,0.5)' }}
                >
                  Neural Voice Interface
                </span>
              </div>
            </div>

            {/* Center: Status */}
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{
                background: 'rgba(0,212,255,0.05)',
                border: '1px solid rgba(0,212,255,0.15)',
              }}
            ></div>

            {/* Right: Version tag */}
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[10px] tracking-widest uppercase"
                style={{ color: 'rgba(0,212,255,0.4)' }}
              >
                v2.0 · AI Core Active
              </span>
            </div>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
