import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace old colors with new ones
const replacements = [
  { old: /#2C241B/g, new: '#4A3B32' }, // Dark text -> Dark Brown
  { old: /#7A6E60/g, new: '#8C7A6B' }, // Muted text -> Muted Brown
  { old: /#9C7A58/g, new: '#8B5E3C' }, // Medium brown -> Primary Brown
  { old: /#8A6A4B/g, new: '#7A5234' }, // Hover brown -> Hover Primary Brown
  { old: /#88A07D/g, new: '#9EAD86' }, // Muted green -> Light Green
  { old: /#768E6B/g, new: '#8A9A72' }, // Hover green -> Hover Light Green
  { old: /#D5E3D9/g, new: '#DCE3D0' }, // Light green border -> Light Green Border
  { old: /#F4F6F3/g, new: '#F2F5ED' }, // Very light green -> Very Light Green
  { old: /#F9F8F6/g, new: '#FCFBF8' }, // Light beige -> Card Beige
  { old: /#F0EEEA/g, new: '#F5F0E6' }, // Secondary beige -> Background Beige
  { old: /#EAE4D9/g, new: '#E8DFD0' }, // Beige border -> Beige Border
  { old: /#C4BCB0/g, new: '#C2B8A9' }, // Grayish beige -> Grayish Beige
  { old: /bg-white/g, new: 'bg-[#FCFBF8]' }, // White backgrounds to Card Beige
  { old: /HR Screening AI/g, new: 'CVfiy' }, // App name
  { old: /HR Screening/g, new: 'CVfiy' }, // App name
];

replacements.forEach(({ old, new: replacement }) => {
  content = content.replace(old, replacement);
});

fs.writeFileSync('src/App.tsx', content);
console.log('Colors and name updated in App.tsx');
