import React, { useRef } from 'react';
import { AiChange } from '../hooks/useJsonProcessor';

interface JsonOutputProps {
  data: string;
  className?: string;
  aiChanges?: AiChange[];
  showAiHighlights?: boolean;
}

export const JsonOutput: React.FC<JsonOutputProps> = ({ 
  data, 
  className,
  aiChanges = [],
  showAiHighlights = false
}) => {
  const highlightRef = useRef<HTMLDivElement>(null);

  // Create highlighted content
  const createHighlightedContent = () => {
    if (!showAiHighlights || aiChanges.length === 0) {
      return '';
    }

    const lines = data.split('\n');
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
          change.type === 'added' ? 'bg-green-500/30 border-l-4 border-green-400 px-2 -mx-2 py-0.5 -my-0.5' :
          change.type === 'modified' ? 'bg-yellow-500/30 border-l-4 border-yellow-400 px-2 -mx-2 py-0.5 -my-0.5' :
          'bg-red-500/30 border-l-4 border-red-400 px-2 -mx-2 py-0.5 -my-0.5';
        
        return `<div class="${highlightClass} block">${escapedLine || ' '}</div>`;
      }
      return `<div>${escapedLine || ' '}</div>`;
    });

    return highlightedLines.join('');
  };

  // Sync scroll between pre and highlight layer
  const handleScroll = (e: React.UIEvent<HTMLPreElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-b-md ${className || ''}`}>
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
      
      {/* Actual content */}
      <pre 
        className="w-full h-full p-4 overflow-auto text-slate-200 rounded-b-md relative z-10"
        style={{ 
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
          fontSize: '14px',
          lineHeight: '1.5',
          background: showAiHighlights ? 'transparent' : 'rgba(30, 41, 59, 0.5)'
        }}
        onScroll={handleScroll}
      >
        <code>{data}</code>
      </pre>
      
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
