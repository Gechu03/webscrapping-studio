import type { ProjectConfig, OutputFormat } from '@/types/project';
import type { ComponentPattern } from '@/types/intelligence';
import type { PageSection } from '@/types/page-section';
import type { CompositionEntry } from '@/types/builder';

interface ComponentPromptInput {
  componentType: string;
  pattern?: ComponentPattern;
  style: string;
  content: {
    heading?: string;
    subheading?: string;
    body?: string;
    ctaText?: string;
    items?: string[];
    images?: string[];
  };
  additionalRequirements?: string;
  projectConfig: ProjectConfig;
}

export function buildComponentPrompt(input: ComponentPromptInput): string {
  const { componentType, pattern, style, content, additionalRequirements, projectConfig } = input;
  const formatInstruction = getFormatInstruction(projectConfig.outputFormat);

  return `Generate a ${componentType} component for this project.

COMPONENT REQUIREMENTS:
- Type: ${componentType}${pattern ? ` (★${'★'.repeat(pattern.rating - 1)} proven pattern)` : ''}
- Style: ${style}
${pattern?.description ? `- Pattern description: ${pattern.description}` : ''}
${pattern?.variants?.length ? `- Known variants: ${pattern.variants.join(', ')}` : ''}

CONTENT:
${content.heading ? `- Heading: "${content.heading}"` : ''}
${content.subheading ? `- Subheading: "${content.subheading}"` : ''}
${content.body ? `- Body text: "${content.body}"` : ''}
${content.ctaText ? `- CTA text: "${content.ctaText}"` : ''}
${content.items?.length ? `- Items:\n${content.items.map((i) => `  - ${i}`).join('\n')}` : ''}

DESIGN TOKENS:
- Primary color: ${projectConfig.colors.primary}
${projectConfig.colors.secondary ? `- Secondary color: ${projectConfig.colors.secondary}` : ''}
${projectConfig.colors.accent ? `- Accent color: ${projectConfig.colors.accent}` : ''}
- Heading font: ${projectConfig.typography.heading}
- Body font: ${projectConfig.typography.body}

${additionalRequirements ? `ADDITIONAL REQUIREMENTS:\n${additionalRequirements}\n` : ''}

OUTPUT FORMAT:
${formatInstruction}

Write the component to the appropriate components/ directory with filename ${componentType}.${getFileExtension(projectConfig.outputFormat)}
Use the project's design tokens (CSS custom properties).
Include responsive design (mobile-first).
Follow the pre-delivery checklist from _build-system.md.
${pattern?.antiPatterns?.length ? `\nANTI-PATTERNS TO AVOID:\n${pattern.antiPatterns.map((a) => `- ${a}`).join('\n')}` : ''}`;
}

export function buildIterationPrompt(
  componentType: string,
  feedback: string,
  outputFormat: OutputFormat
): string {
  return `The user reviewed the ${componentType} component and has this feedback:

"${feedback}"

Read the current component from components/${componentType}.${getFileExtension(outputFormat)}
Update the component based on the feedback.
Write the updated version to the same file.
Preserve the design tokens and responsive design.`;
}

export function buildAnalysisPrompt(
  url: string,
  competitors: string[],
  phases: number[],
  sector?: string
): string {
  const phaseNames = phases.map((p) => {
    const names: Record<number, string> = {
      0: 'INIT', 1: 'DISCOVERY', 2: 'DESIGN',
      3: 'PLANNING', 4: 'BUILD', 5: 'QA', 6: 'CLOSEOUT',
    };
    return names[p] || `Phase ${p}`;
  });

  const competitorList = competitors.filter(Boolean);

  return `analyze

Target URL: ${url}
Competitors: ${competitorList.length > 0 ? competitorList.join(', ') : 'Auto-suggest based on sector'}
${sector ? `Sector: ${sector}` : ''}
Phases to run: ${phaseNames.join(', ')}

IMPORTANT: This is a NON-INTERACTIVE session. Do NOT ask for confirmation or wait for user input.
Proceed immediately with all selected phases. The plan is already confirmed.

Execute the analysis pipeline now:
${phases.includes(0) ? '1. Phase 0 (INIT): Create TEAM_BOARD.md, classify sector' : ''}
${phases.includes(1) ? '2. Phase 1 (DISCOVERY): Analyze the target URL — extract design tokens, visual patterns, content structure, competitor comparison. Write ANALYSIS_REPORT.md' : ''}
${phases.includes(2) ? '3. Phase 2 (DESIGN): Generate DESIGN_SPEC.md, UX_SPEC.md, SEO_SPEC.md from the analysis' : ''}
${phases.includes(3) ? '4. Phase 3 (PLANNING): Generate BUILD_PLAN.md with ordered sections to build' : ''}
${phases.includes(4) ? '5. Phase 4 (BUILD): Build all sections from the specs' : ''}
${phases.includes(5) ? '6. Phase 5 (QA): Run QA panel reviews' : ''}
${phases.includes(6) ? '7. Phase 6 (CLOSEOUT): Update intelligence DB, archive reports' : ''}

Write all output files to the current project directory.`;
}

export function buildAutoBuilderPrompt(
  projectConfig: ProjectConfig,
  pageSections?: PageSection[]
): string {
  const ext = getFileExtension(projectConfig.outputFormat);
  const sectionList = pageSections
    ?.map((s) => `${s.position}. **${s.name}** (\`components/${s.type}.${ext}\`) — ${s.description}${s.required ? '' : ' *(optional)*'}`)
    .join('\n') || '(Use the project BUILD_PLAN.md or generate a sensible page structure for this sector)';

  const sectionHints = pageSections
    ?.map((s) => s.sectorHints ? `- **${s.name}**: ${s.sectorHints}` : null)
    .filter(Boolean)
    .join('\n') || '';

  return `## Build Phase — Full Page Generation

You are building a complete webpage for a **${projectConfig.sector}**${projectConfig.subCategory ? ` > ${projectConfig.subCategory}` : ''} project: "${projectConfig.name || 'Untitled'}".
Follow the Phase 4 (BUILD) workflow from the orchestrator.

### Instructions
1. Load build intelligence from the context/ directory: _build-system.md, _style-catalog.md, _animation.md
2. Read analysis specs if they exist: DESIGN_SPEC.md, UX_SPEC.md, SEO_SPEC.md, BUILD_PLAN.md
3. Generate ALL page sections listed below (or as defined in BUILD_PLAN.md if it exists)
4. Run the pre-delivery checklist from _build-system.md before finishing

### Page Blueprint
${sectionList}

${sectionHints ? `### Sector-Specific Guidance\n${sectionHints}\n` : ''}
### Design Tokens
- Primary color: ${projectConfig.colors.primary}
${projectConfig.colors.secondary ? `- Secondary color: ${projectConfig.colors.secondary}` : ''}
${projectConfig.colors.accent ? `- Accent color: ${projectConfig.colors.accent}` : ''}
${projectConfig.colors.background ? `- Background: ${projectConfig.colors.background}` : ''}
- Heading font: '${projectConfig.typography.heading}'
- Body font: '${projectConfig.typography.body}'
- Style: ${projectConfig.style}

### Output Format
For EACH section, write a file to \`components/{type}.${ext}\`:
- Output ONLY the section content — a single <section> or <div> root element
- Include a <style> block with section-specific CSS (scoped with a unique class prefix)
- Include Google Fonts <link> tags if needed
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags
- Use CSS custom properties (--color-primary, --font-heading, etc.)
- Must be responsive (375px-1440px+)
- Use realistic, sector-appropriate placeholder content
- Ensure visual continuity between sections (consistent spacing, typography, color usage)

### Expected Files
${pageSections?.map((s) => `${s.position}. \`components/${s.type}.${ext}\``).join('\n') || '(Generate based on BUILD_PLAN.md or sector blueprint)'}
`;
}

export function buildSectionPrompt(
  section: PageSection,
  totalSections: number,
  projectConfig: ProjectConfig,
  builtSections: CompositionEntry[],
  allSections: PageSection[]
): string {
  const ext = getFileExtension(projectConfig.outputFormat);

  // Build page structure visualization
  const structureLines = allSections.map((s) => {
    const built = builtSections.find((b) => b.patternType === s.type);
    if (s.id === section.id) return `${s.position}. >> ${s.name} << YOU ARE HERE`;
    if (built && built.status === 'ready') return `${s.position}. [done] ${s.name}`;
    return `${s.position}. [ ] ${s.name}`;
  });

  // List already built sections for visual continuity context
  const builtList = builtSections
    .filter((b) => b.status === 'ready')
    .map((b) => `- ${b.name} (components/${b.patternType}.${ext})`)
    .join('\n');

  return `You are building section **${section.position}** of **${totalSections}** for a **${projectConfig.sector}**${projectConfig.subCategory ? ` > ${projectConfig.subCategory}` : ''} page.
Create the "${section.name}" section.

## Page Structure
${structureLines.join('\n')}

${section.sectorHints ? `## Sector Guidance\n${section.sectorHints}\n` : ''}
${builtList ? `## Already Built Sections (for visual continuity)\n${builtList}\n` : ''}
## Design Tokens
- Primary color: ${projectConfig.colors.primary}
${projectConfig.colors.secondary ? `- Secondary color: ${projectConfig.colors.secondary}` : ''}
${projectConfig.colors.accent ? `- Accent color: ${projectConfig.colors.accent}` : ''}
- Heading font: '${projectConfig.typography.heading}'
- Body font: '${projectConfig.typography.body}'
- Style: ${projectConfig.style}

## Output Format
Write to \`components/${section.type}.${ext}\`:
- Output ONLY the section content — a single <section> or <div> root element
- Include a <style> block with section-specific CSS
- Include Google Fonts <link> tags if needed
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags
- Use CSS custom properties (--color-primary, --font-heading, etc.)
- Must be responsive (375px-1440px+)
- Use realistic, sector-appropriate content
- Maintain visual continuity with already-built sections
`;
}

function getFormatInstruction(format: OutputFormat): string {
  switch (format) {
    case 'react':
      return `Output as a React TSX component with TypeScript.
Use functional components with hooks.
Include proper TypeScript interfaces for props.
Use CSS modules or Tailwind classes for styling.
Export the component as default.`;
    case 'vue':
      return `Output as a Vue 3 Single File Component (.vue).
Use <script setup lang="ts"> with Composition API.
Include TypeScript prop definitions.
Use scoped <style> with CSS custom properties.`;
    case 'designer':
      return `Output as reference HTML with inline comments explaining design decisions.
Include a companion COMPONENT_SPEC.md with:
- Design rationale for each element
- Spacing/sizing tokens used
- Interaction states described
- Responsive breakpoint behavior
- Accessibility notes`;
    default:
      return `Output as vanilla HTML with embedded CSS and minimal JS.
Use semantic HTML5 elements.
Use CSS custom properties matching the project's design tokens.
Keep JavaScript minimal and vanilla (no frameworks).`;
  }
}

function getFileExtension(format: OutputFormat): string {
  switch (format) {
    case 'react': return 'tsx';
    case 'vue': return 'vue';
    default: return 'html';
  }
}
