const fs = require('fs');
const code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Extract the declarations (before the return statement)
const parts = code.split('return (');
const decls = parts[0];

// Try to identify the problematic area around line 47
const lines = decls.split('\n');
for (let i = 35; i < Math.min(60, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// Try to see if we can detect the issue
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const ch of line) {
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
  }
  if (i >= 38 && i <= 52) {
    console.log(`Line ${i+1} depth: ${depth} | ${line.trim().substring(0, 60)}`);
  }
}
