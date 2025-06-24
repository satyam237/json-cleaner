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

// Smart diff function that ignores formatting and focuses on actual content changes
function calculateChanges(original: string, modified: string): AiChange[] {
  const changes: AiChange[] = [];
  
  // First, try to parse both as JSON to compare structure
  let originalParsed: any = null;
  let modifiedParsed: any = null;
  
  try {
    originalParsed = JSON.parse(original);
  } catch (e) {
    // If original can't be parsed, it means AI fixed structural issues
  }
  
  try {
    modifiedParsed = JSON.parse(modified);
  } catch (e) {
    // If modified can't be parsed, something went wrong
  }
  
  // If both can be parsed as JSON, compare the actual data structure
  if (originalParsed !== null && modifiedParsed !== null) {
    const originalStringified = JSON.stringify(originalParsed);
    const modifiedStringified = JSON.stringify(modifiedParsed);
    
    // If the underlying data is the same, no meaningful changes were made
    if (originalStringified === modifiedStringified) {
      return []; // No actual changes, just formatting
    }
    
    // If there are structural differences, we need a more sophisticated comparison
    // Parse both into normalized format and find differences at the content level
    return findStructuralDifferences(original, modified, originalParsed, modifiedParsed);
  }
  
  // If we can't parse both as JSON, fall back to line comparison
  return findLineDifferences(original, modified);
}

// Helper function to find structural differences in JSON
function findStructuralDifferences(original: string, modified: string, originalData: any, modifiedData: any): AiChange[] {
  const changes: AiChange[] = [];
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Extract meaningful content (keys, values) from each line
  const extractContent = (line: string): string => {
    // Remove whitespace and structural characters, keep only meaningful content
    return line.replace(/[\s{}\[\],]/g, '').replace(/^"|"$/g, '');
  };
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const modifiedLine = modifiedLines[i] || '';
    
    const originalContent = extractContent(originalLine);
    const modifiedContent = extractContent(modifiedLine);
    
    // Only flag as different if the actual content (not formatting) changed
    if (originalContent !== modifiedContent && (originalContent || modifiedContent)) {
      if (originalContent && modifiedContent) {
        changes.push({ line: i, type: 'modified', content: modifiedLine });
      } else if (modifiedContent) {
        changes.push({ line: i, type: 'added', content: modifiedLine });
      } else if (originalContent) {
        changes.push({ line: i, type: 'removed', content: originalLine });
      }
    }
  }
  
  return changes;
}

// Helper function for line-based differences when JSON parsing fails
function findLineDifferences(original: string, modified: string): AiChange[] {
  const changes: AiChange[] = [];
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Normalize lines by removing extra whitespace for comparison
  const normalizeForComparison = (line: string) => {
    return line.trim().replace(/\s+/g, ' ');
  };
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const modifiedLine = modifiedLines[i] || '';
    
    const normalizedOriginal = normalizeForComparison(originalLine);
    const normalizedModified = normalizeForComparison(modifiedLine);
    
    // Only flag as different if the normalized content is actually different
    if (normalizedOriginal !== normalizedModified) {
      if (normalizedOriginal && normalizedModified) {
        // Content was modified
        changes.push({ line: i, type: 'modified', content: modifiedLine });
      } else if (normalizedModified) {
        // Content was added
        changes.push({ line: i, type: 'added', content: modifiedLine });
      } else if (normalizedOriginal) {
        // Content was removed
        changes.push({ line: i, type: 'removed', content: originalLine });
      }
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
    setIsLoading(true);
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
        
        // Calculate changes between what normal processing would produce vs AI output
        let expectedOutput = '';
        let shouldCalculateChanges = true;
        
        try {
          // Try to parse the original input to see if it was valid JSON
          const parsed = JSON.parse(jsonString);
          
          // If original was valid JSON, check if AI made any structural changes
          let aiParsed: any = null;
          try {
            aiParsed = JSON.parse(aiResult.correctedText);
            
            // Compare the actual data structures
            const originalStringified = JSON.stringify(parsed);
            const aiStringified = JSON.stringify(aiParsed);
            
            if (originalStringified === aiStringified) {
              // No structural changes, just formatting - don't highlight
              shouldCalculateChanges = false;
            } else {
              // There are structural changes - compare against original input
              expectedOutput = jsonString;
            }
          } catch (e) {
            // AI output is not valid JSON - compare against original
            expectedOutput = jsonString;
          }
        } catch (e) {
          // Original input was invalid JSON - compare against cleaned version
          // This will show what AI fixed from the malformed input
          expectedOutput = jsonString;
        }
        
        if (shouldCalculateChanges) {
          const changes = calculateChanges(expectedOutput, aiResult.correctedText);
          setAiChanges(changes);
          setShowAiHighlights(changes.length > 0);
        } else {
          // No meaningful changes to highlight
          setAiChanges([]);
          setShowAiHighlights(false);
        }
        
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
        setIsLoading(false);
    }
    return null;
  }, [clearAiHighlights]);

  return { 
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
    originalTextBeforeAi
  };
};
