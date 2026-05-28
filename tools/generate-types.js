// tools/generate-types.js
// Generates schemas/types.ts from the JSON Schema files using json-schema-to-typescript.
// Run: node tools/generate-types.js
// Requires: npx (no local install needed; the package is fetched per-run).
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const schemaDir = path.resolve(__dirname, '..', 'schemas');
const outFile = path.join(schemaDir, 'types.ts');
const sourceJsonSchema = path.join(schemaDir, 'source-json.schema.json');
const listSchema = path.join(schemaDir, 'list.schema.json');

// json-schema-to-typescript@15 processes one schema at a time.
// Run once per schema, capture stdout, and concatenate into types.ts.
function compile(schemaPath) {
	console.log('Compiling:', schemaPath);
	return execSync(
		`npx --yes json-schema-to-typescript@15 "${schemaPath}"`,
		{ encoding: 'utf8' }
	);
}

const header = '// AUTO-GENERATED — do not edit by hand.\n// Run `node tools/generate-types.js` to regenerate.\n\n';
const sourceJsonTypes = compile(sourceJsonSchema);
const listTypes = compile(listSchema);

fs.writeFileSync(outFile, header + sourceJsonTypes + '\n' + listTypes);
console.log('Wrote', outFile, '(' + fs.statSync(outFile).size, 'bytes)');
