<template>
  <div class="designer-ui">
    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
      <div class="logo">
        <span class="icon">🎮</span>
        <span class="text">货柜设计师</span>
      </div>
      
      <div class="tool-group">
        <button 
          class="tool-btn" 
          :class="{ active: editMode === 'select' }"
          @click="setEditMode('select')"
          title="选择"
        >
          <span class="icon">↖</span>
        </button>
        <button 
          class="tool-btn" 
          :class="{ active: editMode === 'place' }"
          @click="setEditMode('place')"
          title="放置"
        >
          <span class="icon">➕</span>
        </button>
      </div>
      
      <!-- 填充按钮 - 修复：改为触发按钮 -->
      <div class="tool-group">
        <button 
          class="tool-btn fill-btn"
          @click="openFillDialog"
          title="自动填充"
        >
          <span class="icon">🎨</span>
          <span class="label">填充</span>
        </button>
      </div>
      
      <div class="action-group">
        <button class="action-btn danger" @click="onClearAll" title="清空">
          <span>🗑️</span>
        </button>
      </div>
    </div>

    <!-- 侧边栏/底部抽屉 -->
    <div class="settings-drawer" :class="{ 'is-open': isDrawerOpen }" :style="drawerStyle">
      <div class="drawer-handle" @click="toggleDrawer" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
        <div class="handle-bar"></div>
      </div>
      
      <div class="drawer-header">
        <div class="tabs">
          <button class="tab-btn" :class="{ active: activeTab === 'shelf' }" @click="activeTab = 'shelf'">货架配置</button>
          <button class="tab-btn" :class="{ active: activeTab === 'pegboard' }" @click="activeTab = 'pegboard'">洞洞板管理</button>
        </div>
        <button class="close-btn" @click="isDrawerOpen = false">×</button>
      </div>
      
      <div class="drawer-content">
        <div v-show="activeTab === 'shelf'" class="tab-pane">
          <ShelfConfig 
            v-model="shelfConfig" 
            @update:model-value="onShelfChange"
          />
        </div>
        <div v-show="activeTab === 'pegboard'" class="tab-pane">
          <PegboardPanel
            :presets="pegboardPresets"
            :active-preset-id="activePresetId"
            :selected-id="selection.selectedId"
            @select-preset="setActivePreset"
            @add-preset="addPegboardPreset"
            @update-preset="updatePegboardPreset"
            @delete-preset="deletePegboardPreset"
            @delete-instance="deletePegboardInstance"
            @rotate-instance="togglePegboardRotation"
            @select-instance="onSelectInstance"
          />
        </div>
      </div>
    </div>

    <!-- 悬浮设置按钮 (仅在抽屉关闭时显示) -->
    <button class="settings-fab" :class="{ 'is-hidden': isDrawerOpen }" @click="toggleDrawer">
      ⚙️ 设置
    </button>

    <!-- 选中洞洞板的跨面移动按钮 -->
    <div v-if="selection.selectedId && selectedInstance" class="face-move-panel">
      <div class="panel-title">移动到</div>
      <div class="face-buttons">
        <button 
          class="face-btn" 
          :class="{ active: selectedInstance.face === 'back' }"
          :disabled="selectedInstance.face === 'back'"
          @click="moveToFace('back')"
        >
          背面
        </button>
        <button 
          class="face-btn" 
          :class="{ active: selectedInstance.face === 'left' }"
          :disabled="selectedInstance.face === 'left'"
          @click="moveToFace('left')"
        >
          左面
        </button>
        <button 
          class="face-btn" 
          :class="{ active: selectedInstance.face === 'right' }"
          :disabled="selectedInstance.face === 'right'"
          @click="moveToFace('right')"
        >
          右面
        </button>
      </div>
    </div>

    <!-- 底部统计栏 -->
    <div class="bottom-bar">
      <div class="stat-item">
        <span class="label">洞洞板:</span>
        <span class="value">{{ stats.totalCount }} 块</span>
      </div>
      <div class="stat-item">
        <span class="label">覆盖面积:</span>
        <span class="value">{{ stats.totalArea.toFixed(1) }} cm²</span>
      </div>
      <div class="stat-item">
        <span class="label">FPS:</span>
        <span class="value" :class="fpsClass">{{ fps }}</span>
      </div>
    </div>

    <!-- 底部居中操作栏 (撤销/重做) -->
    <div class="bottom-actions">
      <button class="action-btn" @click="undo" :disabled="!canUndo" title="撤销">
        <span>↩</span>
      </button>
      <button class="action-btn" @click="redo" :disabled="!canRedo" title="重做">
        <span>↪</span>
      </button>
    </div>

    <!-- 自动填充弹窗 -->
    <Teleport to="body">
      <div v-if="showFillDialog" class="modal-overlay" @click.self="closeFillDialog">
        <div class="modal fill-dialog" @click.stop>
          <h3>自动填充</h3>
          <div class="form-group">
            <label>选择面:</label>
            <div class="radio-group">
              <label class="radio">
                <input v-model="fillFace" type="radio" value="back">
                <span>背面</span>
              </label>
              <label class="radio">
                <input v-model="fillFace" type="radio" value="left">
                <span>左面</span>
              </label>
              <label class="radio">
                <input v-model="fillFace" type="radio" value="right">
                <span>右面</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>
              <input v-model="fillAllowRotation" type="checkbox">
              允许旋转
            </label>
          </div>
          <div class="form-group">
            <label>最大数量:</label>
            <input v-model.number="fillMaxCount" type="number" min="1" max="50" class="input-small">
          </div>
          <div class="modal-actions">
            <button class="btn secondary" @click="closeFillDialog">取消</button>
            <button class="btn primary" @click="applyAutoFill">应用</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 提示消息 -->
    <Transition name="toast">
      <div v-if="toast.visible" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import ShelfConfig from './ShelfConfig.vue';
import PegboardPanel from './PegboardPanel.vue';
import {
  shelfConfig,
  pegboardPresets,
  installedPegboards,
  selection,
  editMode,
  activePresetId,
  canUndo,
  canRedo,
  undo,
  redo,
  setEditMode,
  setActivePreset,
  addPegboardPreset,
  updatePegboardPreset,
  deletePegboardPreset,
  deletePegboardInstance,
  togglePegboardRotation,
  clearAll,
  getProjectStats,
} from '../stores/designStore';
import type { PegboardInstance } from '../types';
import { calculateBestFill, generateAutoFillPegboards } from '../core/AutoFill';

// ==================== Props & Emits ====================
const emit = defineEmits<{
  (e: 'select-pegboard', id: string): void;
  (e: 'move-to-face', params: { id: string; targetFace: 'back' | 'left' | 'right' }): void;
}>();

// ==================== 状态 ====================

const isDrawerOpen = ref(true);
const activeTab = ref<'shelf' | 'pegboard'>('pegboard');

// 抽屉拖拽状态
const touchStartY = ref(0);
const currentY = ref(0);
const isDragging = ref(false);

const drawerStyle = computed(() => {
  if (!isDragging.value) return {};
  const offset = Math.max(0, currentY.value - touchStartY.value);
  return {
    transform: `translateY(${offset}px)`,
    transition: 'none'
  };
});

function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value;
}

function handleTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0].clientY;
  currentY.value = e.touches[0].clientY;
  isDragging.value = true;
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging.value) return;
  currentY.value = e.touches[0].clientY;
  // 阻止默认滚动
  if (currentY.value > touchStartY.value) {
    e.preventDefault();
  }
}

function handleTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;
  
  const offset = currentY.value - touchStartY.value;
  if (offset > 100) {
    // 向下滑动超过100px，关闭抽屉
    isDrawerOpen.value = false;
  }
}

const fps = ref(60);
const showFillDialog = ref(false);
const fillFace = ref<'back' | 'left' | 'right'>('back');
const fillAllowRotation = ref(true);
const fillMaxCount = ref(20);

const toast = reactive({
  visible: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'error',
  timer: 0,
});

// ==================== 计算属性 ====================

const stats = computed(() => getProjectStats());

const fpsClass = computed(() => {
  if (fps.value >= 50) return 'good';
  if (fps.value >= 30) return 'normal';
  return 'poor';
});

// 获取当前选中的洞洞板实例
const selectedInstance = computed((): PegboardInstance | null => {
  if (!selection.value.selectedId) return null;
  return installedPegboards.value.find(p => p.id === selection.value.selectedId) || null;
});

// ==================== 方法 ====================

function onShelfChange() {
  showToast('货架参数已更新', 'success');
}

function onClearAll() {
  if (confirm('确定要清空所有洞洞板吗？')) {
    clearAll();
    showToast('已清空所有洞洞板', 'info');
  }
}

// 打开填充对话框 - 修复：每次点击都打开
function openFillDialog() {
  showFillDialog.value = true;
}

// 关闭填充对话框
function closeFillDialog() {
  showFillDialog.value = false;
  // 重置为选择模式
  setEditMode('select');
}

function onSelectInstance(id: string) {
  emit('select-pegboard', id);
}

// 跨面移动
function moveToFace(targetFace: 'back' | 'left' | 'right') {
  if (!selection.value.selectedId) return;
  emit('move-to-face', { id: selection.value.selectedId, targetFace });
}

function applyAutoFill() {
  const face = fillFace.value;
  const shelf = shelfConfig.value;
  
  let width = shelf.width;
  let height = shelf.height;
  
  if (face === 'left' || face === 'right') {
    width = shelf.depth;
  }
  
  const solution = calculateBestFill(
    width,
    height,
    pegboardPresets.value,
    {
      face,
      allowRotation: fillAllowRotation.value,
      maxPegboards: fillMaxCount.value,
    }
  );
  
  if (solution.pegboards.length === 0) {
    showToast('无法找到合适的填充方案', 'error');
    return;
  }
  
  const newInstances = generateAutoFillPegboards(solution, face, shelf.depth);
  installedPegboards.value = [...installedPegboards.value, ...newInstances];
  
  closeFillDialog();
  showToast(
    `已自动填充 ${solution.pegboards.length} 块洞洞板，覆盖率 ${(solution.coverage * 100).toFixed(1)}%`,
    'success'
  );
}

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  toast.visible = true;
  toast.message = message;
  toast.type = type;
  
  if (toast.timer) {
    clearTimeout(toast.timer);
  }
  
  toast.timer = window.setTimeout(() => {
    toast.visible = false;
  }, 3000);
}

// 暴露给父组件
defineExpose({
  fps,
  showToast,
});
</script>

<style scoped>
.designer-ui {
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

.designer-ui > * {
  pointer-events: auto;
}

/* 顶部工具栏 */
.top-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .top-toolbar {
    top: 8px;
    padding: 6px 12px;
    gap: 8px;
    border-radius: 12px;
    width: 90%;
    max-width: 360px;
    justify-content: space-between;
  }
  
  .logo .text {
    display: none;
  }
  
  .tool-btn .label {
    display: none;
  }
  
  .tool-group, .action-group {
    padding: 0 4px;
    gap: 2px;
  }
  
  .tool-btn, .action-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #4a4a4a;
}

.logo .icon {
  font-size: 24px;
}

.tool-group, .action-group {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  border-left: 1px solid rgba(0, 0, 0, 0.1);
}

.tool-btn, .action-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tool-btn:hover, .action-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tool-btn.active {
  background: #4ade80;
  color: white;
}

/* 填充按钮样式 */
.fill-btn {
  width: auto;
  padding: 0 12px;
  gap: 4px;
}

.fill-btn .label {
  font-size: 12px;
  font-weight: 500;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* 跨面移动面板 */
.face-move-panel {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 50;
}

.panel-title {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.face-buttons {
  display: flex;
  gap: 8px;
}

.face-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.face-btn:hover:not(:disabled) {
  border-color: #4ade80;
  background: #f0fdf4;
}

.face-btn.active {
  background: #4ade80;
  color: white;
  border-color: #4ade80;
}

.face-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 底部统计栏 */
.bottom-bar {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  pointer-events: none;
}

.stat-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #333;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8), 0 0 4px rgba(255, 255, 255, 0.5);
  font-family: monospace;
  font-weight: 600;
}

.stat-item .label {
  color: #555;
}

.stat-item .value {
  font-weight: 700;
  color: #111;
}

/* 底部居中操作栏 */
.bottom-actions {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  z-index: 40;
}

.bottom-actions .action-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  border: none;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.bottom-actions .action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.bottom-actions .action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stat-item .value.good {
  color: #22c55e;
}

.stat-item .value.normal {
  color: #f59e0b;
}

.stat-item .value.poor {
  color: #ef4444;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #555;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.radio input {
  cursor: pointer;
}

.input-small {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn.secondary {
  background: #f3f4f6;
  color: #555;
}

.btn.secondary:hover {
  background: #e5e7eb;
}

.btn.primary {
  background: #4ade80;
  color: white;
}

.btn.primary:hover {
  background: #22c55e;
}

/* 提示消息 */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.toast.info {
  background: #3b82f6;
}

.toast.success {
  background: #22c55e;
}

.toast.error {
  background: #ef4444;
}

/* 过渡动画 */
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* 侧边栏/底部抽屉 */
.settings-drawer {
  position: absolute;
  top: 80px;
  right: 16px;
  width: 320px;
  bottom: 80px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  z-index: 50;
  transform: translateX(calc(100% + 32px));
}

.settings-drawer.is-open {
  transform: translateX(0);
}

.drawer-handle {
  display: none;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tab-btn.active {
  background: #4ade80;
  color: white;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.tab-pane {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

.tab-pane > * {
  flex: 1;
}

.settings-fab {
  position: absolute;
  bottom: 24px;
  right: 24px;
  padding: 12px 24px;
  background: #4ade80;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(74, 222, 128, 0.5);
}

.settings-fab.is-hidden {
  transform: scale(0);
  opacity: 0;
  pointer-events: none;
}

/* 响应式：移动端变为底部抽屉 */
@media (max-width: 768px) {
  .settings-drawer {
    top: auto;
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 70vh;
    border-radius: 24px 24px 0 0;
    transform: translateY(100%);
  }
  
  .settings-drawer.is-open {
    transform: translateY(0);
  }
  
  .drawer-handle {
    display: flex;
    justify-content: center;
    padding: 12px 0 4px;
    cursor: grab;
  }
  
  .drawer-handle:active {
    cursor: grabbing;
  }
  
  .handle-bar {
    width: 40px;
    height: 4px;
    background: #ddd;
    border-radius: 2px;
  }
  
  .settings-fab {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  /* 桌面端显示关闭按钮，移动端隐藏 */
  .close-btn {
    display: none;
  }
}
</style>
