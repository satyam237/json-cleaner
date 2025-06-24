
import { useState, useCallback } from 'react';
import { JsonProcessingError } from '../types';
// import { GEMINI_MODEL_NAME } from '../constants'; // Backend will use this
// import { GoogleGenAI, GenerateContentResponse } from "@google/genai"; // Backend will use this

export type OutputFormat = 'json' | 'python';

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
  }, [lastValidParsedJsonObject, formatOfCurrentOutput, lastAiInputForPython, rawJsonWasSourceOfLVPJO]);

  const clearPendingAiConversion = useCallback(() => {
    setPendingAiConversionToJSON(false);
  }, []);

  const tryLocalFix = useCallback(async (jsonString: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setPendingAiConversionToJSON(false);
    setLastAiInputForPython(null); 
    setRawJsonWasSourceOfLVPJO(false); 

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
  }, []);

  const tryAiFix = useCallback(async (jsonString: string, outputFormat: OutputFormat): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    setFormattedJson('');
    setPendingAiConversionToJSON(false); 

    try {
      const proxyResponse = await fetch('/api/gemini-proxy', {
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
        return null; // Indicate failure
      }


      if (aiResult.correctedText) {
        setFormattedJson(aiResult.correctedText);
        setFormatOfCurrentOutput(outputFormat); 
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
        throw new Error("Unexpected response structure from AI proxy. Expected 'correctedText' or 'error' key.");
      }
    } catch (e: any) {
      console.error("AI Fix Error (calling proxy):", e);
      setLastValidParsedJsonObject(null);
      setRawJsonWasSourceOfLVPJO(false);
      setFormatOfCurrentOutput(null);
      setLastAiInputForPython(null);
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
  }, []); 

  return { 
    formattedJson, 
    error, 
    isLoading, 
    processJson, 
    tryLocalFix, 
    tryAiFix,
    pendingAiConversionToJSON,
    clearPendingAiConversion
  };
};
