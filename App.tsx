import React, { useState, useCallback, useEffect, useRef } from 'react';

// Declare gtag for Google Analytics
declare global {
  function gtag(...args: any[]): void;
}
import { JsonInput } from './components/JsonInput';
import { JsonOutput } from './components/JsonOutput';
import { JsonSearch } from './components/JsonSearch';
import { Button } from './components/Button';
import { Alert } from './components/Alert';
import { JsonStats } from './components/JsonStats';
import { Logo } from './components/Logo';

import { useJsonProcessor, OutputFormat, formatJsObjectToPythonString, AiChange } from './hooks/useJsonProcessor';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useTheme } from './hooks/useTheme';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AiLoadingIndicator } from './components/AiLoadingIndicator';
import { ExportFormatConverter } from './lib/exportFormats';
import { SparklesIcon, CogIcon, ClipboardDocumentIcon, XCircleIcon, ArrowUpTrayIcon, DocumentArrowDownIcon, WrapTextIcon, UnwrapTextIcon, SunIcon, MoonIcon, CompressIcon } from './constants';
// Add icons for format and sort
const FunnelIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M6 9.75h12M9 15h6" />
  </svg>
);
const AlignRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15m-9 4.5h9m-12 4.5h12" />
  </svg>
);

// Helper to escape XML characters
const escapeXml = (unsafe: string): string =>
  String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });

// Basic JSON to XML converter
const jsonToBasicXml = (data: any, tagName: string = 'root', indent: string = ''): string => {
  let xml = '';
  if (Array.isArray(data)) {
    data.forEach(item => {
      const itemTagName = tagName === 'root' ? 'item' : tagName;
      xml += jsonToBasicXml(item, itemTagName, indent);
    });
  } else if (typeof data === 'object' && data !== null) {
    xml += `${indent}<${escapeXml(tagName)}>\n`;
    Object.keys(data).forEach(key => {
      xml += jsonToBasicXml(data[key], key, indent + '  ');
    });
    xml += `${indent}</${escapeXml(tagName)}>\n`;
  } else {
    const value = data === null ? '' : escapeXml(String(data));
    xml += `${indent}<${escapeXml(tagName)}>${value}</${escapeXml(tagName)}>\n`;
  }
  return xml;
};


const App: React.FC = () => {
  // Move all hooks to the top
  const {
    formattedJson,
    error,
    isLoading,
    isAiLoading,
    processJson,
    tryLocalFix,
    tryAiFix,
    compactJson,
    pendingAiConversionToJSON,
    clearPendingAiConversion,
    forceProcessJson,
    clearAiHighlights,
    aiChanges,
    showAiHighlights,
    lastValidParsedJsonObject,
    setError
  } = useJsonProcessor();

  const { theme, toggleTheme } = useTheme();
  const { isDragOver, dragHandlers } = useDragAndDrop({
    onFileUpload: (content) => setRawJson(content),
    accept: ['.json', '.txt', '.py', '.md']
  });

  // Now define all state and callbacks that use these variables
  const [rawJson, setRawJson] = useState<string>('');
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<OutputFormat>('json');
  const [showCopiedMessage, setShowCopiedMessage] = useState<boolean>(false);
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState<boolean>(false);
  const [isTextWrapped, setIsTextWrapped] = useState<boolean>(false);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSearchMatch, setCurrentSearchMatch] = useState<{ lineIndex: number; startIndex: number; endIndex: number } | null>(null);
  
  // Compact output state
  const [isOutputCompact, setIsOutputCompact] = useState<boolean>(false);
  const [compactedOutput, setCompactedOutput] = useState<string>('');

  // For the frontend, we'll assume AI features *could* be active if this flag is true.
  // The actual check for API_KEY now happens on the backend.
  // This could be set based on a config or just be true to always show AI buttons.
  const aiFeaturesPotentiallyEnabled = true;

  // Add at the top-level of App component:
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  // Helper to sort JSON object keys
  function sortJsonKeys(obj: any, order: 'asc' | 'desc'): any {
    if (Array.isArray(obj)) {
      return obj.map(item => sortJsonKeys(item, order));
    } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
      const sortedKeys = Object.keys(obj).sort((a, b) => order === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
      const result: any = {};
      for (const key of sortedKeys) {
        result[key] = sortJsonKeys(obj[key], order);
      }
      return result;
    }
    return obj;
  }

  const handleFormatOutput = useCallback(() => {
    try {
      const output = isOutputCompact ? compactedOutput : formattedJson;
      if (!output?.trim()) return;
      const parsed = JSON.parse(output);
      const pretty = JSON.stringify(parsed, null, 2);
      setCompactedOutput('');
      setIsOutputCompact(false);
      forceProcessJson(pretty, 'json');
    } catch {}
  }, [isOutputCompact, compactedOutput, formattedJson, forceProcessJson]);

  const handleSortOutput = useCallback((order: 'asc' | 'desc') => {
    try {
      const output = isOutputCompact ? compactedOutput : formattedJson;
      if (!output?.trim()) return;
      const parsed = JSON.parse(output);
      const sorted = sortJsonKeys(parsed, order);
      const pretty = JSON.stringify(sorted, null, 2);
      setCompactedOutput('');
      setIsOutputCompact(false);
      forceProcessJson(pretty, 'json');
      setSortOrder(order);
      setIsSortMenuOpen(false);
    } catch {}
  }, [isOutputCompact, compactedOutput, formattedJson, forceProcessJson]);

  // Create stable reference to processJson to avoid race conditions
  const processJsonRef = useRef(processJson);
  processJsonRef.current = processJson;

  // Track when we should reset compact mode
  const shouldResetCompact = useRef(false);

  const handleInputChange = useCallback((value: string) => {
    setRawJson(value);
  }, []);

  // Reset compact mode only when explicitly needed
  const resetCompactMode = useCallback(() => {
    setIsOutputCompact(false);
    setCompactedOutput('');
  }, []);

  // Handle rawJson changes with debouncing - NO processJson dependency
  useEffect(() => {
    const handler = setTimeout(() => {
      // Reset compact mode when input changes
      resetCompactMode();
      
      if (rawJson.trim() === '') {
        processJsonRef.current('', selectedOutputFormat);
      } else {
        processJsonRef.current(rawJson, selectedOutputFormat);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [rawJson, selectedOutputFormat, resetCompactMode]);

  // Handle format switching immediately - NO processJson dependency  
  useEffect(() => {
    // Reset compact mode when format changes
    resetCompactMode();
    processJsonRef.current(rawJson, selectedOutputFormat);
  }, [selectedOutputFormat, rawJson, resetCompactMode]);

   useEffect(() => {
    if (pendingAiConversionToJSON && rawJson.trim() !== '') {
      tryAiFix(rawJson, 'json') 
        .finally(() => {
          clearPendingAiConversion();
        });
    }
  }, [pendingAiConversionToJSON, rawJson, tryAiFix, clearPendingAiConversion]);

  const handleLocalFix = useCallback(async () => {
    resetCompactMode(); // Reset compact mode
    const fixed = await tryLocalFix(rawJson);
    setRawJson(fixed); 
    if (fixed.trim() === '') {
      processJson('', selectedOutputFormat);
    } else {
      processJson(fixed, selectedOutputFormat);
    }
  }, [rawJson, tryLocalFix, processJson, selectedOutputFormat, resetCompactMode]);

  const handleAiFix = useCallback(async () => {
    resetCompactMode(); // Reset compact mode
    await tryAiFix(rawJson, selectedOutputFormat);
  }, [rawJson, tryAiFix, selectedOutputFormat, resetCompactMode]);

  const handleCompact = useCallback(() => {
    try {
      // Work on the current output (formattedJson), not the input
      if (!formattedJson?.trim()) {
        setError({
          title: "No Data to Compact",
          message: "There is no formatted output to compact.",
          suggestion: "Please process some JSON data first, then try compacting."
        });
        return;
      }
      
      const compacted = compactJson(formattedJson);
      setCompactedOutput(compacted);
      setIsOutputCompact(true);
      
      // Clear any previous compact-related errors since compacting succeeded
      if (error?.title === "No Data to Compact" || error?.title === "Cannot Compact Data") {
        setError(null);
      }
    } catch (err: any) {
      console.error('Compact failed:', err);
      setError({
        title: "Cannot Compact Data", 
        message: err.message || "Failed to compact the current output.",
        suggestion: "Try processing the input data again, then compact."
      });
    }
  }, [formattedJson, compactJson, error, setError]);

  const handleCopyOutput = useCallback(async () => {
    const outputToCopy = isOutputCompact ? compactedOutput : formattedJson;
    if (outputToCopy) {
      try {
        await navigator.clipboard.writeText(outputToCopy);
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 2000);
        
        // Track copy action with Google Analytics
        if (typeof gtag !== 'undefined') {
          gtag('event', 'copy_output', {
            event_category: 'user_action',
            event_label: isOutputCompact ? 'json_compact' : selectedOutputFormat,
            custom_parameter_1: 'json_action'
          });
        }
      } catch (err) {
        console.error('Failed to copy output: ', err);
        alert('Failed to copy output to clipboard.');
      }
    }
  }, [formattedJson, compactedOutput, isOutputCompact, selectedOutputFormat]);

  const handleClear = useCallback(() => {
    setRawJson('');
    resetCompactMode(); // Reset compact mode
    processJson('', selectedOutputFormat); 
  }, [processJson, selectedOutputFormat, resetCompactMode]);

  const handleToggleTextWrap = useCallback(() => {
    setIsTextWrapped(prev => !prev);
  }, []);

  const handleSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  const handleSearchVisibilityChange = useCallback((visible: boolean) => {
    setShowSearch(visible);
    if (!visible) {
      setCurrentSearchMatch(null);
    }
  }, []);

  const handleNavigateToMatch = useCallback((lineIndex: number, startIndex: number, endIndex: number) => {
    setCurrentSearchMatch({ lineIndex, startIndex, endIndex });
    
    // Find the line element and scroll to it
    setTimeout(() => {
      // Try to find the line element in either input or output
      const lineElements = document.querySelectorAll(`[data-line-number="${lineIndex + 1}"]`);
      if (lineElements.length > 0) {
        lineElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  const handleUploadFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setRawJson(text); 
      };
      reader.onerror = () => {
        alert("Error reading file.");
      }
      reader.readAsText(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };
  
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveOutput = useCallback((format: 'txt' | 'json' | 'py' | 'xml' | 'yaml' | 'csv' | 'toml' | 'md') => {
    setIsSaveDropdownOpen(false);

    const currentOutput = isOutputCompact ? compactedOutput : formattedJson;
    const objectToConvert = lastValidParsedJsonObject;

    let contentToSave = '';
    let filename = `output.${format}`;
    let mimeType = 'text/plain';

    try {
      if (format === 'txt') {
        contentToSave = currentOutput || '';
        mimeType = 'text/plain';
      } else if (isOutputCompact && format === 'json') {
        contentToSave = compactedOutput;
        mimeType = 'application/json';
      } else if (!objectToConvert) {
        if (format === 'py' && selectedOutputFormat === 'python' && formattedJson) {
          contentToSave = formattedJson;
          mimeType = 'application/python';
        } else {
          alert(`Cannot save as ${format.toUpperCase()}. The input data is not valid or has not been processed yet.`);
          return;
        }
      } else {
        switch (format) {
          case 'json':
            contentToSave = JSON.stringify(objectToConvert, null, 2);
            mimeType = 'application/json';
            break;
          case 'py':
            contentToSave = formatJsObjectToPythonString(objectToConvert);
            mimeType = 'application/python';
            break;
          case 'xml':
            contentToSave = jsonToBasicXml(objectToConvert);
            mimeType = 'application/xml';
            break;
          case 'yaml':
            contentToSave = ExportFormatConverter.toYAML(objectToConvert);
            mimeType = 'application/x-yaml';
            break;
          case 'csv':
            contentToSave = ExportFormatConverter.toCSV(objectToConvert);
            mimeType = 'text/csv';
            break;
          case 'toml':
            contentToSave = ExportFormatConverter.toTOML(objectToConvert);
            mimeType = 'application/toml';
            break;
          case 'md':
            contentToSave = ExportFormatConverter.toMarkdownTable(objectToConvert);
            mimeType = 'text/markdown';
            break;
        }
      }
    } catch (e: any) {
      alert(`Failed to convert to ${format.toUpperCase()}: ${e.message}`);
      return;
    }

    if (!contentToSave.trim()) {
      alert("Nothing to save.");
      return;
    }

    triggerDownload(contentToSave, filename, mimeType);
  }, [formattedJson, compactedOutput, isOutputCompact, selectedOutputFormat, lastValidParsedJsonObject]);

  const textAreaMinHeight = "min-h-[300px] md:min-h-[calc(100vh-420px)]";
  const canSave = !!(rawJson.trim() || formattedJson.trim());

  // Initialize keyboard shortcuts after all handlers are defined
  useKeyboardShortcuts({
    onFormat: () => forceProcessJson(rawJson, selectedOutputFormat),
    onClear: handleClear,
    onCopy: handleCopyOutput,
    onUpload: handleUploadFileClick,
    onBasicClean: handleLocalFix,
    onAiClean: handleAiFix,
    onCompact: handleCompact,
    onSearch: handleSearch,
  });



  return (
    <div 
      className={`min-h-screen transition-colors duration-200 flex flex-col p-4 md:p-6 relative z-0 ${
        theme === 'dark' 
          ? 'bg-slate-800 text-slate-200' 
          : 'bg-gray-50 text-gray-900'
      } ${isDragOver ? 'ring-4 ring-indigo-500 ring-opacity-50' : ''}`}
      {...dragHandlers}
    >
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r flex items-center gap-3 ${
            theme === 'dark' 
              ? 'from-slate-300 via-slate-100 to-slate-300' 
              : 'from-gray-700 via-gray-900 to-gray-700'
          }`}>
            <Logo size={40} className="flex-shrink-0" />
            AIjsonformatter
          </h1>
          <Button
            onClick={toggleTheme}
            variant="secondary"
            size="sm"
            className="ml-4"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main role="main" className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50">
          <div className="flex flex-col p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
                Input JSON / Python-like
              </h2>
              <div className="flex items-center space-x-2">
                <JsonSearch
                  content={rawJson}
                  onHighlight={setSearchMatches}
                  onNavigateToMatch={handleNavigateToMatch}
                  className="mr-2"
                  forceVisible={showSearch}
                  onVisibilityChange={handleSearchVisibilityChange}
                />
                <Button
                  onClick={handleToggleTextWrap}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading || isAiLoading}
                  aria-label={isTextWrapped ? "Unwrap text" : "Wrap text"}
                  title={isTextWrapped ? "Unwrap text" : "Wrap text"}
                >
                  {isTextWrapped ? <UnwrapTextIcon className="w-4 h-4" /> : <WrapTextIcon className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleUploadFileClick}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading || isAiLoading}
                  aria-label="Upload file"
                  title="Upload file"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json,.txt,.py,.md,text/*" />
                <Button
                  onClick={handleClear}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading || isAiLoading || (!rawJson.trim() && !formattedJson.trim() && !error)}
                  aria-label="Clear input and output"
                  title="Clear input & output"
                >
                  <XCircleIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex space-x-3 items-start">
              <Button onClick={() => {
                resetCompactMode(); // Reset compact mode
                forceProcessJson(rawJson, selectedOutputFormat);
              }} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading} className="w-full">
                View
              </Button>
              <Button onClick={handleLocalFix} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading || !rawJson.trim()} className="w-full">
                <CogIcon className="w-4 h-4 mr-1.5" /> Basic Clean
              </Button>
              {aiFeaturesPotentiallyEnabled && (
                <Button onClick={handleAiFix} variant="primary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading || !rawJson.trim()} className="w-full">
                  <SparklesIcon className="w-4 h-4 mr-1.5" /> AI Clean
                </Button>
              )}
            </div>

          </div>
          <JsonInput
            value={rawJson}
            onChange={handleInputChange}
            placeholder="Paste your JSON for formatting, validation, or to check JSON online..."
            hasError={!!error}
            className={`flex-grow w-full h-full ${textAreaMinHeight}`}
            onClearHighlights={clearAiHighlights}
            isTextWrapped={isTextWrapped}
            searchMatches={searchMatches}
            currentSearchMatch={currentSearchMatch}
          />
        </div>

        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50">
          <div className="p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className={`text-xl font-semibold ${
                theme === 'dark' ? 'text-slate-100' : 'text-gray-900'
              }`}>Formatted Output</h2>
              <div className="flex items-center space-x-2">
                {showCopiedMessage && <span className="text-xs text-green-400 mr-1 animate-pulse">Copied!</span>}
                <Button
                  onClick={handleToggleTextWrap}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading || isAiLoading}
                  aria-label={isTextWrapped ? "Unwrap text" : "Wrap text"}
                  title={isTextWrapped ? "Unwrap text" : "Wrap text"}
                >
                  {isTextWrapped ? <UnwrapTextIcon className="w-4 h-4" /> : <WrapTextIcon className="w-4 h-4" />}
                </Button>
                <Button onClick={handleCompact} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading || !formattedJson?.trim()} title="Compact/Minify JSON">
                  <CompressIcon className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={handleFormatOutput}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading || isAiLoading || !formattedJson?.trim()}
                  title="Pretty-print JSON"
                >
                  <AlignRightIcon className="w-4 h-4" />
                </Button>
                <div className="relative">
                  <Button
                    onClick={() => setIsSortMenuOpen(prev => !prev)}
                    variant="secondary"
                    size="sm"
                    ringOffsetClass="focus:ring-offset-slate-700/30"
                    disabled={isLoading || isAiLoading || !formattedJson?.trim()}
                    title="Sort JSON keys"
                  >
                    <FunnelIcon className="w-4 h-4" />
                  </Button>
                  {isSortMenuOpen && (
                    <div className={`absolute right-0 mt-2 w-28 backdrop-blur-md border rounded-md shadow-lg py-1 z-20 ${
                      theme === 'dark' 
                        ? 'bg-slate-600/80 border-slate-500/50' 
                        : 'bg-white/80 border-gray-200'
                    }`}>
                      <button
                        onClick={() => handleSortOutput('asc')}
                        className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-200 hover:bg-slate-500/50'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Sort Ascending
                      </button>
                      <button
                        onClick={() => handleSortOutput('desc')}
                        className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          theme === 'dark'
                            ? 'text-slate-200 hover:bg-slate-500/50'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Sort Descending
                      </button>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleCopyOutput} 
                  variant="secondary" 
                  ringOffsetClass="focus:ring-offset-slate-700/30" 
                  size="sm" 
                  disabled={!(isOutputCompact ? compactedOutput : formattedJson) || isLoading || isAiLoading} 
                  aria-label="Copy output" 
                  title="Copy output"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </Button>
                <div className="relative">
                  <Button 
                    onClick={() => setIsSaveDropdownOpen(prev => !prev)} 
                    variant="secondary" 
                    ringOffsetClass="focus:ring-offset-slate-700/30" 
                    size="sm" 
                    disabled={isLoading || !canSave} 
                    aria-label="Save output as..." 
                    title="Save output as..."
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                  </Button>
                  {isSaveDropdownOpen && (
                    <div className={`absolute right-0 mt-2 w-48 backdrop-blur-md border rounded-md shadow-lg py-1 z-10 ${
                      theme === 'dark' 
                        ? 'bg-slate-600/80 border-slate-500/50' 
                        : 'bg-white/80 border-gray-200'
                    }`}>
                      {(['json', 'py', 'txt'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => handleSaveOutput(fmt)}
                          className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                            theme === 'dark'
                              ? 'text-slate-200 hover:bg-slate-500/50'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          disabled={!canSave || isLoading}
                          title={`Save as .${fmt}`}
                        >
                          Save as .{fmt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <fieldset>
              <legend className="sr-only">Output Format</legend>
              <div className="flex items-center space-x-4">
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                }`}>Format as:</span>
                {(['json', 'python'] as OutputFormat[]).map((format) => (
                  <label key={format} className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="outputFormat"
                      value={format}
                      checked={selectedOutputFormat === format}
                      onChange={() => setSelectedOutputFormat(format)}
                      className="form-radio h-4 w-4 text-indigo-400 bg-slate-600/50 border-slate-500/70 focus:ring-indigo-500 focus:ring-offset-slate-700/30"
                    />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-200' : 'text-gray-800'
                    }`}>
                      {format === 'json' ? 'Standard JSON' : 'Python dict/list'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {(isLoading || isAiLoading) && (
            <div className="flex-grow flex items-center justify-center">
              {isAiLoading ? <AiLoadingIndicator /> : <LoadingSpinner />}
            </div>
          )}
          {!isLoading && !isAiLoading && error && (
            <div className="p-4">
              <Alert type={error.isAiError ? "warning" : "error"} title={error.title}>
                {error.message}
                {error.suggestion && <p className="mt-2 text-sm text-yellow-300">{error.suggestion}</p>}
              </Alert>
            </div>
          )}
          {!isLoading && !isAiLoading && !error && (isOutputCompact ? compactedOutput : formattedJson) && (
            <>
              <JsonOutput 
                data={isOutputCompact ? compactedOutput : formattedJson} 
                className={`flex-grow w-full h-full ${textAreaMinHeight}`}
                aiChanges={aiChanges}
                showAiHighlights={showAiHighlights}
                isTextWrapped={isTextWrapped}
                searchMatches={searchMatches}
                currentSearchMatch={currentSearchMatch}
              />
              <div className="p-3 border-t border-slate-600/50">
                <JsonStats 
                  originalText={rawJson}
                  formattedText={formattedJson}
                />
              </div>
            </>
          )}
          {!isLoading && !isAiLoading && !error && !(isOutputCompact ? compactedOutput : formattedJson) && (
             <div className={`flex-grow flex items-center justify-center ${
               theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
             } ${textAreaMinHeight}`}>
                <p>{rawJson.trim() ? "Output will appear here once processed." : "Output will appear here."}</p>
             </div>
          )}
        </div>
      </main>

      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div className={`text-center p-8 rounded-lg border-2 border-dashed border-indigo-400 ${
            theme === 'dark' ? 'bg-slate-800/90 text-slate-200' : 'bg-white/90 text-gray-800'
          }`}>
            <ArrowUpTrayIcon className="w-16 h-16 mx-auto mb-4 text-indigo-400" />
            <h3 className="text-xl font-semibold mb-2">Drop your file here</h3>
            <p className="text-sm opacity-75">Supports .json, .txt, .py, .md files</p>
          </div>
        </div>
      )}

      <section className="mt-8 mb-4 text-slate-300" aria-labelledby="features-heading">
        <h3 id="features-heading" className="text-lg font-semibold text-center mb-3 text-slate-100">Free Online JSON Formatter & Validator Features</h3>
        <div className="grid md:grid-cols-3 gap-x-4 gap-y-4 max-w-5xl mx-auto">
          <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><CogIcon className="w-4 h-4 mr-2 text-slate-400"/>JSON Basic Clean</h4>
            <p className="text-xs text-slate-400">Instant JSON formatter and validator with local fixes for common syntax issues like Python's True/False/None, missing quotes around keys, single-quoted strings, and trailing commas. Fast and offline JSON cleaning.</p>
          </div>
          <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><CompressIcon className="w-4 h-4 mr-2 text-blue-400"/>JSON Compact/Minify</h4>
            <p className="text-xs text-slate-400">Minify and compress JSON output by removing all unnecessary whitespace, line breaks, and indentation. Perfect for production environments where file size matters. Works with both JSON and Python-like data structures.</p>
          </div>
          {aiFeaturesPotentiallyEnabled && (
            <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
              <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><SparklesIcon className="w-4 h-4 mr-2 text-indigo-400"/>AI JSON Cleaner</h4>
              <p className="text-xs text-slate-400">Advanced AI-powered JSON error correction for complex malformed data. Automatically format JSON, validate syntax, and convert between JSON and Python dictionary formats with intelligent error detection.</p>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center max-w-4xl mx-auto">
          <h4 className={`text-md font-medium mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
            Why Choose Our JSON Formatter Tool?
          </h4>
          <p className={`text-sm leading-relaxed mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Format JSON online instantly with our free JSON beautifier and validator. Clean malformed JSON data, validate JSON syntax, compact/minify JSON for production, and convert between JSON and Python formats. 
            Perfect JSON tool for developers, data analysts, and anyone working with JSON files. No signup required - start formatting JSON now!
          </p>
          
          {/* Keyboard Shortcuts Info */}
          <div className={`text-xs mt-4 p-3 rounded-md ${theme === 'dark' ? 'bg-slate-700/20 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
            <h5 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Keyboard Shortcuts:</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-left">
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> Format</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+K</kbd> Clear</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+F</kbd> Search</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+C</kbd> Copy Output</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+O</kbd> Upload File</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+B</kbd> Basic Clean</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+M</kbd> Compact Output</span>
              <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+I</kbd> AI Clean</span>
            </div>
            <p className="text-xs mt-2 opacity-75">Drag & drop files anywhere on the page to upload instantly!</p>
          </div>
        </div>
      </section>

      {/* FAQ Section for SEO */}
      <section className="mt-8 mb-6" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto">
          <h3 id="faq-heading" className={`text-xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            Frequently Asked Questions - JSON Formatter & Validator
          </h3>
          <div className="space-y-4">
            <details className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <summary className={`font-semibold cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                What is a JSON formatter and why do I need it?
              </summary>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                A JSON formatter is a tool that takes unformatted or minified JSON data and converts it into a human-readable format with proper indentation, line breaks, and syntax highlighting. You need it to debug APIs, validate JSON structure, fix syntax errors, and make JSON data easier to read and understand. Our formatter also validates JSON syntax and provides error correction.
              </p>
            </details>
            
            <details className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <summary className={`font-semibold cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                How do I validate JSON online for free?
              </summary>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Simply paste your JSON data into our online validator above, and it will instantly check for syntax errors, missing brackets, incorrect quotes, and other common issues. Our tool provides detailed error messages and suggestions to help you fix any problems. No registration required!
              </p>
            </details>

            <details className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <summary className={`font-semibold cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Can this tool fix broken or malformed JSON?
              </summary>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Yes! Our tool offers both Basic Clean (fixes common issues like Python literals, missing quotes, trailing commas) and AI Clean (advanced error correction for complex malformed data) to automatically repair broken JSON. It handles most common JSON syntax errors automatically.
              </p>
            </details>

            <details className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <summary className={`font-semibold cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Does this work with Python dictionaries and lists?
              </summary>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Absolutely! Our tool can convert Python dictionary and list syntax to proper JSON format, handling Python literals like True/False/None and converting them to valid JSON equivalents (true/false/null). Perfect for data scientists working with both Python and JSON.
              </p>
            </details>

            <details className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <summary className={`font-semibold cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Is this JSON formatter tool completely free?
              </summary>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Yes, AIjsonformatter is completely free to use with no signup required, no limits on usage, and no hidden fees. All features including AI-powered cleaning, file uploads, and exports are available at no cost.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="mt-8 mb-6" aria-labelledby="use-cases-heading">
        <div className="max-w-5xl mx-auto">
          <h3 id="use-cases-heading" className={`text-xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            JSON Formatter Use Cases & Examples
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>API Development & Testing</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Format API responses, validate request payloads, and debug REST API calls. Essential for developers working with JSON APIs.
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Data Analysis & Cleaning</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Clean messy JSON data from web scraping, convert Python dictionaries to JSON, and prepare data for analysis.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Configuration Files</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Format and validate JSON configuration files for applications, validate package.json files, and fix syntax errors.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Database Export/Import</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Format JSON exports from databases, validate data before importing, and convert between different data formats.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Educational & Learning</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Learn JSON structure, understand JSON syntax, practice with real data, and debug JSON parsing errors.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Production Optimization</h4>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Minify JSON for production deployment, reduce file sizes, and optimize API payload sizes for better performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How-to Tutorial Section */}
      <section className="mt-8 mb-6" aria-labelledby="tutorial-heading">
        <div className="max-w-4xl mx-auto">
          <h3 id="tutorial-heading" className={`text-xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            How to Use Our JSON Formatter - Step by Step Guide
          </h3>
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                <span className="bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">1</span>
                Paste or Upload Your JSON Data
              </h4>
              <p className={`text-sm ml-9 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Paste your JSON text directly into the input area above, or drag & drop a .json file. You can also upload .txt, .py, or .md files containing JSON data.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                <span className="bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">2</span>
                Choose Output Format
              </h4>
              <p className={`text-sm ml-9 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Select "Standard JSON" for JSON output or "Python dict/list" for Python-compatible format. The tool automatically processes your input.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                <span className="bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">3</span>
                Fix Errors (If Needed)
              </h4>
              <p className={`text-sm ml-9 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                If you see errors, click "Basic Clean" for common fixes or "AI Clean" for advanced error correction. Our tool handles most JSON syntax issues automatically.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/20 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                <span className="bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">4</span>
                Copy, Download, or Minify
              </h4>
              <p className={`text-sm ml-9 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Copy the formatted result, download in various formats (JSON, YAML, CSV, XML, etc.), or use the compress button to minify for production use.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="mt-8 mb-6" aria-labelledby="comparison-heading">
        <div className="max-w-5xl mx-auto">
          <h3 id="comparison-heading" className={`text-xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            Why Choose AIjsonformatter Over Other JSON Tools?
          </h3>
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse border ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
              <thead>
                <tr className={theme === 'dark' ? 'bg-slate-700/30' : 'bg-gray-100'}>
                  <th className={`border p-3 text-left ${theme === 'dark' ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-800'}`}>Feature</th>
                  <th className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-800'}`}>AIjsonformatter</th>
                  <th className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-800'}`}>Other Tools</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>AI-Powered Error Correction</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-red-400 font-semibold">✗</span>
                  </td>
                </tr>
                <tr className={theme === 'dark' ? 'bg-slate-700/10' : 'bg-gray-50'}>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>Python Dictionary Support</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-red-400 font-semibold">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>Multiple Export Formats</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-yellow-400 font-semibold">Limited</span>
                  </td>
                </tr>
                <tr className={theme === 'dark' ? 'bg-slate-700/10' : 'bg-gray-50'}>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>Drag & Drop File Upload</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-red-400 font-semibold">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>Keyboard Shortcuts</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-red-400 font-semibold">✗</span>
                  </td>
                </tr>
                <tr className={theme === 'dark' ? 'bg-slate-700/10' : 'bg-gray-50'}>
                  <td className={`border p-3 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-700'}`}>No Registration Required</td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-green-400 font-semibold">✓</span>
                  </td>
                  <td className={`border p-3 text-center ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    <span className="text-yellow-400 font-semibold">Varies</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="mt-8 pt-4 border-t border-slate-700/50 text-center text-sm text-slate-400">
        <div className="mb-4">
          <p className="text-sm text-slate-300 mb-1">
            <strong>AIjsonformatter</strong> - Free Online JSON Formatter, Validator & Cleaner
          </p>
          <p className="text-xs text-slate-400">
            Format JSON • Validate JSON • Clean JSON • Beautify JSON • Compact JSON • Python to JSON Converter
          </p>
        </div>
        
        {/* GitHub Links Section */}
        <div className="mb-4">
          <div className="flex justify-center gap-6 text-xs">
            <a
              href="https://github.com/satyam237/json-cleaner/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Report bugs or request features"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.379.201 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.017C22 6.484 17.522 2 12 2Z" clipRule="evenodd" />
              </svg>
              <span>Report Issues</span>
            </a>
            <a
              href="https://github.com/satyam237/json-cleaner"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-slate-400 hover:text-indigo-400 transition-colors"
              title="View source code"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.379.201 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.017C22 6.484 17.522 2 12 2Z" clipRule="evenodd" />
              </svg>
              <span>Source Code</span>
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Found a bug? Have an idea? We'd love to hear from you on GitHub!
          </p>
        </div>
        
        <p className="text-xs text-slate-500">AI-powered by Google Gemini API</p>
      </footer>
    </div>
  );
};

export default App;
