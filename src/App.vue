<template>
  <div class="app">
    <!-- 3D 画布容器 -->
    <div ref="canvasContainer" class="canvas-container"></div>
    
    <!-- UI 层 -->
    <DesignerUI 
      ref="designerUI" 
      @select-pegboard="onSelectPegboardFromList"
      @move-to-face="onMoveToFace"
    />
    
    <!-- 层板高度提示 -->
    <div v-if="layerDragInfo.isDragging" class="layer-drag-hint">
      <div class="hint-content">
        <div class="hint-title">调整层板高度</div>
        <div class="hint-value">{{ layerDragInfo.currentY.toFixed(1) }} cm</div>
      </div>
    </div>
    
    <!-- 加载画面 -->
    <Transition name="fade">
      <div v-if="isLoading" class="loading-screen">
        <div class="loading-content">
          <div class="loading-icon">🎮</div>
          <div class="loading-text">加载中...</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager';
import { ShelfBuilder } from './core/ShelfBuilder';
import { PegboardManager } from './core/PegboardManager';
import { InteractionManager } from './core/InteractionManager';
import { SnapSystem } from './core/SnapSystem';
import { CADDimensions } from './core/CADDimensions';
import DesignerUI from './components/DesignerUI.vue';
import {
  shelfConfig,
  pegboardPresets,
  installedPegboards,
  selection,
  editMode,
  activePresetId,
  addPegboardInstance,
  updatePegboardPosition,
  selectPegboard,
  deletePegboardInstance,
  setEditMode,
} from './stores/designStore';
import type { Position, PegboardPreset, PegboardInstance } from './types';

// ==================== 状态 ====================

const canvasContainer = ref<HTMLElement | null>(null);
const designerUI = ref<InstanceType<typeof DesignerUI> | null>(null);
const isLoading = ref(true);

// 层板拖拽状态
const layerDragInfo = ref({
  isDragging: false,
  layerIndex: -1,
  currentY: 0,
});

// 核心实例
let sceneManager: SceneManager | null = null;
let shelfBuilder: ShelfBuilder | null = null;
let pegboardManager: PegboardManager | null = null;
let interactionManager: InteractionManager | null = null;
let snapSystem: SnapSystem | null = null;
let cadDimensions: CADDimensions | null = null;

// 层板拖拽状态
let isDraggingLayer = false;
let draggedLayerIndex = -1;
let layerDragPlane: THREE.Plane | null = null;

// 事件处理函数引用（用于解绑）
let layerMouseDownHandler: ((e: MouseEvent) => void) | null = null;
let layerMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let layerMouseUpHandler: ((e: MouseEvent) => void) | null = null;

const isPegboardPanelOpen = ref(true);

// ==================== 生命周期 ====================

onMounted(async () => {
  await nextTick();
  
  if (!canvasContainer.value) return;
  
  try {
    // 1. 初始化场景管理器
    sceneManager = new SceneManager(canvasContainer.value);
    
    // 2. 初始化吸附系统
    snapSystem = new SnapSystem({
      gridSize: 0.5,
      snapDistance: 3,
    });
    
    // 3. 初始化货架
    shelfBuilder = new ShelfBuilder(shelfConfig.value);
    sceneManager.add(shelfBuilder.getGroup());
    updateSnapSystemBounds();
    
    // 4. 初始化洞洞板管理器
    pegboardManager = new PegboardManager();
    sceneManager.add(pegboardManager.getGroup());
    
    // 加载预设
    for (const preset of pegboardPresets.value) {
      pegboardManager.addPreset(preset);
    }
    
    // 加载已安装的洞洞板
    for (const instance of installedPegboards.value) {
      try {
        pegboardManager.addPegboard(instance);
      } catch (e) {
        console.warn('Failed to add pegboard:', e);
      }
    }
    
    // 5. 初始化CAD尺寸标注
    cadDimensions = new CADDimensions(sceneManager.getScene());
    
    // 6. 设置层板拖拽 - 关键：在交互管理器之前初始化，以便优先捕获事件
    setupLayerDragEvents();

    // 7. 初始化交互管理器
    interactionManager = new InteractionManager(
      canvasContainer.value,
      sceneManager.getScene(),
      sceneManager.getCamera(),
      sceneManager.getControls(),
      snapSystem,
      (id) => pegboardPresets.value.find(p => p.id === id),
      (id) => installedPegboards.value.find(p => p.id === id)
    );
    interactionManager.setShelfGroup(shelfBuilder.getGroup());
    interactionManager.setPegboardGroup(pegboardManager.getGroup());
    
    // 注册交互回调
    setupInteractionCallbacks();
    
    // 8. 设置观察器
    setupWatchers();
    
    // 9. 开始性能监控
    startPerformanceMonitor();
    
    // 10. 显示货架尺寸
    setTimeout(() => {
      if (shelfBuilder && cadDimensions) {
        cadDimensions.showShelfDimensions(shelfConfig.value, shelfBuilder.getLayers());
      }
    }, 500);
    
    // 11. 隐藏加载画面
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
    
  } catch (error) {
    console.error('Failed to initialize:', error);
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  // 解绑层板事件
  if (canvasContainer.value && layerMouseDownHandler) {
    canvasContainer.value.removeEventListener('mousedown', layerMouseDownHandler, true);
    canvasContainer.value.removeEventListener('mousemove', layerMouseMoveHandler!, true);
    window.removeEventListener('mouseup', layerMouseUpHandler!, true);
  }
  
  interactionManager?.dispose();
  pegboardManager?.dispose();
  shelfBuilder?.dispose();
  cadDimensions?.dispose();
  sceneManager?.dispose();
});

// ==================== 右侧列表点击选中 ====================

function onSelectPegboardFromList(id: string): void {
  selectPegboard(id);
}

// ==================== 跨面移动 ====================

function onMoveToFace(params: { id: string; targetFace: 'back' | 'left' | 'right' }): void {
  const { id, targetFace } = params;
  const instance = installedPegboards.value.find(p => p.id === id);
  if (!instance || instance.face === targetFace) return;
  
  const shelf = shelfConfig.value;
  const halfW = shelf.width / 2;
  const halfD = shelf.depth / 2;
  const preset = pegboardPresets.value.find(p => p.id === instance.configId);
  
  if (!preset) return;
  
  // 创建新的位置
  let newPosition: Position;
  const thickness = preset.thickness;
  const postSize = 4; // 立柱尺寸
  const gapOffset = 2.0; // 往外增加间隙
  
  switch (targetFace) {
    case 'back':
      newPosition = {
        x: 0,
        y: instance.position.y,
        z: -halfD - thickness / 2 - gapOffset,
      };
      break;
    case 'left':
      newPosition = {
        x: -halfW - thickness / 2 - gapOffset,
        y: instance.position.y,
        z: 0,
      };
      break;
    case 'right':
      newPosition = {
        x: halfW + thickness / 2 + gapOffset,
        y: instance.position.y,
        z: 0,
      };
      break;
    default:
      return;
  }
  
  // 更新实例
  const updatedInstance: PegboardInstance = {
    ...instance,
    face: targetFace,
    position: newPosition,
  };
  
  // 更新存储
  const index = installedPegboards.value.findIndex(p => p.id === id);
  if (index >= 0) {
    installedPegboards.value[index] = updatedInstance;
    
    // 刷新3D模型
    pegboardManager?.removePegboard(id);
    pegboardManager?.addPegboard(updatedInstance);
    pegboardManager?.selectPegboard(id);
    
    // 显示尺寸
    showPegboardDimensions(id);
    
    if (sceneManager) {
      sceneManager.focusOnPegboard(updatedInstance);
    }
    
    const faceLabels: Record<string, string> = { back: '背面', left: '左面', right: '右面' };
    designerUI.value?.showToast(`已移动到${faceLabels[targetFace]}`, 'success');
  }
}

// ==================== 交互回调 ====================

function setupInteractionCallbacks(): void {
  if (!interactionManager) return;
  
  interactionManager.onSelect((id, type) => {
    if (type === 'pegboard' && id) {
      selectPegboard(id);
    } else {
      selectPegboard(null);
    }
  });
  
  interactionManager.onMove((id, position) => {
    pegboardManager?.updatePegboardPosition(id, new THREE.Vector3(position.x, position.y, position.z));
  });
  
  interactionManager.onDragStart((id) => {
    pegboardManager?.highlightPegboard(id);
    cadDimensions?.clearPegboardDimensions();
  });
  
  interactionManager.onDragEnd((id, position) => {
    updatePegboardPosition(id, position);
    pegboardManager?.highlightPegboard(null);
    showPegboardDimensions(id);
  });
  
  // 关键修复：直接在这里处理旋转，不通过自定义事件
  interactionManager.onDoubleClick = (id: string) => {
    rotatePegboard(id);
  };
  
  canvasContainer.value?.addEventListener('pegboard-place', handlePlaceEvent as EventListener);
}

// ==================== 洞洞板旋转 - 关键修复 ====================

function rotatePegboard(id: string): void {
  if (!pegboardManager) return;
  
  // 1. 获取当前实例
  const instance = installedPegboards.value.find(p => p.id === id);
  const preset = instance ? pegboardPresets.value.find(p => p.id === instance.configId) : undefined;
  
  if (!instance || !preset) return;
  
  // 2. 计算新的旋转状态
  const newIsRotated = !instance.isRotated;
  
  // 3. 更新 store（这会触发 watcher 重新创建模型）
  const index = installedPegboards.value.findIndex(p => p.id === id);
  if (index >= 0) {
    installedPegboards.value[index] = {
      ...instance,
      isRotated: newIsRotated,
    };
  }
  
  // 4. 显示尺寸
  showPegboardDimensions(id);
  
  designerUI.value?.showToast('已旋转90°', 'success');
}

function showPegboardDimensions(id: string): void {
  if (!cadDimensions || !pegboardManager) return;
  
  const instance = installedPegboards.value.find(p => p.id === id);
  const preset = pegboardPresets.value.find(p => p.id === instance?.configId);
  
  if (instance && preset) {
    cadDimensions.showPegboardDimensions(instance, preset, shelfConfig.value.depth);
  }
}

// ==================== 层板拖拽事件 - 彻底重写 ====================

function setupLayerDragEvents(): void {
  if (!canvasContainer.value || !shelfBuilder || !sceneManager) return;
  
  const container = canvasContainer.value;
  const controls = sceneManager.getControls();
  const camera = sceneManager.getCamera();
  
  // 创建事件处理函数
  layerMouseDownHandler = (e: MouseEvent) => {
    if (e.button !== 0) return;
    
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // 检测场景中所有物体
    const allObjects = sceneManager!.getScene().children;
    const intersects = raycaster.intersectObjects(allObjects, true)
      .filter(hit => {
        if (!hit.object.visible) return false;
        
        const material = (hit.object as THREE.Mesh).material;
        if (material) {
          if (Array.isArray(material)) {
            if (material.every(m => !m.visible)) return false;
          } else {
            if (!material.visible) return false;
          }
        }
        
        if (hit.object.type === 'LineSegments' || hit.object.type === 'Line') return false;
        if (hit.object.name === 'outline') return false;
        if (hit.object.userData?.type?.includes('face')) return false;
        
        return true;
      });
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const object = hit.object;
      
      // 检查最近的物体是否是层板手柄
      if (object.userData?.isLayerHandle) {
        // 关键修复：立即停止事件传播，防止触发洞洞板交互
        e.stopImmediatePropagation();
        e.preventDefault();
        
        // 找到被点击的手柄
        const hitHandle = object as THREE.Mesh;
        const layerIndex = hitHandle.userData.layerIndex;
        const layer = shelfBuilder!.getLayers()[layerIndex];
      
      if (layerIndex === undefined || layerIndex === null) return;
      
      // 开始拖拽
      isDraggingLayer = true;
      draggedLayerIndex = layerIndex;
      
      // 锁定镜头
      controls.enabled = false;
      
      // 创建拖拽平面（垂直面，面向相机）
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;
      cameraDir.normalize();
      if (cameraDir.lengthSq() === 0) cameraDir.set(0, 0, 1);
      
      layerDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        cameraDir.negate(),
        hitHandle.position
      );
      
      // 高亮手柄
      shelfBuilder!.setHandleHovered(layerIndex);
      
      // 显示提示
      layerDragInfo.value = {
        isDragging: true,
        layerIndex: layerIndex,
        currentY: layer.y,
      };
      }
    }
  };
  
  layerMouseMoveHandler = (e: MouseEvent) => {
    if (!isDraggingLayer || draggedLayerIndex < 0 || !layerDragPlane) return;
    
    // 关键修复：阻止事件传播，防止影响其他交互
    e.stopImmediatePropagation();
    e.preventDefault();
    
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(layerDragPlane, target)) {
      const config = shelfConfig.value;
      const minY = 2;
      const maxY = config.height - 2;
      const newY = Math.max(minY, Math.min(maxY, target.y));
      
      // 更新层板高度
      shelfBuilder!.updateLayerHeight(draggedLayerIndex, newY);
      
      // 更新提示
      layerDragInfo.value.currentY = newY;
      
      // 更新CAD尺寸
      if (cadDimensions) {
        const layers = shelfBuilder!.getLayers();
        const config = shelfConfig.value;
        const currentLayer = layers[draggedLayerIndex];
        
        const sortedLayers = [...layers].sort((a, b) => a.y - b.y);
        const currentIndexInSorted = sortedLayers.findIndex(l => l.index === draggedLayerIndex);
        
        const prevLayerY = currentIndexInSorted > 0 ? sortedLayers[currentIndexInSorted - 1].y : 0;
        const nextLayerY = currentIndexInSorted < sortedLayers.length - 1 ? sortedLayers[currentIndexInSorted + 1].y : config.height;
        
        cadDimensions.showLayerAdjustmentHint(
          currentLayer,
          config.width / 2 + 10, // x position
          config.depth / 2 + 10, // z position
          prevLayerY,
          nextLayerY
        );
      }
      
      // 更新吸附系统的层板位置
      updateSnapSystemBounds();
    }
  };
  
  layerMouseUpHandler = (e: MouseEvent) => {
    if (isDraggingLayer) {
      e.stopImmediatePropagation();
      isDraggingLayer = false;
      draggedLayerIndex = -1;
      layerDragPlane = null;
      
      // 解锁镜头
      controls.enabled = true;
      
      // 取消高亮
      shelfBuilder!.setHandleHovered(null);
      
      // 隐藏提示
      layerDragInfo.value.isDragging = false;
      
      // 清除CAD尺寸
      if (cadDimensions) {
        cadDimensions.clearPegboardDimensions();
        // 重新显示整体货架尺寸
        cadDimensions.showShelfDimensions(shelfConfig.value, shelfBuilder!.getLayers());
      }
    }
  };
  
  // 绑定事件 - 使用 capture 确保优先处理
  // 关键修复：使用 stopImmediatePropagation 确保层板事件不被其他处理器干扰
  container.addEventListener('mousedown', layerMouseDownHandler, true);
  container.addEventListener('mousemove', layerMouseMoveHandler, true);
  window.addEventListener('mouseup', layerMouseUpHandler, true);
}

// ==================== 事件处理 ====================

function handlePlaceEvent(event: CustomEvent): void {
  const { face, point } = event.detail;
  
  if (!activePresetId.value) {
    designerUI.value?.showToast('请先选择一个洞洞板预设', 'error');
    return;
  }
  
  const preset = pegboardPresets.value.find(p => p.id === activePresetId.value);
  if (!preset) return;
  
  const position = calculatePositionOnFace(face, point, preset);
  
  const id = addPegboardInstance(activePresetId.value, position, face);
  
  const instance = installedPegboards.value.find(p => p.id === id);
  if (instance && pegboardManager) {
    pegboardManager.addPegboard(instance);
    selectPegboard(id);
    pegboardManager.selectPegboard(id);
    showPegboardDimensions(id);
  }
  
  designerUI.value?.showToast('洞洞板已添加', 'success');
}

function calculatePositionOnFace(
  face: 'back' | 'left' | 'right',
  point: { x: number; y: number; z: number },
  preset: { width: number; height: number; thickness: number }
): Position {
  const shelf = shelfConfig.value;
  const halfW = shelf.width / 2;
  const halfD = shelf.depth / 2;
  const gapOffset = 2.0; // 往外增加间隙
  
  switch (face) {
    case 'back':
      return {
        x: Math.max(-halfW + preset.width/2, Math.min(halfW - preset.width/2, point.x)),
        y: Math.max(preset.height/2, Math.min(shelf.height - preset.height/2, point.y)),
        z: -halfD - preset.thickness / 2 - gapOffset,
      };
    case 'left':
      return {
        x: -halfW - preset.thickness / 2 - gapOffset,
        y: Math.max(preset.height/2, Math.min(shelf.height - preset.height/2, point.y)),
        z: Math.max(-halfD + preset.width/2, Math.min(halfD - preset.width/2, point.z)),
      };
    case 'right':
      return {
        x: halfW + preset.thickness / 2 + gapOffset,
        y: Math.max(preset.height/2, Math.min(shelf.height - preset.height/2, point.y)),
        z: Math.max(-halfD + preset.width/2, Math.min(halfD - preset.width/2, point.z)),
      };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function updateSnapSystemBounds(): void {
  if (!snapSystem || !shelfBuilder) return;
  
  const config = shelfConfig.value;
  snapSystem.setShelfBounds(
    config.width,
    config.height,
    config.depth,
    { x: 0, y: config.height / 2, z: 0 }
  );
  
  const layers = shelfBuilder.getLayers();
  snapSystem.setLayerPositions(layers.map(l => l.y));
  
  const otherPbs = installedPegboards.value.map(instance => {
    const preset = pegboardPresets.value.find(p => p.id === instance.configId);
    return {
      id: instance.id,
      position: instance.position,
      width: instance.isRotated ? (preset?.height || 0) : (preset?.width || 0),
      height: instance.isRotated ? (preset?.width || 0) : (preset?.height || 0),
      face: instance.face,
      isRotated: instance.isRotated,
    };
  });
  snapSystem.setOtherPegboards(otherPbs);
}

// ==================== 观察器 ====================

function setupWatchers(): void {
  watch(shelfConfig, (newConfig) => {
    const builder = shelfBuilder;
    if (builder) {
      builder.updateConfig(newConfig);
      updateSnapSystemBounds();
      
      // 重新验证所有洞洞板的位置
      const halfW = newConfig.width / 2;
      const halfD = newConfig.depth / 2;
      const gapOffset = 2.0;
      
      installedPegboards.value.forEach(pb => {
        const preset = pegboardPresets.value.find(p => p.id === pb.configId);
        if (preset) {
          const width = pb.isRotated ? preset.height : preset.width;
          const height = pb.isRotated ? preset.width : preset.height;
          const thickness = preset.thickness;
          
          let newPos = { ...pb.position };
          
          if (pb.face === 'back') {
            newPos.z = -halfD - thickness / 2 - gapOffset;
            newPos.x = Math.max(-halfW + width/2, Math.min(halfW - width/2, newPos.x));
          } else if (pb.face === 'left') {
            newPos.x = -halfW - thickness / 2 - gapOffset;
            newPos.z = Math.max(-halfD + width/2, Math.min(halfD - width/2, newPos.z));
          } else if (pb.face === 'right') {
            newPos.x = halfW + thickness / 2 + gapOffset;
            newPos.z = Math.max(-halfD + width/2, Math.min(halfD - width/2, newPos.z));
          }
          
          newPos.y = Math.max(height/2, Math.min(newConfig.height - height/2, newPos.y));
          
          updatePegboardPosition(pb.id, newPos);
          pegboardManager?.updatePegboardPosition(pb.id, new THREE.Vector3(newPos.x, newPos.y, newPos.z));
        }
      });
      
      const layers = builder.getLayers();
      setTimeout(() => {
        cadDimensions?.showShelfDimensions(newConfig, layers);
      }, 100);
    }
  }, { deep: true });
  
  watch(pegboardPresets, (newPresets, oldPresets) => {
    if (!pegboardManager) return;
    
    for (const preset of newPresets) {
      if (!pegboardManager.getPreset(preset.id)) {
        pegboardManager.addPreset(preset);
      }
    }
    
    for (const preset of newPresets) {
      const oldPreset = oldPresets?.find(p => p.id === preset.id);
      if (oldPreset && JSON.stringify(oldPreset) !== JSON.stringify(preset)) {
        pegboardManager.updatePreset(preset.id, preset);
      }
    }
    
    updateSnapSystemBounds();
  }, { deep: true });
  
  // 关键修复：监听洞洞板变化，同步3D模型
  watch(installedPegboards, (newInstances, oldInstances) => {
    if (!pegboardManager) return;
    
    // 获取当前所有ID
    const currentIds = new Set(newInstances.map(i => i.id));
    const existingIds = new Set(pegboardManager.getAllPegboards().map(p => p.id));
    
    // 添加新的
    for (const instance of newInstances) {
      if (!existingIds.has(instance.id)) {
        try {
          pegboardManager.addPegboard(instance);
        } catch (e) {
          console.warn('Failed to add pegboard:', e);
        }
      }
    }
    
    // 删除不存在的
    for (const existingId of existingIds) {
      if (!currentIds.has(existingId)) {
        pegboardManager.removePegboard(existingId);
      }
    }
    
    // 关键修复：检测旋转状态变化并更新模型
    for (const newInstance of newInstances) {
      const oldInstance = oldInstances?.find(i => i.id === newInstance.id);
      if (oldInstance && oldInstance.isRotated !== newInstance.isRotated) {
        // 旋转状态发生了变化，需要重建模型
        pegboardManager.removePegboard(newInstance.id);
        pegboardManager.addPegboard(newInstance);
        // 重新选中
        pegboardManager.selectPegboard(newInstance.id);
      }
    }
    
    updateSnapSystemBounds();
  }, { deep: true });
  
  let isFocusedOnShelf = true;
  
  watch(selection, (newSel) => {
    if (interactionManager) {
      interactionManager.setSelectedId(newSel.selectedId);
    }
    if (pegboardManager) {
      pegboardManager.selectPegboard(newSel.selectedId);
      
      if (newSel.selectedId) {
        showPegboardDimensions(newSel.selectedId);
        const instance = installedPegboards.value.find(p => p.id === newSel.selectedId);
        if (instance && sceneManager) {
          sceneManager.focusOnPegboard(instance);
          isFocusedOnShelf = false;
        }
      } else {
        cadDimensions?.clearPegboardDimensions();
        if (sceneManager && !isFocusedOnShelf) {
          sceneManager.focusOnShelf(shelfConfig.value.height);
          isFocusedOnShelf = true;
        }
      }
    }
  }, { deep: true });
  
  watch(editMode, (mode) => {
    if (interactionManager) {
      interactionManager.setMode(mode);
      interactionManager.setPlacing(mode === 'place' && !!activePresetId.value);
    }
  });
  
  watch(activePresetId, (id) => {
    if (interactionManager) {
      interactionManager.setPlacing(!!id && editMode.value === 'place');
    }
  });
}

function startPerformanceMonitor(): void {
  const updateFPS = () => {
    if (sceneManager) {
      const fps = sceneManager.getFPS();
      if (designerUI.value) {
        designerUI.value.fps = fps;
      }
    }
    requestAnimationFrame(updateFPS);
  };
  updateFPS();
}
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #faf6f0;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

/* 层板拖拽提示 */
.layer-drag-hint {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: none;
}

.hint-content {
  background: rgba(255, 107, 107, 0.95);
  color: white;
  padding: 16px 32px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
}

.hint-title {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.hint-value {
  font-size: 24px;
  font-weight: 700;
}

/* 加载画面 */
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #faf6f0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.loading-content {
  text-align: center;
}

.loading-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 1s ease infinite;
}

.loading-text {
  font-size: 18px;
  color: #666;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
