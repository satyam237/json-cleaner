export interface CollapsibleSection {
  startLine: number;
  endLine: number;
  type: 'object' | 'array';
  level: number;
  isCollapsed: boolean;
}

export interface LineInfo {
  lineNumber: number;
  content: string;
  hasCollapsibleStart?: boolean;
  hasCollapsibleEnd?: boolean;
  sectionType?: 'object' | 'array';
  indentLevel: number;
  isVisible: boolean;
}

export function parseJsonStructure(jsonString: string): {
  lines: LineInfo[];
  sections: CollapsibleSection[];
} {
  const lines = jsonString.split('\n');
  const lineInfos: LineInfo[] = [];
  const sections: CollapsibleSection[] = [];
  const stack: { type: 'object' | 'array'; startLine: number; level: number }[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const indentLevel = line.length - line.trimStart().length;
    
    const lineInfo: LineInfo = {
      lineNumber: index,
      content: line,
      indentLevel,
      isVisible: true
    };

    // Parse character by character to handle both JSON and Python-like structures
    let inString = false;
    let escapeNext = false;
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    let stringDelimiter = '';

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      // Handle both single and double quotes (for Python compatibility)
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringDelimiter = char;
        continue;
      } else if (char === stringDelimiter && inString) {
        inString = false;
        stringDelimiter = '';
        continue;
      }
      
      if (inString) {
        continue; // Skip everything inside strings
      }
      
      if (char === '{') {
        openBraces++;
      } else if (char === '}') {
        closeBraces++;
      } else if (char === '[') {
        openBrackets++;
      } else if (char === ']') {
        closeBrackets++;
      }
    }

    // Determine if this line starts a collapsible section
    if (openBraces > closeBraces) {
      lineInfo.hasCollapsibleStart = true;
      lineInfo.sectionType = 'object';
      stack.push({ type: 'object', startLine: index, level: indentLevel });
    } else if (openBrackets > closeBrackets) {
      lineInfo.hasCollapsibleStart = true;
      lineInfo.sectionType = 'array';
      stack.push({ type: 'array', startLine: index, level: indentLevel });
    }

    // Check for closing braces/brackets
    const netCloseBraces = closeBraces - openBraces;
    const netCloseBrackets = closeBrackets - openBrackets;
    
    for (let i = 0; i < netCloseBraces && stack.length > 0; i++) {
      const lastOpen = stack[stack.length - 1];
      if (lastOpen?.type === 'object') {
        stack.pop();
        lineInfo.hasCollapsibleEnd = true;
        
        // Only create section if it spans multiple lines
        if (lastOpen.startLine < index) {
          sections.push({
            startLine: lastOpen.startLine,
            endLine: index,
            type: lastOpen.type,
            level: lastOpen.level,
            isCollapsed: false
          });
        }
      }
    }
    
    for (let i = 0; i < netCloseBrackets && stack.length > 0; i++) {
      const lastOpen = stack[stack.length - 1];
      if (lastOpen?.type === 'array') {
        stack.pop();
        lineInfo.hasCollapsibleEnd = true;
        
        // Only create section if it spans multiple lines
        if (lastOpen.startLine < index) {
          sections.push({
            startLine: lastOpen.startLine,
            endLine: index,
            type: lastOpen.type,
            level: lastOpen.level,
            isCollapsed: false
          });
        }
      }
    }

    lineInfos.push(lineInfo);
  });

  return { lines: lineInfos, sections };
}

export function toggleSection(
  sections: CollapsibleSection[], 
  sectionIndex: number
): CollapsibleSection[] {
  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    return sections; // Safety check
  }
  
  return sections.map((section, index) => 
    index === sectionIndex 
      ? { ...section, isCollapsed: !section.isCollapsed }
      : section
  );
}

export function getVisibleLines(
  lines: LineInfo[], 
  sections: CollapsibleSection[]
): LineInfo[] {
  const collapsedRanges = sections
    .filter(section => section.isCollapsed)
    .map(section => ({ start: section.startLine + 1, end: section.endLine - 1 }));

  return lines.map((line, index) => {
    const isHidden = collapsedRanges.some(range => 
      index >= range.start && index <= range.end
    );
    
    return { ...line, isVisible: !isHidden };
  });
}

export function getCollapsedContent(jsonString: string, sections: CollapsibleSection[]): string {
  if (!jsonString || !sections.some(s => s.isCollapsed)) {
    return jsonString;
  }

  const lines = jsonString.split('\n');
  const result: string[] = [];
  
  const collapsedSections = sections
    .filter(section => section.isCollapsed)
    .sort((a, b) => a.startLine - b.startLine);

  let currentIndex = 0;
  
  for (const section of collapsedSections) {
    // Add lines before this collapsed section
    while (currentIndex < section.startLine) {
      result.push(lines[currentIndex]);
      currentIndex++;
    }
    
    // Add the opening line with collapsed indicator
    const openingLine = lines[section.startLine];
    if (!openingLine) continue; // Safety check
    
    const indicator = section.type === 'object' ? '{ ... }' : '[ ... ]';
    
    // Replace the first occurrence of opening brace/bracket with collapsed indicator
    let collapsedLine = openingLine;
    if (section.type === 'object') {
      collapsedLine = openingLine.replace('{', indicator);
    } else {
      collapsedLine = openingLine.replace('[', indicator);
    }
    
    result.push(collapsedLine);
    currentIndex = section.endLine + 1;
  }
  
  // Add remaining lines
  while (currentIndex < lines.length) {
    result.push(lines[currentIndex]);
    currentIndex++;
  }
  
  return result.join('\n');
} 