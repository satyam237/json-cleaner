import React, { useState, useCallback, useEffect, useRef } from 'react';
import { JsonInput } from './components/JsonInput';
import { JsonOutput } from './components/JsonOutput';
import { Button } from './components/Button';
import { Alert } from './components/Alert';
import { useJsonProcessor, OutputFormat, formatJsObjectToPythonString, AiChange } from './hooks/useJsonProcessor';
import { LoadingSpinner } from './components/LoadingSpinner';
import { GithubIcon, SparklesIcon, CogIcon, ClipboardDocumentIcon, XCircleIcon, ArrowUpTrayIcon, DocumentArrowDownIcon } from './constants';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For the frontend, we'll assume AI features *could* be active if this flag is true.
  // The actual check for API_KEY now happens on the backend.
  // This could be set based on a config or just be true to always show AI buttons.
  const aiFeaturesPotentiallyEnabled = true; 

  const {
    formattedJson,
    error,
    isLoading,
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

  useEffect(() => {
    const handler = setTimeout(() => {
      if (rawJson.trim() === '') {
        processJson('', selectedOutputFormat);
      } else {
        processJson(rawJson, selectedOutputFormat);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [rawJson, processJson, selectedOutputFormat]);

  // Simplified format switching - always process when format changes
  useEffect(() => {
    processJson(rawJson, selectedOutputFormat);
  }, [selectedOutputFormat, processJson]);

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
      } catch (err) {
        console.error('Failed to copy output: ', err);
        alert('Failed to copy output to clipboard.');
      }
    }
  }, [formattedJson]);

  const handleClear = useCallback(() => {
    setRawJson('');
    processJson('', selectedOutputFormat); 
  }, [processJson, selectedOutputFormat]);

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

  const handleSaveOutput = (format: 'txt' | 'json' | 'py' | 'xml') => {
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
  };

  const textAreaMinHeight = "min-h-[300px] md:min-h-[calc(100vh-420px)]";
  const canSave = !!(rawJson.trim() || formattedJson.trim());

  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 flex flex-col p-4 md:p-6 relative z-0">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300">
          JSON Buddy
        </h1>
        <a
          href="https://github.com/google/ai-on-device" // Or your specific repo: https://www.github.com/satyam237/
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title="View Project on GitHub"
          aria-label="View Project on GitHub"
        >
          <GithubIcon className="w-7 h-7" />
        </a>
      </header>

      <main role="main" className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50">
          <div className="flex flex-col p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-slate-100">Input JSON / Python-like</h2>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleUploadFileClick}
                  variant="secondary"
                  size="sm"
                  ringOffsetClass="focus:ring-offset-slate-700/30"
                  disabled={isLoading}
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
                  disabled={isLoading || (!rawJson.trim() && !formattedJson.trim() && !error)}
                  aria-label="Clear input and output"
                  title="Clear input & output"
                >
                  <XCircleIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex space-x-3 items-start">
              <Button onClick={() => forceProcessJson(rawJson, selectedOutputFormat)} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading} className="w-full">
                View
              </Button>
              <Button onClick={handleLocalFix} variant="secondary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || !rawJson.trim()} className="w-full">
                <CogIcon className="w-4 h-4 mr-1.5" /> Basic Clean
              </Button>
              {aiFeaturesPotentiallyEnabled && (
                <Button onClick={handleAiFix} variant="primary" ringOffsetClass="focus:ring-offset-slate-700/30" size="sm" disabled={isLoading || !rawJson.trim()} className="w-full">
                  <SparklesIcon className="w-4 h-4 mr-1.5" /> AI Clean
                </Button>
              )}
            </div>
            {showAiHighlights && aiChanges.length > 0 && (
              <div className="mt-2 p-2 bg-slate-600/30 rounded text-xs text-slate-300">
                <span className="font-medium">AI Changes:</span>
                <span className="ml-2 inline-flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded mr-1"></span>Added
                </span>
                <span className="ml-2 inline-flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded mr-1"></span>Modified
                </span>
                <span className="ml-2 inline-flex items-center">
                  <span className="w-2 h-2 bg-red-400 rounded mr-1"></span>Removed
                </span>
                <span className="ml-3 text-slate-400">(lines with actual content changes)</span>
              </div>
            )}
          </div>
          <JsonInput
            value={rawJson}
            onChange={handleInputChange}
            placeholder="Paste your JSON for formatting, validation, or to check JSON online..."
            hasError={!!error}
            className={`flex-grow w-full h-full ${textAreaMinHeight}`}
            onClearHighlights={clearAiHighlights}
          />
        </div>

        <div className="flex flex-col bg-slate-700/30 backdrop-blur-lg shadow-xl rounded-lg p-1 border border-slate-600/50">
          <div className="p-3 border-b border-slate-600/50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-slate-100">Formatted Output</h2>
              <div className="flex items-center space-x-2">
                {showCopiedMessage && <span className="text-xs text-green-400 mr-1 animate-pulse">Copied!</span>}
                <Button 
                  onClick={handleCopyOutput} 
                  variant="secondary" 
                  ringOffsetClass="focus:ring-offset-slate-700/30" 
                  size="sm" 
                  disabled={!formattedJson || isLoading} 
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

          {isLoading && <div className="flex-grow flex items-center justify-center"><LoadingSpinner /></div>}
          {!isLoading && error && (
            <div className="p-4">
              <Alert type={error.isAiError ? "warning" : "error"} title={error.title}>
                {error.message}
                {error.suggestion && <p className="mt-2 text-sm text-yellow-300">{error.suggestion}</p>}
              </Alert>
            </div>
          )}
          {!isLoading && !error && formattedJson && (
            <JsonOutput 
              data={formattedJson} 
              className={`flex-grow w-full h-full ${textAreaMinHeight}`}
              aiChanges={aiChanges}
              showAiHighlights={showAiHighlights}
            />
          )}
          {!isLoading && !error && !formattedJson && (
             <div className={`flex-grow flex items-center justify-center text-slate-400 ${textAreaMinHeight}`}>
                <p>{rawJson.trim() ? "Output will appear here once processed." : "Output will appear here."}</p>
             </div>
          )}
        </div>
      </main>

      <div className="mt-8 mb-4 text-slate-300">
        <h3 className="text-lg font-semibold text-center mb-3 text-slate-100">About Cleaning Functions</h3>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 max-w-3xl mx-auto">
          <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><CogIcon className="w-4 h-4 mr-2 text-slate-400"/>Basic Clean</h4>
            <p className="text-xs text-slate-400">Local fixes for common syntax issues like Python's True/False/None, missing quotes around keys, single-quoted strings, and trailing commas. Fast and offline.</p>
          </div>
          {aiFeaturesPotentiallyEnabled && (
            <div className="bg-slate-700/20 backdrop-blur-md p-3 rounded-md shadow border border-slate-600/40">
              <h4 className="font-semibold text-slate-100 mb-1 flex items-center"><SparklesIcon className="w-4 h-4 mr-2 text-indigo-400"/>AI Clean</h4>
              <p className="text-xs text-slate-400">Advanced AI-powered correction for more complex errors and direct conversion to your selected output format (JSON or Python).</p>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-8 pt-4 border-t border-slate-700/50 text-center text-sm text-slate-400">
        <p className="text-xs text-slate-500">Powered by Google Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;
