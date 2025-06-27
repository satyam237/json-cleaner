import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { AiChange } from '../hooks/useJsonProcessor';
import { parseJsonStructure, toggleSection, getCollapsedContent, CollapsibleSection } from '../lib/jsonCollapse';

interface JsonOutputProps {
  data: string;
  className?: string;
  aiChanges?: AiChange[];
  showAiHighlights?: boolean;
  isTextWrapped?: boolean;
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

export const JsonOutput: React.FC<JsonOutputProps> = ({ 
  data, 
  className,
  aiChanges = [],
  showAiHighlights = false,
  isTextWrapped = false
}) => {
  const contentRef = useRef<HTMLPreElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
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

  // Create highlighted content
  const createHighlightedContent = useCallback(() => {
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

  // Sync scroll between content, highlights, and line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLPreElement>) => {
    if (highlightRef.current && lineNumbersRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  return (
    <div className={`relative flex w-full h-full overflow-hidden rounded-b-md ${className || ''}`}>
      {/* Line Numbers with Collapse/Expand Controls */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-16 bg-slate-600/30 border-r border-slate-600/50 overflow-hidden"
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
              whiteSpace: isTextWrapped ? 'pre-wrap' : 'pre',
              wordWrap: isTextWrapped ? 'break-word' : 'normal',
              overflowWrap: isTextWrapped ? 'break-word' : 'normal',
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
            whiteSpace: isTextWrapped ? 'pre-wrap' : 'pre',
            wordWrap: isTextWrapped ? 'break-word' : 'normal',
            overflowWrap: isTextWrapped ? 'break-word' : 'normal',
            margin: 0
          }}
          onScroll={handleScroll}
        >
          <code className="leading-6">{displayData}</code>
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
