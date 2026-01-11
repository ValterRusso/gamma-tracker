/**
 * ============================================================================
 * VALIDATION MIDDLEWARE
 * ============================================================================
 * 
 * Validação robusta de request body e query parameters
 * 
 * FEATURES:
 * - Type validation (string, number, boolean, object, array)
 * - Required fields
 * - Min/Max for numbers
 * - MinLength/MaxLength for strings
 * - Enum values
 * - Custom validators
 * - Array validation
 * - Nested object validation
 * - Type coercion for query params
 * 
 * USO:
 * router.post('/endpoint',
 *   validateBody({
 *     name: { type: 'string', required: true, minLength: 3 },
 *     age: { type: 'number', min: 18, max: 120 },
 *     role: { type: 'string', enum: ['admin', 'user'] }
 *   }),
 *   handler
 * );
 * 
 * router.get('/endpoint',
 *   validateQuery({
 *     limit: { type: 'number', min: 1, max: 100 },
 *     sort: { type: 'string', enum: ['asc', 'desc'] }
 *   }),
 *   handler
 * );
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

/**
 * Validate request body
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = validateObject(req.body, schema, 'body');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

function validateQueryParams(schema) {
  return (req, res, next) => {
    const errors = [];
    const validated = {};

    for (const [param, rules] of Object.entries(schema)) {
      let value = req.query[param];

      // Apply default if not provided
      if (value === undefined || value === null || value === '') {
        if (rules.default !== undefined) {
          validated[param] = rules.default;
          continue;
        }
        if (rules.required) {
          errors.push(`${param} is required`);
          continue;
        }
        continue;
      }

      // Type conversion and validation
      try {
        switch (rules.type) {
          case 'int':
            value = parseInt(value);
            if (isNaN(value)) {
              errors.push(`${param} must be an integer`);
              break;
            }
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${param} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${param} must be <= ${rules.max}`);
            }
            validated[param] = value;
            break;

          case 'float':
            value = parseFloat(value);
            if (isNaN(value)) {
              errors.push(`${param} must be a number`);
              break;
            }
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${param} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${param} must be <= ${rules.max}`);
            }
            validated[param] = value;
            break;

          case 'boolean':
            if (value === 'true' || value === '1') {
              validated[param] = true;
            } else if (value === 'false' || value === '0') {
              validated[param] = false;
            } else {
              errors.push(`${param} must be true or false`);
            }
            break;

          case 'enum':
            if (!rules.values.includes(value)) {
              errors.push(`${param} must be one of: ${rules.values.join(', ')}`);
            } else {
              validated[param] = value;
            }
            break;

          case 'string':
            validated[param] = String(value);
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${param} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${param} must be at most ${rules.maxLength} characters`);
            }
            break;

          case 'date':
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              errors.push(`${param} must be a valid date`);
            } else {
              validated[param] = date.toISOString();
            }
            break;

          default:
            validated[param] = value;
        }
      } catch (error) {
        errors.push(`${param} validation failed: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace req.query with validated values
    req.query = validated;
    next();
  };
}

/**
 * Validate query parameters
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    // Coerce query param types
    req.query = coerceQueryTypes(req.query, schema);
    
    // Apply defaults for undefined values
    for (const [field, rules] of Object.entries(schema)) {
      if ((req.query[field] === undefined || req.query[field] === null) && rules.default !== undefined) {
        req.query[field] = rules.default;
      }
    }
    
    const errors = validateObject(req.query, schema, 'query');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Validate params (URL parameters)
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const errors = validateObject(req.params, schema, 'params');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Validate object against schema
 * @private
 */
function validateObject(obj, schema, source = 'body') {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    const fieldErrors = validateField(field, value, rules, source);
    errors.push(...fieldErrors);
  }
  
  return errors;
}

/**
 * Validate single field
 * @private
 */
function validateField(field, value, rules, source) {
  const errors = [];
  const prefix = source ? `${source}.` : '';
  
  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${prefix}${field} is required`);
    return errors; // Stop validation if required field is missing
  }
  
  // Skip further validation if value is not present and not required
  if (value === undefined || value === null) {
    return errors;
  }
  
  // Type validation
  if (rules.type) {
    const typeError = validateType(field, value, rules.type, prefix);
    if (typeError) {
      errors.push(typeError);
      return errors; // Stop if type is wrong
    }
  }
  
  // Type-specific validations
  if (rules.type === 'number') {
    errors.push(...validateNumber(field, value, rules, prefix));
  }
  
  if (rules.type === 'string') {
    errors.push(...validateString(field, value, rules, prefix));
  }
  
  if (rules.type === 'array') {
    errors.push(...validateArray(field, value, rules, prefix));
  }
  
  if (rules.type === 'object') {
    errors.push(...validateNestedObject(field, value, rules, prefix));
  }
  
  // Enum validation
  if (rules.enum) {
    if (!rules.enum.includes(value)) {
      errors.push(`${prefix}${field} must be one of: ${rules.enum.join(', ')}`);
    }
  }
  
  // Custom validator
  if (rules.validate) {
    const customError = rules.validate(value);
    if (customError) {
      errors.push(`${prefix}${field}: ${customError}`);
    }
  }
  
  // Pattern (regex)
  if (rules.pattern && typeof value === 'string') {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      errors.push(`${prefix}${field} does not match required pattern`);
    }
  }
  
  return errors;
}

/**
 * Validate type
 * @private
 */
function validateType(field, value, expectedType, prefix) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  
  if (actualType !== expectedType) {
    return `${prefix}${field} must be ${expectedType}, got ${actualType}`;
  }
  
  return null;
}

/**
 * Validate number
 * @private
 */
function validateNumber(field, value, rules, prefix) {
  const errors = [];
  
  if (rules.min !== undefined && value < rules.min) {
    errors.push(`${prefix}${field} must be >= ${rules.min}`);
  }
  
  if (rules.max !== undefined && value > rules.max) {
    errors.push(`${prefix}${field} must be <= ${rules.max}`);
  }
  
  if (rules.integer && !Number.isInteger(value)) {
    errors.push(`${prefix}${field} must be an integer`);
  }
  
  if (rules.positive && value <= 0) {
    errors.push(`${prefix}${field} must be positive`);
  }
  
  return errors;
}

/**
 * Validate string
 * @private
 */
function validateString(field, value, rules, prefix) {
  const errors = [];
  
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    errors.push(`${prefix}${field} must be at least ${rules.minLength} characters`);
  }
  
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    errors.push(`${prefix}${field} must be at most ${rules.maxLength} characters`);
  }
  
  if (rules.trim && value !== value.trim()) {
    errors.push(`${prefix}${field} must not have leading/trailing whitespace`);
  }
  
  if (rules.lowercase && value !== value.toLowerCase()) {
    errors.push(`${prefix}${field} must be lowercase`);
  }
  
  if (rules.uppercase && value !== value.toUpperCase()) {
    errors.push(`${prefix}${field} must be uppercase`);
  }
  
  // Common formats
  if (rules.format === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(`${prefix}${field} must be a valid email`);
    }
  }
  
  if (rules.format === 'url') {
    try {
      new URL(value);
    } catch {
      errors.push(`${prefix}${field} must be a valid URL`);
    }
  }
  
  if (rules.format === 'uuid') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      errors.push(`${prefix}${field} must be a valid UUID`);
    }
  }
  
  return errors;
}

/**
 * Validate array
 * @private
 */
function validateArray(field, value, rules, prefix) {
  const errors = [];
  
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    errors.push(`${prefix}${field} must have at least ${rules.minLength} items`);
  }
  
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    errors.push(`${prefix}${field} must have at most ${rules.maxLength} items`);
  }
  
  // Validate array items
  if (rules.items) {
    value.forEach((item, index) => {
      const itemErrors = validateField(`${field}[${index}]`, item, rules.items, prefix);
      errors.push(...itemErrors);
    });
  }
  
  return errors;
}

/**
 * Validate nested object
 * @private
 */
function validateNestedObject(field, value, rules, prefix) {
  const errors = [];
  
  if (rules.properties) {
    for (const [prop, propRules] of Object.entries(rules.properties)) {
      const propErrors = validateField(`${field}.${prop}`, value[prop], propRules, prefix);
      errors.push(...propErrors);
    }
  }
  
  return errors;
}

/**
 * Coerce query parameter types
 * @private
 */
function coerceQueryTypes(query, schema) {
  const coerced = { ...query };
  
  for (const [field, rules] of Object.entries(schema)) {
    let value = coerced[field];
    
    // Skip if undefined or null
    if (value === undefined || value === null) {
      continue;
    }
    
    // Skip empty strings - let validation handle it
    if (value === '') {
      coerced[field] = undefined;
      continue;
    }
    
    // Coerce based on expected type
    if (rules.type === 'number' || rules.type === 'int') {
      const num = rules.type === 'int' ? parseInt(value, 10) : parseFloat(value);
      // If conversion fails, set to undefined (let validation use default or reject)
      coerced[field] = isNaN(num) ? undefined : num;
    }
    
    if (rules.type === 'boolean') {
      coerced[field] = value === 'true' || value === '1' || value === true;
    }
    
    if (rules.type === 'array' && typeof value === 'string') {
      coerced[field] = value.split(',').map(v => v.trim());
    }
  }
  
  return coerced;
}

/**
 * Common validation schemas (reusable)
 */
const commonSchemas = {
  pagination: {
    limit: { type: 'number', min: 1, max: 100 },
    offset: { type: 'number', min: 0 }
  },
  
  id: {
    id: { type: 'string', required: true, minLength: 1 }
  },
  
  timestamp: {
    start: { type: 'number', positive: true },
    end: { type: 'number', positive: true }
  }
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateQueryParams,
  commonSchemas
};