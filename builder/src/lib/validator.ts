import Ajv, { type ErrorObject } from "ajv";
import templateSchema from "@/lib/shared/jist-template-schema.json";
import themeSchema from "@/lib/shared/jist-theme-schema.json";

const ajv = new Ajv({ allErrors: true, strict: false });

const validateTemplate = ajv.compile(templateSchema);
const validateTheme = ajv.compile(themeSchema);

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export function validateTemplateJson(template: unknown): ValidationResult {
  const valid = validateTemplate(template) as boolean;
  return {
    valid,
    errors: valid ? [] : (validateTemplate.errors || []),
  };
}

export function validateThemeJson(theme: unknown): ValidationResult {
  const valid = validateTheme(theme) as boolean;
  return {
    valid,
    errors: valid ? [] : (validateTheme.errors || []),
  };
}
