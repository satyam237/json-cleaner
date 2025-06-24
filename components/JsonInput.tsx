import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { parseJsonStructure, toggleSection, getCollapsedContent, CollapsibleSection } from '../lib/jsonCollapse';

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError: boolean;
  className?: string;
  onClearHighlights?: () => void;
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

// JSON syntax highlighting function
const highlightJsonSyntax = (text: string): string => {
  if (!text.trim()) return text;

  // Escape HTML entities first
  let highlighted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight strings (both single and double quoted) - blue-green
  highlighted = highlighted.replace(
    /"([^"\\]*(\\.[^"\\]*)*)"/g,
    '<span style="color: #7dd3fc;">\"$1\"</span>'
  );
  highlighted = highlighted.replace(
    /'([^'\\]*(\\.[^'\\]*)*)'/g,
    '<span style="color: #7dd3fc;">\'$1\'</span>'
  );

  // Highlight numbers - light orange
  highlighted = highlighted.replace(
    /\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g,
    '<span style="color: #fbbf24;">$1</span>'
  );

  // Highlight booleans and null - purple
  highlighted = highlighted.replace(
    /\b(true|false|null|True|False|None)\b/g,
    '<span style="color: #c084fc;">$1</span>'
  );

  // Highlight brackets and braces - light gray
  highlighted = highlighted.replace(
    /([{}[\]])/g,
    '<span style="color: #94a3b8;">$1</span>'
  );

  // Highlight colons and commas - gray
  highlighted = highlighted.replace(
    /([:,])/g,
    '<span style="color: #64748b;">$1</span>'
  );

  return highlighted;
};

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

export const JsonInput: React.FC<JsonInputProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  hasError, 
  className,
  onClearHighlights
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [collapsibleSections, setCollapsibleSections] = useState<CollapsibleSection[]>([]);
  const [isValidJson, setIsValidJson] = useState(false);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);

  const baseClasses = "w-full h-full resize-none focus:outline-none focus:ring-2 rounded-b-md border";
  const errorClasses = "focus:ring-red-500 border-red-500/70 focus:border-red-500";
  const normalClasses = "focus:ring-indigo-500 border-slate-600/50 focus:border-indigo-500 focus:ring-offset-slate-800"; 

  // Parse structure for both JSON and Python-like syntax
  const jsonStructure = useMemo(() => {
    if (!value.trim()) {
      return null;
    }

    // Try to parse as JSON first
    let isValidJsonFormat = false;
    try {
      JSON.parse(value);
      isValidJsonFormat = true;
    } catch {
      // Not valid JSON, but might still have collapsible structure
    }

    // Parse structure regardless of JSON validity (for Python-like syntax too)
    const structure = parseJsonStructure(value);
    return structure.sections.length > 0 ? structure : null;
  }, [value]);

  // Update validity state when structure changes
  useEffect(() => {
    setIsValidJson(!!jsonStructure);
  }, [jsonStructure]);

  // Calculate display value based on collapsed sections
  const displayValue = useMemo(() => {
    if (!value.trim() || !jsonStructure) {
      return value;
    }

    const hasCollapsed = collapsibleSections.some(s => s.isCollapsed);
    return hasCollapsed ? getCollapsedContent(value, collapsibleSections) : value;
  }, [value, collapsibleSections, jsonStructure]);

  // Calculate guide lines
  const guideLines = useMemo(() => {
    return calculateGuideLines(displayValue);
  }, [displayValue]);

  // Create highlighted content
  const highlightedContent = useMemo(() => {
    return highlightJsonSyntax(displayValue);
  }, [displayValue]);

  // Update read-only mode based on collapsed sections
  useEffect(() => {
    const hasCollapsed = collapsibleSections.some(s => s.isCollapsed);
    setIsReadOnlyMode(hasCollapsed && !!jsonStructure);
  }, [collapsibleSections, jsonStructure]);

  // Update line count when display value changes
  useEffect(() => {
    const lines = displayValue.split('\n').length;
    setLineCount(Math.max(1, lines));
  }, [displayValue]);

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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Only allow changes if not in read-only mode (when sections are collapsed)
    if (isReadOnlyMode) {
      return;
    }

    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear highlights when user starts typing
    if (onClearHighlights) {
      onClearHighlights();
    }
  }, [isReadOnlyMode, onChange, onClearHighlights]);

  const handleToggleSection = useCallback((sectionIndex: number) => {
    setCollapsibleSections(prev => {
      const newSections = toggleSection(prev, sectionIndex);
      return newSections;
    });
  }, []);

  // Get section for a specific line
  const getSectionForLine = useCallback((lineNumber: number) => {
    return collapsibleSections.findIndex(section => section.startLine === lineNumber);
  }, [collapsibleSections]);

  // Sync scroll between all elements
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current && highlightRef.current && guidesRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;
      
      lineNumbersRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
      guidesRef.current.scrollTop = scrollTop;
      guidesRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  return (
    <div className={`relative flex w-full h-full ${className || ''}`}>
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

        {/* Syntax Highlighting Layer */}
        <div
          ref={highlightRef}
          className="absolute inset-0 p-4 pointer-events-none overflow-auto whitespace-pre text-transparent z-10"
          style={{ 
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            background: 'rgba(30, 41, 59, 0.5)',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
        
        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          onScroll={handleScroll}
          placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
          className={`${baseClasses} ${hasError ? errorClasses : normalClasses} pl-4 pr-4 py-4 text-transparent bg-transparent flex-1 relative z-15 caret-slate-200 ${isReadOnlyMode ? 'cursor-not-allowed opacity-75' : ''}`}
          spellCheck="false"
          readOnly={isReadOnlyMode}
          style={{ 
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
            fontSize: '14px',
            lineHeight: '1.5',
            background: 'transparent',
            tabSize: 2,
            whiteSpace: 'pre',
            overflow: 'auto',
            resize: 'none'
          }}
          aria-invalid={hasError}
          aria-describedby={hasError ? "json-input-error" : undefined}
          title={isReadOnlyMode ? "Expand collapsed sections to edit" : undefined}
        />

        {/* Background */}
        <div 
          className="absolute inset-0 pointer-events-none -z-10"
          style={{ background: 'rgba(30, 41, 59, 0.5)' }}
        />
      </div>
    </div>
  );
};