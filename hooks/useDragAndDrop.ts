import { useState, useCallback, DragEvent } from 'react';

interface UseDragAndDropProps {
  onFileUpload: (content: string) => void;
  accept?: string[];
}

export const useDragAndDrop = ({ onFileUpload, accept = ['.json', '.txt', '.py'] }: UseDragAndDropProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (!file) return;

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (accept.length > 0 && !accept.includes(fileExtension)) {
      alert(`Please upload a file with one of these extensions: ${accept.join(', ')}`);
      return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size too large. Please upload a file smaller than 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onFileUpload(content);
    };
    reader.onerror = () => {
      alert('Error reading file.');
    };
    reader.readAsText(file);
  }, [onFileUpload, accept]);

  return {
    isDragOver,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}; 