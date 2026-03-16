import type { CompositionEntry } from '@/types/builder';

/**
 * Detect if HTML is a section-only fragment (no <!DOCTYPE> or <html> wrapper).
 */
function isSectionOnly(html: string): boolean {
  const trimmed = html.trimStart();
  return !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<!doctype') && !trimmed.startsWith('<html');
}

/**
 * Extract the inner content of <body> from a self-contained HTML document,
 * or parse a section-only HTML fragment.
 * Also extracts <style> blocks and <link> tags.
 */
export function extractBodyContent(html: string): { fontLinks: string[]; css: string; body: string } {
  if (!html) return { fontLinks: [], css: '', body: '' };

  // Extract style blocks (from <head> or <body> or standalone)
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: string[] = [];
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles.push(match[1]);
  }

  // Extract link tags (Google Fonts, etc.)
  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const links: string[] = [];
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[0]);
  }

  let body: string;

  if (isSectionOnly(html)) {
    // Section-only HTML: strip style and link tags, keep the rest as body
    body = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .trim();
  } else {
    // Full-document HTML: extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    body = bodyMatch ? bodyMatch[1] : html;

    // If no <body> tag was found, strip document scaffolding that would render as text
    if (!bodyMatch) {
      body = body
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<html[^>]*>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<meta[^>]*>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<link[^>]*>/gi, '');
    }

    // Remove style tags from body content (already extracted)
    body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
  }

  return { fontLinks: links, css: styles.join('\n'), body };
}

/**
 * Compose a full HTML page from ordered composition entries.
 * Deduplicates Google Fonts links and merges styles.
 */
export function composePageHtml(
  entries: CompositionEntry[],
  projectConfig?: {
    typography?: { heading: string; body: string };
    colors?: { primary: string; secondary?: string; accent?: string; background?: string };
  }
): string {
  if (entries.length === 0) {
    return emptyPageHtml();
  }

  const allStyles: string[] = [];
  const allBodies: string[] = [];
  const fontLinks = new Set<string>();

  for (const entry of entries.filter((e) => e.status === 'ready' && e.html)) {
    const { fontLinks: links, css, body } = extractBodyContent(entry.html);

    for (const link of links) {
      fontLinks.add(link);
    }

    if (css.trim()) {
      allStyles.push(`/* === ${entry.name} === */\n${css}`);
    }

    allBodies.push(
      `<div data-section="${entry.patternType}" id="section-${entry.id}">\n${body}\n</div>`
    );
  }

  const colors = projectConfig?.colors;
  const typo = projectConfig?.typography;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Preview</title>
  ${Array.from(fontLinks).join('\n  ')}
  <style>
    /* === Reset & Design Tokens === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      ${colors?.primary ? `--color-primary: ${colors.primary};` : ''}
      ${colors?.secondary ? `--color-secondary: ${colors.secondary};` : ''}
      ${colors?.accent ? `--color-accent: ${colors.accent};` : ''}
      ${colors?.background ? `--color-background: ${colors.background};` : '--color-background: #ffffff;'}
      ${typo?.heading ? `--font-heading: '${typo.heading}', sans-serif;` : ''}
      ${typo?.body ? `--font-body: '${typo.body}', sans-serif;` : ''}
    }
    body {
      font-family: var(--font-body, system-ui, sans-serif);
      background: var(--color-background, #fff);
      color: #1a1a1a;
      line-height: 1.6;
    }

    ${allStyles.join('\n\n    ')}
  </style>
</head>
<body>
${allBodies.join('\n\n')}
</body>
</html>`;
}

function emptyPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
      color: #94a3b8;
      background: #f8fafc;
    }
    .empty {
      text-align: center;
    }
    .empty h2 {
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .empty p {
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="empty">
    <h2>No sections yet</h2>
    <p>Click a component chip or type in the chat to start building</p>
  </div>
</body>
</html>`;
}
