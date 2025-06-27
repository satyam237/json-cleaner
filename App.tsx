import React, { useState, useCallback, useEffect, useRef } from 'react';

// Declare gtag for Google Analytics
declare global {
  function gtag(...args: any[]): void;
}
import { JsonInput } from './components/JsonInput';
import { JsonOutput } from './components/JsonOutput';
import { Button } from './components/Button';
import { Alert } from './components/Alert';
import { JsonStats } from './components/JsonStats';
import { Logo } from './components/Logo';

import { useJsonProcessor, OutputFormat, formatJsObjectToPythonString, AiChange } from './hooks/useJsonProcessor';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AiLoadingIndicator } from './components/AiLoadingIndicator';
import { SparklesIcon, CogIcon, ClipboardDocumentIcon, XCircleIcon, ArrowUpTrayIcon, DocumentArrowDownIcon, WrapTextIcon, UnwrapTextIcon } from './constants';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For the frontend, we'll assume AI features *could* be active if this flag is true.
  // The actual check for API_KEY now happens on the backend.
  // This could be set based on a config or just be true to always show AI buttons.
  const aiFeaturesPotentiallyEnabled = true; 

  const {
    formattedJson,
    error,
    isLoading,
    isAiLoading,
    processJson,
    tryLocalFix,
    tryAiFix,
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

  const handleSaveOutput = useCallback((format: 'txt' | 'json' | 'py' | 'xml') => {
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
    }

    if (isContentPotentiallyEmpty && !contentToSave.trim() && (format === 'txt' || (format === 'py' && selectedOutputFormat !== 'python') )) {
        alert("No output to save.");
        return;
    }
    
    triggerDownload(contentToSave, filename, mimeType);
  }, [formattedJson, selectedOutputFormat, rawJson]);

  const textAreaMinHeight = "min-h-[300px] md:min-h-[calc(100vh-420px)]";
  const canSave = !!(rawJson.trim() || formattedJson.trim());



  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 flex flex-col p-4 md:p-6 relative z-0">
      <header className="mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 flex items-center gap-3">
          <Logo size={40} className="flex-shrink-0" />
          AIjsonformatter
        </h1>
      </header>

      <main role="main" className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50">
          <div className="flex flex-col p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-slate-100">Input JSON / Python-like</h2>
              <div className="flex items-center space-x-2">
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
          />
        </div>

        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50 relative">
          {/* AI Loading Indicator - Fixed at top center of output box */}
          {isAiLoading && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-30">
              <div className="bg-slate-700/95 backdrop-blur-md rounded-lg px-4 py-2 shadow-xl border border-slate-600/60">
                <AiLoadingIndicator />
              </div>
            </div>
          )}
          
          <div className="p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-slate-100">Formatted Output</h2>
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
                    <div className="absolute right-0 mt-2 w-40 bg-slate-600/80 backdrop-blur-md border border-slate-500/50 rounded-md shadow-lg py-1 z-10">
                      {(['txt', 'json', 'py', 'xml'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => handleSaveOutput(fmt)}
                          className="block w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-500/50 transition-colors"
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
                <span className="text-sm text-slate-300">Format as:</span>
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
                    <span className="text-sm text-slate-200">
                      {format === 'json' ? 'Standard JSON' : 'Python dict/list'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {isLoading && !isAiLoading && (
            <div className="flex-grow flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
          {!isLoading && error && (
            <div className="p-4">
              <Alert type={error.isAiError ? "warning" : "error"} title={error.title}>
                {error.message}
                {error.suggestion && <p className="mt-2 text-sm text-yellow-300">{error.suggestion}</p>}
              </Alert>
            </div>
          )}
          {!isLoading && !error && formattedJson && (
            <>
              <JsonOutput 
                data={formattedJson} 
                className={`flex-grow w-full h-full ${textAreaMinHeight}`}
                aiChanges={aiChanges}
                showAiHighlights={showAiHighlights}
                isTextWrapped={isTextWrapped}
              />
              <div className="p-3 border-t border-slate-600/50">
                <JsonStats 
                  originalText={rawJson}
                  formattedText={formattedJson}
                />
              </div>
            </>
          )}
          {!isLoading && !error && !formattedJson && (
             <div className={`flex-grow flex items-center justify-center text-slate-400 ${textAreaMinHeight}`}>
                <p>{rawJson.trim() ? "Output will appear here once processed." : "Output will appear here."}</p>
             </div>
          )}
        </div>
      </main>

      <section className="mt-8 mb-4 text-slate-300" aria-labelledby="features-heading">
        <h3 id="features-heading" className="text-lg font-semibold text-center mb-3 text-slate-100">Free Online JSON Formatter & Validator Features</h3>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 max-w-3xl mx-auto">
          <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><CogIcon className="w-4 h-4 mr-2 text-slate-400"/>JSON Basic Clean</h4>
            <p className="text-xs text-slate-400">Instant JSON formatter and validator with local fixes for common syntax issues like Python's True/False/None, missing quotes around keys, single-quoted strings, and trailing commas. Fast and offline JSON cleaning.</p>
          </div>
          {aiFeaturesPotentiallyEnabled && (
            <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
              <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><SparklesIcon className="w-4 h-4 mr-2 text-indigo-400"/>AI JSON Cleaner</h4>
              <p className="text-xs text-slate-400">Advanced AI-powered JSON error correction for complex malformed data. Automatically format JSON, validate syntax, and convert between JSON and Python dictionary formats with intelligent error detection.</p>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center max-w-4xl mx-auto">
          <h4 className="text-md font-medium text-slate-200 mb-2">Why Choose Our JSON Formatter Tool?</h4>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Format JSON online instantly with our free JSON beautifier and validator. Clean malformed JSON data, validate JSON syntax, and convert between JSON and Python formats. 
            Perfect JSON tool for developers, data analysts, and anyone working with JSON files. No signup required - start formatting JSON now!
          </p>
          



        </div>
      </section>

      <footer className="mt-8 pt-4 border-t border-slate-700/50 text-center text-sm text-slate-400">
        <div className="mb-4">
          <p className="text-sm text-slate-300 mb-1">
            <strong>AIjsonformatter</strong> - Free Online JSON Formatter, Validator & Cleaner
          </p>
          <p className="text-xs text-slate-400">
            Format JSON • Validate JSON • Clean JSON • Beautify JSON • Python to JSON Converter
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
