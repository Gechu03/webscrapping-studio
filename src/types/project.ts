export type OutputFormat = 'react' | 'vue' | 'vanilla' | 'designer';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Phase {
  id: number;
  name: string;
  label: string;
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export const PHASES: { id: number; name: string; label: string }[] = [
  { id: 0, name: 'INIT', label: 'Initialize' },
  { id: 1, name: 'DISCOVERY', label: 'Discovery' },
  { id: 2, name: 'DESIGN', label: 'Design' },
  { id: 3, name: 'PLANNING', label: 'Planning' },
  { id: 4, name: 'BUILD', label: 'Build' },
  { id: 5, name: 'QA', label: 'QA Review' },
  { id: 6, name: 'CLOSEOUT', label: 'Closeout' },
];

export interface ProjectConfig {
  name: string;
  url?: string;
  sector: string;
  subCategory?: string;
  outputFormat: OutputFormat;
  style: string;
  typography: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };
  competitors: string[];
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  path: string;
  config: ProjectConfig;
  phases: Phase[];
  components: ComponentEntry[];
  pages: PageSummary[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'analyzing' | 'building' | 'completed';
}

export interface ComponentEntry {
  id: string;
  name: string;
  type: string;
  pageId?: string;
  versions: ComponentVersion[];
  currentVersion: number;
  status: 'draft' | 'generating' | 'review' | 'approved';
  order: number;
}

export interface Page {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  order: number;
  components: ComponentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PageSummary {
  id: string;
  name: string;
  slug: string;
  order: number;
  componentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentVersion {
  version: number;
  code: string;
  feedback?: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  sector: string;
  outputFormat: OutputFormat;
  status: string;
  componentCount: number;
  createdAt: string;
  updatedAt: string;
}
