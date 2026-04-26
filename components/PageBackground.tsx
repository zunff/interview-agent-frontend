'use client';

import ParticleBackground from './ParticleBackground';
import { useTheme } from './ThemeProvider';

/**
 * 页面背景层：深色模式显示粒子背景，浅色模式显示渐变背景
 */
export default function PageBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <>
      {isDark && <ParticleBackground />}
      {!isDark && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-cyan-50/50 via-transparent to-sky-50/30 pointer-events-none"
          aria-hidden
        />
      )}
    </>
  );
}
