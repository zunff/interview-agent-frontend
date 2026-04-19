import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

function MockModeBadge() {
  if (process.env.NEXT_PUBLIC_MOCK_MODE !== 'true') return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full bg-amber-500/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm">
      Mock Mode
    </div>
  );
}

export const metadata: Metadata = {
  title: "模拟面试系统 | AI Interview Coach",
  description: "专业的AI模拟面试平台，提供实时反馈和详细评估报告",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased scroll-smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  var resolvedTheme = theme;

                  if (theme === 'system') {
                    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }

                  if (resolvedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <MockModeBadge />
      </body>
    </html>
  );
}
