import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/project-manager';
import type { ProjectConfig } from '@/types/project';

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const config: ProjectConfig = {
      name: body.name,
      url: body.url || undefined,
      sector: body.sector,
      subCategory: body.subCategory || undefined,
      outputFormat: body.outputFormat || 'vanilla',
      style: body.style || 'Tech Minimal',
      typography: body.typography || { heading: 'Inter', body: 'Inter' },
      colors: body.colors || { primary: '#000000' },
      competitors: body.competitors || [],
    };

    if (!config.name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const project = createProject(config);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
