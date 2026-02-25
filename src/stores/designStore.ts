import { ref, computed, type Ref } from 'vue';
import type { 
  PegboardPreset, 
  PegboardInstance, 
  DesignProject,
  SelectionState 
} from '../types';
import { 
  getDefaultProject, 
  getCurrentProject, 
  debouncedAutoSave,
  generateId 
} from '../utils/storage';

// ==================== 状态定义 ====================

/** 当前项目 */
const currentProject = ref<DesignProject>(getCurrentProject() || getDefaultProject());

/** 选中状态 */
const selection = ref<SelectionState>({ selectedId: null, type: null });

/** 编辑模式 */
const editMode = ref<'select' | 'place' | 'fill'>('select');

/** 当前选中的洞洞板预设 (用于放置) */
const activePresetId = ref<string | null>(null);

/** 是否显示刻度 */
const showRulers = ref(true);

/** 刻度淡出延迟 (ms) */
const rulerFadeDelay = ref(2000);

/** 网格吸附精度 (cm) */
const snapPrecision = ref(0.5);

/** 旋转吸附角度 */
const rotationSnap = ref(15); // 度

/** 撤销/重做历史 */
const historyStack = ref<DesignProject[]>([]);
const historyIndex = ref(-1);
const MAX_HISTORY = 50;

// ==================== 计算属性 ====================

/** 货架配置 */
export const shelfConfig = computed({
  get: () => currentProject.value.shelf,
  set: (val) => {
    currentProject.value.shelf = val;
    saveState();
  },
});

/** 洞洞板预设列表 */
export const pegboardPresets = computed({
  get: () => currentProject.value.pegboardPresets,
  set: (val) => {
    currentProject.value.pegboardPresets = val;
    saveState();
  },
});

/** 已安装的洞洞板 */
export const installedPegboards = computed({
  get: () => currentProject.value.installedPegboards,
  set: (val) => {
    currentProject.value.installedPegboards = val;
    saveState();
  },
});

/** 当前选中的预设 */
export const activePreset = computed(() => {
  if (!activePresetId.value) return null;
  return pegboardPresets.value.find(p => p.id === activePresetId.value) || null;
});

/** 选中的洞洞板实例 */
export const selectedPegboard = computed(() => {
  if (selection.value.type !== 'pegboard' || !selection.value.selectedId) return null;
  return installedPegboards.value.find(p => p.id === selection.value.selectedId) || null;
});

/** 是否可以撤销 */
export const canUndo = computed(() => historyIndex.value > 0);

/** 是否可以重做 */
export const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1);

/** 当前选中面的可用空间 */
export const availableSpace = computed(() => {
  // 货架三个面的尺寸
  return {
    back: { width: shelfConfig.value.width, height: shelfConfig.value.height },
    left: { width: shelfConfig.value.depth, height: shelfConfig.value.height },
    right: { width: shelfConfig.value.depth, height: shelfConfig.value.height },
  };
});

// ==================== 方法 ====================

/** 保存状态到历史 */
function saveState() {
  // 删除当前位置之后的历史
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  
  // 添加新状态
  historyStack.value.push(JSON.parse(JSON.stringify(currentProject.value)));
  
  // 限制历史记录数量
  if (historyStack.value.length > MAX_HISTORY) {
    historyStack.value.shift();
  } else {
    historyIndex.value++;
  }
  
  // 自动保存到本地存储
  debouncedAutoSave(
    currentProject.value.shelf,
    currentProject.value.pegboardPresets,
    currentProject.value.installedPegboards
  );
}

/** 初始化历史 */
function initHistory() {
  historyStack.value = [JSON.parse(JSON.stringify(currentProject.value))];
  historyIndex.value = 0;
}

/** 撤销 */
export function undo() {
  if (canUndo.value) {
    historyIndex.value--;
    currentProject.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]));
  }
}

/** 重做 */
export function redo() {
  if (canRedo.value) {
    historyIndex.value++;
    currentProject.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]));
  }
}

/** 添加洞洞板预设 */
export function addPegboardPreset(preset: Omit<PegboardPreset, 'id'>) {
  const newPreset: PegboardPreset = {
    ...preset,
    id: generateId(),
  };
  pegboardPresets.value = [...pegboardPresets.value, newPreset];
  return newPreset.id;
}

/** 更新洞洞板预设 */
export function updatePegboardPreset(id: string, updates: Partial<PegboardPreset>) {
  pegboardPresets.value = pegboardPresets.value.map(p =>
    p.id === id ? { ...p, ...updates } : p
  );
}

/** 删除洞洞板预设 */
export function deletePegboardPreset(id: string) {
  pegboardPresets.value = pegboardPresets.value.filter(p => p.id !== id);
  // 同时删除使用该预设的实例
  installedPegboards.value = installedPegboards.value.filter(p => p.configId !== id);
}

/** 添加洞洞板实例 */
export function addPegboardInstance(
  configId: string,
  position: { x: number; y: number; z: number },
  face: 'back' | 'left' | 'right' = 'back',
  isRotated: boolean = false
): string {
  const newInstance: PegboardInstance = {
    id: generateId(),
    configId,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    isRotated,
    face,
  };
  installedPegboards.value = [...installedPegboards.value, newInstance];
  
  // 自动选中新添加的
  selection.value = { selectedId: newInstance.id, type: 'pegboard' };
  
  return newInstance.id;
}

/** 更新洞洞板实例位置 */
export function updatePegboardPosition(
  id: string,
  position: { x: number; y: number; z: number }
) {
  installedPegboards.value = installedPegboards.value.map(p =>
    p.id === id ? { ...p, position } : p
  );
}

/** 更新洞洞板实例旋转 */
export function updatePegboardRotation(
  id: string,
  rotation: { x: number; y: number; z: number }
) {
  installedPegboards.value = installedPegboards.value.map(p =>
    p.id === id ? { ...p, rotation } : p
  );
}

/** 切换洞洞板旋转状态 (90度) */
export function togglePegboardRotation(id: string) {
  installedPegboards.value = installedPegboards.value.map(p =>
    p.id === id ? { ...p, isRotated: !p.isRotated } : p
  );
}

/** 删除洞洞板实例 */
export function deletePegboardInstance(id: string) {
  installedPegboards.value = installedPegboards.value.filter(p => p.id !== id);
  if (selection.value.selectedId === id) {
    selection.value = { selectedId: null, type: null };
  }
}

/** 选中洞洞板 */
export function selectPegboard(id: string | null) {
  if (id) {
    if (selection.value.selectedId !== id) {
      selection.value = { selectedId: id, type: 'pegboard' };
    }
  } else {
    if (selection.value.selectedId !== null) {
      selection.value = { selectedId: null, type: null };
    }
  }
}

/** 设置编辑模式 */
export function setEditMode(mode: 'select' | 'place' | 'fill') {
  editMode.value = mode;
  if (mode === 'select') {
    activePresetId.value = null;
  }
}

/** 设置活动预设 */
export function setActivePreset(id: string | null) {
  activePresetId.value = id;
  if (id) {
    editMode.value = 'place';
  }
}

/** 清空所有洞洞板 */
export function clearAllPegboards() {
  installedPegboards.value = [];
  selection.value = { selectedId: null, type: null };
}

/** 重置项目 */
export function resetProject() {
  currentProject.value = getDefaultProject();
  initHistory();
  selection.value = { selectedId: null, type: null };
}

/** 加载项目 */
export function loadProject(project: DesignProject) {
  currentProject.value = JSON.parse(JSON.stringify(project));
  initHistory();
  selection.value = { selectedId: null, type: null };
}

/** 获取项目统计信息 */
export function getProjectStats() {
  const pbs = installedPegboards.value;
  const presets = pegboardPresets.value;
  
  // 统计各种预设使用的数量
  const presetCounts: Record<string, number> = {};
  for (const pb of pbs) {
    presetCounts[pb.configId] = (presetCounts[pb.configId] || 0) + 1;
  }
  
  // 计算总覆盖面积
  let totalArea = 0;
  for (const pb of pbs) {
    const preset = presets.find(p => p.id === pb.configId);
    if (preset) {
      const area = preset.width * preset.height;
      totalArea += area;
    }
  }
  
  return {
    totalCount: pbs.length,
    presetCounts,
    totalArea,
  };
}

// ==================== 初始化 ====================

initHistory();

// 导出响应式状态
export const store = {
  currentProject,
  selection: selection as Ref<SelectionState>,
  editMode: editMode as Ref<'select' | 'place' | 'fill'>,
  activePresetId: activePresetId as Ref<string | null>,
  showRulers: showRulers as Ref<boolean>,
  rulerFadeDelay: rulerFadeDelay as Ref<number>,
  snapPrecision: snapPrecision as Ref<number>,
  rotationSnap: rotationSnap as Ref<number>,
  historyIndex: historyIndex as Ref<number>,
  historyStack: historyStack as Ref<DesignProject[]>,
};

export { selection, editMode, activePresetId, clearAllPegboards as clearAll };
