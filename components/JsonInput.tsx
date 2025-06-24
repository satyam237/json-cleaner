import React, { useRef } from 'react';
import { AiChange } from '../hooks/useJsonProcessor';

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError: boolean;
  className?: string;
  aiChanges?: AiChange[];
  showAiHighlights?: boolean;
  onClearHighlights?: () => void;
}

export const JsonInput: React.FC<JsonInputProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  hasError, 
  className,
  aiChanges = [],
  showAiHighlights = false,
  onClearHighlights
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const baseClasses = "w-full h-full p-4 text-slate-200 resize-none focus:outline-none focus:ring-2 rounded-b-md border";
  const errorClasses = "focus:ring-red-500 border-red-500/70 focus:border-red-500";
  const normalClasses = "focus:ring-indigo-500 border-slate-600/50 focus:border-indigo-500 focus:ring-offset-slate-800"; 
  const textareaClasses = `${baseClasses} ${hasError ? errorClasses : normalClasses} ${className || ''}`;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear highlights when user starts typing
    if (showAiHighlights && onClearHighlights) {
      onClearHighlights();
    }
  };

  // Sync scroll between textarea and highlight layer
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Create highlighted content
  const createHighlightedContent = () => {
    if (!showAiHighlights || aiChanges.length === 0) {
      return '';
    }

    const lines = value.split('\n');
    const changeMap = new Map<number, AiChange>();
    
    aiChanges.forEach(change => {
      changeMap.set(change.line, change);
    });

    const highlightedLines = lines.map((line, index) => {
      const change = changeMap.get(index);
      // Escape HTML entities
      const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      if (change) {
        const highlightClass = 
          change.type === 'added' ? 'bg-green-500/20 border-l-2 border-green-400' :
          change.type === 'modified' ? 'bg-yellow-500/20 border-l-2 border-yellow-400' :
          'bg-red-500/20 border-l-2 border-red-400';
        
        return `<div class="${highlightClass} block px-1 -mx-1">${escapedLine || ' '}</div>`;
      }
      return `<div>${escapedLine || ' '}</div>`;
    });

    return highlightedLines.join('');
  };

  return (
    <div className="relative">
      {/* Highlight layer */}
      {showAiHighlights && aiChanges.length > 0 && (
        <div
          ref={highlightRef}
          className="absolute inset-0 p-4 pointer-events-none overflow-auto whitespace-pre-wrap break-words text-transparent rounded-b-md z-0"
          style={{ 
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            background: 'rgba(30, 41, 59, 0.5)',
          }}
          dangerouslySetInnerHTML={{ __html: createHighlightedContent() }}
        />
      )}
      
      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
        className={`${textareaClasses} ${showAiHighlights ? 'relative z-10 bg-transparent' : ''}`}
        spellCheck="false"
        style={{ 
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
          fontSize: '14px',
          lineHeight: '1.5',
          background: showAiHighlights ? 'transparent' : 'rgba(30, 41, 59, 0.5)'
        }}
        aria-invalid={hasError}
        aria-describedby={hasError ? "json-input-error" : undefined}
      />
      
      {/* Background for when not highlighting */}
      {!showAiHighlights && (
        <div 
          className="absolute inset-0 rounded-b-md pointer-events-none -z-10"
          style={{ background: 'rgba(30, 41, 59, 0.5)' }}
        />
      )}
    </div>
  );
};