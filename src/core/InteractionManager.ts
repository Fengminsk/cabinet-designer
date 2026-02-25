import * as THREE from 'three';
import type { Position, PegboardPreset, PegboardInstance } from '../types';
import { SnapSystem, createSnapIndicator } from './SnapSystem';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 拖拽状态
 */
interface DragState {
  isDragging: boolean;
  pegboardId: string | null;
  startPosition: THREE.Vector3;
  startClientX: number;
  startClientY: number;
  face: 'back' | 'left' | 'right';
  preset: PegboardPreset | null; // 存储预设以获取尺寸
}

/**
 * 交互管理器
 * 
 * 交互规则：
 * - 点击空白区域：控制镜头旋转/平移 (OrbitControls)
 * - 点击洞洞板并拖拽：移动洞洞板，锁定镜头
 * - 拖拽时：禁用OrbitControls，防止镜头移动
 */
export class InteractionManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private shelfGroup: THREE.Group;
  private pegboardGroup: THREE.Group;
  private getPreset: (id: string) => PegboardPreset | undefined; // 获取预设的回调
  private getInstance: (id: string) => PegboardInstance | undefined; // 获取实例的回调
  
  // 吸附系统
  private snapSystem: SnapSystem;
  private snapIndicator: THREE.Group;
  
  // 状态
  private dragState: DragState = {
    isDragging: false,
    pegboardId: null,
    startPosition: new THREE.Vector3(),
    startClientX: 0,
    startClientY: 0,
    face: 'back',
    preset: null,
  };
  
  // 点击检测状态
  private mouseDownTime: number = 0;
  private mouseDownPosition: { x: number; y: number } = { x: 0, y: 0 };
  private clickThreshold: number = 5;
  private clickTimeThreshold: number = 200;
  private isClickOnPegboard: boolean = false;
  
  // 交互平面
  private dragPlane: THREE.Plane;
  
  // 回调函数
  private onSelectCallback: ((id: string | null, type: 'pegboard' | 'shelf' | 'empty') => void) | null = null;
  private onMoveCallback: ((id: string, position: Position) => void) | null = null;
  private onDragStartCallback: ((id: string) => void) | null = null;
  private onDragEndCallback: ((id: string, position: Position) => void) | null = null;
  private onHoverCallback: ((id: string | null) => void) | null = null;
  
  // 编辑模式
  private mode: 'select' | 'place' | 'fill' = 'select';
  private isPlacing: boolean = false;
  private originalCursor: string = 'default';
  private selectedId: string | null = null;

  constructor(
    container: HTMLElement,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    snapSystem: SnapSystem,
    getPreset?: (id: string) => PegboardPreset | undefined,
    getInstance?: (id: string) => PegboardInstance | undefined
  ) {
    this.container = container;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.snapSystem = snapSystem;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.getPreset = getPreset || (() => undefined);
    this.getInstance = getInstance || (() => undefined);
    
    this.shelfGroup = new THREE.Group();
    this.pegboardGroup = new THREE.Group();
    
    this.snapIndicator = createSnapIndicator();
    this.scene.add(this.snapIndicator);
    
    this.bindEvents();
  }

  setGetPresetCallback(callback: (id: string) => PegboardPreset | undefined): void {
    this.getPreset = callback;
  }

  setGetInstanceCallback(callback: (id: string) => PegboardInstance | undefined): void {
    this.getInstance = callback;
  }

  setShelfGroup(group: THREE.Group): void {
    this.shelfGroup = group;
  }

  setPegboardGroup(group: THREE.Group): void {
    this.pegboardGroup = group;
  }

  setMode(mode: 'select' | 'place' | 'fill'): void {
    this.mode = mode;
    if (mode !== 'place') {
      this.isPlacing = false;
    }
  }

  setPlacing(isPlacing: boolean): void {
    this.isPlacing = isPlacing;
    this.container.style.cursor = isPlacing ? 'crosshair' : 'default';
  }

  setSelectedId(id: string | null): void {
    this.selectedId = id;
  }

  onSelect(callback: (id: string | null, type: 'pegboard' | 'shelf' | 'empty') => void): void {
    this.onSelectCallback = callback;
  }

  onMove(callback: (id: string, position: Position) => void): void {
    this.onMoveCallback = callback;
  }

  onDragStart(callback: (id: string) => void): void {
    this.onDragStartCallback = callback;
  }

  onDragEnd(callback: (id: string, position: Position) => void): void {
    this.onDragEndCallback = callback;
  }
  
  onHover(callback: (id: string | null) => void): void {
    this.onHoverCallback = callback;
  }
  
  // 双击回调
  onDoubleClick: ((id: string) => void) | null = null;

  private bindEvents(): void {
    // 使用捕获阶段确保我们在其他处理器之前处理
    this.container.addEventListener('mousedown', this.handleMouseDown, true);
    this.container.addEventListener('mousemove', this.handleMouseMove, true);
    this.container.addEventListener('mouseup', this.handleMouseUp, true);
    this.container.addEventListener('mouseleave', this.handleMouseUp);
    
    this.container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd);
    
    this.container.addEventListener('dblclick', this.handleDoubleClick);
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private getNormalizedPoint(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.container.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private raycast(point: THREE.Vector2, objects: THREE.Object3D[]): THREE.Intersection[] {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(point, this.camera);
    return raycaster.intersectObjects(objects, true);
  }

  /**
   * 检测是否点击在洞洞板上 - 关键修复：只检测直接点击，不包括边缘，并考虑遮挡
   */
  private checkPegboardHit(clientX: number, clientY: number): { id: string; mesh: THREE.Object3D } | null {
    const point = this.getNormalizedPoint(clientX, clientY);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(point, this.camera);
    
    // 检测场景中所有物体以考虑遮挡
    const allObjects = this.scene.children;
    const intersects = raycaster.intersectObjects(allObjects, true)
      .filter(hit => {
        // 过滤掉不可见的物体和辅助线
        if (!hit.object.visible) return false;
        
        // 过滤掉不可见的材质
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
        
        // 过滤掉货架的虚拟安装面
        if (hit.object.userData?.type?.includes('face')) return false;
        
        return true;
      });
    
    if (intersects.length > 0) {
      // 找到最近的物体
      const hit = intersects[0];
      let parent: THREE.Object3D | null = hit.object;
      
      // 检查最近的物体是否是洞洞板
      while (parent) {
        if (parent.userData?.type === 'pegboard') {
          return { id: parent.userData.id, mesh: parent };
        }
        parent = parent.parent;
      }
    }
    return null;
  }

  private getPointOnDragPlane(clientX: number, clientY: number): THREE.Vector3 | null {
    const point = this.getNormalizedPoint(clientX, clientY);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(point, this.camera);
    
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(this.dragPlane, target)) {
      return target;
    }
    return null;
  }

  /**
   * 处理鼠标按下
   */
  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    
    this.mouseDownTime = Date.now();
    this.mouseDownPosition = { x: e.clientX, y: e.clientY };
    
    const point = this.getNormalizedPoint(e.clientX, e.clientY);
    
    // 放置模式
    if (this.isPlacing) {
      this.handlePlace(point);
      return;
    }
    
    // 检测是否点击在洞洞板上
    const hit = this.checkPegboardHit(e.clientX, e.clientY);
    this.isClickOnPegboard = !!hit;
    
    if (hit) {
      if (hit.id === this.selectedId) {
        // 已经选中，准备拖拽
        this.prepareDrag(hit.id, e.clientX, e.clientY);
        e.stopPropagation(); // 阻止事件冒泡
      } else {
        // 未选中，仅记录点击的洞洞板ID，等待 mouseup 触发选中
        this.dragState.pegboardId = hit.id;
      }
    } else {
      // 点击在空白处或货架上
      this.isClickOnPegboard = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    // 悬停检测
    if (!this.dragState.isDragging) {
      this.handleHover(e.clientX, e.clientY);
    }
    
    // 检查是否应该开始拖拽
    if (this.isClickOnPegboard && !this.dragState.isDragging) {
      const dx = e.clientX - this.mouseDownPosition.x;
      const dy = e.clientY - this.mouseDownPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.clickThreshold) {
        this.startDrag();
      }
    }
    
    // 执行拖拽
    if (this.dragState.isDragging) {
      this.updateDrag(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private handleMouseUp = (e?: MouseEvent): void => {
    const clickDuration = Date.now() - this.mouseDownTime;
    const dx = e ? e.clientX - this.mouseDownPosition.x : 0;
    const dy = e ? e.clientY - this.mouseDownPosition.y : 0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const isClick = clickDuration < this.clickTimeThreshold && distance < this.clickThreshold;
    
    if (isClick) {
      if (this.isClickOnPegboard && !this.dragState.isDragging) {
        const pegboardId = this.dragState.pegboardId;
        if (pegboardId && this.onSelectCallback) {
          this.onSelectCallback(pegboardId, 'pegboard');
        }
      } else if (!this.isClickOnPegboard) {
        // 点击在空白处或货架上，取消选中
        if (this.onSelectCallback) {
          this.onSelectCallback(null, 'empty');
        }
      }
    }
    
    if (this.dragState.isDragging) {
      this.endDrag();
    }
    
    this.isClickOnPegboard = false;
    this.dragState.pegboardId = null;
    this.dragState.preset = null;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    this.handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
    } as MouseEvent);
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    this.handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as MouseEvent);
  };

  private handleTouchEnd = (): void => {
    this.handleMouseUp();
  };

  private handleDoubleClick = (e: MouseEvent): void => {
    const hit = this.checkPegboardHit(e.clientX, e.clientY);
    if (hit && this.onDoubleClick) {
      this.onDoubleClick(hit.id);
    }
  };

  private handleHover(clientX: number, clientY: number): void {
    const hit = this.checkPegboardHit(clientX, clientY);
    
    if (hit) {
      this.container.style.cursor = this.isPlacing ? 'crosshair' : 'grab';
      if (this.onHoverCallback) {
        this.onHoverCallback(hit.id);
      }
    } else {
      this.container.style.cursor = this.isPlacing ? 'crosshair' : 'default';
      if (this.onHoverCallback) {
        this.onHoverCallback(null);
      }
    }
  }

  private prepareDrag(pegboardId: string, clientX: number, clientY: number): void {
    const pegboardObj = this.pegboardGroup.getObjectByName(`pegboard-${pegboardId}`);
    if (!pegboardObj) return;
    
    // 获取实例和预设信息
    const instance = this.getInstance(pegboardId);
    const preset = instance ? this.getPreset(instance.configId) : undefined;
    
    const face = pegboardObj.userData.face || 'back';
    
    this.dragState = {
      isDragging: false,
      pegboardId,
      startPosition: pegboardObj.position.clone(),
      startClientX: clientX,
      startClientY: clientY,
      face,
      preset: preset || null,
    };
  }

  private startDrag(): void {
    if (!this.dragState.pegboardId) return;
    
    // 只有在已经选中的情况下才允许拖拽
    if (this.dragState.pegboardId !== this.selectedId) return;
    
    this.dragState.isDragging = true;
    this.controls.enabled = false;
    this.originalCursor = this.container.style.cursor;
    this.container.style.cursor = 'grabbing';
    
    const pegboardObj = this.pegboardGroup.getObjectByName(`pegboard-${this.dragState.pegboardId}`);
    if (pegboardObj) {
      this.snapIndicator.visible = true;
      this.snapIndicator.position.copy(pegboardObj.position);
    }
    
    if (this.onDragStartCallback) {
      this.onDragStartCallback(this.dragState.pegboardId);
    }
  }

  /**
   * 更新拖拽 - 使用屏幕空间映射，彻底解决侧面拖拽错位问题
   */
  private updateDrag(clientX: number, clientY: number): void {
    const pegboardObj = this.pegboardGroup.getObjectByName(`pegboard-${this.dragState.pegboardId}`);
    if (!pegboardObj) return;

    // 计算屏幕移动像素
    const dx = clientX - this.dragState.startClientX;
    const dy = clientY - this.dragState.startClientY;

    // 计算物体所在深度的世界坐标与像素的比例
    const distance = this.dragState.startPosition.distanceTo(this.camera.position);
    const fov = this.camera.fov * Math.PI / 180;
    const viewHeight = 2 * Math.tan(fov / 2) * distance;
    const viewWidth = viewHeight * this.camera.aspect;
    
    const worldDx = (dx / this.container.clientWidth) * viewWidth;
    const worldDy = -(dy / this.container.clientHeight) * viewHeight;

    const newPosition = this.dragState.startPosition.clone();

    // 将屏幕移动映射到面的局部坐标系
    switch (this.dragState.face) {
      case 'back':
        const isLookingFromBack = this.camera.position.z < newPosition.z;
        newPosition.x += isLookingFromBack ? -worldDx : worldDx;
        newPosition.y += worldDy;
        break;
      case 'left':
        // 左面：屏幕向右拖动对应 Z 轴正向
        const isLookingFromLeft = this.camera.position.x < newPosition.x;
        newPosition.z += isLookingFromLeft ? worldDx : -worldDx;
        newPosition.y += worldDy;
        break;
      case 'right':
        // 右面：屏幕向右拖动对应 Z 轴反向
        const isLookingFromRight = this.camera.position.x > newPosition.x;
        newPosition.z += isLookingFromRight ? -worldDx : worldDx;
        newPosition.y += worldDy;
        break;
    }
    
    // 获取实际尺寸
    let width = 60;
    let height = 40;
    
    const instance = this.getInstance(this.dragState.pegboardId || '');
    const preset = instance ? this.getPreset(instance.configId) : undefined;
    
    if (preset && instance) {
      width = instance.isRotated ? preset.height : preset.width;
      height = instance.isRotated ? preset.width : preset.height;
    }
    
    // 应用吸附
    const snapped = this.snapSystem.calculateSnap(
      { x: newPosition.x, y: newPosition.y, z: newPosition.z },
      width,
      height,
      this.dragState.face,
      this.dragState.pegboardId || undefined
    );
    
    // 再次确保坐标固定（吸附可能会改变它们）
    const shelfBounds = this.snapSystem.getShelfBounds();
    if (shelfBounds) {
      const halfW = shelfBounds.width / 2;
      const halfD = shelfBounds.depth / 2;
      const thickness = preset?.thickness || 1.5;
      const postSize = 4; // 立柱尺寸
      const gapOffset = 0.6; // 往外增加间隙
      
      switch (this.dragState.face) {
        case 'back':
          snapped.position.z = -halfD - thickness / 2 - gapOffset;
          break;
        case 'left':
          snapped.position.x = -halfW - thickness / 2 - gapOffset;
          break;
        case 'right':
          snapped.position.x = halfW + thickness / 2 + gapOffset;
          break;
      }
    }
    
    this.snapIndicator.position.set(
      snapped.position.x,
      snapped.position.y,
      snapped.position.z
    );
    
    if (this.dragState.pegboardId && this.onMoveCallback) {
      this.onMoveCallback(this.dragState.pegboardId, snapped.position);
    }
  }

  private endDrag(): void {
    if (!this.dragState.pegboardId) return;
    
    this.controls.enabled = true;
    this.snapIndicator.visible = false;
    
    const finalPosition: Position = {
      x: this.snapIndicator.position.x,
      y: this.snapIndicator.position.y,
      z: this.snapIndicator.position.z,
    };
    
    if (this.onDragEndCallback) {
      this.onDragEndCallback(this.dragState.pegboardId, finalPosition);
    }
    
    this.container.style.cursor = this.originalCursor;
  }

  private handlePlace(point: THREE.Vector2): void {
    const intersects = this.raycast(point, [this.shelfGroup]);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const object = hit.object;
      
      let face: 'back' | 'left' | 'right' = 'back';
      if (object.userData?.type === 'shelf-back-face') {
        face = 'back';
      } else if (object.userData?.type === 'shelf-left-face') {
        face = 'left';
      } else if (object.userData?.type === 'shelf-right-face') {
        face = 'right';
      } else {
        return;
      }
      
      const hitPoint = hit.point;
      this.emitPlaceEvent(face, hitPoint);
    }
  }

  private emitPlaceEvent(face: 'back' | 'left' | 'right', point: THREE.Vector3): void {
    const event = new CustomEvent('pegboard-place', {
      detail: { face, point },
    });
    this.container.dispatchEvent(event);
  }



  dispose(): void {
    this.container.removeEventListener('mousedown', this.handleMouseDown, true);
    this.container.removeEventListener('mousemove', this.handleMouseMove, true);
    this.container.removeEventListener('mouseup', this.handleMouseUp, true);
    this.container.removeEventListener('mouseleave', this.handleMouseUp);
    this.container.removeEventListener('touchstart', this.handleTouchStart);
    this.container.removeEventListener('touchmove', this.handleTouchMove);
    this.container.removeEventListener('touchend', this.handleTouchEnd);
    this.container.removeEventListener('dblclick', this.handleDoubleClick);
    
    this.scene.remove(this.snapIndicator);
  }
}
