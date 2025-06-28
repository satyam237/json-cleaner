import Ajv from 'ajv';

interface ValidationResult {
  isValid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
}

export class JsonSchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  validate(data: any, schema: object): ValidationResult {
    const validate = this.ajv.compile(schema);
    const isValid = validate(data);

    if (!isValid && validate.errors) {
      const errors = validate.errors.map(error => ({
        path: error.instancePath || 'root',
        message: error.message || 'Unknown error',
        value: error.data
      }));

      return { isValid: false, errors };
    }

    return { isValid: true };
  }

  // Common schema presets
  static getCommonSchemas() {
    return {
      basicObject: {
        type: 'object',
        properties: {},
        additionalProperties: true
      },
      array: {
        type: 'array',
        items: {}
      },
      strictObject: {
        type: 'object',
        additionalProperties: false,
        required: []
      }
    };
  }
} 