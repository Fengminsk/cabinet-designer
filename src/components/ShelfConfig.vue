<template>
  <div class="shelf-config" :class="{ collapsed: isCollapsed }">
    <div class="panel-header" @click="toggleCollapse" style="display: none;">
      <div class="header-left">
        <span class="icon">📦</span>
        <span v-if="!isCollapsed">货架配置</span>
      </div>
      <button class="collapse-btn" :title="isCollapsed ? '展开' : '折叠'">
        <span class="collapse-icon" :class="{ collapsed: isCollapsed }">▼</span>
      </button>
    </div>
    
    <div v-show="!isCollapsed" class="panel-body">
      <!-- 尺寸配置 -->
      <div class="section">
        <h4>尺寸 (cm)</h4>
        
        <div class="input-row">
          <label class="input-label">
            <span class="label-text">宽度</span>
            <div class="input-with-slider">
              <input
                :value="modelValue.width"
                type="number"
                min="30"
                max="300"
                class="input-number"
                @input="update('width', +($event.target as HTMLInputElement).value)"
              >
              <input
                :value="modelValue.width"
                type="range"
                min="30"
                max="300"
                class="input-range"
                @input="update('width', +($event.target as HTMLInputElement).value)"
              >
            </div>
          </label>
        </div>
        
        <div class="input-row">
          <label class="input-label">
            <span class="label-text">高度</span>
            <div class="input-with-slider">
              <input
                :value="modelValue.height"
                type="number"
                min="50"
                max="300"
                class="input-number"
                @input="update('height', +($event.target as HTMLInputElement).value)"
              >
              <input
                :value="modelValue.height"
                type="range"
                min="50"
                max="300"
                class="input-range"
                @input="update('height', +($event.target as HTMLInputElement).value)"
              >
            </div>
          </label>
        </div>
        
        <div class="input-row">
          <label class="input-label">
            <span class="label-text">深度</span>
            <div class="input-with-slider">
              <input
                :value="modelValue.depth"
                type="number"
                min="20"
                max="100"
                class="input-number"
                @input="update('depth', +($event.target as HTMLInputElement).value)"
              >
              <input
                :value="modelValue.depth"
                type="range"
                min="20"
                max="100"
                class="input-range"
                @input="update('depth', +($event.target as HTMLInputElement).value)"
              >
            </div>
          </label>
        </div>
      </div>
      
      <!-- 层数配置 -->
      <div class="section">
        <h4>层数</h4>
        <div class="layer-control">
          <button class="layer-btn" @click="update('layers', Math.max(1, modelValue.layers - 1))">-</button>
          <span class="layer-value">{{ modelValue.layers }} 层</span>
          <button class="layer-btn" @click="update('layers', Math.min(10, modelValue.layers + 1))">+</button>
        </div>
      </div>
      
      <!-- 颜色配置 -->
      <div class="section">
        <h4>颜色</h4>
        <div class="color-options">
          <button
            v-for="color in shelfColors"
            :key="color"
            class="color-btn"
            :class="{ active: modelValue.color === color }"
            :style="{ background: color }"
            @click="update('color', color)"
          />
        </div>
      </div>
      
      <!-- 预设尺寸 -->
      <div class="section">
        <h4>快速预设</h4>
        <div class="preset-buttons">
          <button
            v-for="preset in shelfPresets"
            :key="preset.name"
            class="preset-btn"
            @click="applyPreset(preset)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ShelfConfig } from '../types';

interface Props {
  modelValue: ShelfConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: ShelfConfig): void;
}>();

// 折叠状态
const isCollapsed = ref(false);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

// 预设颜色
const shelfColors = [
  '#f5f5f0', // 暖白
  '#e8e4dc', // 米黄
  '#f0e6d3', // 暖木
  '#e0e0e0', // 浅灰
  '#2d2d2d', // 深灰
  '#8b4513', // 木色
];

// 预设尺寸
const shelfPresets = [
  { name: '标准货架', width: 120, height: 198, depth: 40, layers: 6, color: '#f5f5f0' },
  { name: '小型货架', width: 80, height: 150, depth: 35, layers: 4, color: '#f5f5f0' },
  { name: '大型货架', width: 150, height: 240, depth: 50, layers: 8, color: '#f5f5f0' },
  { name: '窄深货架', width: 60, height: 198, depth: 60, layers: 6, color: '#f5f5f0' },
];

function update<K extends keyof ShelfConfig>(key: K, value: ShelfConfig[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function applyPreset(preset: ShelfConfig) {
  emit('update:modelValue', { ...preset });
}
</script>

<style scoped>
.shelf-config {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.panel-header:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.collapse-icon {
  font-size: 12px;
  transition: transform 0.3s ease;
  display: inline-block;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

/* 折叠状态样式 */
.shelf-config.collapsed {
  width: auto;
  min-width: 60px;
}

.shelf-config.collapsed .panel-header {
  padding: 12px;
}

.shelf-config.collapsed .icon {
  font-size: 24px;
}

.panel-header .icon {
  font-size: 20px;
}

.panel-body {
  padding: 16px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-row {
  margin-bottom: 12px;
}

.input-row:last-child {
  margin-bottom: 0;
}

.input-label {
  display: block;
}

.label-text {
  display: block;
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
}

.input-with-slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-number {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input-number:focus {
  outline: none;
  border-color: #667eea;
}

.input-range {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  border-radius: 2px;
  outline: none;
}

.input-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
}

.input-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

/* 层数控制 */
.layer-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.layer-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f3f4f6;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.layer-btn:hover {
  background: #e5e7eb;
}

.layer-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  min-width: 60px;
  text-align: center;
}

/* 颜色选择 */
.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-btn {
  width: 36px;
  height: 36px;
  border: 3px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

/* 预设按钮 */
.preset-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-btn {
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.preset-btn:hover {
  border-color: #667eea;
  background: #f8f9ff;
  color: #667eea;
}

/* 滚动条样式 */
.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>
