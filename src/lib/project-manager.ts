import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
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

export function createProject(config: ProjectConfig): Project {
  const db = getDb();
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
  db.prepare(
    `INSERT INTO projects (id, name, slug, path, config, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, config.name, slug, projectPath, JSON.stringify(config), 'draft', now, now);

  // Create default "Home" page
  const homePageId = uuidv4();
  db.prepare(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(homePageId, id, 'Home', 'home', 0, now, now);

  return project;
}

export function listProjects(): ProjectSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.slug, p.config, p.status, p.created_at, p.updated_at,
              COUNT(c.id) as component_count
       FROM projects p
       LEFT JOIN components c ON c.project_id = p.id
       GROUP BY p.id
       ORDER BY p.updated_at DESC`
    )
    .all() as Array<{
    id: string;
    name: string;
    slug: string;
    config: string;
    status: string;
    created_at: string;
    updated_at: string;
    component_count: number;
  }>;

  return rows.map((row) => {
    const config = JSON.parse(row.config) as ProjectConfig;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sector: config.sector,
      outputFormat: config.outputFormat,
      status: row.status,
      componentCount: row.component_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function getProject(id: string): Project | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as {
    id: string;
    name: string;
    slug: string;
    path: string;
    config: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  const config = JSON.parse(row.config) as ProjectConfig;

  // Auto-migrate: ensure project has at least one page
  ensureProjectHasPages(row.id, row.path);

  // Read phases from TEAM_BOARD.md if it exists
  const phases = readPhases(row.path);

  // Get components
  const components = getProjectComponents(id);

  // Get pages
  const pages = getProjectPages(id);

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

export function deleteProject(id: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT path FROM projects WHERE id = ?').get(id) as { path: string } | undefined;
  if (!row) return false;

  // Remove from database
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);

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
function ensureProjectHasPages(projectId: string, projectPath: string): void {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM pages WHERE project_id = ?').get(projectId) as { cnt: number };
  if (existing.cnt > 0) {
    // Pages exist — ensure join table is populated for any orphan components
    migrateOrphanComponents(projectId);
    return;
  }

  const now = new Date().toISOString();
  const homePageId = uuidv4();
  db.prepare(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(homePageId, projectId, 'Home', 'home', 0, now, now);

  // Link all components to the Home page via join table
  const components = db.prepare('SELECT id, sort_order FROM components WHERE project_id = ?').all(projectId) as Array<{ id: string; sort_order: number }>;
  const insertLink = db.prepare('INSERT OR IGNORE INTO page_components (page_id, component_id, sort_order) VALUES (?, ?, ?)');
  for (const comp of components) {
    insertLink.run(homePageId, comp.id, comp.sort_order);
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
function migrateOrphanComponents(projectId: string): void {
  const db = getDb();
  // Find components that aren't in any page_components entry
  const orphans = db.prepare(
    `SELECT c.id, c.sort_order FROM components c
     WHERE c.project_id = ?
     AND NOT EXISTS (SELECT 1 FROM page_components pc WHERE pc.component_id = c.id)`
  ).all(projectId) as Array<{ id: string; sort_order: number }>;

  if (orphans.length === 0) return;

  // Get the first page for this project
  const firstPage = db.prepare('SELECT id FROM pages WHERE project_id = ? ORDER BY sort_order LIMIT 1').get(projectId) as { id: string } | undefined;
  if (!firstPage) return;

  const insertLink = db.prepare('INSERT OR IGNORE INTO page_components (page_id, component_id, sort_order) VALUES (?, ?, ?)');
  for (const orphan of orphans) {
    insertLink.run(firstPage.id, orphan.id, orphan.sort_order);
  }
}

export function getProjectPages(projectId: string): PageSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, COUNT(pc.component_id) as component_count
       FROM pages p
       LEFT JOIN page_components pc ON pc.page_id = p.id
       WHERE p.project_id = ?
       GROUP BY p.id
       ORDER BY p.sort_order`
    )
    .all(projectId) as Array<{
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    component_count: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    order: row.sort_order,
    componentCount: row.component_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getPage(pageId: string): Page | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId) as {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  // Get components linked to this page via join table
  const components = getPageComponents(row.project_id, row.id);

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
function getPageComponents(projectId: string, pageId: string): ComponentEntry[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT c.*, pc.sort_order as page_sort_order,
            GROUP_CONCAT(cv.version || '::' || cv.code || '::' || COALESCE(cv.feedback, '') || '::' || cv.created_at, '||||') as versions_raw
     FROM page_components pc
     JOIN components c ON c.id = pc.component_id
     LEFT JOIN component_versions cv ON cv.component_id = c.id
     WHERE pc.page_id = ? AND c.project_id = ?
     GROUP BY c.id
     ORDER BY pc.sort_order`
  ).all(pageId, projectId) as Array<{
    id: string;
    name: string;
    type: string;
    page_id: string | null;
    current_version: number;
    status: string;
    page_sort_order: number;
    versions_raw: string | null;
  }>;

  return rows.map((row) => {
    const versions = row.versions_raw
      ? row.versions_raw.split('||||').map((v) => {
          const [version, code, feedback, createdAt] = v.split('::');
          return { version: parseInt(version), code, feedback: feedback || undefined, createdAt };
        })
      : [];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      versions,
      currentVersion: row.current_version,
      status: row.status as ComponentEntry['status'],
      order: row.page_sort_order,
    };
  });
}

export function createPage(projectId: string, name: string): PageSummary {
  const db = getDb();
  const id = uuidv4();
  const slug = slugifyPage(name);
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM pages WHERE project_id = ?')
    .get(projectId) as { next_order: number };

  db.prepare(
    `INSERT INTO pages (id, project_id, name, slug, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectId, name, slug, maxOrder.next_order, now, now);

  return {
    id,
    name,
    slug,
    order: maxOrder.next_order,
    componentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePage(pageId: string, updates: { name?: string; slug?: string }): boolean {
  const db = getDb();
  const now = new Date().toISOString();

  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId) as { id: string; project_id: string; slug: string } | undefined;
  if (!page) return false;

  const newName = updates.name;
  const newSlug = updates.slug || (newName ? slugifyPage(newName) : undefined);

  db.prepare(
    `UPDATE pages SET name = COALESCE(?, name), slug = COALESCE(?, slug), updated_at = ? WHERE id = ?`
  ).run(newName || null, newSlug || null, now, pageId);

  return true;
}

export function deletePage(pageId: string): boolean {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId) as {
    id: string;
    project_id: string;
  } | undefined;

  if (!page) return false;

  // Don't allow deleting the last page
  const count = db.prepare('SELECT COUNT(*) as cnt FROM pages WHERE project_id = ?').get(page.project_id) as { cnt: number };
  if (count.cnt <= 1) return false;

  // Remove join table entries (components themselves are shared — don't delete them)
  db.prepare('DELETE FROM page_components WHERE page_id = ?').run(pageId);

  // Delete the page
  db.prepare('DELETE FROM pages WHERE id = ?').run(pageId);

  return true;
}

export function duplicatePage(pageId: string): PageSummary | null {
  const db = getDb();
  const source = getPage(pageId);
  if (!source) return null;

  // Create new page with "(Copy)" suffix
  const newPage = createPage(source.projectId, `${source.name} (Copy)`);

  // Link the SAME components to the new page (shared — not copied)
  const insertLink = db.prepare('INSERT OR IGNORE INTO page_components (page_id, component_id, sort_order) VALUES (?, ?, ?)');
  for (const comp of source.components) {
    insertLink.run(newPage.id, comp.id, comp.order);
  }

  return { ...newPage, componentCount: source.components.length };
}

/** Link a component to a page */
export function linkComponentToPage(pageId: string, componentId: string, sortOrder: number): void {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO page_components (page_id, component_id, sort_order) VALUES (?, ?, ?)').run(pageId, componentId, sortOrder);
}

export function reorderPages(projectId: string, orderedIds: string[]): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE pages SET sort_order = ?, updated_at = ? WHERE id = ? AND project_id = ?');
  for (let i = 0; i < orderedIds.length; i++) {
    stmt.run(i, now, orderedIds[i], projectId);
  }
}

// ── Component Queries ─────────────────────────────────

function getProjectComponents(projectId: string): ComponentEntry[] {
  const db = getDb();

  const rows = db.prepare(
    `SELECT c.*,
            GROUP_CONCAT(cv.version || '::' || cv.code || '::' || COALESCE(cv.feedback, '') || '::' || cv.created_at, '||||') as versions_raw
     FROM components c
     LEFT JOIN component_versions cv ON cv.component_id = c.id
     WHERE c.project_id = ?
     GROUP BY c.id
     ORDER BY c.sort_order`
  ).all(projectId) as Array<{
    id: string;
    name: string;
    type: string;
    page_id: string | null;
    current_version: number;
    status: string;
    sort_order: number;
    versions_raw: string | null;
  }>;

  return rows.map((row) => {
    const versions = row.versions_raw
      ? row.versions_raw.split('||||').map((v) => {
          const [version, code, feedback, createdAt] = v.split('::');
          return {
            version: parseInt(version),
            code,
            feedback: feedback || undefined,
            createdAt,
          };
        })
      : [];

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      pageId: row.page_id || undefined,
      versions,
      currentVersion: row.current_version,
      status: row.status as ComponentEntry['status'],
      order: row.sort_order,
    };
  });
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
