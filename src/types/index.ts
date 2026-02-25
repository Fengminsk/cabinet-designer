// ==================== 基础类型定义 ====================

/** 三维尺寸 */
export interface Dimensions {
  width: number;  // 宽 (x轴)
  height: number; // 高 (y轴)
  depth: number;  // 深 (z轴)
}

/** 三维位置 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/** 旋转状态 */
export interface Rotation {
  x: number;
  y: number;
  z: number;
}

// ==================== 货架类型 ====================

/** 货架配置 */
export interface ShelfConfig {
  width: number;    // 货架宽度 (cm)
  height: number;   // 货架高度 (cm)
  depth: number;    // 货架深度 (cm)
  layers: number;   // 层数
  color: string;    // 颜色 (hex)
  postRadius?: number; // 立柱圆角半径
}

/** 货架层板信息 */
export interface ShelfLayer {
  index: number;
  y: number;        // 层板的Y坐标
  thickness: number; // 层板厚度
}

// ==================== 洞洞板类型 ====================

/** 洞洞板配置 */
export interface PegboardConfig {
  id: string;
  width: number;    // 洞洞板宽度 (cm)
  height: number;   // 洞洞板高度 (cm)
  thickness: number; // 洞洞板厚度 (cm)
  color: string;    // 颜色
  holeSize: number; // 孔洞大小
  holeSpacing: number; // 孔洞间距
}

/** 洞洞板实例 (已安装的) */
export interface PegboardInstance {
  id: string;
  configId: string; // 引用哪个配置
  position: Position;
  rotation: Rotation;
  isRotated: boolean; // 是否旋转90度放置
  face: 'back' | 'left' | 'right'; // 安装在哪个面
}

/** 洞洞板预设 */
export interface PegboardPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  thickness: number;
  color: string;
  holeSize?: number;     // 孔洞大小 (默认 1.5)
  holeSpacing?: number;  // 孔洞间距 (默认 2.5)
}

// ==================== 设计状态类型 ====================

/** 设计方案 */
export interface DesignProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shelf: ShelfConfig;
  pegboardPresets: PegboardPreset[];
  installedPegboards: PegboardInstance[];
  cameraPosition?: Position;
}

// ==================== 交互类型 ====================

/** 拖拽状态 */
export interface DragState {
  isDragging: boolean;
  pegboardId: string | null;
  startPosition: Position | null;
  currentPosition: Position | null;
  face: 'back' | 'left' | 'right' | null;
}

/** 选中状态 */
export interface SelectionState {
  selectedId: string | null;
  type: 'pegboard' | 'shelf' | null;
}

/** 吸附结果 */
export interface SnapResult {
  snapped: boolean;
  position: Position;
  rotation: Rotation;
  distance: number;
}

// ==================== 自动填充类型 ====================

/** 填充方案 */
export interface FillSolution {
  pegboards: {
    presetId: string;
    position: Position;
    rotation: Rotation;
    isRotated: boolean;
  }[];
  coverage: number; // 覆盖率 0-1
  wasteArea: number; // 浪费面积
}

/** 填充约束 */
export interface FillConstraints {
  face: 'back' | 'left' | 'right';
  allowRotation: boolean; // 是否允许旋转
  maxPegboards: number;   // 最大数量限制
  preferredPresetIds?: string[]; // 优先使用哪些预设
}

// ==================== UI 类型 ====================

/** 刻度显示设置 */
export interface RulerSettings {
  enabled: boolean;
  fadeDelay: number;    // 延迟消失时间 (ms)
  opacity: number;      // 透明度
}

/** 主题设置 */
export interface ThemeSettings {
  backgroundColor: string;
  gridColor: string;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}
