import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, getPool } from './db';
import type {
  Project,
  ProjectConfig,
  ProjectSummary,
  ComponentEntry,
  Phase,
  PageSummary,
  Page,
  PHASES as PhaseList,
} from '@/types/project';
import { PHASES } from '@/types/project';

// Root directory for all UI-created projects
// Projects live INSIDE the framework dir so Claude CLI finds CLAUDE.md when traversing up
const PROJECTS_ROOT = path.resolve(process.cwd(), '..', 'projects');
// Framework root for intelligence files
const FRAMEWORK_ROOT = path.resolve(process.cwd(), '..');

export function getProjectsRoot(): string {
  return PROJECTS_ROOT;
}

export function getFrameworkRoot(): string {
  return FRAMEWORK_ROOT;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createProject(config: ProjectConfig): Promise<Project> {
  const id = uuidv4();
  const slug = slugify(config.name);
  const projectPath = path.join(PROJECTS_ROOT, slug);

  // Ensure projects root exists
  if (!fs.existsSync(PROJECTS_ROOT)) {
    fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  }

  // Create project directory structure
  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'components'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'export'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

  // Generate project CLAUDE.md
  const claudeMd = generateProjectClaudeMd(config);
  fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), claudeMd, 'utf-8');

  // Initialize phases
  const phases: Phase[] = PHASES.map((p) => ({
    ...p,
    status: 'pending' as const,
  }));

  const now = new Date().toISOString();
  const project: Project = {
    id,
    name: config.name,
    slug,
    path: projectPath,
    config,
    phases,
    components: [],
    pages: [],
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };

  // Save to database
  await query(
    `INSERT INTO projects (id, name, slug, path, config, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, config.name, slug, projectPath, JSON.stringify(config), 'draft', now, now]
  );

  // Create default "Home" page
  const homePageId = uuidv4();
  await query(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [homePageId, id, 'Home', 'home', 0, now, now]
  );

  return project;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const result = await query(
    `SELECT p.id, p.name, p.slug, p.config, p.status, p.created_at, p.updated_at,
            COUNT(c.id) as component_count
     FROM projects p
     LEFT JOIN components c ON c.project_id = p.id
     GROUP BY p.id, p.name, p.slug, p.config, p.status, p.created_at, p.updated_at
     ORDER BY p.updated_at DESC`
  );

  return result.rows.map((row) => {
    const config = JSON.parse(row.config) as ProjectConfig;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sector: config.sector,
      outputFormat: config.outputFormat,
      status: row.status,
      componentCount: parseInt(row.component_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
  const row = result.rows[0];

  if (!row) return null;

  const config = JSON.parse(row.config) as ProjectConfig;

  // Auto-migrate: ensure project has at least one page
  await ensureProjectHasPages(row.id, row.path);

  // Read phases from TEAM_BOARD.md if it exists
  const phases = readPhases(row.path);

  // Get components
  const components = await getProjectComponents(id);

  // Get pages
  const pages = await getProjectPages(id);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    path: row.path,
    config,
    phases,
    components,
    pages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as Project['status'],
  };
}

export async function deleteProject(id: string): Promise<boolean> {
  const result = await query('SELECT path FROM projects WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return false;

  // Remove from database
  await query('DELETE FROM projects WHERE id = $1', [id]);

  // Optionally remove files (keep for safety - user can manually delete)
  return true;
}

// ── Page CRUD (shared components model) ───────────────
// Components live in flat components/ dir and are shared across pages.
// The page_components join table maps which components appear on which page.

function slugifyPage(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Auto-migration: ensures a project has at least one page.
 * Creates "Home" page, links all existing components via page_components join table.
 * Moves any files from subdirectories back to flat components/.
 */
async function ensureProjectHasPages(projectId: string, projectPath: string): Promise<void> {
  const existing = await query('SELECT COUNT(*) as cnt FROM pages WHERE project_id = $1', [projectId]);
  if (parseInt(existing.rows[0].cnt) > 0) {
    // Pages exist — ensure join table is populated for any orphan components
    await migrateOrphanComponents(projectId);
    return;
  }

  const now = new Date().toISOString();
  const homePageId = uuidv4();
  await query(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [homePageId, projectId, 'Home', 'home', 0, now, now]
  );

  // Link all components to the Home page via join table
  const components = await query('SELECT id, sort_order FROM components WHERE project_id = $1', [projectId]);
  for (const comp of components.rows) {
    await query(
      'INSERT INTO page_components (page_id, component_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [homePageId, comp.id, comp.sort_order]
    );
  }

  // Move files from subdirectories back to flat components/
  flattenComponentFiles(projectPath);
}

/** Move component files from subdirectories (e.g. components/home/) back to flat components/ */
function flattenComponentFiles(projectPath: string): void {
  const componentsDir = path.join(projectPath, 'components');
  if (!fs.existsSync(componentsDir)) return;

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(componentsDir, entry.name);
      const subFiles = fs.readdirSync(subDir, { withFileTypes: true });
      for (const file of subFiles) {
        if (file.isFile() && /\.(html|tsx|vue)$/.test(file.name)) {
          const src = path.join(subDir, file.name);
          const dest = path.join(componentsDir, file.name);
          if (!fs.existsSync(dest)) {
            fs.renameSync(src, dest);
          }
        }
      }
      // Remove empty subdirectory
      try {
        const remaining = fs.readdirSync(subDir);
        if (remaining.length === 0) fs.rmdirSync(subDir);
      } catch { /* ignore */ }
    }
  }
}

/** Ensure all components for a project are linked to at least one page */
async function migrateOrphanComponents(projectId: string): Promise<void> {
  // Find components that aren't in any page_components entry
  const orphans = await query(
    `SELECT c.id, c.sort_order FROM components c
     WHERE c.project_id = $1
     AND NOT EXISTS (SELECT 1 FROM page_components pc WHERE pc.component_id = c.id)`,
    [projectId]
  );

  if (orphans.rows.length === 0) return;

  // Get the first page for this project
  const firstPage = await query('SELECT id FROM pages WHERE project_id = $1 ORDER BY sort_order LIMIT 1', [projectId]);
  if (firstPage.rows.length === 0) return;

  for (const orphan of orphans.rows) {
    await query(
      'INSERT INTO page_components (page_id, component_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [firstPage.rows[0].id, orphan.id, orphan.sort_order]
    );
  }
}

export async function getProjectPages(projectId: string): Promise<PageSummary[]> {
  const result = await query(
    `SELECT p.*, COUNT(pc.component_id) as component_count
     FROM pages p
     LEFT JOIN page_components pc ON pc.page_id = p.id
     WHERE p.project_id = $1
     GROUP BY p.id
     ORDER BY p.sort_order`,
    [projectId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    order: row.sort_order,
    componentCount: parseInt(row.component_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getPage(pageId: string): Promise<Page | null> {
  const result = await query('SELECT * FROM pages WHERE id = $1', [pageId]);
  const row = result.rows[0];

  if (!row) return null;

  // Get components linked to this page via join table
  const components = await getPageComponents(row.project_id, row.id);

  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    order: row.sort_order,
    components,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Get components for a specific page via the join table */
async function getPageComponents(projectId: string, pageId: string): Promise<ComponentEntry[]> {
  // Fetch components linked to this page
  const compResult = await query(
    `SELECT c.*, pc.sort_order as page_sort_order
     FROM page_components pc
     JOIN components c ON c.id = pc.component_id
     WHERE pc.page_id = $1 AND c.project_id = $2
     ORDER BY pc.sort_order`,
    [pageId, projectId]
  );

  const entries: ComponentEntry[] = [];
  for (const row of compResult.rows) {
    // Fetch versions for each component
    const versionsResult = await query(
      `SELECT version, code, feedback, created_at
       FROM component_versions
       WHERE component_id = $1
       ORDER BY version`,
      [row.id]
    );

    const versions = versionsResult.rows.map((v) => ({
      version: v.version,
      code: v.code,
      feedback: v.feedback || undefined,
      createdAt: v.created_at,
    }));

    entries.push({
      id: row.id,
      name: row.name,
      type: row.type,
      versions,
      currentVersion: row.current_version,
      status: row.status as ComponentEntry['status'],
      order: row.page_sort_order,
    });
  }

  return entries;
}

export async function createPage(projectId: string, name: string): Promise<PageSummary> {
  const id = uuidv4();
  const slug = slugifyPage(name);
  const now = new Date().toISOString();

  const maxOrder = await query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM pages WHERE project_id = $1',
    [projectId]
  );

  const nextOrder = parseInt(maxOrder.rows[0].next_order);

  await query(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, projectId, name, slug, nextOrder, now, now]
  );

  return {
    id,
    name,
    slug,
    order: nextOrder,
    componentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePage(pageId: string, updates: { name?: string; slug?: string }): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await query('SELECT * FROM pages WHERE id = $1', [pageId]);
  if (result.rows.length === 0) return false;

  const newName = updates.name;
  const newSlug = updates.slug || (newName ? slugifyPage(newName) : undefined);

  await query(
    `UPDATE pages SET name = COALESCE($1, name), slug = COALESCE($2, slug), updated_at = $3 WHERE id = $4`,
    [newName || null, newSlug || null, now, pageId]
  );

  return true;
}

export async function deletePage(pageId: string): Promise<boolean> {
  const result = await query('SELECT * FROM pages WHERE id = $1', [pageId]);
  const page = result.rows[0];

  if (!page) return false;

  // Don't allow deleting the last page
  const count = await query('SELECT COUNT(*) as cnt FROM pages WHERE project_id = $1', [page.project_id]);
  if (parseInt(count.rows[0].cnt) <= 1) return false;

  // Remove join table entries (components themselves are shared — don't delete them)
  await query('DELETE FROM page_components WHERE page_id = $1', [pageId]);

  // Delete the page
  await query('DELETE FROM pages WHERE id = $1', [pageId]);

  return true;
}

export async function duplicatePage(pageId: string): Promise<PageSummary | null> {
  const source = await getPage(pageId);
  if (!source) return null;

  // Create new page with "(Copy)" suffix
  const newPage = await createPage(source.projectId, `${source.name} (Copy)`);

  // Link the SAME components to the new page (shared — not copied)
  for (const comp of source.components) {
    await query(
      'INSERT INTO page_components (page_id, component_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [newPage.id, comp.id, comp.order]
    );
  }

  return { ...newPage, componentCount: source.components.length };
}

/** Link a component to a page */
export async function linkComponentToPage(pageId: string, componentId: string, sortOrder: number): Promise<void> {
  await query(
    'INSERT INTO page_components (page_id, component_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [pageId, componentId, sortOrder]
  );
}

export async function reorderPages(projectId: string, orderedIds: string[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE pages SET sort_order = $1, updated_at = $2 WHERE id = $3 AND project_id = $4',
        [i, now, orderedIds[i], projectId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Component Queries ─────────────────────────────────

async function getProjectComponents(projectId: string): Promise<ComponentEntry[]> {
  const compResult = await query(
    `SELECT c.* FROM components c
     WHERE c.project_id = $1
     ORDER BY c.sort_order`,
    [projectId]
  );

  const entries: ComponentEntry[] = [];
  for (const row of compResult.rows) {
    const versionsResult = await query(
      `SELECT version, code, feedback, created_at
       FROM component_versions
       WHERE component_id = $1
       ORDER BY version`,
      [row.id]
    );

    const versions = versionsResult.rows.map((v) => ({
      version: v.version,
      code: v.code,
      feedback: v.feedback || undefined,
      createdAt: v.created_at,
    }));

    entries.push({
      id: row.id,
      name: row.name,
      type: row.type,
      pageId: row.page_id || undefined,
      versions,
      currentVersion: row.current_version,
      status: row.status as ComponentEntry['status'],
      order: row.sort_order,
    });
  }

  return entries;
}

function readPhases(projectPath: string): Phase[] {
  const teamBoardPath = path.join(projectPath, 'TEAM_BOARD.md');
  const defaultPhases = PHASES.map((p) => ({
    ...p,
    status: 'pending' as const,
  }));

  if (!fs.existsSync(teamBoardPath)) {
    return defaultPhases;
  }

  try {
    const content = fs.readFileSync(teamBoardPath, 'utf-8');

    // Normalize status strings from TEAM_BOARD.md to our PhaseStatus type
    const normalizeStatus = (raw: string): Phase['status'] => {
      const s = raw.trim().toUpperCase();
      if (s === 'DONE' || s === 'COMPLETE' || s === 'COMPLETED') return 'completed';
      if (s === 'RUNNING' || s === 'IN PROGRESS' || s === 'IN_PROGRESS') return 'running';
      if (s === 'FAILED' || s === 'ERROR') return 'failed';
      if (s === 'SKIPPED' || s === 'SKIP') return 'skipped';
      return 'pending';
    };

    return defaultPhases.map((phase) => {
      // Match table format: "| 0. Init | DONE |" or "| 1. Discovery | DONE |"
      const tableRegex = new RegExp(
        `\\|\\s*${phase.id}\\.\\s*[^|]+\\|\\s*(\\w[\\w ]*?)\\s*\\|`,
        'i'
      );
      // Match prose format: "Phase 0 ... : STATUS"
      const proseRegex = new RegExp(
        `Phase ${phase.id}.*?:\\s*(PENDING|RUNNING|COMPLETED|DONE|FAILED|SKIPPED|IN.PROGRESS)`,
        'i'
      );

      const tableMatch = content.match(tableRegex);
      const proseMatch = content.match(proseRegex);
      const match = tableMatch || proseMatch;

      if (match) {
        return {
          ...phase,
          status: normalizeStatus(match[1]),
        };
      }
      return phase;
    });
  } catch {
    return defaultPhases;
  }
}

function generateProjectClaudeMd(config: ProjectConfig): string {
  const frameworkPath = FRAMEWORK_ROOT.replace(/\\/g, '/');
  const sectorSlug = config.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return `# ${config.name} — Component Builder Project

## Framework Agent System
This project is part of the WebScrapping framework. The parent CLAUDE.md at the framework root
provides access to the full multi-agent orchestrator (orchestrator-v3), 13 specialist agents,
and 54 skills. Use Phase 4 (BUILD) workflow for page generation.

## Project Configuration
- **Output Format**: ${config.outputFormat}
- **Style**: ${config.style}
- **Typography**: ${config.typography.heading} (headings) + ${config.typography.body} (body)
- **Primary Color**: ${config.colors.primary}
${config.colors.secondary ? `- **Secondary Color**: ${config.colors.secondary}` : ''}
${config.colors.accent ? `- **Accent Color**: ${config.colors.accent}` : ''}
- **Sector**: ${config.sector}${config.subCategory ? ` > ${config.subCategory}` : ''}
${config.url ? `- **Reference URL**: ${config.url}` : ''}
${config.competitors.length > 0 ? `- **Competitors**: ${config.competitors.join(', ')}` : ''}

## Intelligence Context
Load the following framework intelligence files:
- \`${frameworkPath}/context/_build-system.md\` — Pre-delivery checklist, anti-pattern registry
- \`${frameworkPath}/context/_style-catalog.md\` — 8 style implementations with CSS specs
- \`${frameworkPath}/context/_animation.md\` — Core animation config, spring motion
- \`${frameworkPath}/context/_component-patterns.md\` — Component pattern tables
- \`${frameworkPath}/context/_design-system.md\` — Color, typography, spacing tables
- \`${frameworkPath}/context/${sectorSlug}.md\` — Sector-specific intelligence

## Design Tokens (Layer 2 — Semantic)
\`\`\`css
:root {
  /* Colors */
  --color-primary: ${config.colors.primary};
  --color-secondary: ${config.colors.secondary || '#6b7280'};
  --color-accent: ${config.colors.accent || config.colors.primary};
  --color-background: ${config.colors.background || '#ffffff'};
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;

  /* Typography */
  --font-heading: '${config.typography.heading}', sans-serif;
  --font-body: '${config.typography.body}', sans-serif;

  /* Spacing */
  --space-section: 6rem;
  --space-component: 3rem;
  --space-element: 1.5rem;
}
\`\`\`

## Component Guidelines
- Follow the Universal Pre-Delivery Checklist from _build-system.md
- Check Anti-Pattern Registry before each component delivery
- Use the project's design tokens for all values
- Output format: ${config.outputFormat === 'react' ? 'React TSX component' : config.outputFormat === 'vue' ? 'Vue SFC (.vue)' : config.outputFormat === 'designer' ? 'Reference HTML + design specs' : 'Vanilla HTML/CSS/JS'}
- When building sections, output ONLY the section content (a single <section> or <div> root element with embedded <style>)
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> wrappers — sections are composed into a full page by the builder

## Approved Components
<!-- Updated as components are approved in the builder -->
`;
}
