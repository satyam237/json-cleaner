import * as yaml from 'js-yaml';

export class ExportFormatConverter {
  
  static toYAML(jsonData: any): string {
    try {
      return yaml.dump(jsonData, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });
    } catch (error) {
      throw new Error(`Failed to convert to YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static toCSV(jsonData: any): string {
    if (!Array.isArray(jsonData)) {
      throw new Error('CSV export requires an array of objects');
    }
    
    if (jsonData.length === 0) {
      return '';
    }

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    jsonData.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);
    const csvRows = [headers.join(',')];

    jsonData.forEach(item => {
      const row = headers.map(header => {
        let value = item?.[header] ?? '';
        
        // Handle complex values
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        // Escape quotes and wrap in quotes if contains comma
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
        
        return value;
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  static toTOML(jsonData: any): string {
    // Simple TOML converter for basic objects
    const convertValue = (value: any, indent = ''): string => {
      if (value === null) return 'null';
      if (typeof value === 'boolean') return value.toString();
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
      if (Array.isArray(value)) {
        const items = value.map(v => convertValue(v, indent)).join(', ');
        return `[${items}]`;
      }
      if (typeof value === 'object') {
        // For nested objects, create sections
        return Object.entries(value)
          .map(([key, val]) => `${indent}${key} = ${convertValue(val, indent)}`)
          .join('\n');
      }
      return String(value);
    };

    if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
      return Object.entries(jsonData)
        .map(([key, value]) => `${key} = ${convertValue(value)}`)
        .join('\n');
    }
    
    throw new Error('TOML export requires a top-level object');
  }

  static toMarkdownTable(jsonData: any): string {
    if (!Array.isArray(jsonData)) {
      throw new Error('Markdown table export requires an array of objects');
    }

    if (jsonData.length === 0) {
      return '| (no data) |\n|-----------|';
    }

    // Get headers
    const allKeys = new Set<string>();
    jsonData.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

    const dataRows = jsonData.map(item => {
      const values = headers.map(header => {
        let value = item?.[header] ?? '';
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        return String(value).replace(/\|/g, '\\|');
      });
      return `| ${values.join(' | ')} |`;
    });

    return [headerRow, separatorRow, ...dataRows].join('\n');
  }
} 