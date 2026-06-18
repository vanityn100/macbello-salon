const fs = require('fs');
const path = require('path');

const dirs = [
  'public/images',
  'public/images/gallery',
  'public/images/team',
  'public/images/transformations'
];

// Ensure directories exist
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

// Helper to write SVG with text
function writeSVG(filePath, title, category, subtitle, isBeforeAfter = false, variant = 'dark') {
  const width = 800;
  const height = 600;

  const bgGrad = variant === 'dark' 
    ? `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#050505" />
         <stop offset="100%" stop-color="#121212" />
       </linearGradient>`
    : `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#151515" />
         <stop offset="100%" stop-color="#0B0B0B" />
       </linearGradient>`;

  const accentColor = isBeforeAfter && title.includes('Before') ? '#888888' : '#D4AF37';
  const accentLight = isBeforeAfter && title.includes('Before') ? '#aaaaaa' : '#EEDC82';

  const goldGrad = `<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${accentColor}" />
    <stop offset="50%" stop-color="${accentLight}" />
    <stop offset="100%" stop-color="${accentColor}" />
  </linearGradient>`;

  // Draw some abstract luxury geometric lines/shapes based on category
  let shapes = '';
  if (category === 'styling' || category === 'Hair Styling') {
    shapes = `
      <!-- Elegant flowing wave lines -->
      <path d="M-100,300 C200,200 300,400 800,150 L800,600 L-100,600 Z" fill="url(#gold)" opacity="0.04"/>
      <path d="M0,400 C300,200 400,500 900,300 L900,600 L0,600 Z" fill="url(#gold)" opacity="0.08"/>
      <path d="M50,450 C350,300 450,550 950,350" stroke="url(#gold)" stroke-width="1.5" fill="none" opacity="0.3"/>
      <path d="M100,480 C400,350 500,580 1000,380" stroke="url(#gold)" stroke-width="0.75" fill="none" opacity="0.2"/>
    `;
  } else if (category === 'coloring' || category === 'Hair Coloring') {
    shapes = `
      <!-- Soft glowing radial circles representing multi-dimensional color -->
      <circle cx="600" cy="200" r="250" fill="url(#gold)" opacity="0.05" filter="blur(40px)"/>
      <circle cx="200" cy="450" r="180" fill="url(#gold)" opacity="0.04"/>
      <circle cx="500" cy="350" r="120" stroke="url(#gold)" stroke-width="0.5" fill="none" opacity="0.2"/>
      <circle cx="500" cy="350" r="130" stroke="url(#gold)" stroke-width="0.5" fill="none" stroke-dasharray="5,5" opacity="0.15"/>
    `;
  } else if (category === 'bridal' || category === 'Bridal') {
    shapes = `
      <!-- Mandalas / royal elements -->
      <path d="M400,100 L430,220 L550,250 L430,280 L400,400 L370,280 L250,250 L370,220 Z" stroke="url(#gold)" stroke-width="0.5" fill="none" opacity="0.15"/>
      <circle cx="400" cy="250" r="60" stroke="url(#gold)" stroke-width="1" fill="none" opacity="0.2"/>
      <circle cx="400" cy="250" r="90" stroke="url(#gold)" stroke-width="0.5" fill="none" stroke-dasharray="4,4" opacity="0.15"/>
      <line x1="400" y1="0" x2="400" y2="500" stroke="url(#gold)" stroke-width="0.5" opacity="0.1"/>
      <line x1="0" y1="250" x2="800" y2="250" stroke="url(#gold)" stroke-width="0.5" opacity="0.1"/>
    `;
  } else if (category === 'grooming' || category === 'Grooming') {
    shapes = `
      <!-- Clean sharp grid / angles representing barbering -->
      <path d="M 0,0 L 800,600 M 800,0 L 0,600" stroke="url(#gold)" stroke-width="0.25" opacity="0.1"/>
      <rect x="250" y="150" width="300" height="300" stroke="url(#gold)" stroke-width="0.5" fill="none" opacity="0.15"/>
      <rect x="260" y="160" width="280" height="280" stroke="url(#gold)" stroke-width="0.5" fill="none" stroke-dasharray="8,8" opacity="0.1"/>
    `;
  } else {
    // Salon interior / default
    shapes = `
      <!-- Soft ambient architectural lighting curves -->
      <path d="M 0,100 Q 400,50 800,100 L 800,600 L 0,600 Z" fill="url(#gold)" opacity="0.03"/>
      <path d="M 0,150 Q 400,100 800,150" stroke="url(#gold)" stroke-width="1" fill="none" opacity="0.2"/>
      <circle cx="400" cy="300" r="150" stroke="url(#gold)" stroke-width="0.5" fill="none" opacity="0.1"/>
    `;
  }

  const svgContent = `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${bgGrad}
    ${goldGrad}
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <!-- Outer luxury border -->
  <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="none" stroke="url(#gold)" stroke-width="1.5" opacity="0.45"/>
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="url(#gold)" stroke-width="0.5" opacity="0.2" stroke-dasharray="4,4"/>

  <!-- Geometric Abstract Shapes -->
  ${shapes}

  <!-- Brand Heading -->
  <text x="50%" y="15%" dominant-baseline="middle" text-anchor="middle" font-family="'Playfair Display', 'Georgia', serif" font-size="14" fill="#D4AF37" letter-spacing="8" opacity="0.75">MACBELLO</text>
  <text x="50%" y="18%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8" fill="#F5F5F0" letter-spacing="4" opacity="0.4">FAMILY SALON</text>

  <!-- Section Title -->
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="'Playfair Display', 'Georgia', serif" font-size="36" font-weight="300" fill="#F5F5F0" letter-spacing="2">${title}</text>
  
  <!-- Category Tag -->
  <rect x="340" y="50%" width="120" height="22" fill="none" stroke="url(#gold)" stroke-width="0.75" opacity="0.6"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', sans-serif" font-size="9" font-weight="500" fill="${accentLight}" letter-spacing="3" opacity="0.9">${category.toUpperCase()}</text>
  
  <!-- Subtitle -->
  <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', sans-serif" font-size="11" font-weight="300" fill="#F5F5F0" letter-spacing="1" opacity="0.5">${subtitle}</text>
  
  <!-- Bottom Corner Accents -->
  <path d="M 35,35 L 35,50 M 35,35 L 50,35" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
  <path d="M ${width-35},35 L ${width-35},50 M ${width-35},35 L ${width-50},35" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
  <path d="M 35,${height-35} L 35,${height-50} M 35,${height-35} L 50,${height-35}" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
  <path d="M ${width-35},${height-35} L ${width-35},${height-50} M ${width-35},${height-35} L ${width-50},${height-35}" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
</svg>`;

  fs.writeFileSync(filePath, svgContent, 'utf8');
  console.log(`Saved SVG to ${filePath}`);
}

// Generate the files
const fileList = [
  // Core
  { path: 'public/images/hero_salon.svg', title: 'Luxury Sanctuary', cat: 'interior', sub: 'Where Style Meets Perfection' },
  
  // Gallery
  { path: 'public/images/gallery/styling-1.svg', title: 'Avant-Garde Wave', cat: 'styling', sub: 'Texturized waves with gold highlights' },
  { path: 'public/images/gallery/styling-2.svg', title: 'Sleek Blowout', cat: 'styling', sub: 'Ultra-smooth thermal nourishing blowout' },
  { path: 'public/images/gallery/coloring-1.svg', title: 'Champagne Balayage', cat: 'coloring', sub: 'Multi-dimensional hand-painted highlights' },
  { path: 'public/images/gallery/coloring-2.svg', title: 'Obsidian & Gold', cat: 'coloring', sub: 'Deep black base with golden underlights' },
  { path: 'public/images/gallery/bridal-1.svg', title: 'Royal Kerala Bride', cat: 'bridal', sub: 'Traditional gold with modern HD dewy skin' },
  { path: 'public/images/gallery/bridal-2.svg', title: 'Reception Glam', cat: 'bridal', sub: 'Smoky eyes and bold lip styling' },
  { path: 'public/images/gallery/grooming-1.svg', title: 'Executive Contour', cat: 'grooming', sub: 'Classic side-part contour & razor edge' },
  { path: 'public/images/gallery/grooming-2.svg', title: 'Beard Fade', cat: 'grooming', sub: 'Seamless fade shaped with organic oils' },
  { path: 'public/images/gallery/interior-1.svg', title: 'Macbello Suite', cat: 'interior', sub: 'Luxe styling chairs & black marble design' },
  { path: 'public/images/gallery/interior-2.svg', title: 'VIP Lounge', cat: 'interior', sub: 'Plush waiting area and espresso bar' },

  // Team
  { path: 'public/images/team/expert_1.svg', title: 'Marco Bello', cat: 'styling', sub: 'Creative Director & Master Stylist' },
  { path: 'public/images/team/expert_2.svg', title: 'Aiswarya Rajan', cat: 'bridal', sub: 'Lead Bridal Makeover Artist' },
  { path: 'public/images/team/expert_3.svg', title: 'Sandeep Kumar', cat: 'grooming', sub: 'Master Barber & Beard Specialist' },
  { path: 'public/images/team/expert_4.svg', title: 'Tina Mathew', cat: 'skin', sub: 'Senior Skin Aesthetician' },

  // Transformations (Before / After Pairs)
  { path: 'public/images/transformations/styling-before.svg', title: 'Before styling', cat: 'Hair Styling', sub: 'Dry, lifeless, unstyled flat hair', isBA: true, var: 'light' },
  { path: 'public/images/transformations/styling-after.svg', title: 'After styling', cat: 'Hair Styling', sub: 'Voluminous, bouncy golden waves', isBA: true },
  
  { path: 'public/images/transformations/color-before.svg', title: 'Before coloring', cat: 'Hair Coloring', sub: 'Brassy, uneven faded hair coloring', isBA: true, var: 'light' },
  { path: 'public/images/transformations/color-after.svg', title: 'After coloring', cat: 'Hair Coloring', sub: 'Flawless multi-tone champagne balayage', isBA: true },
  
  { path: 'public/images/transformations/botox-before.svg', title: 'Before botox', cat: 'Hair Botox', sub: 'Extremely frizzy, heat-damaged locks', isBA: true, var: 'light' },
  { path: 'public/images/transformations/botox-after.svg', title: 'After botox', cat: 'Hair Botox', sub: 'Silky, fully restored straight finish', isBA: true },
  
  { path: 'public/images/transformations/bridal-before.svg', title: 'Before bridal', cat: 'Bridal', sub: 'Bare face pre-makeover skin prep', isBA: true, var: 'light' },
  { path: 'public/images/transformations/bridal-after.svg', title: 'After bridal', cat: 'Bridal', sub: 'Radiant royal traditional makeup glow', isBA: true },
  
  { path: 'public/images/transformations/grooming-before.svg', title: 'Before grooming', cat: 'Grooming', sub: 'Overgrown beard and unkempt haircut', isBA: true, var: 'light' },
  { path: 'public/images/transformations/grooming-after.svg', title: 'After grooming', cat: 'Grooming', sub: 'Sharp skin fade and contoured beard shape', isBA: true }
];

fileList.forEach(file => {
  const filePath = path.join(__dirname, file.path);
  writeSVG(filePath, file.title, file.cat, file.sub, file.isBA, file.var);
});

console.log('Successfully generated all SVGs!');
