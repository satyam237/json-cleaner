import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') return 'dark';
    
    // Check localStorage first, then system preference
    try {
      const saved = localStorage.getItem('json-formatter-theme') as Theme;
      if (saved) return saved;
    } catch (e) {
      // localStorage not available
    }
    
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      // matchMedia not available
      return 'dark';
    }
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('json-formatter-theme', theme);
    } catch (e) {
      // localStorage not available
    }
    
    // Update document class for Tailwind
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}; 