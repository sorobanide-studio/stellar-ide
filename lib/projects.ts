/**
 * Project Management - Auto-discovers Soroban projects from workspace
 * Each folder in /workspace is a project initialized with `stellar contract init`
 */

import {
  execAsync,
  getWorkspacePath,
  getContainerName,
  escapeShellArg,
} from './docker/utils';

/**
 * Allowed shape for a project name: 1-64 characters, starting with an
 * alphanumeric, then alphanumerics, dots, underscores or hyphens. '..' is
 * explicitly rejected so the name can never traverse out of the workspace,
 * and a leading dot is impossible because the first character must be
 * alphanumeric (getAllProjects hides dotfolders anyway).
 */
const PROJECT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Returns true when `name` is a safe project folder name. Exported so callers
 * and tests can reuse the exact same rule the project commands enforce.
 */
export function isValidProjectName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    PROJECT_NAME_PATTERN.test(name) &&
    !name.includes('..')
  );
}

const INVALID_PROJECT_NAME = 'Invalid project name';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  contractType: 'soroban';
}

/**
 * Get all projects by listing folders in workspace
 */
export async function getAllProjects(walletAddress: string): Promise<Project[]> {
  try {
    const containerName = getContainerName(walletAddress);
    const projectPath = getWorkspacePath();
    
    // List all directories in workspace
    const cmd = `docker exec ${containerName} find ${projectPath} -maxdepth 1 -type d ! -name workspace -exec basename {} \\;`;
    const { stdout } = await execAsync(cmd);
    
    const folders = stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0 && !f.startsWith('.'));

    // Convert folders to projects
    const projects: Project[] = folders.map(name => ({
      id: `project_${name}`,
      name,
      createdAt: new Date().toISOString(),
      description: `Soroban contract project`,
      contractType: 'soroban',
    }));

    return projects;
  } catch (error) {
    console.error('Error reading projects:', error);
    return [];
  }
}


/**
 * Create a new project using stellar contract init
 */
export async function createProject(
  walletAddress: string,
  projectName: string,
  description?: string
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    // Validate before anything is executed or read.
    if (!isValidProjectName(projectName)) {
      return { success: false, error: INVALID_PROJECT_NAME };
    }

    const containerName = getContainerName(walletAddress);
    const projectPath = getWorkspacePath();
    const projects = await getAllProjects(walletAddress);
    
    // Check if project already exists
    if (projects.some(p => p.name === projectName)) {
      return { success: false, error: 'Project already exists' };
    }

    // Initialize Soroban contract using stellar command
    const cmd = `docker exec -u developer ${containerName} sh -c "cd ${escapeShellArg(projectPath)} && stellar contract init ${escapeShellArg(projectName)}"`;
    const result = await execAsync(cmd);
    
    console.log('Project initialization output:', result.stdout);

    const newProject: Project = {
      id: `project_${projectName}`,
      name: projectName,
      createdAt: new Date().toISOString(),
      description: description || 'Soroban contract project',
      contractType: 'soroban',
    };

    return { success: true, project: newProject };
  } catch (error: any) {
    console.error('Error creating project:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a project folder
 */
export async function deleteProject(
  walletAddress: string,
  projectName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidProjectName(projectName)) {
      return { success: false, error: INVALID_PROJECT_NAME };
    }

    const containerName = getContainerName(walletAddress);
    const projectPath = getWorkspacePath();

    // Delete project folder (path is shell-escaped, name is already validated)
    await execAsync(
      `docker exec -u developer ${containerName} rm -rf ${escapeShellArg(`${projectPath}/${projectName}`)}`
    );

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get project details
 */
export async function getProject(
  walletAddress: string,
  projectName: string
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    if (!isValidProjectName(projectName)) {
      return { success: false, error: INVALID_PROJECT_NAME };
    }

    const projects = await getAllProjects(walletAddress);
    const project = projects.find(p => p.name === projectName);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rename a project folder
 */
export async function renameProject(
  walletAddress: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    if (!isValidProjectName(oldName) || !isValidProjectName(newName)) {
      return { success: false, error: INVALID_PROJECT_NAME };
    }

    const containerName = getContainerName(walletAddress);
    const projectPath = getWorkspacePath();
    const projects = await getAllProjects(walletAddress);

    const project = projects.find(p => p.name === oldName);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    if (projects.some(p => p.name === newName)) {
      return { success: false, error: 'New name already exists' };
    }

    // Rename folder
    await execAsync(
      `docker exec -u developer ${containerName} mv ${escapeShellArg(`${projectPath}/${oldName}`)} ${escapeShellArg(`${projectPath}/${newName}`)}`
    );

    const renamedProject: Project = {
      ...project,
      name: newName,
    };

    return { success: true, project: renamedProject };
  } catch (error: any) {
    console.error('Error renaming project:', error);
    return { success: false, error: error.message };
  }
}

