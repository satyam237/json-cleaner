import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { AiChange } from '../hooks/useJsonProcessor';
import { parseJsonStructure, toggleSection, getCollapsedContent, CollapsibleSection } from '../lib/jsonCollapse';

interface JsonOutputProps {
  data: string;
  className?: string;
  aiChanges?: AiChange[];
  showAiHighlights?: boolean;
}

// Chevron icons for collapse/expand
const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);



// Calculate vertical guide lines for brackets
const calculateGuideLines = (text: string): Array<{ left: number; top: number; height: number; level: number }> => {
  const lines = text.split('\n');
  const guides: Array<{ left: number; top: number; height: number; level: number }> = [];
  const stack: Array<{ char: string; line: number; col: number; level: number }> = [];
  let currentLevel = 0;

  lines.forEach((line, lineIndex) => {
    let inString = false;
    let escapeNext = false;
    let stringDelimiter = '';

    for (let col = 0; col < line.length; col++) {
      const char = line[col];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringDelimiter = char;
        continue;
      } else if (char === stringDelimiter && inString) {
        inString = false;
        stringDelimiter = '';
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        stack.push({ char, line: lineIndex, col, level: currentLevel });
        currentLevel++;
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) {
          const opener = stack.pop()!;
          const matching = (char === '}' && opener.char === '{') || (char === ']' && opener.char === '[');
          
          if (matching && lineIndex > opener.line) {
            // Calculate guide line position
            const left = opener.col * 8.4 + 16; // Approximate character width in monospace
            const top = (opener.line + 1) * 24; // Line height
            const height = (lineIndex - opener.line) * 24;
            
            guides.push({
              left,
              top,
              height,
              level: opener.level
            });
          }
        }
        currentLevel = Math.max(0, currentLevel - 1);
      }
    }
  });

  return guides;
};

export const JsonOutput: React.FC<JsonOutputProps> = ({ 
  data, 
  className,
  aiChanges = [],
  showAiHighlights = false
}) => {
  const contentRef = useRef<HTMLPreElement>(null);

  const aiHighlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [collapsibleSections, setCollapsibleSections] = useState<CollapsibleSection[]>([]);
  const [isValidJson, setIsValidJson] = useState(false);

  // Parse structure for both JSON and Python-like syntax
  const jsonStructure = useMemo(() => {
    if (!data.trim()) {
      return null;
    }

    // Try to parse as JSON first
    let isValidJsonFormat = false;
    try {
      JSON.parse(data);
      isValidJsonFormat = true;
    } catch {
      // Not valid JSON, but might still have collapsible structure
    }

    // Parse structure regardless of JSON validity (for Python-like syntax too)
    const structure = parseJsonStructure(data);
    return structure.sections.length > 0 ? structure : null;
  }, [data]);

  // Update validity state when structure changes
  useEffect(() => {
    setIsValidJson(!!jsonStructure);
  }, [jsonStructure]);

  // Calculate display data based on collapsed sections
  const displayData = useMemo(() => {
    if (!data.trim() || !jsonStructure) {
      return data;
    }

    const hasCollapsed = collapsibleSections.some(s => s.isCollapsed);
    return hasCollapsed ? getCollapsedContent(data, collapsibleSections) : data;
  }, [data, collapsibleSections, jsonStructure]);

  // Calculate guide lines
  const guideLines = useMemo(() => {
    return calculateGuideLines(displayData);
  }, [displayData]);



  // Update line count when display data changes
  useEffect(() => {
    const lines = displayData.split('\n').length;
    setLineCount(Math.max(1, lines));
  }, [displayData]);

  // Update collapsible sections when JSON structure changes
  useEffect(() => {
    if (jsonStructure?.sections) {
      setCollapsibleSections(prev => {
        // Preserve collapsed state for existing sections
        const newSections = jsonStructure.sections.map(newSection => {
          const existingSection = prev.find(s => 
            s.startLine === newSection.startLine && 
            s.endLine === newSection.endLine && 
            s.type === newSection.type
          );
          return existingSection ? { ...newSection, isCollapsed: existingSection.isCollapsed } : newSection;
        });
        return newSections;
      });
    } else {
      setCollapsibleSections([]);
    }
  }, [jsonStructure]);

  const handleToggleSection = useCallback((sectionIndex: number) => {
    setCollapsibleSections(prev => toggleSection(prev, sectionIndex));
  }, []);

  // Get section for a specific line
  const getSectionForLine = useCallback((lineNumber: number) => {
    return collapsibleSections.findIndex(section => section.startLine === lineNumber);
  }, [collapsibleSections]);

  // Create AI highlighted content
  const createAiHighlightedContent = useCallback(() => {
    if (!showAiHighlights || aiChanges.length === 0 || !displayData) {
      return '';
    }

    const lines = displayData.split('\n');
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
  }, [showAiHighlights, aiChanges, displayData]);

  // Sync scroll between all elements
  const handleScroll = useCallback((e: React.UIEvent<HTMLPreElement>) => {
    if (aiHighlightRef.current && lineNumbersRef.current && guidesRef.current) {
      const scrollTop = e.currentTarget.scrollTop;
      const scrollLeft = e.currentTarget.scrollLeft;
      
      aiHighlightRef.current.scrollTop = scrollTop;
      aiHighlightRef.current.scrollLeft = scrollLeft;
      lineNumbersRef.current.scrollTop = scrollTop;
      guidesRef.current.scrollTop = scrollTop;
      guidesRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  return (
    <div className={`relative flex w-full h-full overflow-hidden rounded-b-md ${className || ''}`}>
      {/* Line Numbers with Collapse/Expand Controls */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-16 bg-slate-600/30 border-r border-slate-600/50 overflow-hidden relative z-20"
        style={{
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        <div className="px-1 py-4 text-slate-400 select-none">
          {Array.from({ length: lineCount }, (_, i) => {
            const lineNumber = i;
            const sectionIndex = getSectionForLine(lineNumber);
            const hasCollapsible = sectionIndex !== -1;
            const section = hasCollapsible ? collapsibleSections[sectionIndex] : null;
            
            return (
              <div key={i + 1} className="leading-6 flex items-center h-6">
                <div className="flex items-center w-4">
                  {jsonStructure && hasCollapsible && section ? (
                    <button
                      onClick={() => handleToggleSection(sectionIndex)}
                      className="w-3 h-3 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                      title={section.isCollapsed ? 'Expand' : 'Collapse'}
                      aria-label={`${section.isCollapsed ? 'Expand' : 'Collapse'} ${section.type} at line ${i + 1}`}
                    >
                      {section.isCollapsed ? (
                        <ChevronRightIcon className="w-3 h-3" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3" />
                      )}
                    </button>
                  ) : (
                    <div className="w-3" />
                  )}
                </div>
                <div className="text-right flex-1 pr-1">
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area Container */}
      <div className="relative flex-1 overflow-hidden">
        {/* Vertical Guide Lines */}
        <div
          ref={guidesRef}
          className="absolute inset-0 pointer-events-none overflow-hidden z-5"
          style={{ 
            paddingLeft: '16px',
            paddingTop: '16px',
          }}
        >
          {guideLines.map((guide, index) => (
            <div
              key={index}
              className="absolute border-l border-slate-600/30"
              style={{
                left: `${guide.left}px`,
                top: `${guide.top}px`,
                height: `${guide.height}px`,
                opacity: 0.4 - (guide.level * 0.05), // Fade deeper levels
              }}
            />
          ))}
        </div>

        {/* AI Highlight layer */}
        {showAiHighlights && aiChanges.length > 0 && (
          <div
            ref={aiHighlightRef}
            className="absolute inset-0 p-4 pointer-events-none overflow-auto whitespace-pre text-transparent z-15"
            style={{ 
              fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
            dangerouslySetInnerHTML={{ __html: createAiHighlightedContent() }}
          />
        )}


        
        {/* Actual content */}
        <pre 
          ref={contentRef}
          className="w-full h-full p-4 overflow-auto text-slate-200 relative z-20"
          style={{ 
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
            fontSize: '14px',
            lineHeight: '1.5',
            background: 'transparent',
            tabSize: 2,
            whiteSpace: 'pre',
            margin: 0
          }}
          onScroll={handleScroll}
        >
          <code className="leading-6">{displayData}</code>
        </pre>
        
        {/* Background */}
        <div 
          className="absolute inset-0 pointer-events-none -z-10"
          style={{ background: 'rgba(30, 41, 59, 0.5)' }}
        />
      </div>
    </div>
  );
};
