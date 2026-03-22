import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace bright colors with softer, earthy tones
const replacements = [
  // Red -> Muted Rose/Terracotta
  { old: /text-red-600/g, new: 'text-[#A67C7C]' },
  { old: /bg-red-50/g, new: 'bg-[#FAF0F0]' },
  { old: /border-red-100/g, new: 'border-[#E8D0D0]' },
  { old: /text-red-500/g, new: 'text-[#A67C7C]' },
  { old: /text-red-700/g, new: 'text-[#8A5A5A]' },
  { old: /border-red-200/g, new: 'border-[#D9B8B8]' },
  { old: /bg-red-100/g, new: 'bg-[#F2E6E6]' },
  { old: /text-red-900/g, new: 'text-[#5C3A3A]' },
  { old: /bg-red-400/g, new: 'bg-[#C29999]' },
  { old: /text-red-800/g, new: 'text-[#734A4A]' },

  // Blue -> Muted Slate/Blue
  { old: /bg-blue-50/g, new: 'bg-[#F0F4FA]' },
  { old: /text-blue-700/g, new: 'text-[#5A738A]' },
  { old: /border-blue-200/g, new: 'border-[#C2D1D9]' },
  { old: /bg-blue-100/g, new: 'bg-[#E6EEF2]' },
  { old: /text-blue-600/g, new: 'text-[#6B8599]' },
  { old: /text-blue-900/g, new: 'text-[#3A4C5C]' },
  { old: /bg-blue-400/g, new: 'bg-[#8FA6B8]' },
  { old: /text-blue-800/g, new: 'text-[#4A6073]' },
  { old: /border-blue-100/g, new: 'border-[#D9E3E8]' },

  // Yellow -> Muted Gold
  { old: /bg-yellow-100/g, new: 'bg-[#F5EEDC]' },
  { old: /text-yellow-700/g, new: 'text-[#8A7A52]' },
  { old: /border-yellow-200/g, new: 'border-[#E6DAB3]' },

  // Orange -> Muted Terracotta
  { old: /bg-orange-100/g, new: 'bg-[#F5E6DC]' },
  { old: /text-orange-800/g, new: 'text-[#8A6A52]' },
  { old: /border-orange-200/g, new: 'border-[#E6CDB3]' },

  // Emerald -> Light Green (from palette)
  { old: /bg-emerald-50/g, new: 'bg-[#F2F5ED]' },
  { old: /text-emerald-700/g, new: 'text-[#7A8A62]' },
  { old: /border-emerald-200/g, new: 'border-[#DCE3D0]' },

  // Amber -> Muted Mustard
  { old: /bg-amber-50/g, new: 'bg-[#F5F0E6]' },
  { old: /text-amber-700/g, new: 'text-[#8A7A52]' },
  { old: /border-amber-200/g, new: 'border-[#E8DFD0]' },
  
  // Indigo -> Muted Purple/Brown
  { old: /bg-indigo-50/g, new: 'bg-[#F2F0F5]' },
  { old: /text-indigo-900/g, new: 'text-[#4A425C]' },
  { old: /text-indigo-800/g, new: 'text-[#5A5273]' },
  { old: /bg-indigo-100/g, new: 'bg-[#E6E3ED]' },
  { old: /text-indigo-600/g, new: 'text-[#736B8A]' },
  { old: /border-indigo-100/g, new: 'border-[#D9D5E3]' },
];

replacements.forEach(({ old, new: replacement }) => {
  content = content.replace(old, replacement);
});

fs.writeFileSync('src/App.tsx', content);
console.log('Bright colors replaced with softer tones in App.tsx');
