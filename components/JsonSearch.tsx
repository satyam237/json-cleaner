import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { useTheme } from '../hooks/useTheme';

interface SearchMatch {
  lineIndex: number;
  lineContent: string;
  startIndex: number;
  endIndex: number;
  matchText: string;
}

interface JsonSearchProps {
  content: string;
  onHighlight: (matches: number[]) => void;
  onNavigateToMatch?: (lineIndex: number, startIndex: number, endIndex: number) => void;
  className?: string;
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const MagnifyingGlassIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export const JsonSearch: React.FC<JsonSearchProps> = ({ 
  content, 
  onHighlight, 
  onNavigateToMatch,
  className,
  forceVisible = false,
  onVisibilityChange
}) => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [isVisible, setIsVisible] = useState(forceVisible);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matches, setMatches] = useState<SearchMatch[]>([]);

  const performSearch = useCallback(() => {
    if (!searchTerm.trim() || !content) {
      setMatches([]);
      setTotalMatches(0);
      setCurrentMatch(0);
      onHighlight([]);
      return;
    }

    const lines = content.split('\n');
    const foundMatches: SearchMatch[] = [];
    const matchingLines: number[] = [];
    const searchLower = searchTerm.toLowerCase();

    lines.forEach((line, lineIndex) => {
      const lineLower = line.toLowerCase();
      let startIndex = 0;
      
      // Find all matches in this line
      while (true) {
        const matchIndex = lineLower.indexOf(searchLower, startIndex);
        if (matchIndex === -1) break;
        
        foundMatches.push({
          lineIndex,
          lineContent: line,
          startIndex: matchIndex,
          endIndex: matchIndex + searchTerm.length,
          matchText: line.substring(matchIndex, matchIndex + searchTerm.length)
        });
        
        if (!matchingLines.includes(lineIndex)) {
          matchingLines.push(lineIndex);
        }
        
        startIndex = matchIndex + 1;
      }
    });

    setMatches(foundMatches);
    setTotalMatches(foundMatches.length);
    setCurrentMatch(foundMatches.length > 0 ? 0 : -1);
    onHighlight(matchingLines);
    
    // Navigate to first match
    if (foundMatches.length > 0 && onNavigateToMatch) {
      const firstMatch = foundMatches[0];
      onNavigateToMatch(firstMatch.lineIndex, firstMatch.startIndex, firstMatch.endIndex);
    }
  }, [searchTerm, content, onHighlight, onNavigateToMatch]);

  useEffect(() => {
    const debounced = setTimeout(performSearch, 300);
    return () => clearTimeout(debounced);
  }, [performSearch]);

  useEffect(() => {
    setIsVisible(forceVisible);
  }, [forceVisible]);

  const handleNext = () => {
    if (matches.length > 0) {
      const nextIndex = (currentMatch + 1) % matches.length;
      setCurrentMatch(nextIndex);
      
      if (onNavigateToMatch && matches[nextIndex]) {
        const match = matches[nextIndex];
        onNavigateToMatch(match.lineIndex, match.startIndex, match.endIndex);
      }
    }
  };

  const handlePrev = () => {
    if (matches.length > 0) {
      const prevIndex = (currentMatch - 1 + matches.length) % matches.length;
      setCurrentMatch(prevIndex);
      
      if (onNavigateToMatch && matches[prevIndex]) {
        const match = matches[prevIndex];
        onNavigateToMatch(match.lineIndex, match.startIndex, match.endIndex);
      }
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setSearchTerm('');
    setMatches([]);
    setCurrentMatch(0);
    onHighlight([]);
    if (onVisibilityChange) {
      onVisibilityChange(false);
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => {
          setIsVisible(true);
          if (onVisibilityChange) {
            onVisibilityChange(true);
          }
        }}
        variant="secondary"
        size="sm"
        className={className}
        title="Search in JSON (Ctrl+F)"
      >
        <MagnifyingGlassIcon className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className={`flex items-center space-x-2 backdrop-blur-md rounded-md p-2 ${
      theme === 'dark' ? 'bg-slate-600/80' : 'bg-gray-300/80'
    } ${className}`}>
      <div className="relative flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search in JSON..."
          className={`w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            theme === 'dark' 
              ? 'bg-slate-700/50 border-slate-500/50 text-slate-200 placeholder-slate-400'
              : 'bg-white/50 border-gray-400/50 text-gray-800 placeholder-gray-500'
          }`}
          autoFocus
        />
        <MagnifyingGlassIcon className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
          theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
        }`} />
      </div>
      
      {totalMatches > 0 && (
        <>
          <span className={`text-xs ${
            theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
          }`}>
            {currentMatch + 1} / {totalMatches}
          </span>
          <div className="flex space-x-1">
            <button
              onClick={handlePrev}
              className={`p-1 disabled:opacity-50 ${
                theme === 'dark' 
                  ? 'text-slate-300 hover:text-slate-100' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              disabled={totalMatches === 0}
              title="Previous match"
            >
              ↑
            </button>
            <button
              onClick={handleNext}
              className={`p-1 disabled:opacity-50 ${
                theme === 'dark' 
                  ? 'text-slate-300 hover:text-slate-100' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              disabled={totalMatches === 0}
              title="Next match"
            >
              ↓
            </button>
          </div>
        </>
      )}
      
      <button
        onClick={handleClose}
        className={`p-1 ${
          theme === 'dark' 
            ? 'text-slate-300 hover:text-slate-100' 
            : 'text-gray-600 hover:text-gray-800'
        }`}
        title="Close search"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}; 