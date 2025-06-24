import React, { useRef, useState, useEffect } from 'react';
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
  const contentRef = useRef<HTMLPreElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Update line count when data changes
  useEffect(() => {
    const lines = data.split('\n').length;
    setLineCount(Math.max(1, lines));
  }, [data]);

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
          change.type === 'added' ? 'bg-green-500/15 border-l-2 border-green-400/60 px-1 -mx-1' :
          change.type === 'modified' ? 'bg-yellow-500/15 border-l-2 border-yellow-400/60 px-1 -mx-1' :
          'bg-red-500/15 border-l-2 border-red-400/60 px-1 -mx-1';
        
        return `<div class="${highlightClass} leading-6">${escapedLine || ' '}</div>`;
      }
      return `<div class="leading-6">${escapedLine || ' '}</div>`;
    });

    return highlightedLines.join('');
  };

  // Sync scroll between content, highlights, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLPreElement>) => {
    if (highlightRef.current && lineNumbersRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className={`relative flex w-full h-full overflow-hidden rounded-b-md ${className || ''}`}>
      {/* Line Numbers */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-12 bg-slate-600/30 border-r border-slate-600/50 overflow-hidden"
        style={{
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        <div className="px-2 py-4 text-slate-400 text-right select-none">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area Container */}
      <div className="relative flex-1 overflow-hidden">
        {/* Highlight layer */}
        {showAiHighlights && aiChanges.length > 0 && (
          <div
            ref={highlightRef}
            className="absolute inset-0 p-4 pointer-events-none overflow-auto whitespace-pre text-transparent z-0"
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
          ref={contentRef}
          className="w-full h-full p-4 overflow-auto text-slate-200 relative z-10"
          style={{ 
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
            fontSize: '14px',
            lineHeight: '1.5',
            background: showAiHighlights ? 'transparent' : 'rgba(30, 41, 59, 0.5)',
            tabSize: 2,
            whiteSpace: 'pre',
            margin: 0
          }}
          onScroll={handleScroll}
        >
          <code className="leading-6">{data}</code>
        </pre>
        
        {/* Background for when not highlighting */}
        {!showAiHighlights && (
          <div 
            className="absolute inset-0 pointer-events-none -z-10"
            style={{ background: 'rgba(30, 41, 59, 0.5)' }}
          />
        )}
      </div>
    </div>
  );
};
