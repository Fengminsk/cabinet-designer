<template>
  <div class="pegboard-panel" :class="{ 'is-collapsed': isCollapsed }">
    <div class="panel-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: none;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="icon">🔧</span>
        <span>洞洞板</span>
      </div>
      <span class="toggle-icon" :style="{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }">▼</span>
    </div>
    
    <div class="panel-body" v-show="!isCollapsed">
      <!-- 预设列表 -->
      <div class="section">
        <div class="section-header">
          <h4>预设</h4>
          <button class="add-btn" @click="openAddPreset" title="添加预设">
            <span>+</span>
          </button>
        </div>
        
        <div class="preset-list">
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="preset-item"
            :class="{ 
              active: activePresetId === preset.id,
              selected: selectedPresetId === preset.id 
            }"
            @click="selectPreset(preset.id)"
            @contextmenu.prevent="showPresetMenu(preset.id, $event)"
          >
            <div class="preset-preview" :style="getPreviewStyle(preset)">
              <div class="holes"></div>
            </div>
            <div class="preset-info">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-size">{{ preset.width }} × {{ preset.height }} cm</div>
            </div>
            <button 
              v-if="selectedPresetId === preset.id"
              class="quick-delete"
              @click.stop="$emit('delete-preset', preset.id)"
              title="删除"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      
      <!-- 已安装列表 -->
      <div v-if="installedList.length > 0" class="section">
        <div class="section-header">
          <h4>已安装 ({{ installedList.length }})</h4>
        </div>
        
        <div class="installed-list">
          <div
            v-for="item in installedList"
            :key="item.instance.id"
            class="installed-item"
            :class="{ selected: item.instance.id === selectedId }"
            @click="onInstalledItemClick(item.instance.id)"
          >
            <div class="item-preview" :style="getInstalledStyle(item.preset, item.instance)">
              <div class="holes"></div>
            </div>
            <div class="item-info">
              <div class="item-name">{{ item.preset?.name || '未知' }}</div>
              <div class="item-face">{{ getFaceLabel(item.instance.face) }}</div>
            </div>
            <div class="item-actions">
              <button 
                class="action-icon" 
                @click.stop="$emit('rotate-instance', item.instance.id)"
                title="旋转"
              >
                ↻
              </button>
              <button 
                class="action-icon delete"
                @click.stop="$emit('delete-instance', item.instance.id)"
                title="删除"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加预设弹窗 - 修复显示问题 -->
    <Teleport to="body">
      <div v-if="showAddPreset" class="modal-overlay" @click.self="showAddPreset = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h4>添加洞洞板预设</h4>
            <button class="close-btn" @click="showAddPreset = false">×</button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label>名称</label>
              <input 
                v-model="newPreset.name" 
                type="text" 
                placeholder="例如: 标准洞洞板"
                @keydown.enter="addPreset"
              >
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>宽度 (cm)</label>
                <input v-model.number="newPreset.width" type="number" min="10" max="200" step="0.5">
              </div>
              <div class="form-group">
                <label>高度 (cm)</label>
                <input v-model.number="newPreset.height" type="number" min="10" max="200" step="0.5">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>厚度 (cm)</label>
                <input v-model.number="newPreset.thickness" type="number" min="0.5" max="5" step="0.5">
              </div>
              <div class="form-group">
                <label>孔径 (cm)</label>
                <input v-model.number="newPreset.holeSize" type="number" min="0.5" max="5" step="0.1">
              </div>
            </div>
            
            <div class="form-group">
              <label>颜色</label>
              <div class="color-picker">
                <button
                  v-for="color in pegboardColors"
                  :key="color"
                  class="color-dot"
                  :class="{ active: newPreset.color === color }"
                  :style="{ background: color }"
                  @click="newPreset.color = color"
                />
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn secondary" @click="showAddPreset = false">取消</button>
            <button class="btn primary" @click="addPreset">添加</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { PegboardPreset, PegboardInstance } from '../types';
import { installedPegboards } from '../stores/designStore';

const isCollapsed = ref(false);

interface Props {
  presets: PegboardPreset[];
  activePresetId: string | null;
  selectedId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'select-preset', id: string): void;
  (e: 'add-preset', preset: Omit<PegboardPreset, 'id'>): void;
  (e: 'update-preset', id: string, updates: Partial<PegboardPreset>): void;
  (e: 'delete-preset', id: string): void;
  (e: 'delete-instance', id: string): void;
  (e: 'rotate-instance', id: string): void;
  (e: 'select-instance', id: string): void;
}>();

const showAddPreset = ref(false);
const selectedPresetId = ref<string | null>(null);

const newPreset = reactive({
  name: '',
  width: 60,
  height: 40,
  thickness: 1.5,
  color: '#e8e4dc',
  holeSize: 1.5,
  holeSpacing: 2.5,
});

const pegboardColors = [
  '#e8e4dc', '#f5f5f0', '#d4c5b9', '#a89080',
  '#2d2d2d', '#4a90a4', '#c85a54', '#7cb342',
];

// 已安装列表
const installedList = computed(() => {
  return installedPegboards.value.map(instance => ({
    instance,
    preset: props.presets.find(p => p.id === instance.configId),
  }));
});

function openAddPreset() {
  showAddPreset.value = true;
  // 重置表单
  newPreset.name = '';
  newPreset.width = 60;
  newPreset.height = 40;
  newPreset.thickness = 1.5;
  newPreset.color = '#e8e4dc';
  newPreset.holeSize = 1.5;
}

function selectPreset(id: string) {
  selectedPresetId.value = id;
  emit('select-preset', id);
}

function onInstalledItemClick(id: string) {
  // 关键修复：点击列表项时选中对应的模型
  emit('select-instance', id);
}

function showPresetMenu(id: string, event: MouseEvent) {
  selectedPresetId.value = id;
}

function addPreset() {
  if (!newPreset.name) {
    newPreset.name = `洞洞板 ${props.presets.length + 1}`;
  }
  
  emit('add-preset', { ...newPreset });
  showAddPreset.value = false;
}

function getPreviewStyle(preset: PegboardPreset) {
  const maxSize = 50;
  const ratio = Math.min(maxSize / preset.width, maxSize / preset.height);
  return {
    width: `${preset.width * ratio}px`,
    height: `${preset.height * ratio}px`,
    background: preset.color,
  };
}

function getInstalledStyle(preset: PegboardPreset | undefined, instance: PegboardInstance) {
  if (!preset) return {};
  
  const width = instance.isRotated ? preset.height : preset.width;
  const height = instance.isRotated ? preset.width : preset.height;
  
  const maxSize = 40;
  const ratio = Math.min(maxSize / width, maxSize / height, 1);
  
  return {
    width: `${width * ratio}px`,
    height: `${height * ratio}px`,
    background: preset.color,
    transform: instance.isRotated ? 'rotate(90deg)' : 'none',
  };
}

function getFaceLabel(face: string): string {
  const labels: Record<string, string> = {
    back: '背面',
    left: '左面',
    right: '右面',
  };
  return labels[face] || face;
}
</script>

<style scoped>
.pegboard-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.pegboard-panel.is-collapsed {
  width: 140px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  font-weight: 600;
  flex-shrink: 0;
}

.panel-header .icon {
  font-size: 20px;
}

.panel-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(245, 87, 108, 0.1);
  color: #f5576c;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  background: rgba(245, 87, 108, 0.2);
}

/* 预设列表 */
.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.preset-item:hover {
  background: #f8f9fa;
  transform: translateX(-2px);
}

.preset-item.active {
  border-color: #4ade80;
  background: #f0fdf4;
}

.preset-item.selected {
  border-color: #f5576c;
}

.preset-preview {
  flex-shrink: 0;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.holes {
  position: absolute;
  inset: 4px;
  background-image: radial-gradient(circle, rgba(0,0,0,0.15) 2px, transparent 2px);
  background-size: 8px 8px;
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-size {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

.quick-delete {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
}

.preset-item:hover .quick-delete,
.preset-item.selected .quick-delete {
  opacity: 1;
}

/* 已安装列表 */
.installed-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.installed-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.installed-item:hover {
  border-color: #ccc;
  background: #f8f9fa;
}

.installed-item.selected {
  border-color: #4ade80;
  background: #f0fdf4;
}

.item-preview {
  flex-shrink: 0;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  color: #333;
}

.item-face {
  font-size: 11px;
  color: #888;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.action-icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #f3f4f6;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon:hover {
  background: #e5e7eb;
}

.action-icon.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* 弹窗样式 - 修复显示问题 */
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
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h4 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #666;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #555;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #f5576c;
  box-shadow: 0 0 0 3px rgba(245, 87, 108, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-dot {
  width: 36px;
  height: 36px;
  border: 3px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-dot:hover {
  transform: scale(1.1);
}

.color-dot.active {
  border-color: #f5576c;
  box-shadow: 0 0 0 2px rgba(245, 87, 108, 0.3);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn.primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* 滚动条 */
.panel-body::-webkit-scrollbar,
.installed-list::-webkit-scrollbar,
.modal-body::-webkit-scrollbar {
  width: 4px;
}

.panel-body::-webkit-scrollbar-track,
.installed-list::-webkit-scrollbar-track,
.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb,
.installed-list::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}
</style>
