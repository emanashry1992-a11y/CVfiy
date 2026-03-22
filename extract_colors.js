const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const matches = content.match(/#[0-9A-Fa-f]{6}/g);
const counts = {};
if (matches) {
  matches.forEach(m => {
    counts[m] = (counts[m] || 0) + 1;
  });
}
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log(sorted.map(([k, v]) => `${k}: ${v}`).join('\n'));
