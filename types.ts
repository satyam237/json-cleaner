
export interface JsonProcessingError {
  title: string;
  message: string;
  suggestion?: string;
  isAiError?: boolean; // Indicates if the error is from AI processing itself
}
