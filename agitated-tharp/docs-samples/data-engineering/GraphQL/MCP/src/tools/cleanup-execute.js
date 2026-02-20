const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const result = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Remove 'export const execute' or 'export async function execute'
    if (line.match(/^export const execute\s*=/) || line.match(/^export async function execute/)) {
      // Skip this line and skip until we find the closing brace at depth 0
      let depth = 1;
      let j = i + 1;
      
      while (j < lines.length && depth > 0) {
        const nextLine = lines[j];
        const openBraces = (nextLine.match(/{/g) || []).length;
        const closeBraces = (nextLine.match(/}/g) || []).length;
        depth += openBraces - closeBraces;
        j++;
      }
      
      i = j - 1; // Continue from line after closing brace
    } else {
      result.push(line);
    }
    
    i++;
  }
  
  if (result.length !== lines.length) {
    fs.writeFileSync(file, result.join('\n'));
    console.log(`Cleaned: ${file}`);
  }
});

console.log('Done!');
