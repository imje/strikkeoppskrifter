'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 p-2 rounded-lg"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? '🖤' : '💛'}
    </button>
  );
} 