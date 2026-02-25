import * as THREE from 'three';
import type { ShelfConfig, ShelfLayer } from '../types';

/**
 * 货架构建器
 * 负责根据配置生成3D货架模型
 * 
 * 新增功能：
 * - 层板可独立调整高度（通过拖拽手柄）
 * - 显示层板高度标注
 */
export class ShelfBuilder {
  private group: THREE.Group;
  private config: ShelfConfig;
  private layers: ShelfLayer[] = [];
  private layerMeshes: Map<number, THREE.Mesh> = new Map(); // 存储层板引用
  private layerHandles: Map<number, THREE.Mesh> = new Map(); // 存储层板手柄引用
  
  // 材质缓存
  private material: THREE.MeshStandardMaterial;
  private highlightMaterial: THREE.MeshStandardMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;
  private handleHoverMaterial: THREE.MeshStandardMaterial;
  
  // 回调
  private onLayerHeightChange: ((layerIndex: number, newY: number) => void) | null = null;

  constructor(config: ShelfConfig) {
    this.config = { ...config };
    this.group = new THREE.Group();
    this.group.name = 'shelf';
    
    // 创建材质 - 哑光柔和风格
    this.material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.75,
      metalness: 0.05,
    });
    
    // 高亮材质 (用于选中效果)
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.5,
      metalness: 0.1,
      emissive: '#ffffff',
      emissiveIntensity: 0.1,
    });
    
    // 层板手柄材质
    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: '#4ade80',
      roughness: 0.3,
      metalness: 0.2,
      emissive: '#4ade80',
      emissiveIntensity: 0.2,
    });
    
    this.handleHoverMaterial = new THREE.MeshStandardMaterial({
      color: '#22c55e',
      roughness: 0.3,
      metalness: 0.2,
      emissive: '#22c55e',
      emissiveIntensity: 0.5,
    });
    
    this.build();
  }

  /**
   * 设置层板高度变化回调
   */
  onLayerChange(callback: (layerIndex: number, newY: number) => void): void {
    this.onLayerHeightChange = callback;
  }

  /**
   * 构建货架
   */
  private build(): void {
    // 清理旧模型
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    
    this.layers = [];
    this.layerMeshes.clear();
    this.layerHandles.clear();
    
    const { width, height, depth, layers, postRadius = 1.5 } = this.config;
    const postSize = 4; // 立柱尺寸
    const halfW = width / 2;
    const halfD = depth / 2;
    
    // 1. 创建四根立柱
    const postGeom = new THREE.BoxGeometry(postSize, height, postSize);
    const postPositions = [
      { x: -halfW + postSize/2, z: -halfD + postSize/2 },
      { x: halfW - postSize/2, z: -halfD + postSize/2 },
      { x: -halfW + postSize/2, z: halfD - postSize/2 },
      { x: halfW - postSize/2, z: halfD - postSize/2 },
    ];
    
    for (const pos of postPositions) {
      const post = new THREE.Mesh(postGeom, this.material.clone());
      post.position.set(pos.x, height / 2, pos.z);
      post.castShadow = true;
      post.receiveShadow = true;
      post.userData = { type: 'shelf-post' };
      this.group.add(post);
    }
    
    // 2. 创建层板和调整手柄
    const layerSpacing = height / (layers + 1);
    const boardThickness = 2;
    const boardGeom = new THREE.BoxGeometry(
      width - postSize * 2 + 1,
      boardThickness,
      depth - postSize * 2 + 1
    );
    
    // 创建手柄几何体 (扁平的圆角矩形风格)
    const handleWidth = 20;
    const handleHeight = 4;
    const handleDepth = 8;
    const handleGeom = new THREE.BoxGeometry(handleWidth, handleHeight, handleDepth);
    
    for (let i = 1; i <= layers; i++) {
      const y = i * layerSpacing;
      
      // 层板
      const board = new THREE.Mesh(boardGeom, this.material.clone());
      board.position.set(0, y, 0);
      board.castShadow = true;
      board.receiveShadow = true;
      board.userData = { type: 'shelf-layer', layerIndex: i - 1 };
      this.group.add(board);
      this.layerMeshes.set(i - 1, board);
      
      // 调整手柄 (位于层板前方中央)
      const handle = new THREE.Mesh(handleGeom, this.handleMaterial.clone());
      handle.position.set(0, y, halfD + handleDepth / 2);
      handle.userData = { 
        type: 'shelf-layer-handle', 
        layerIndex: i - 1,
        originalY: y,
        isLayerHandle: true, // 标记为层板手柄，用于事件过滤
      };
      // 确保手柄始终渲染在前面
      handle.renderOrder = 1000;
      this.group.add(handle);
      this.layerHandles.set(i - 1, handle);
      
      this.layers.push({
        index: i - 1,
        y: y,
        thickness: boardThickness,
      });
    }
    
    // 3. 添加背板和侧面框架 (用于洞洞板安装的参考)
    this.buildFaceFrames(halfW, halfD, height);
    
    // 4. 添加脚垫
    this.buildFeet(postPositions);
  }

  /**
   * 构建面框架
   */
  private buildFaceFrames(halfW: number, halfD: number, height: number): void {
    // 背板框架
    const backFrameThickness = 2;
    const backFrameGeom = new THREE.BoxGeometry(this.config.width, height, backFrameThickness);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.3,
      visible: false,
    });
    
    const backFrame = new THREE.Mesh(backFrameGeom, frameMat);
    backFrame.position.set(0, height / 2, -halfD - backFrameThickness / 2);
    backFrame.userData = { type: 'shelf-back-face' };
    this.group.add(backFrame);
    
    // 侧面框架
    const sideFrameGeom = new THREE.BoxGeometry(backFrameThickness, height, this.config.depth);
    
    const leftFrame = new THREE.Mesh(sideFrameGeom, frameMat.clone());
    leftFrame.position.set(-halfW - backFrameThickness / 2, height / 2, 0);
    leftFrame.userData = { type: 'shelf-left-face' };
    this.group.add(leftFrame);
    
    const rightFrame = new THREE.Mesh(sideFrameGeom, frameMat.clone());
    rightFrame.position.set(halfW + backFrameThickness / 2, height / 2, 0);
    rightFrame.userData = { type: 'shelf-right-face' };
    this.group.add(rightFrame);
  }

  /**
   * 构建脚垫
   */
  private buildFeet(postPositions: { x: number; z: number }[]): void {
    const footGeom = new THREE.BoxGeometry(5, 2, 5);
    const footMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.5,
      metalness: 0.3,
    });
    
    for (const pos of postPositions) {
      const foot = new THREE.Mesh(footGeom, footMat);
      foot.position.set(pos.x, 1, pos.z);
      foot.receiveShadow = true;
      this.group.add(foot);
    }
  }

  /**
   * 更新层板高度
   */
  updateLayerHeight(layerIndex: number, newY: number): void {
    const board = this.layerMeshes.get(layerIndex);
    const handle = this.layerHandles.get(layerIndex);
    const layer = this.layers[layerIndex];
    
    if (board && handle && layer) {
      // 更新位置
      board.position.y = newY;
      handle.position.y = newY;
      handle.userData.originalY = newY;
      
      // 更新数据
      layer.y = newY;
      
      // 触发回调
      if (this.onLayerHeightChange) {
        this.onLayerHeightChange(layerIndex, newY);
      }
    }
  }

  /**
   * 获取层板手柄
   */
  getLayerHandle(layerIndex: number): THREE.Mesh | undefined {
    return this.layerHandles.get(layerIndex);
  }

  /**
   * 设置手柄高亮
   */
  setHandleHovered(layerIndex: number | null): void {
    this.layerHandles.forEach((handle, index) => {
      if (index === layerIndex) {
        handle.material = this.handleHoverMaterial;
        handle.scale.set(1.3, 1.3, 1.3);
      } else {
        handle.material = this.handleMaterial;
        handle.scale.set(1, 1, 1);
      }
    });
  }

  /**
   * 获取所有层板手柄（包括装饰环）用于事件检测
   */
  getAllLayerHandleMeshes(): THREE.Mesh[] {
    const handles: THREE.Mesh[] = [];
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData?.isLayerHandle) {
        handles.push(child);
      }
    });
    return handles;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ShelfConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 更新材质颜色
    if (config.color) {
      this.material.color.set(config.color);
      this.highlightMaterial.color.set(config.color);
    }
    
    // 重新构建
    this.build();
  }

  /**
   * 获取货架组
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * 获取层板信息
   */
  getLayers(): ShelfLayer[] {
    return [...this.layers];
  }

  /**
   * 获取配置
   */
  getConfig(): ShelfConfig {
    return { ...this.config };
  }

  /**
   * 获取三个安装面的边界信息 (外侧)
   */
  getFaceBounds() {
    const { width, height, depth } = this.config;
    const postSize = 4; // 立柱尺寸
    const halfW = width / 2;
    const halfD = depth / 2;
    
    return {
      back: {
        width,
        height,
        center: { x: 0, y: height / 2, z: -halfD - postSize / 2 },
        normal: new THREE.Vector3(0, 0, 1),
      },
      left: {
        width: depth,
        height,
        center: { x: -halfW - postSize / 2, y: height / 2, z: 0 },
        normal: new THREE.Vector3(1, 0, 0),
      },
      right: {
        width: depth,
        height,
        center: { x: halfW + postSize / 2, y: height / 2, z: 0 },
        normal: new THREE.Vector3(-1, 0, 0),
      },
    };
  }

  /**
   * 高亮显示
   */
  setHighlighted(highlighted: boolean): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.type?.startsWith('shelf-')) {
        if (highlighted) {
          child.material = this.highlightMaterial;
        } else {
          child.material = this.material;
        }
      }
    });
  }

  /**
   * 获取某个Y坐标最近的层板
   */
  getNearestLayer(y: number): ShelfLayer | null {
    if (this.layers.length === 0) return null;
    
    let nearest = this.layers[0];
    let minDist = Math.abs(y - nearest.y);
    
    for (const layer of this.layers) {
      const dist = Math.abs(y - layer.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = layer;
      }
    }
    
    return nearest;
  }

  /**
   * 获取层板之间的可用空间
   */
  getLayerSpaces(): { bottom: number; top: number; height: number }[] {
    const spaces: { bottom: number; top: number; height: number }[] = [];
    const sortedLayers = [...this.layers].sort((a, b) => a.y - b.y);
    
    // 地面到第一层
    if (sortedLayers.length > 0) {
      spaces.push({
        bottom: 0,
        top: sortedLayers[0].y - sortedLayers[0].thickness / 2,
        height: sortedLayers[0].y - sortedLayers[0].thickness / 2,
      });
    }
    
    // 层板之间
    for (let i = 0; i < sortedLayers.length - 1; i++) {
      const current = sortedLayers[i];
      const next = sortedLayers[i + 1];
      spaces.push({
        bottom: current.y + current.thickness / 2,
        top: next.y - next.thickness / 2,
        height: next.y - next.thickness / 2 - current.y - current.thickness / 2,
      });
    }
    
    return spaces;
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.material.dispose();
    this.highlightMaterial.dispose();
    this.handleMaterial.dispose();
    this.handleHoverMaterial.dispose();
  }
}
