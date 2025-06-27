import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { parseJsonStructure, toggleSection, getCollapsedContent, CollapsibleSection } from '../lib/jsonCollapse';

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError: boolean;
  className?: string;
  onClearHighlights?: () => void;
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

export const JsonInput: React.FC<JsonInputProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  hasError, 
  className,
  onClearHighlights,
  isTextWrapped = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
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

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className={`relative flex w-full h-full ${className || ''}`}>
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

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleChange}
        onScroll={handleScroll}
        placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
        className={`${baseClasses} ${hasError ? errorClasses : normalClasses} pl-4 pr-4 py-4 text-slate-200 bg-transparent flex-1 ${isReadOnlyMode ? 'cursor-not-allowed opacity-75' : ''}`}
        spellCheck="false"
        readOnly={isReadOnlyMode}
        style={{ 
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
          fontSize: '14px',
          lineHeight: '1.5',
          background: 'rgba(30, 41, 59, 0.5)',
          tabSize: 2,
          whiteSpace: isTextWrapped ? 'pre-wrap' : 'pre',
          wordWrap: isTextWrapped ? 'break-word' : 'normal',
          overflowWrap: isTextWrapped ? 'break-word' : 'normal',
          overflow: 'auto',
          resize: 'none'
        }}
        aria-invalid={hasError}
        aria-describedby={hasError ? "json-input-error" : undefined}
        title={isReadOnlyMode ? "Expand collapsed sections to edit" : undefined}
      />
    </div>
  );
};