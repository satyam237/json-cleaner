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
  const [rawJson, setRawJson] = useState<string>('');
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<OutputFormat>('json');
  const [showCopiedMessage, setShowCopiedMessage] = useState<boolean>(false);
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState<boolean>(false);
  const [isTextWrapped, setIsTextWrapped] = useState<boolean>(false);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For the frontend, we'll assume AI features *could* be active if this flag is true.
  // The actual check for API_KEY now happens on the backend.
  // This could be set based on a config or just be true to always show AI buttons.
  const aiFeaturesPotentiallyEnabled = true;

  // Initialize new hooks
  const { theme, toggleTheme } = useTheme();
  const { isDragOver, dragHandlers } = useDragAndDrop({
    onFileUpload: (content) => setRawJson(content),
    accept: ['.json', '.txt', '.py', '.md']
  }); 

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
  } = useJsonProcessor();



  const handleInputChange = useCallback((value: string) => {
    setRawJson(value);
  }, []);

  // Handle rawJson changes with debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      if (rawJson.trim() === '') {
        processJson('', selectedOutputFormat);
      } else {
        processJson(rawJson, selectedOutputFormat);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [rawJson, selectedOutputFormat, processJson]);

  // Handle format switching immediately (no debouncing needed)
  useEffect(() => {
    processJson(rawJson, selectedOutputFormat);
  }, [rawJson, selectedOutputFormat, processJson]);

   useEffect(() => {
    if (pendingAiConversionToJSON && rawJson.trim() !== '') {
      tryAiFix(rawJson, 'json') 
        .finally(() => {
          clearPendingAiConversion();
        });
    }
  }, [pendingAiConversionToJSON, rawJson, tryAiFix, clearPendingAiConversion]);




  const handleLocalFix = useCallback(async () => {
    const fixed = await tryLocalFix(rawJson);
    setRawJson(fixed); 
    if (fixed.trim() === '') {
      processJson('', selectedOutputFormat);
    } else {
      processJson(fixed, selectedOutputFormat);
    }
  }, [rawJson, tryLocalFix, processJson, selectedOutputFormat]);

  const handleAiFix = useCallback(async () => {
    await tryAiFix(rawJson, selectedOutputFormat);
  }, [rawJson, tryAiFix, selectedOutputFormat]);

  const handleCompact = useCallback(async () => {
    try {
      // Use the formatted output if available, otherwise use raw input
      const sourceData = formattedJson || rawJson;
      const compacted = await compactJson(sourceData);
      setRawJson(compacted); 
      // Force process to show the compacted result
      processJson(compacted, 'json'); // Always show as JSON since compacting produces JSON
      setSelectedOutputFormat('json'); // Switch to JSON format
    } catch (err) {
      // Error is already handled by compactJson
      console.error('Compact failed:', err);
    }
  }, [formattedJson, rawJson, compactJson, processJson]);

  const handleCopyOutput = useCallback(async () => {
    if (formattedJson) {
      try {
        await navigator.clipboard.writeText(formattedJson);
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 2000);
        
        // Track copy action with Google Analytics
        if (typeof gtag !== 'undefined') {
          gtag('event', 'copy_output', {
            event_category: 'user_action',
            event_label: selectedOutputFormat,
            custom_parameter_1: 'json_action'
          });
        }
      } catch (err) {
        console.error('Failed to copy output: ', err);
        alert('Failed to copy output to clipboard.');
      }
    }
  }, [formattedJson, selectedOutputFormat]);

  const handleClear = useCallback(() => {
    setRawJson('');
    processJson('', selectedOutputFormat); 
  }, [processJson, selectedOutputFormat]);

  const handleToggleTextWrap = useCallback(() => {
    setIsTextWrapped(prev => !prev);
  }, []);

  const handleSearch = useCallback(() => {
    setShowSearch(true);
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
    
    let contentToSave = formattedJson || '';
    let isContentPotentiallyEmpty = !formattedJson;

    let filename = 'output';
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        filename += '.txt';
        mimeType = 'text/plain';
        break;
      case 'json':
        filename += '.json';
        mimeType = 'application/json';
        if (selectedOutputFormat === 'json' && formattedJson) {
          contentToSave = formattedJson;
          isContentPotentiallyEmpty = false;
        } else { 
          try { 
            const parsedRaw = JSON.parse(rawJson);
            contentToSave = JSON.stringify(parsedRaw, null, 2);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            if (formattedJson && selectedOutputFormat === 'python') {
              alert("Original input is not valid JSON. Saving current Python output as .json instead (may not be true JSON).");
              contentToSave = formattedJson; 
              isContentPotentiallyEmpty = !formattedJson;
            } else if (!formattedJson && !rawJson.trim()) {
                alert("Nothing to save as JSON."); return;
            } else {
                alert("Original input is not valid JSON. Cannot save as structured JSON."); return;
            }
          }
        }
        break;
      case 'py':
        filename += '.py';
        mimeType = 'application/python';
        if (selectedOutputFormat === 'python' && formattedJson) {
          contentToSave = formattedJson;
           isContentPotentiallyEmpty = false;
        } else if (formattedJson) { 
          try {
            const parsedFormatted = JSON.parse(formattedJson);
            contentToSave = formatJsObjectToPythonString(parsedFormatted);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            alert("Current output is not valid JSON. Cannot convert to Python.");
            return;
          }
        } else if (!rawJson.trim()) {
            alert("Nothing to save as Python."); return;
        } else {
             alert("No valid content to convert to Python."); return;
        }
        break;
      case 'xml':
        filename += '.xml';
        mimeType = 'application/xml';
        let objectToConvert: any = null;
        if (rawJson.trim()) {
            try {
              objectToConvert = JSON.parse(rawJson); 
            } catch (e) { /* ignore attempt on raw */ }
        }
        if (!objectToConvert && selectedOutputFormat === 'json' && formattedJson) {
          try {
            objectToConvert = JSON.parse(formattedJson); 
          } catch (e2) { /* ignore attempt on formatted */ }
        }
        
        if (objectToConvert) {
          contentToSave = jsonToBasicXml(objectToConvert);
          isContentPotentiallyEmpty = false;
        } else {
          alert("Cannot convert to XML. Input data is not valid JSON.");
          return;
        }
        break;
      case 'yaml':
        filename += '.yaml';
        mimeType = 'application/x-yaml';
        let yamlObject: any = null;
        if (rawJson.trim()) {
          try {
            yamlObject = JSON.parse(rawJson);
          } catch (e) { /* ignore */ }
        }
        if (!yamlObject && selectedOutputFormat === 'json' && formattedJson) {
          try {
            yamlObject = JSON.parse(formattedJson);
          } catch (e) { /* ignore */ }
        }
        if (yamlObject) {
          try {
            contentToSave = ExportFormatConverter.toYAML(yamlObject);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            alert("Failed to convert to YAML: " + e.message);
            return;
          }
        } else {
          alert("Cannot convert to YAML. Input data is not valid JSON.");
          return;
        }
        break;
      case 'csv':
        filename += '.csv';
        mimeType = 'text/csv';
        let csvObject: any = null;
        if (rawJson.trim()) {
          try {
            csvObject = JSON.parse(rawJson);
          } catch (e) { /* ignore */ }
        }
        if (!csvObject && selectedOutputFormat === 'json' && formattedJson) {
          try {
            csvObject = JSON.parse(formattedJson);
          } catch (e) { /* ignore */ }
        }
        if (csvObject) {
          try {
            contentToSave = ExportFormatConverter.toCSV(csvObject);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            alert("Failed to convert to CSV: " + e.message);
            return;
          }
        } else {
          alert("Cannot convert to CSV. Input data is not valid JSON.");
          return;
        }
        break;
      case 'toml':
        filename += '.toml';
        mimeType = 'application/toml';
        let tomlObject: any = null;
        if (rawJson.trim()) {
          try {
            tomlObject = JSON.parse(rawJson);
          } catch (e) { /* ignore */ }
        }
        if (!tomlObject && selectedOutputFormat === 'json' && formattedJson) {
          try {
            tomlObject = JSON.parse(formattedJson);
          } catch (e) { /* ignore */ }
        }
        if (tomlObject) {
          try {
            contentToSave = ExportFormatConverter.toTOML(tomlObject);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            alert("Failed to convert to TOML: " + e.message);
            return;
          }
        } else {
          alert("Cannot convert to TOML. Input data is not valid JSON.");
          return;
        }
        break;
      case 'md':
        filename += '.md';
        mimeType = 'text/markdown';
        let mdObject: any = null;
        if (rawJson.trim()) {
          try {
            mdObject = JSON.parse(rawJson);
          } catch (e) { /* ignore */ }
        }
        if (!mdObject && selectedOutputFormat === 'json' && formattedJson) {
          try {
            mdObject = JSON.parse(formattedJson);
          } catch (e) { /* ignore */ }
        }
        if (mdObject) {
          try {
            contentToSave = ExportFormatConverter.toMarkdownTable(mdObject);
            isContentPotentiallyEmpty = false;
          } catch (e) {
            alert("Failed to convert to Markdown table: " + e.message);
            return;
          }
        } else {
          alert("Cannot convert to Markdown table. Input data is not valid JSON.");
          return;
        }
        break;
    }

    if (isContentPotentiallyEmpty && !contentToSave.trim() && (format === 'txt' || (format === 'py' && selectedOutputFormat !== 'python') )) {
        alert("No output to save.");
        return;
    }
    
    triggerDownload(contentToSave, filename, mimeType);
  }, [formattedJson, selectedOutputFormat, rawJson]);

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
                  className="mr-2"
                  forceVisible={showSearch}
                  onVisibilityChange={setShowSearch}
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
              <Button onClick={() => forceProcessJson(rawJson, selectedOutputFormat)} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading} className="w-full">
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
                <Button onClick={handleCompact} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || isAiLoading || !formattedJson} title="Compact/Minify JSON">
                  <CompressIcon className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={handleCopyOutput} 
                  variant="secondary" 
                  ringOffsetClass="focus:ring-offset-slate-700/30" 
                  size="sm" 
                  disabled={!formattedJson || isLoading || isAiLoading} 
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
                      {(['txt', 'json', 'py', 'xml', 'yaml', 'csv', 'toml', 'md'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => handleSaveOutput(fmt)}
                          className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                            theme === 'dark'
                              ? 'text-slate-200 hover:bg-slate-500/50'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          disabled={isLoading || !canSave}
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
          {!isLoading && !isAiLoading && !error && formattedJson && (
            <>
              <JsonOutput 
                data={formattedJson} 
                className={`flex-grow w-full h-full ${textAreaMinHeight}`}
                aiChanges={aiChanges}
                showAiHighlights={showAiHighlights}
                isTextWrapped={isTextWrapped}
                searchMatches={searchMatches}
              />
              <div className="p-3 border-t border-slate-600/50">
                <JsonStats 
                  originalText={rawJson}
                  formattedText={formattedJson}
                />
              </div>
            </>
          )}
          {!isLoading && !isAiLoading && !error && !formattedJson && (
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
