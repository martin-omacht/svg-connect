#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { mergeSVG } = require('./merge');

// --- Config ---
let inputFile, outputFile;
let TOLERANCE = 0.2;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--tolerance=')) TOLERANCE = parseFloat(arg.slice(12));
  else if (!inputFile) inputFile = arg;
  else if (!outputFile) outputFile = arg;
}

if (!inputFile) {
  console.error('Usage: node svg-connect.js <input.svg> [output.svg] [--tolerance=N]');
  console.error('  tolerance defaults to 1.0 (SVG units)');
  process.exit(1);
}

const svgText = fs.readFileSync(inputFile, 'utf8');
const { svg, merged } = mergeSVG(svgText, TOLERANCE, new DOMParser(), new XMLSerializer());

console.error(`Merged ${merged} path connection(s) (tolerance: ${TOLERANCE})`);

if (outputFile) {
  fs.writeFileSync(outputFile, svg, 'utf8');
} else {
  process.stdout.write(svg + '\n');
}
