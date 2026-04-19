#!/usr/bin/env node
// Validates that every JSON Schema in spec/ that defines properties has an
// `x-jist-tag` on each property, and that tags are unique within each scope.
//
// A "scope" is a single object-type definition — peer properties under the
// same `properties` block must have distinct tags. Tags across different
// scopes are independent.
//
// Exits non-zero on any violation. Run: node spec/validate-tags.js

const fs = require('fs');
const path = require('path');

const SPEC_DIR = __dirname;
const FILES = [
  'jist-template-schema.json',
  'jist-theme-schema.json',
];

const errors = [];

function walk(node, jsonPath, file) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, `${jsonPath}[${i}]`, file));
    return;
  }

  // Check a `properties` block — every child must have a unique x-jist-tag.
  if (node.properties && typeof node.properties === 'object') {
    const seen = new Map();
    for (const [key, value] of Object.entries(node.properties)) {
      // Skip the meta `$schema` property and the `type` discriminator.
      if (key === '$schema' || key === 'type') {
        walk(value, `${jsonPath}.properties.${key}`, file);
        continue;
      }
      if (!value || typeof value !== 'object') continue;
      const tag = value['x-jist-tag'];
      if (tag === undefined) {
        errors.push(`${file}: missing x-jist-tag on ${jsonPath}.properties.${key}`);
      } else if (!Number.isInteger(tag) || tag < 1) {
        errors.push(`${file}: x-jist-tag on ${jsonPath}.properties.${key} must be a positive integer (got ${JSON.stringify(tag)})`);
      } else if (seen.has(tag)) {
        errors.push(`${file}: duplicate x-jist-tag=${tag} at ${jsonPath}.properties — used by both "${seen.get(tag)}" and "${key}"`);
      } else {
        seen.set(tag, key);
      }
      walk(value, `${jsonPath}.properties.${key}`, file);
    }
  }

  // Validate oneOf discriminator: each variant referenced by $ref must have a top-level x-jist-tag.
  if (Array.isArray(node.oneOf)) {
    const seenVariantTags = new Map();
    for (const variant of node.oneOf) {
      if (!variant.$ref) continue;
      const refName = variant.$ref.split('/').pop();
      const def = resolveRef(variant.$ref, file);
      if (!def) continue;
      const tag = def['x-jist-tag'];
      if (tag === undefined) {
        errors.push(`${file}: oneOf variant "${refName}" missing x-jist-tag (at definition definitions.${refName})`);
      } else if (!Number.isInteger(tag) || tag < 1) {
        errors.push(`${file}: oneOf variant "${refName}" x-jist-tag must be a positive integer`);
      } else if (seenVariantTags.has(tag)) {
        errors.push(`${file}: duplicate oneOf variant x-jist-tag=${tag} — used by "${seenVariantTags.get(tag)}" and "${refName}"`);
      } else {
        seenVariantTags.set(tag, refName);
      }
    }
  }

  // Recurse into other fields (definitions, items, etc.)
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties') continue; // already walked above
    walk(value, `${jsonPath}.${key}`, file);
  }
}

const loadedSchemas = {};
function resolveRef(ref, file) {
  // Supports local refs of the form "#/definitions/Name".
  const match = ref.match(/^#\/definitions\/(.+)$/);
  if (!match) return null;
  const schema = loadedSchemas[file];
  return schema?.definitions?.[match[1]] ?? null;
}

for (const filename of FILES) {
  const full = path.join(SPEC_DIR, filename);
  if (!fs.existsSync(full)) {
    errors.push(`${filename}: file not found`);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  let schema;
  try {
    schema = JSON.parse(content);
  } catch (e) {
    errors.push(`${filename}: invalid JSON — ${e.message}`);
    continue;
  }
  loadedSchemas[filename] = schema;
  walk(schema, '$', filename);
}

if (errors.length > 0) {
  console.error('Tag validation failed:');
  for (const err of errors) console.error(`  • ${err}`);
  process.exit(1);
}

console.log('Tag validation passed for:');
for (const f of FILES) console.log(`  • ${f}`);
