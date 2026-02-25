<template>
  <div 
    class="ruler-overlay"
    :class="{ visible: isVisible, fading: isFading }"
  >
    <!-- 水平刻度 (货架顶部) -->
    <div v-if="shelfConfig" class="ruler-horizontal">
      <div class="ruler-line"></div>
      <div 
        v-for="tick in horizontalTicks" 
        :key="tick.value"
        class="tick"
        :style="{ left: tick.position + '%' }"
      >
        <span class="tick-label" :class="{ major: tick.isMajor }">{{ tick.label }}</span>
        <div class="tick-mark" :class="{ major: tick.isMajor }"></div>
      </div>
    </div>
    
    <!-- 垂直刻度 (货架侧面) -->
    <div v-if="shelfConfig" class="ruler-vertical">
      <div class="ruler-line"></div>
      <div 
        v-for="tick in verticalTicks" 
        :key="tick.value"
        class="tick"
        :style="{ top: tick.position + '%' }"
      >
        <span class="tick-label" :class="{ major: tick.isMajor }">{{ tick.label }}</span>
        <div class="tick-mark" :class="{ major: tick.isMajor }"></div>
      </div>
    </div>
    
    <!-- 洞洞板尺寸提示 -->
    <div v-if="hoveredPegboard" class="pegboard-tooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <div class="size">{{ hoveredPegboard.width }} × {{ hoveredPegboard.height }} cm</div>
        <div class="position">{{ formatPosition(hoveredPegboard.position) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { shelfConfig } from '../stores/designStore';
import type { Position } from '../types';

interface Tick {
  value: number;
  position: number;
  label: string;
  isMajor: boolean;
}

interface HoveredPegboard {
  width: number;
  height: number;
  position: Position;
  screenX: number;
  screenY: number;
}

// ==================== 状态 ====================

const isVisible = ref(false);
const isFading = ref(false);
const fadeTimer = ref<number | null>(null);
const hoveredPegboard = ref<HoveredPegboard | null>(null);

// ==================== 计算属性 ====================

const horizontalTicks = computed<Tick[]>(() => {
  if (!shelfConfig.value) return [];
  
  const width = shelfConfig.value.width;
  const ticks: Tick[] = [];
  const step = 10; // 每10cm一个刻度
  const majorStep = 50; // 每50cm一个主刻度
  
  for (let i = 0; i <= width; i += step) {
    ticks.push({
      value: i,
      position: (i / width) * 100,
      label: i % majorStep === 0 ? `${i}` : '',
      isMajor: i % majorStep === 0,
    });
  }
  
  return ticks;
});

const verticalTicks = computed<Tick[]>(() => {
  if (!shelfConfig.value) return [];
  
  const height = shelfConfig.value.height;
  const ticks: Tick[] = [];
  const step = 10;
  const majorStep = 50;
  
  for (let i = 0; i <= height; i += step) {
    ticks.push({
      value: i,
      position: ((height - i) / height) * 100,
      label: i % majorStep === 0 ? `${i}` : '',
      isMajor: i % majorStep === 0,
    });
  }
  
  return ticks;
});

const tooltipStyle = computed(() => {
  if (!hoveredPegboard.value) return {};
  return {
    left: `${hoveredPegboard.value.screenX}px`,
    top: `${hoveredPegboard.value.screenY - 60}px`,
  };
});

// ==================== 方法 ====================

function formatPosition(pos: Position): string {
  return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
}

/**
 * 显示刻度
 */
function show(): void {
  if (fadeTimer.value) {
    clearTimeout(fadeTimer.value);
  }
  isVisible.value = true;
  isFading.value = false;
  
  // 3秒后淡出
  fadeTimer.value = window.setTimeout(() => {
    isFading.value = true;
    setTimeout(() => {
      isVisible.value = false;
      isFading.value = false;
    }, 500);
  }, 3000);
}

/**
 * 设置悬停的洞洞板信息
 */
function setHoveredPegboard(
  width: number,
  height: number,
  position: Position,
  screenX: number,
  screenY: number
): void {
  hoveredPegboard.value = { width, height, position, screenX, screenY };
  show();
}

/**
 * 清除悬停
 */
function clearHoveredPegboard(): void {
  hoveredPegboard.value = null;
}

// 暴露给父组件
defineExpose({
  show,
  setHoveredPegboard,
  clearHoveredPegboard,
});
</script>

<style scoped>
.ruler-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ruler-overlay.visible {
  opacity: 1;
}

.ruler-overlay.fading {
  opacity: 0;
}

/* 水平刻度 */
.ruler-horizontal {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 40%;
  height: 30px;
}

.ruler-horizontal .ruler-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4ade80, transparent);
}

.ruler-horizontal .tick {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
}

.ruler-horizontal .tick-mark {
  width: 1px;
  height: 6px;
  background: #4ade80;
  margin: 0 auto;
}

.ruler-horizontal .tick-mark.major {
  height: 10px;
  width: 2px;
}

.ruler-horizontal .tick-label {
  display: block;
  text-align: center;
  font-size: 10px;
  color: #4ade80;
  margin-bottom: 2px;
  opacity: 0.7;
}

.ruler-horizontal .tick-label.major {
  font-size: 12px;
  font-weight: 600;
  opacity: 1;
}

/* 垂直刻度 */
.ruler-vertical {
  position: absolute;
  top: 50%;
  left: 15%;
  transform: translateY(-50%);
  width: 30px;
  height: 50%;
}

.ruler-vertical .ruler-line {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, #4ade80, transparent);
}

.ruler-vertical .tick {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
}

.ruler-vertical .tick-mark {
  width: 6px;
  height: 1px;
  background: #4ade80;
}

.ruler-vertical .tick-mark.major {
  width: 10px;
  height: 2px;
}

.ruler-vertical .tick-label {
  font-size: 10px;
  color: #4ade80;
  margin-right: 4px;
  opacity: 0.7;
}

.ruler-vertical .tick-label.major {
  font-size: 12px;
  font-weight: 600;
  opacity: 1;
}

/* 洞洞板提示 */
.pegboard-tooltip {
  position: absolute;
  transform: translateX(-50%);
  z-index: 60;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.tooltip-content .size {
  font-weight: 600;
  margin-bottom: 2px;
}

.tooltip-content .position {
  color: #aaa;
  font-size: 10px;
}

/* 动画 */
@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}
</style>
