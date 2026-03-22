const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const colorMap = {
  // Backgrounds & Borders
  '#FCFBF8': '#FFFFFF', // Clean white for cards
  '#F4F1EB': '#F5F2ED', // App bg
  '#E8DFD0': '#D2BCA1', // Akaroa (Borders)
  '#D1C7B7': '#C2A88D', // Darker Akaroa

  // Primary Brand (was Green, now Rhino)
  '#9EAD86': '#273F5B', // Rhino
  '#8A9A72': '#1C2D42', // Darker Rhino
  '#7A8A62': '#1C2D42', // Darker Rhino
  '#E8EDE9': '#E9ECF0', // Light Rhino tint

  // Primary Text (was Dark Brown, now Rhino)
  '#4A3B32': '#273F5B', // Rhino

  // Secondary Text (was Muted Brown, now Sandstone)
  '#8C7A6B': '#7F715F', // Sandstone
  '#A89F91': '#7F715F', // Sandstone
  '#5A5146': '#7F715F', // Sandstone

  // Icons / Accents (was Medium Brown, now Walnut)
  '#8B5E3C': '#6F481C', // Walnut
  '#7A5234': '#6F481C', // Walnut

  // Muted Accents (now Akaroa)
  '#C2B8A9': '#D2BCA1', // Akaroa

  // High Match (was Green) -> Rhino
  '#F2F5ED': '#E9ECF0', // Light Rhino tint
  '#DCE3D0': '#C5D0DC', // Rhino border tint
  '#5C7A61': '#273F5B', // Rhino

  // Medium Match (was Yellow/Amber) -> Walnut
  '#F5F0E6': '#F4EBE1', // Light Walnut tint
  '#8A7A52': '#6F481C', // Walnut
  // '#E8DFD0' is already mapped to Akaroa
  
  // Low Match (was Red) -> Desert
  '#FAF0F0': '#F6EFE9', // Light Desert tint
  '#A67C7C': '#A76825', // Desert
  '#E8D0D0': '#E6D2C0', // Desert border tint
  '#8A5A5A': '#A76825', // Desert
  '#D9B8B8': '#E6D2C0', // Desert border tint
  '#5C3A3A': '#A76825', // Desert
  '#C29999': '#A76825', // Desert
  '#734A4A': '#A76825', // Desert

  // Other Accents (Yellow/Orange -> Desert/Walnut)
  '#F5EEDC': '#F4EBE1',
  '#F5E6DC': '#F6EFE9',
  '#8A6A52': '#6F481C', // Walnut
  '#E6DAB3': '#E6D2C0',
  '#E6CDB3': '#E6D2C0',
  '#D4A373': '#A76825', // Desert
  '#E07A5F': '#A76825', // Desert

  // Blue -> Rhino
  '#F0F4FA': '#E9ECF0',
  '#5A738A': '#273F5B', // Rhino
  '#C2D1D9': '#C5D0DC', // Rhino border tint
  '#E6EEF2': '#E9ECF0',
  '#6B8599': '#273F5B', // Rhino
  '#3A4C5C': '#273F5B', // Rhino
  '#8FA6B8': '#7F715F', // Sandstone
  '#4A6073': '#273F5B', // Rhino
  '#D9E3E8': '#C5D0DC', // Rhino border tint

  // Indigo -> Sandstone
  '#F2F0F5': '#F5F2ED',
  '#D9D5E3': '#D2BCA1', // Akaroa
  '#4A425C': '#7F715F', // Sandstone
  '#E6E3ED': '#E9ECF0',
  '#736B8A': '#7F715F', // Sandstone
  '#5A5273': '#7F715F', // Sandstone
};

// Case-insensitive replacement
Object.entries(colorMap).forEach(([oldColor, newColor]) => {
  const regex = new RegExp(oldColor, 'gi');
  content = content.replace(regex, newColor);
});

fs.writeFileSync('src/App.tsx', content);
console.log('Colors replaced successfully!');
