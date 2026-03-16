import { NextRequest } from 'next/server';
import { getProject } from '@/lib/project-manager';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const format = (body.format || project.config.outputFormat) as string;

  // Stream SSE progress to the frontend
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (type: string, content: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, content, timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch { /* closed */ }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch { /* already closed */ }
      };

      try {
        const componentsDir = path.join(project.path, 'components');
        const exportDir = path.join(project.path, 'export', format);

        // 1. Read component files from flat components/ directory (shared across pages)
        send('text', 'Reading component files...');
        const ext = project.config.outputFormat === 'react' ? 'tsx'
          : project.config.outputFormat === 'vue' ? 'vue' : 'html';

        const componentFiles: ComponentFile[] = [];

        if (fs.existsSync(componentsDir)) {
          const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
          const files = entries.filter((e) => e.isFile() && e.name.endsWith(`.${ext}`));
          for (const file of files) {
            const filePath = path.join(componentsDir, file.name);
            const content = fs.readFileSync(filePath, 'utf-8');
            const type = file.name.replace(`.${ext}`, '');
            componentFiles.push({ name: file.name, type, content });
            send('text', `  Read ${file.name} (${content.length} bytes)`);
          }
        }

        if (componentFiles.length === 0) {
          send('error', 'No component files found in components/ directory');
          close();
          return;
        }

        send('text', `Found ${componentFiles.length} components`);

        // 2. Create export directory
        fs.mkdirSync(exportDir, { recursive: true });

        // 3. Export based on format
        const filesCreated: string[] = [];

        if (format === 'vanilla' || format === 'html') {
          send('text', 'Assembling vanilla HTML export...');
          const result = exportVanillaHtml(componentFiles, project.config, exportDir);
          filesCreated.push(...result);
        } else if (format === 'designer') {
          send('text', 'Generating designer mode export...');
          const result = exportDesignerMode(componentFiles, project.config, exportDir);
          filesCreated.push(...result);
        } else if (format === 'react') {
          send('text', 'Generating React export...');
          const result = exportReact(componentFiles, project.config, exportDir);
          filesCreated.push(...result);
        } else if (format === 'vue') {
          send('text', 'Generating Vue export...');
          const result = exportVue(componentFiles, project.config, exportDir);
          filesCreated.push(...result);
        } else {
          send('text', `Unknown format "${format}", falling back to vanilla HTML`);
          const result = exportVanillaHtml(componentFiles, project.config, exportDir);
          filesCreated.push(...result);
        }

        for (const f of filesCreated) {
          send('text', `  Created ${f}`);
        }

        send('result', `Export complete! ${filesCreated.length} files written to export/${format}/`);
        close();
      } catch (error) {
        send('error', error instanceof Error ? error.message : 'Export failed');
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ── Types ─────────────────────────────────────────────
interface ProjectConfig {
  name: string;
  style: string;
  sector: string;
  subCategory?: string;
  outputFormat: string;
  typography: { heading: string; body: string };
  colors: { primary: string; secondary?: string; accent?: string; background?: string };
  url?: string;
  competitors: string[];
}

interface ComponentFile {
  name: string;
  type: string;
  content: string;
}

// ── Vanilla HTML Export ────────────────────────────────
function exportVanillaHtml(
  components: ComponentFile[],
  config: ProjectConfig,
  exportDir: string
): string[] {
  const created: string[] = [];

  // Extract styles, font links, and body content from each component
  const allStyles: string[] = [];
  const allBodies: string[] = [];
  const fontLinks = new Set<string>();

  for (const comp of components) {
    const { css, body, links } = parseComponentHtml(comp.content);
    for (const link of links) fontLinks.add(link);
    if (css.trim()) allStyles.push(`/* === ${comp.type} === */\n${css}`);
    allBodies.push(`  <!-- ${comp.type} -->\n${body}`);
  }

  // Build index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name}</title>
  ${Array.from(fontLinks).join('\n  ')}
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${allBodies.join('\n\n')}
  <script src="script.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(exportDir, 'index.html'), indexHtml, 'utf-8');
  created.push('index.html');

  const stylesCss = `/* ${config.name} — Generated Styles */

/* === Design Tokens === */
:root {
  --color-primary: ${config.colors.primary};
  --color-secondary: ${config.colors.secondary || '#6b7280'};
  --color-accent: ${config.colors.accent || config.colors.primary};
  --color-background: ${config.colors.background || '#ffffff'};
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --font-heading: '${config.typography.heading}', sans-serif;
  --font-body: '${config.typography.body}', sans-serif;
  --space-section: 6rem;
  --space-component: 3rem;
  --space-element: 1.5rem;
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  background: var(--color-background);
  color: var(--color-text);
  line-height: 1.6;
}
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; }

/* === Component Styles === */
${allStyles.join('\n\n')}
`;

  fs.writeFileSync(path.join(exportDir, 'styles.css'), stylesCss, 'utf-8');
  created.push('styles.css');

  const scriptJs = `// ${config.name} — Generated Scripts
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
`;

  fs.writeFileSync(path.join(exportDir, 'script.js'), scriptJs, 'utf-8');
  created.push('script.js');

  return created;
}

// ── Designer Mode Export ──────────────────────────────
function exportDesignerMode(
  components: ComponentFile[],
  config: ProjectConfig,
  exportDir: string
): string[] {
  const created: string[] = [];

  // 1. DESIGN_SYSTEM.md
  const designSystem = `# ${config.name} — Design System

## Brand
- **Sector**: ${config.sector}${config.subCategory ? ` > ${config.subCategory}` : ''}
- **Style**: ${config.style}

## Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Primary | \`${config.colors.primary}\` | CTAs, links, key accents |
| Secondary | \`${config.colors.secondary || '#6b7280'}\` | Supporting elements |
| Accent | \`${config.colors.accent || config.colors.primary}\` | Highlights, badges |
| Background | \`${config.colors.background || '#ffffff'}\` | Page background |
| Text | \`#1a1a1a\` | Body text |
| Text Muted | \`#6b7280\` | Secondary text, captions |

## Typography
| Role | Font | Weight | Size |
|------|------|--------|------|
| Heading | ${config.typography.heading} | 600-700 | 2rem-3.5rem |
| Subheading | ${config.typography.heading} | 500-600 | 1.25rem-1.75rem |
| Body | ${config.typography.body} | 400 | 1rem |
| Caption | ${config.typography.body} | 400 | 0.875rem |
| Button | ${config.typography.body} | 500-600 | 0.875rem-1rem |

## Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| Section | 6rem (96px) | Between major page sections |
| Component | 3rem (48px) | Between components within a section |
| Element | 1.5rem (24px) | Between elements within a component |
| Inner | 1rem (16px) | Padding within cards/containers |

## CSS Custom Properties
\`\`\`css
:root {
  --color-primary: ${config.colors.primary};
  --color-secondary: ${config.colors.secondary || '#6b7280'};
  --color-accent: ${config.colors.accent || config.colors.primary};
  --color-background: ${config.colors.background || '#ffffff'};
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --font-heading: '${config.typography.heading}', sans-serif;
  --font-body: '${config.typography.body}', sans-serif;
  --space-section: 6rem;
  --space-component: 3rem;
  --space-element: 1.5rem;
}
\`\`\`
`;

  fs.writeFileSync(path.join(exportDir, 'DESIGN_SYSTEM.md'), designSystem, 'utf-8');
  created.push('DESIGN_SYSTEM.md');

  // 2. COMPONENT_SPECS.md
  const componentSpecs = components.map((comp) => {
    const { css, body, links } = parseComponentHtml(comp.content);
    const lineCount = comp.content.split('\n').length;
    const hasResponsive = css.includes('@media');
    const hasAnimations = css.includes('transition') || css.includes('animation') || css.includes('@keyframes');
    const hasHoverStates = css.includes(':hover');

    return `### ${comp.type}
- **File**: \`components/${comp.name}\`
- **Lines**: ${lineCount}
- **Responsive**: ${hasResponsive ? 'Yes' : 'No'}
- **Animations**: ${hasAnimations ? 'Yes' : 'No'}
- **Hover States**: ${hasHoverStates ? 'Yes' : 'No'}
- **Font Links**: ${links.length > 0 ? links.length + ' external' : 'None'}
- **CSS Size**: ${css.length} chars
`;
  }).join('\n');

  const specsDoc = `# ${config.name} — Component Specifications

## Overview
Total components: ${components.length}
Output format: ${config.outputFormat}

## Components
${componentSpecs}
`;

  fs.writeFileSync(path.join(exportDir, 'COMPONENT_SPECS.md'), specsDoc, 'utf-8');
  created.push('COMPONENT_SPECS.md');

  // 3. IMPLEMENTATION_GUIDE.md
  const implGuide = `# ${config.name} — Implementation Guide

## Quick Start
1. Copy the \`components/\` directory into your project
2. Include the design tokens CSS (see DESIGN_SYSTEM.md)
3. Import Google Fonts for **${config.typography.heading}** and **${config.typography.body}**
4. Compose sections in order within your page layout

## Section Order
${components.map((c, i) => `${i + 1}. \`${c.type}\` — ${c.name}`).join('\n')}

## Responsive Breakpoints
- Mobile: 375px
- Tablet: 768px
- Desktop: 1024px
- Wide: 1440px+

## Color Usage Guide
- **Primary** (\`${config.colors.primary}\`): CTAs, active states, key brand elements
- **Secondary** (\`${config.colors.secondary || '#6b7280'}\`): Supporting UI, borders, dividers
- **Accent** (\`${config.colors.accent || config.colors.primary}\`): Highlights, badges, special callouts
- **Background** (\`${config.colors.background || '#ffffff'}\`): Page and card backgrounds

## Integration Notes
- All components use CSS custom properties — override \`:root\` values to rebrand
- Components are self-contained sections — can be reordered or omitted
- Each component includes its own scoped CSS to avoid conflicts
`;

  fs.writeFileSync(path.join(exportDir, 'IMPLEMENTATION_GUIDE.md'), implGuide, 'utf-8');
  created.push('IMPLEMENTATION_GUIDE.md');

  // 4. Copy component files as reference HTML
  const compDir = path.join(exportDir, 'components');
  fs.mkdirSync(compDir, { recursive: true });
  for (const comp of components) {
    fs.writeFileSync(path.join(compDir, comp.name), comp.content, 'utf-8');
    created.push(`components/${comp.name}`);
  }

  return created;
}

// ── React Export ──────────────────────────────────────
function exportReact(
  components: ComponentFile[],
  config: ProjectConfig,
  exportDir: string
): string[] {
  const created: string[] = [];
  const compDir = path.join(exportDir, 'components');
  fs.mkdirSync(compDir, { recursive: true });

  // Copy original components
  for (const comp of components) {
    fs.writeFileSync(path.join(compDir, comp.name), comp.content, 'utf-8');
    created.push(`components/${comp.name}`);
  }

  // tokens.css
  const tokens = buildTokensCss(config);
  const stylesDir = path.join(exportDir, 'styles');
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.writeFileSync(path.join(stylesDir, 'tokens.css'), tokens, 'utf-8');
  created.push('styles/tokens.css');

  // package.json
  const pkg = JSON.stringify({
    name: config.name.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { typescript: '^5.0.0', '@types/react': '^19.0.0' },
  }, null, 2);
  fs.writeFileSync(path.join(exportDir, 'package.json'), pkg, 'utf-8');
  created.push('package.json');

  return created;
}

// ── Vue Export ────────────────────────────────────────
function exportVue(
  components: ComponentFile[],
  config: ProjectConfig,
  exportDir: string
): string[] {
  const created: string[] = [];
  const compDir = path.join(exportDir, 'components');
  fs.mkdirSync(compDir, { recursive: true });

  for (const comp of components) {
    fs.writeFileSync(path.join(compDir, comp.name), comp.content, 'utf-8');
    created.push(`components/${comp.name}`);
  }

  const tokens = buildTokensCss(config);
  const stylesDir = path.join(exportDir, 'styles');
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.writeFileSync(path.join(stylesDir, 'tokens.css'), tokens, 'utf-8');
  created.push('styles/tokens.css');

  const pkg = JSON.stringify({
    name: config.name.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    dependencies: { vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0', vite: '^6.0.0', '@vitejs/plugin-vue': '^5.0.0' },
  }, null, 2);
  fs.writeFileSync(path.join(exportDir, 'package.json'), pkg, 'utf-8');
  created.push('package.json');

  return created;
}

// ── Helpers ───────────────────────────────────────────
function parseComponentHtml(html: string): { css: string; body: string; links: string[] } {
  if (!html) return { css: '', body: '', links: [] };

  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: string[] = [];
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles.push(match[1]);
  }

  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const links: string[] = [];
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[0]);
  }

  let body = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .trim();

  return { css: styles.join('\n'), body, links };
}

function buildTokensCss(config: ProjectConfig): string {
  return `:root {
  --color-primary: ${config.colors.primary};
  --color-secondary: ${config.colors.secondary || '#6b7280'};
  --color-accent: ${config.colors.accent || config.colors.primary};
  --color-background: ${config.colors.background || '#ffffff'};
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --font-heading: '${config.typography.heading}', sans-serif;
  --font-body: '${config.typography.body}', sans-serif;
}
`;
}
