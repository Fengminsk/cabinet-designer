import type { DesignProject, ShelfConfig, PegboardPreset, PegboardInstance } from '../types';

const STORAGE_KEY = 'container_designer_projects';
const CURRENT_PROJECT_KEY = 'container_designer_current';

/** 获取所有保存的项目 */
export function getAllProjects(): DesignProject[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/** 保存项目 */
export function saveProject(project: DesignProject): void {
  const projects = getAllProjects();
  const index = projects.findIndex(p => p.id === project.id);
  project.updatedAt = Date.now();
  
  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/** 删除项目 */
export function deleteProject(projectId: string): void {
  const projects = getAllProjects().filter(p => p.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/** 获取当前项目 */
export function getCurrentProject(): DesignProject | null {
  try {
    const data = localStorage.getItem(CURRENT_PROJECT_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/** 设置当前项目 */
export function setCurrentProject(project: DesignProject | null): void {
  if (project) {
    localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(project));
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

/** 自动保存防抖 */
let autoSaveTimer: number | null = null;

export function debouncedAutoSave(
  shelf: ShelfConfig,
  presets: PegboardPreset[],
  pegboards: PegboardInstance[],
  delay: number = 1000
): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  
  autoSaveTimer = window.setTimeout(() => {
    const current = getCurrentProject();
    const project: DesignProject = {
      id: current?.id || generateId(),
      name: current?.name || '未命名设计',
      createdAt: current?.createdAt || Date.now(),
      updatedAt: Date.now(),
      shelf,
      pegboardPresets: presets,
      installedPegboards: pegboards,
    };
    saveProject(project);
    setCurrentProject(project);
  }, delay);
}

/** 生成唯一ID */
export function generateId(): string {
  return `_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;
}

/** 导出项目为JSON */
export function exportProject(project: DesignProject): string {
  return JSON.stringify(project, null, 2);
}

/** 导入项目 */
export function importProject(json: string): DesignProject | null {
  try {
    const project = JSON.parse(json);
    // 简单验证
    if (project.shelf && project.pegboardPresets && project.installedPegboards) {
      project.id = generateId();
      project.createdAt = Date.now();
      project.updatedAt = Date.now();
      return project as DesignProject;
    }
    return null;
  } catch {
    return null;
  }
}

/** 获取默认项目 */
export function getDefaultProject(): DesignProject {
  return {
    id: generateId(),
    name: '新设计',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    shelf: {
      width: 120,
      height: 198,
      depth: 40,
      layers: 6,
      color: '#f5f5f0',
      postRadius: 0.5,
    },
    pegboardPresets: [
      { id: generateId(), name: '标准洞洞板', width: 60, height: 40, thickness: 1.5, color: '#e8e4dc' },
      { id: generateId(), name: '大号洞洞板', width: 90, height: 60, thickness: 1.5, color: '#e8e4dc' },
      { id: generateId(), name: '小号洞洞板', width: 30, height: 30, thickness: 1.5, color: '#e8e4dc' },
    ],
    installedPegboards: [],
  };
}
