import { Pool, QueryResult } from 'pg';

let pool: Pool | null = null;
let initialized = false;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const p = getPool();
  if (!initialized) {
    await initializeDb();
    initialized = true;
  }
  return p.query(text, params);
}

async function initializeDb() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS component_versions (
      id SERIAL PRIMARY KEY,
      component_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      code TEXT NOT NULL,
      feedback TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claude_processes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      prompt TEXT NOT NULL,
      output TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS page_components (
      page_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (page_id, component_id),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_email TEXT PRIMARY KEY,
      claude_access_token TEXT,
      claude_refresh_token TEXT,
      claude_expires_at INTEGER,
      claude_scopes TEXT,
      claude_subscription_type TEXT,
      claude_connected_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migration: add page_id column to components if it doesn't exist
  const colCheck = await p.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'components' AND column_name = 'page_id'
  `);
  if (colCheck.rows.length === 0) {
    await p.query(`ALTER TABLE components ADD COLUMN page_id TEXT REFERENCES pages(id)`);
  }
}
