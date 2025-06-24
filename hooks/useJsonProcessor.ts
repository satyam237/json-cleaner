import { useState, useCallback } from 'react';
import { JsonProcessingError } from '../types';
// import { GEMINI_MODEL_NAME } from '../constants'; // Backend will use this
// import { GoogleGenAI, GenerateContentResponse } from "@google/genai"; // Backend will use this

export type OutputFormat = 'json' | 'python';

export interface AiChange {
  line: number;
  type: 'added' | 'modified' | 'removed';
  content: string;
}

// Ultra-simple diff: only highlight if actual content was added/changed (ignoring all formatting)
function calculateChanges(original: string, modified: string): AiChange[] {
  // Remove ALL whitespace to compare pure content
  const cleanOriginal = original.replace(/\s+/g, '');
  const cleanModified = modified.replace(/\s+/g, '');
  
  // If the content is identical after removing formatting, no changes to highlight
  if (cleanOriginal === cleanModified) {
    return [];
  }
  
  // Find what content was actually added to the modified version
  const changes: AiChange[] = [];
  const modifiedLines = modified.split('\n');
  
  // Look for completely new content that wasn't in the original at all
  for (let lineIndex = 0; lineIndex < modifiedLines.length; lineIndex++) {
    const line = modifiedLines[lineIndex];
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Check if this line contains content that's completely new
    // We'll remove the formatting and see if the core content exists in original
    const lineContent = trimmedLine.replace(/\s+/g, '');
    
    // If this line's content doesn't exist anywhere in the original, it's new
    if (lineContent && !cleanOriginal.includes(lineContent)) {
      changes.push({ line: lineIndex, type: 'added', content: line });
    }
  }
  
  return changes;
}

export function formatJsObjectToPythonString(obj: any, indentLevel = 0, indentUnit = "  "): string {
  const currentIndent = indentUnit.repeat(indentLevel);
  const nextIndent = indentUnit.repeat(indentLevel + 1);

  if (obj === null) return 'None';
  if (typeof obj === 'boolean') return obj ? 'True' : 'False';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const allSimple = obj.every(item => ['number', 'string', 'boolean'].includes(typeof item) || item === null);
    if (allSimple && obj.map(item => formatJsObjectToPythonString(item, 0, "")).join(', ').length < 60) {
        return `[${obj.map(item => formatJsObjectToPythonString(item, 0, "")).join(', ')}]`;
    }
    const items = obj.map(item => `${nextIndent}${formatJsObjectToPythonString(item, indentLevel + 1, indentUnit)}`);
    return `[\n${items.join(',\n')}\n${currentIndent}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const entries = keys.map(key => {
      const formattedKey = `"${key.replace(/"/g, '\\"')}"`;
      return `${nextIndent}${formattedKey}: ${formatJsObjectToPythonString(obj[key], indentLevel + 1, indentUnit)}`;
    });
    return `{\n${entries.join(',\n')}\n${currentIndent}}`;
  }
  return String(obj); 
}


export const useJsonProcessor = () => {
  const [formattedJson, setFormattedJson] = useState<string>('');
  const [error, setError] = useState<JsonProcessingError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  
  const [lastValidParsedJsonObject, setLastValidParsedJsonObject] = useState<any | null>(null);
  const [formatOfCurrentOutput, setFormatOfCurrentOutput] = useState<OutputFormat | null>(null);
  const [rawJsonWasSourceOfLVPJO, setRawJsonWasSourceOfLVPJO] = useState<boolean>(false);
  
  const [lastAiInputForPython, setLastAiInputForPython] = useState<string | null>(null);
  const [pendingAiConversionToJSON, setPendingAiConversionToJSON] = useState<boolean>(false);
  
  // AI highlights state
  const [aiChanges, setAiChanges] = useState<AiChange[]>([]);
  const [showAiHighlights, setShowAiHighlights] = useState<boolean>(false);
  const [originalTextBeforeAi, setOriginalTextBeforeAi] = useState<string>('');

  // Define clearAiHighlights early so it can be used in dependency arrays
  const clearAiHighlights = useCallback(() => {
    setAiChanges([]);
    setShowAiHighlights(false);
    setOriginalTextBeforeAi('');
  }, []);

  const processJson = useCallback((jsonString: string, targetOutputFormat: OutputFormat) => {
    setIsLoading(true);
    setError(null);
    setPendingAiConversionToJSON(false);

    if (lastValidParsedJsonObject &&
        (targetOutputFormat !== formatOfCurrentOutput ||
         (targetOutputFormat === formatOfCurrentOutput && !rawJsonWasSourceOfLVPJO)
        )
       ) {
      if (targetOutputFormat === 'json') {
        setFormattedJson(JSON.stringify(lastValidParsedJsonObject, null, 2));
      } else { 
        setFormattedJson(formatJsObjectToPythonString(lastValidParsedJsonObject));
      }
      setFormatOfCurrentOutput(targetOutputFormat);
      setIsLoading(false);
      return;
    }
  
    // Clear AI highlights when processing new input (not just format change)
    clearAiHighlights();

    setFormattedJson(''); 
    if (!jsonString.trim()) {
      setLastValidParsedJsonObject(null);
      setRawJsonWasSourceOfLVPJO(false);
      setFormatOfCurrentOutput(null); 
      setLastAiInputForPython(null); 
      setIsLoading(false);
      return;
    }
  
    try {
      const parsed = JSON.parse(jsonString);
      setLastValidParsedJsonObject(parsed); 
      setRawJsonWasSourceOfLVPJO(true); 
      if (targetOutputFormat === 'json') {
        setFormattedJson(JSON.stringify(parsed, null, 2));
      } else { 
        setFormattedJson(formatJsObjectToPythonString(parsed));
      }
      setFormatOfCurrentOutput(targetOutputFormat);
      setLastAiInputForPython(null); 
    } catch (parseError: any) {
      setLastValidParsedJsonObject(null); 
      setRawJsonWasSourceOfLVPJO(false);
      setFormatOfCurrentOutput(null);

      if (
        lastAiInputForPython === jsonString && 
        targetOutputFormat === 'json'          
      ) {
        setPendingAiConversionToJSON(true);
        return; 
      } else {
        setError({
          title: "Invalid JSON Structure",
          message: (parseError as Error).message || "Could not parse input as valid JSON.",
          suggestion: "Ensure your input is valid JSON. 'Basic Clean' can help. If AI previously generated Python, and you switch to JSON, it will try to use AI again.",
        });
      }
    } finally {
      if (!pendingAiConversionToJSON) {
        setIsLoading(false);
      }
    }
  }, [lastValidParsedJsonObject, formatOfCurrentOutput, lastAiInputForPython, rawJsonWasSourceOfLVPJO, clearAiHighlights]);

  const clearPendingAiConversion = useCallback(() => {
    setPendingAiConversionToJSON(false);
  }, []);

  const forceProcessJson = useCallback((jsonString: string, targetOutputFormat: OutputFormat) => {
    // Clear cached state to force fresh processing
    setLastValidParsedJsonObject(null);
    setRawJsonWasSourceOfLVPJO(false);
    setFormatOfCurrentOutput(null);
    setLastAiInputForPython(null);
    
    // Clear AI highlights
    clearAiHighlights();
    
    // Now process with fresh state
    processJson(jsonString, targetOutputFormat);
  }, [processJson, clearAiHighlights]);

  const tryLocalFix = useCallback(async (jsonString: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setPendingAiConversionToJSON(false);
    setLastAiInputForPython(null); 
    setRawJsonWasSourceOfLVPJO(false);
    
    // Clear AI highlights since we're doing local cleaning
    clearAiHighlights();

    let cleaned = jsonString;
    cleaned = cleaned.replace(/\bTrue\b/g, 'true');
    cleaned = cleaned.replace(/\bFalse\b/g, 'false');
    cleaned = cleaned.replace(/\bNone\b/g, 'null');

    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][\w\s-]*?)(\s*:)/g, (match, p1, p2, p3) => {
        if (!p2.startsWith('"') && !p2.startsWith("'")) {
            return `${p1}"${p2}"${p3}`;
        }
        return match; 
    });
    cleaned = cleaned.replace(/'((?:\\.|[^'\\])*)'/g, (match, group1) => {
        return `"${group1.replace(/"/g, '\\"')}"`;
    });

    cleaned = cleaned.replace(/,\s*\]/g, ']');
    cleaned = cleaned.replace(/,\s*\}/g, '}');
    
    setIsLoading(false); 
    return cleaned;
  }, [clearAiHighlights]);

  const tryAiFix = useCallback(async (jsonString: string, outputFormat: OutputFormat): Promise<string | null> => {
    setIsAiLoading(true);
    setError(null);
    setFormattedJson('');
    setPendingAiConversionToJSON(false);
    
    // Store original text for highlighting changes - but we'll calculate diff against expected output
    setOriginalTextBeforeAi(jsonString);

    try {
      const proxyResponse = await fetch('/api/gemini-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonString: jsonString,
          targetOutputFormat: outputFormat,
        }),
      });

      const aiResult = await proxyResponse.json();

      if (!proxyResponse.ok) {
        // Use error structure from backend if available, otherwise generic message
        const errorTitle = aiResult.title || "AI Service Error";
        const errorMessage = aiResult.error || `Request to AI service failed with status ${proxyResponse.status}.`;
        const errorSuggestion = aiResult.suggestion || "Please check the server logs or try again later.";
        setError({
            title: errorTitle,
            message: errorMessage,
            suggestion: errorSuggestion,
            isAiError: true,
        });
        setLastValidParsedJsonObject(null);
        setRawJsonWasSourceOfLVPJO(false);
        setFormatOfCurrentOutput(null);
        setLastAiInputForPython(null);
        clearAiHighlights();
        return null; // Indicate failure
      }


      if (aiResult.correctedText) {
        setFormattedJson(aiResult.correctedText);
        setFormatOfCurrentOutput(outputFormat); 
        
        // Calculate changes by comparing original input vs AI output directly
        const changes = calculateChanges(jsonString, aiResult.correctedText);
        setAiChanges(changes);
        setShowAiHighlights(changes.length > 0);
        
        if (outputFormat === 'json') {
          try {
            const parsedAiJson = JSON.parse(aiResult.correctedText);
            setLastValidParsedJsonObject(parsedAiJson);
            setRawJsonWasSourceOfLVPJO(false); 
            setLastAiInputForPython(null); 
            setError(null); 
          } catch (e) {
            setLastValidParsedJsonObject(null); 
            setRawJsonWasSourceOfLVPJO(false);
            setLastAiInputForPython(null);
            setError({
              title: "AI Response Error",
              message: "AI claimed to return JSON, but it was not parsable. Output shown is AI's raw response.",
              suggestion: "This might be a temporary issue with the AI. You can try 'AI Clean' again.",
              isAiError: true,
            });
          }
        } else { 
          setLastValidParsedJsonObject(null); 
          setRawJsonWasSourceOfLVPJO(false);
          setLastAiInputForPython(jsonString); 
          setError(null);
        }
        return aiResult.correctedText;
      } else if (aiResult.error) {
        setLastValidParsedJsonObject(null);
        setRawJsonWasSourceOfLVPJO(false);
        setFormatOfCurrentOutput(null);
        setLastAiInputForPython(null);
        clearAiHighlights();
        setError({
          title: aiResult.title || `AI Could Not Process Input for ${outputFormat.toUpperCase()} Format`,
          message: aiResult.error,
          suggestion: aiResult.suggestion || "Try modifying the input or using 'Basic Clean' first if applicable.",
          isAiError: true,
        });
      } else {
        setLastValidParsedJsonObject(null);
        setRawJsonWasSourceOfLVPJO(false);
        setFormatOfCurrentOutput(null);
        setLastAiInputForPython(null);
        clearAiHighlights();
        throw new Error("Unexpected response structure from AI proxy. Expected 'correctedText' or 'error' key.");
      }
    } catch (e: any) {
      console.error("AI Fix Error (calling proxy):", e);
      setLastValidParsedJsonObject(null);
      setRawJsonWasSourceOfLVPJO(false);
      setFormatOfCurrentOutput(null);
      setLastAiInputForPython(null);
      clearAiHighlights();
      setError({
        title: "AI Fix Failed",
        message: e.message || "An error occurred while communicating with the AI service proxy.",
        suggestion: "Ensure the backend proxy is running and configured correctly.",
        isAiError: true,
      });
    } finally {
        setIsAiLoading(false);
    }
    return null;
  }, [clearAiHighlights]);

  return { 
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
    originalTextBeforeAi
  };
};
