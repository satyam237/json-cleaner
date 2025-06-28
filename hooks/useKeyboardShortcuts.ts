import { useEffect, useCallback } from 'react';

interface KeyboardShortcuts {
  onFormat: () => void;
  onClear: () => void;
  onCopy: () => void;
  onUpload: () => void;
  onBasicClean: () => void;
  onAiClean: () => void;
  onCompact: () => void;
  onSearch?: () => void;
}

export const useKeyboardShortcuts = ({
  onFormat,
  onClear,
  onCopy,
  onUpload,
  onBasicClean,
  onAiClean,
  onCompact,
  onSearch,
}: KeyboardShortcuts) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const metaKey = isMac ? event.metaKey : event.ctrlKey;

    if (metaKey) {
      switch (event.key.toLowerCase()) {
        case 'enter':
          event.preventDefault();
          onFormat();
          break;
        case 'k':
          event.preventDefault();
          onClear();
          break;
        case 'c':
          if (event.shiftKey) {
            event.preventDefault();
            onCopy();
          }
          break;
        case 'o':
          event.preventDefault();
          onUpload();
          break;
        case 'b':
          event.preventDefault();
          onBasicClean();
          break;
        case 'i':
          event.preventDefault();
          onAiClean();
          break;
        case 'm':
          event.preventDefault();
          onCompact();
          break;
        case 'f':
          if (onSearch) {
            event.preventDefault();
            onSearch();
          }
          break;
      }
    }
  }, [onFormat, onClear, onCopy, onUpload, onBasicClean, onAiClean, onCompact, onSearch]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}; 