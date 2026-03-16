import fs from 'fs';
import path from 'path';
import type {
  StyleDefinition,
  ComponentPattern,
  TypographyPairing,
  SectorInfo,
} from '@/types/intelligence';
import type { PageSection } from '@/types/page-section';

const CONTEXT_DIR = path.resolve(process.cwd(), '..', 'context');

function readContextFile(filename: string): string {
  const filePath = path.join(CONTEXT_DIR, filename);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function getStyles(): StyleDefinition[] {
  const content = readContextFile('_style-catalog.md');
  if (!content) return getDefaultStyles();

  // Parse style catalog markdown into structured data
  const styles: StyleDefinition[] = [];
  const styleBlocks = content.split(/^## (?=\d+\.\s)/m).filter((b) => b.trim());

  for (const block of styleBlocks) {
    const nameMatch = block.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Extract description
    const descMatch = block.match(/\*\*(.+?)\*\*\s*\n(.+?)(?:\n|$)/);
    const description = descMatch?.[2]?.trim() || '';

    // Extract colors from CSS specs
    const primaryMatch = block.match(/primary[:\s]*([#\w]+)/i);
    const secondaryMatch = block.match(/secondary[:\s]*([#\w]+)/i);
    const bgMatch = block.match(/background[:\s]*([#\w]+)/i);

    styles.push({
      name,
      slug,
      description,
      cssProperties: {},
      sectors: [],
      typography: { heading: 'Inter', body: 'Inter' },
      colors: {
        primary: primaryMatch?.[1] || '#000000',
        secondary: secondaryMatch?.[1] || '#666666',
        accent: primaryMatch?.[1] || '#000000',
        background: bgMatch?.[1] || '#ffffff',
        text: '#1a1a1a',
      },
      borderRadius: '0.5rem',
      animations: [],
    });
  }

  return styles.length > 0 ? styles : getDefaultStyles();
}

function getDefaultStyles(): StyleDefinition[] {
  return [
    {
      name: 'Warm Editorial',
      slug: 'warm-editorial',
      description: 'Warm, inviting tone with editorial typography. Earth tones and generous whitespace.',
      cssProperties: { 'letter-spacing': '0.02em', 'line-height': '1.7' },
      sectors: ['Real Estate', 'Travel', 'Food & Beverage'],
      typography: { heading: 'Cormorant Garamond', body: 'Montserrat' },
      colors: {
        primary: '#e58747',
        secondary: '#2c3e50',
        accent: '#d4a373',
        background: '#fefae0',
        text: '#1a1a1a',
      },
      borderRadius: '0.25rem',
      animations: ['fade-up', 'slide-in'],
    },
    {
      name: 'Tech Minimal',
      slug: 'tech-minimal',
      description: 'Clean, modern, developer-friendly. Monospace accents, sharp edges.',
      cssProperties: { 'letter-spacing': '-0.01em', 'line-height': '1.5' },
      sectors: ['SaaS', 'Fintech', 'Tech'],
      typography: { heading: 'Inter', body: 'Inter' },
      colors: {
        primary: '#000000',
        secondary: '#6b7280',
        accent: '#3b82f6',
        background: '#ffffff',
        text: '#111827',
      },
      borderRadius: '0.5rem',
      animations: ['fade-in', 'scale-up'],
    },
    {
      name: 'Luxury Dark',
      slug: 'luxury-dark',
      description: 'High-contrast dark theme with gold accents. Premium feel.',
      cssProperties: { 'letter-spacing': '0.05em', 'line-height': '1.6' },
      sectors: ['Fashion', 'Automotive', 'Real Estate'],
      typography: { heading: 'Playfair Display', body: 'Lato' },
      colors: {
        primary: '#c9a96e',
        secondary: '#1a1a1a',
        accent: '#d4af37',
        background: '#0a0a0a',
        text: '#f5f5f5',
      },
      borderRadius: '0',
      animations: ['reveal', 'parallax'],
    },
    {
      name: 'Bold Vibrant',
      slug: 'bold-vibrant',
      description: 'Energetic with saturated colors and strong typography. Great for DTC brands.',
      cssProperties: { 'letter-spacing': '-0.02em', 'line-height': '1.4' },
      sectors: ['E-Commerce', 'Food & Beverage', 'Health'],
      typography: { heading: 'Space Grotesk', body: 'DM Sans' },
      colors: {
        primary: '#FF5722',
        secondary: '#1a1a2e',
        accent: '#FFD600',
        background: '#ffffff',
        text: '#1a1a2e',
      },
      borderRadius: '1rem',
      animations: ['bounce-in', 'slide-up'],
    },
    {
      name: 'Clean Corporate',
      slug: 'clean-corporate',
      description: 'Professional, trustworthy. Blue-based palette with structured layouts.',
      cssProperties: { 'letter-spacing': '0', 'line-height': '1.6' },
      sectors: ['Financial Services', 'Professional Services', 'Education'],
      typography: { heading: 'Plus Jakarta Sans', body: 'Source Sans 3' },
      colors: {
        primary: '#1e40af',
        secondary: '#334155',
        accent: '#0ea5e9',
        background: '#f8fafc',
        text: '#0f172a',
      },
      borderRadius: '0.5rem',
      animations: ['fade-in', 'slide-right'],
    },
    {
      name: 'Organic Natural',
      slug: 'organic-natural',
      description: 'Soft, organic shapes with earth tones. Rounded edges and gentle motion.',
      cssProperties: { 'letter-spacing': '0.01em', 'line-height': '1.7' },
      sectors: ['Health', 'Food & Beverage', 'Architecture'],
      typography: { heading: 'Fraunces', body: 'Outfit' },
      colors: {
        primary: '#4a7c59',
        secondary: '#8b6f47',
        accent: '#a8c090',
        background: '#faf6f0',
        text: '#2d2d2d',
      },
      borderRadius: '1.5rem',
      animations: ['grow-in', 'float'],
    },
    {
      name: 'Neo Brutalist',
      slug: 'neo-brutalist',
      description: 'Raw, bold, unapologetic. Thick borders, stark contrasts, system fonts.',
      cssProperties: { 'letter-spacing': '-0.03em', 'line-height': '1.3' },
      sectors: ['Media', 'Entertainment', 'Tech'],
      typography: { heading: 'Archivo Black', body: 'IBM Plex Sans' },
      colors: {
        primary: '#000000',
        secondary: '#ff3366',
        accent: '#ffcc00',
        background: '#ffffff',
        text: '#000000',
      },
      borderRadius: '0',
      animations: ['none', 'snap'],
    },
    {
      name: 'Soft Gradient',
      slug: 'soft-gradient',
      description: 'Modern gradients with glass-morphism. Smooth, app-like feel.',
      cssProperties: { 'letter-spacing': '-0.01em', 'line-height': '1.5' },
      sectors: ['SaaS', 'Fintech', 'EdTech'],
      typography: { heading: 'Satoshi', body: 'General Sans' },
      colors: {
        primary: '#6366f1',
        secondary: '#a855f7',
        accent: '#ec4899',
        background: '#fafafa',
        text: '#18181b',
      },
      borderRadius: '1rem',
      animations: ['blur-in', 'gradient-shift'],
    },
  ];
}

export function getComponentPatterns(): ComponentPattern[] {
  const content = readContextFile('_component-patterns.md');
  if (!content) return getDefaultPatterns();

  // Parse component patterns from markdown by section
  const patterns: ComponentPattern[] = [];
  const lines = content.split('\n');

  let currentRating: 1 | 2 | 3 = 1;
  let currentTableColumns: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers to determine rating
    if (trimmed.includes('★★★') && trimmed.includes('CRITICAL')) {
      currentRating = 3;
      currentTableColumns = [];
      continue;
    }
    if (trimmed.includes('★★') && !trimmed.includes('★★★') && trimmed.includes('HIGH')) {
      currentRating = 2;
      currentTableColumns = [];
      continue;
    }
    if (/★[^★]/.test(trimmed) && trimmed.includes('EMERGING')) {
      currentRating = 1;
      currentTableColumns = [];
      continue;
    }

    // Skip non-table lines
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1) // Remove empty first/last from leading/trailing pipes
      .map((c) => c.trim());

    if (cells.length < 3) continue;

    // Detect header rows and separator rows
    if (cells[0] === 'Component' || cells[0] === 'Name') {
      currentTableColumns = cells;
      continue;
    }
    if (cells[0].match(/^-+$/)) continue; // separator row

    // Extract component name (first cell, strip **)
    const rawName = cells[0].replace(/\*\*/g, '');
    if (!rawName || rawName.match(/^-+$/)) continue;

    // Determine fields based on table structure
    let sectors: string[] = [];
    let description = '';
    let variants: string[] = [];

    if (currentTableColumns.length >= 8) {
      // ★★★ CRITICAL table: Component | Sectors | Site1 | Site2 | ... | Pattern | Recommendation
      const sectorIdx = currentTableColumns.indexOf('Sectors');
      const patternIdx = currentTableColumns.indexOf('Pattern');
      const recIdx = currentTableColumns.indexOf('Recommendation');

      if (sectorIdx >= 0 && sectorIdx < cells.length) {
        sectors = cells[sectorIdx].split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (patternIdx >= 0 && patternIdx < cells.length) {
        description = cells[patternIdx];
      }
      if (recIdx >= 0 && recIdx < cells.length && !description) {
        description = cells[recIdx];
      }
    } else if (currentTableColumns.length >= 4) {
      // ★★ HIGH table: Component | Found In | Pattern | When to Use
      sectors = cells[1]?.split(',').map((s) => s.trim()).filter(Boolean) || [];
      description = cells[2] || '';
    } else if (currentTableColumns.length >= 3) {
      // ★ EMERGING table: Component | Found In | Notes
      sectors = cells[1]?.split(',').map((s) => s.trim()).filter(Boolean) || [];
      description = cells[2] || '';
    }

    patterns.push({
      name: rawName,
      type: rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      rating: currentRating,
      sectors,
      description,
      variants,
    });
  }

  return patterns.length > 0 ? patterns : getDefaultPatterns();
}

function getDefaultPatterns(): ComponentPattern[] {
  return [
    {
      name: 'Hero Section',
      type: 'hero',
      rating: 3,
      sectors: ['All'],
      description: 'Full-width hero with headline, subtext, CTA, and background image/video',
      variants: ['Split hero', 'Video hero', 'Animated hero', 'Minimal hero'],
    },
    {
      name: 'Card Grid',
      type: 'card-grid',
      rating: 3,
      sectors: ['All'],
      description: 'Responsive grid of cards with image, title, description, and CTA',
      variants: ['3-column', '4-column', 'Masonry', 'Horizontal scroll'],
    },
    {
      name: 'Testimonials',
      type: 'testimonials',
      rating: 3,
      sectors: ['All'],
      description: 'Social proof section with quotes, avatars, and company logos',
      variants: ['Carousel', 'Grid', 'Single featured', 'Video testimonials'],
    },
    {
      name: 'FAQ Accordion',
      type: 'faq',
      rating: 3,
      sectors: ['All'],
      description: 'Expandable FAQ section with smooth animations',
      variants: ['Single column', 'Two column', 'Categorized'],
    },
    {
      name: 'Stats Counter',
      type: 'stats',
      rating: 2,
      sectors: ['SaaS', 'Corporate', 'Fintech'],
      description: 'Animated number counters with labels and icons',
      variants: ['Inline', 'Cards', 'Full-width bar'],
    },
    {
      name: 'Feature Grid',
      type: 'features',
      rating: 3,
      sectors: ['SaaS', 'Tech'],
      description: 'Feature showcase with icons, titles, and descriptions',
      variants: ['Icon grid', 'Alternating rows', 'Bento grid'],
    },
    {
      name: 'Pricing Table',
      type: 'pricing',
      rating: 2,
      sectors: ['SaaS', 'Professional Services'],
      description: 'Pricing tiers with features comparison',
      variants: ['3-tier', 'Toggle monthly/yearly', 'Comparison table'],
    },
    {
      name: 'Contact Form',
      type: 'contact',
      rating: 2,
      sectors: ['All'],
      description: 'Contact form with validation and success state',
      variants: ['Simple', 'Split with info', 'Multi-step'],
    },
    {
      name: 'Footer',
      type: 'footer',
      rating: 3,
      sectors: ['All'],
      description: 'Site footer with navigation, social links, and legal',
      variants: ['4-column', 'Centered', 'Minimal', 'Mega footer'],
    },
    {
      name: 'Navigation Bar',
      type: 'navbar',
      rating: 3,
      sectors: ['All'],
      description: 'Responsive navbar with logo, links, and mobile menu',
      variants: ['Transparent', 'Sticky', 'Mega menu', 'Auto-hide'],
    },
    {
      name: 'CTA Banner',
      type: 'cta-banner',
      rating: 2,
      sectors: ['All'],
      description: 'Call-to-action banner with compelling copy and button',
      variants: ['Full-width', 'Contained', 'With image', 'Gradient'],
    },
    {
      name: 'Image Gallery',
      type: 'gallery',
      rating: 2,
      sectors: ['Real Estate', 'Travel', 'Architecture'],
      description: 'Image gallery with lightbox and filtering',
      variants: ['Grid', 'Masonry', 'Carousel', 'Fullscreen'],
    },
  ];
}

export function getTypographyPairings(): TypographyPairing[] {
  return [
    { heading: 'Cormorant Garamond', body: 'Montserrat', style: 'Warm Editorial', sectors: ['Real Estate', 'Travel'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@400;500;600&display=swap' },
    { heading: 'Inter', body: 'Inter', style: 'Tech Minimal', sectors: ['SaaS', 'Fintech'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
    { heading: 'Playfair Display', body: 'Lato', style: 'Luxury Dark', sectors: ['Fashion', 'Automotive'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@400;700&display=swap' },
    { heading: 'Space Grotesk', body: 'DM Sans', style: 'Bold Vibrant', sectors: ['E-Commerce', 'DTC'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500;700&display=swap' },
    { heading: 'Plus Jakarta Sans', body: 'Source Sans 3', style: 'Clean Corporate', sectors: ['Financial', 'Professional'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700&family=Source+Sans+3:wght@400;600&display=swap' },
    { heading: 'Fraunces', body: 'Outfit', style: 'Organic Natural', sectors: ['Health', 'Food'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Outfit:wght@400;500;600&display=swap' },
    { heading: 'Archivo Black', body: 'IBM Plex Sans', style: 'Neo Brutalist', sectors: ['Media', 'Entertainment'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;500;700&display=swap' },
    { heading: 'Cabinet Grotesk', body: 'General Sans', style: 'Soft Gradient', sectors: ['SaaS', 'EdTech'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap' },
    { heading: 'Merriweather', body: 'Open Sans', style: 'Classic Readable', sectors: ['Education', 'Media'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap' },
    { heading: 'Poppins', body: 'Nunito', style: 'Friendly Modern', sectors: ['Health', 'EdTech'], googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Nunito:wght@400;600&display=swap' },
  ];
}

// ── Page Section Blueprints ────────────────────────────
// Sector-specific ordered page blueprints used as fallback when no BUILD_PLAN.md exists

const PAGE_BLUEPRINTS: Record<string, Omit<PageSection, 'id'>[]> = {
  'real estate': [
    { name: 'Navigation Bar', type: 'navbar', description: 'Sticky navbar with logo, nav links, and CTA button', required: true, position: 1, sectorHints: 'Include property search or "Book a Tour" CTA. Transparent on hero, solid on scroll.' },
    { name: 'Hero Section', type: 'hero', description: 'Full-width hero with headline, subtext, and primary CTA', required: true, position: 2, sectorHints: 'Property/lifestyle hero image or video. Search bar or "View Properties" CTA. Convey lifestyle aspiration.' },
    { name: 'Trust Bar', type: 'trust-bar', description: 'Logo bar or trust indicators', required: true, position: 3, sectorHints: 'Awards, certifications, press mentions, or partner logos. Build credibility early.' },
    { name: 'Listings Grid', type: 'listings', description: 'Property or room type cards in responsive grid', required: true, position: 4, sectorHints: 'Card grid with property images, price, key features (beds, baths, sqft). Filterable if possible.' },
    { name: 'Amenities', type: 'amenities', description: 'Feature/amenity showcase with icons', required: true, position: 5, sectorHints: 'Icon grid or alternating rows. Highlight community amenities, smart home features, sustainability.' },
    { name: 'Location Map', type: 'location', description: 'Location section with map and neighborhood info', required: true, position: 6, sectorHints: 'Interactive map or styled static map. Nearby transport, shops, schools. Walking distances.' },
    { name: 'Testimonials', type: 'testimonials', description: 'Resident reviews and social proof', required: true, position: 7, sectorHints: 'Real resident quotes with names and photos. Star ratings. Video testimonials if available.' },
    { name: 'CTA Banner', type: 'cta-banner', description: 'Call-to-action section before footer', required: true, position: 8, sectorHints: 'Strong conversion CTA: "Schedule a Viewing", "Book a Tour". Urgency elements optional.' },
    { name: 'Footer', type: 'footer', description: 'Site footer with navigation, contact info, social links', required: true, position: 9, sectorHints: 'Contact details, office hours, social links, legal links, newsletter signup.' },
  ],
  'saas / b2b': [
    { name: 'Navigation Bar', type: 'navbar', description: 'Sticky navbar with logo, nav links, and demo CTA', required: true, position: 1, sectorHints: 'Include "Get Started" or "Request Demo" CTA button. Mega menu for product features optional.' },
    { name: 'Hero Section', type: 'hero', description: 'Product hero with headline, value prop, and CTA', required: true, position: 2, sectorHints: 'Clear value proposition. Product screenshot or animated demo. Two CTAs: primary (Start Free) + secondary (Watch Demo).' },
    { name: 'Logo Bar', type: 'logo-bar', description: 'Customer logos for social proof', required: true, position: 3, sectorHints: '"Trusted by" with recognizable company logos. Grayscale, hover to color.' },
    { name: 'Features', type: 'features', description: 'Product feature showcase', required: true, position: 4, sectorHints: 'Icon grid or bento grid. Each feature: icon + title + short description. Link to detail pages.' },
    { name: 'How It Works', type: 'how-it-works', description: 'Step-by-step process explanation', required: true, position: 5, sectorHints: '3-4 numbered steps with icons/illustrations. Show the user journey from signup to value.' },
    { name: 'Pricing', type: 'pricing', description: 'Pricing tiers with feature comparison', required: false, position: 6, sectorHints: '3 tiers: Free/Pro/Enterprise. Monthly/yearly toggle. Feature comparison. Highlight recommended plan.' },
    { name: 'Testimonials', type: 'testimonials', description: 'Customer success stories', required: true, position: 7, sectorHints: 'Quote cards with company logos, names, roles. Metrics-driven: "Saved 40% time".' },
    { name: 'FAQ', type: 'faq', description: 'Frequently asked questions accordion', required: false, position: 8, sectorHints: 'Expandable accordion. Common objections: pricing, security, integrations, migration.' },
    { name: 'CTA Banner', type: 'cta-banner', description: 'Final conversion section', required: true, position: 9, sectorHints: 'Reinforce value prop. "Start your free trial" or "Talk to sales". No credit card required messaging.' },
    { name: 'Footer', type: 'footer', description: 'Site footer with product links and legal', required: true, position: 10, sectorHints: 'Product, Resources, Company, Legal columns. Status page link. SOC2/GDPR badges.' },
  ],
  'e-commerce / dtc': [
    { name: 'Navigation Bar', type: 'navbar', description: 'Navbar with logo, categories, search, and cart', required: true, position: 1, sectorHints: 'Category mega menu, search bar, cart icon with count, account icon. Announcement bar on top optional.' },
    { name: 'Hero Section', type: 'hero', description: 'Product showcase hero', required: true, position: 2, sectorHints: 'Hero product image or lifestyle shot. "Shop Now" CTA. Seasonal/promotional messaging.' },
    { name: 'Categories', type: 'categories', description: 'Product category navigation', required: true, position: 3, sectorHints: 'Visual category cards with images. 3-6 main categories. Clean grid layout.' },
    { name: 'Featured Products', type: 'featured-products', description: 'Product card grid', required: true, position: 4, sectorHints: 'Product cards: image, name, price, rating, quick-add. "New" or "Sale" badges.' },
    { name: 'Benefits', type: 'benefits', description: 'Brand value propositions', required: true, position: 5, sectorHints: 'Free shipping, easy returns, sustainability, quality guarantee. Icon + text format.' },
    { name: 'Reviews', type: 'reviews', description: 'Customer reviews section', required: true, position: 6, sectorHints: 'Star ratings, review quotes, photos. Overall score summary. Filter by rating.' },
    { name: 'Newsletter', type: 'newsletter', description: 'Email signup section', required: false, position: 7, sectorHints: 'Discount incentive: "Get 10% off your first order". Email input + subscribe button.' },
    { name: 'Footer', type: 'footer', description: 'E-commerce footer with shop links', required: true, position: 8, sectorHints: 'Shop, Help, About columns. Payment icons. Social links. Trust badges.' },
  ],
  'travel & hospitality': [
    { name: 'Navigation Bar', type: 'navbar', description: 'Navbar with search and booking CTA', required: true, position: 1, sectorHints: 'Include destination search or "Book Now" CTA. Language selector if international.' },
    { name: 'Hero Section', type: 'hero', description: 'Destination hero with search', required: true, position: 2, sectorHints: 'Stunning destination imagery or video. Search bar with dates, guests, location. Aspirational headline.' },
    { name: 'Destinations', type: 'destinations', description: 'Popular destination cards', required: true, position: 3, sectorHints: 'Destination cards with beautiful images, starting price, rating. "Trending" or "Popular" badges.' },
    { name: 'Experiences', type: 'experiences', description: 'Experience or activity cards', required: true, position: 4, sectorHints: 'Activity cards: image, title, duration, price. Categories: Adventure, Culture, Food, Relaxation.' },
    { name: 'Gallery', type: 'gallery', description: 'Photo gallery showcase', required: false, position: 5, sectorHints: 'Masonry or grid gallery. Lightbox on click. Mix of landscape and portrait. User-generated content feel.' },
    { name: 'Testimonials', type: 'testimonials', description: 'Traveler reviews and stories', required: true, position: 6, sectorHints: 'Traveler quotes with photos, destination visited, dates. Star ratings. Story-like format.' },
    { name: 'CTA Banner', type: 'cta-banner', description: 'Booking conversion section', required: true, position: 7, sectorHints: '"Start planning your trip" or "Book your dream stay". Urgency: limited availability messaging.' },
    { name: 'Footer', type: 'footer', description: 'Travel footer with destination links', required: true, position: 8, sectorHints: 'Popular destinations, travel guides, support, app download links.' },
  ],
  'fintech': [
    { name: 'Navigation Bar', type: 'navbar', description: 'Navbar with app download CTA', required: true, position: 1, sectorHints: 'Include "Download App" or "Open Account" CTA. Clean, trust-inspiring design.' },
    { name: 'Hero Section', type: 'hero', description: 'App showcase hero', required: true, position: 2, sectorHints: 'Phone mockup showing the app. Clear value prop. App store buttons. "No hidden fees" messaging.' },
    { name: 'Trust & Security', type: 'trust-security', description: 'Security credentials and trust signals', required: true, position: 3, sectorHints: 'Regulatory badges (FCA, FDIC). Encryption icons. "Your money is protected" messaging. Partner bank logos.' },
    { name: 'Features', type: 'features', description: 'Product feature showcase', required: true, position: 4, sectorHints: 'Key features: instant transfers, multi-currency, budgeting, crypto. Phone mockup per feature.' },
    { name: 'How It Works', type: 'how-it-works', description: 'Getting started steps', required: true, position: 5, sectorHints: '3 steps: Download → Verify → Start using. Quick, simple, emphasize speed of onboarding.' },
    { name: 'Pricing', type: 'pricing', description: 'Plan comparison', required: false, position: 6, sectorHints: 'Free vs Premium tiers. Feature comparison. Transparent fee structure. "Free forever" for basic.' },
    { name: 'Testimonials', type: 'testimonials', description: 'User reviews and ratings', required: true, position: 7, sectorHints: 'App store ratings (4.8★). User quotes about specific features. Trust-building metrics.' },
    { name: 'FAQ', type: 'faq', description: 'Financial FAQ', required: false, position: 8, sectorHints: 'Security questions, fees, supported countries, regulatory compliance. Clear, reassuring tone.' },
    { name: 'CTA Banner', type: 'cta-banner', description: 'App download section', required: true, position: 9, sectorHints: 'Phone mockup + app store buttons. QR code optional. "Join X million users" social proof.' },
    { name: 'Footer', type: 'footer', description: 'Fintech footer with legal', required: true, position: 10, sectorHints: 'Legal disclaimers, regulatory info, security certifications. Required compliance text.' },
  ],
};

const GENERIC_BLUEPRINT: Omit<PageSection, 'id'>[] = [
  { name: 'Navigation Bar', type: 'navbar', description: 'Responsive navbar with logo, links, and CTA', required: true, position: 1, sectorHints: 'Sticky on scroll. Mobile hamburger menu. Primary CTA button.' },
  { name: 'Hero Section', type: 'hero', description: 'Full-width hero with headline and CTA', required: true, position: 2, sectorHints: 'Clear value proposition. Strong visual. Primary + secondary CTA buttons.' },
  { name: 'Features', type: 'features', description: 'Feature or benefit showcase', required: true, position: 3, sectorHints: 'Icon grid or alternating rows. 3-6 key features with icons and descriptions.' },
  { name: 'About', type: 'about', description: 'About or story section', required: false, position: 4, sectorHints: 'Brand story, mission, or team. Image + text split layout.' },
  { name: 'Testimonials', type: 'testimonials', description: 'Social proof section', required: true, position: 5, sectorHints: 'Customer quotes, ratings, logos. Carousel or grid.' },
  { name: 'CTA Banner', type: 'cta-banner', description: 'Conversion section', required: true, position: 6, sectorHints: 'Strong headline + CTA button. Reinforce main value prop.' },
  { name: 'Footer', type: 'footer', description: 'Site footer', required: true, position: 7, sectorHints: 'Navigation columns, social links, legal text, newsletter signup.' },
];

export function getPageSections(sector?: string, _subCategory?: string): PageSection[] {
  const key = sector?.toLowerCase() || '';
  const blueprint = PAGE_BLUEPRINTS[key] || GENERIC_BLUEPRINT;

  return blueprint.map((section, index) => ({
    ...section,
    id: `${section.type}-${index + 1}`,
  }));
}

export function getSectors(): SectorInfo[] {
  return [
    { name: 'Real Estate', subCategories: [
      { name: 'Flex Living / Co-living', sites: ['BeCasa', 'Node Living', 'Calido Living'], status: 'SUFFICIENT' },
      { name: 'Build-to-Rent (BTR)', sites: ['Greenford Quay', 'Quintain Living', 'Vertus'], status: 'SUFFICIENT' },
      { name: 'Luxury Residential', sites: ['The OWO Residences'], status: 'INSUFFICIENT' },
    ]},
    { name: 'Travel & Hospitality', subCategories: [
      { name: 'Marketplace', sites: ['Airbnb', 'Vrbo', 'Booking.com'], status: 'SUFFICIENT' },
      { name: 'Luxury Concierge', sites: ['OneFineStay', 'Plum Guide'], status: 'INSUFFICIENT' },
    ]},
    { name: 'SaaS / B2B', subCategories: [
      { name: 'SaaS Platform', sites: ['Stripe', 'Linear', 'Notion'], status: 'SUFFICIENT' },
    ]},
    { name: 'E-Commerce / DTC', subCategories: [
      { name: 'DTC / Premium Retail', sites: ['Apple Store', 'Allbirds', 'Glossier'], status: 'SUFFICIENT' },
    ]},
    { name: 'Fintech', subCategories: [
      { name: 'Digital Finance', sites: ['Revolut', 'Wise', 'Mercury'], status: 'SUFFICIENT' },
    ]},
    { name: 'Health & Wellness', subCategories: [
      { name: 'Wellness Tech', sites: ['Headspace', 'Oura Ring', 'Calm'], status: 'SUFFICIENT' },
    ]},
    { name: 'Fashion & Luxury', subCategories: [
      { name: 'Luxury / Premium', sites: ['Bottega Veneta', 'Jacquemus', 'Aesop'], status: 'SUFFICIENT' },
    ]},
    { name: 'Education / EdTech', subCategories: [
      { name: 'EdTech', sites: ['Duolingo', 'Brilliant', 'Coursera'], status: 'SUFFICIENT' },
    ]},
    { name: 'Automotive', subCategories: [
      { name: 'Automotive', sites: ['Porsche', 'Rivian', 'Polestar'], status: 'SUFFICIENT' },
    ]},
    { name: 'Food & Beverage', subCategories: [
      { name: 'DTC Food & Beverage', sites: ['Oatly', 'Liquid Death', 'Graza'], status: 'SUFFICIENT' },
    ]},
    { name: 'Professional Services', subCategories: [
      { name: 'Digital Marketing', sites: ['Pepe Chamorro'], status: 'INSUFFICIENT' },
    ]},
    { name: 'Tech & Consumer', subCategories: [
      { name: 'Brand Experience', sites: ['Xiaomi Future Gallery'], status: 'INSUFFICIENT' },
    ]},
  ];
}
