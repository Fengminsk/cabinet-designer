import * as THREE from 'three';
import type { PegboardPreset, PegboardInstance } from '../types';

/**
 * 单个洞洞板对象包装
 */
export class PegboardObject {
  public mesh: THREE.Group;
  public id: string;
  public configId: string;
  public data: PegboardInstance;
  private outline: THREE.LineSegments | null = null;
  
  constructor(instance: PegboardInstance, preset: PegboardPreset) {
    this.id = instance.id;
    this.configId = instance.configId;
    this.data = { ...instance };
    
    // 创建洞洞板组
    this.mesh = new THREE.Group();
    this.mesh.name = `pegboard-${this.id}`;
    this.updateUserData();
    
    this.buildMesh(preset, instance);
    this.updateTransform();
  }

  private updateUserData(): void {
    this.mesh.userData = {
      type: 'pegboard',
      id: this.id,
      configId: this.configId,
      face: this.data.face,
      isRotated: this.data.isRotated,
    };
  }

  /**
   * 构建洞洞板网格
   */
  private buildMesh(preset: PegboardPreset, instance: PegboardInstance): void {
    // 清理旧网格
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    
    // 根据是否旋转确定实际宽高
    const width = instance.isRotated ? preset.height : preset.width;
    const height = instance.isRotated ? preset.width : preset.height;
    const thickness = preset.thickness;
    
    // 主体 - 使用盒子几何体
    const bodyGeom = new THREE.BoxGeometry(width, height, thickness);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: preset.color,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { pegboardId: this.id, part: 'body' };
    this.mesh.add(body);
    
    // 创建洞洞纹理
    const holeTexture = this.createHoleTexture(preset.holeSize || 1.5, preset.holeSpacing || 2.5, width, height);
    
    // 前面板 (带孔洞效果)
    const frontGeom = new THREE.PlaneGeometry(width, height);
    const frontMat = new THREE.MeshStandardMaterial({
      map: holeTexture,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });
    const front = new THREE.Mesh(frontGeom, frontMat);
    front.position.z = thickness / 2 + 0.001;
    front.userData = { pegboardId: this.id, part: 'front' };
    this.mesh.add(front);
    
    // 边框装饰
    const borderThickness = 0.8;
    const borderDepth = thickness + 0.2;
    
    // 上下边框
    const hBorderGeom = new THREE.BoxGeometry(width + 0.4, borderThickness, borderDepth);
    const borderMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(preset.color).multiplyScalar(0.9),
      roughness: 0.5,
      metalness: 0.15,
    });
    
    const topBorder = new THREE.Mesh(hBorderGeom, borderMat);
    topBorder.position.set(0, height / 2 - borderThickness / 2, 0);
    topBorder.castShadow = true;
    topBorder.userData = { pegboardId: this.id, part: 'border' };
    this.mesh.add(topBorder);
    
    const bottomBorder = new THREE.Mesh(hBorderGeom, borderMat);
    bottomBorder.position.set(0, -height / 2 + borderThickness / 2, 0);
    bottomBorder.castShadow = true;
    bottomBorder.userData = { pegboardId: this.id, part: 'border' };
    this.mesh.add(bottomBorder);
    
    // 左右边框
    const vBorderGeom = new THREE.BoxGeometry(borderThickness, height - borderThickness * 2, borderDepth);
    
    const leftBorder = new THREE.Mesh(vBorderGeom, borderMat);
    leftBorder.position.set(-width / 2 + borderThickness / 2, 0, 0);
    leftBorder.castShadow = true;
    leftBorder.userData = { pegboardId: this.id, part: 'border' };
    this.mesh.add(leftBorder);
    
    const rightBorder = new THREE.Mesh(vBorderGeom, borderMat);
    rightBorder.position.set(width / 2 - borderThickness / 2, 0, 0);
    rightBorder.castShadow = true;
    rightBorder.userData = { pegboardId: this.id, part: 'border' };
    this.mesh.add(rightBorder);
    
    // 创建选中轮廓线
    this.createOutline(width, height, thickness);
  }

  private createHoleTexture(holeSize: number, spacing: number, width: number, height: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    const pixelsPerCm = 32;
    const size = spacing * pixelsPerCm;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, size, size);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const holeRadius = (holeSize / 2) * pixelsPerCm;
    
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, holeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / spacing, height / spacing);
    return texture;
  }

  private createOutline(width: number, height: number, depth: number): void {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.5, height + 0.5, depth + 0.5));
    const material = new THREE.LineBasicMaterial({ 
      color: '#4ade80',
      linewidth: 2,
      transparent: true,
      opacity: 0,
    });
    this.outline = new THREE.LineSegments(geometry, material);
    this.outline.name = 'outline';
    this.mesh.add(this.outline);
  }

  /**
   * 更新变换 - 修复旋转问题
   */
  private updateTransform(): void {
    const { position, rotation, face, isRotated } = this.data;
    
    // 设置位置
    this.mesh.position.set(position.x, position.y, position.z);
    
    // 重置旋转
    this.mesh.rotation.set(0, 0, 0);
    
    // 根据面调整基础朝向，并确保洞洞板位于立柱外侧
    switch (face) {
      case 'back':
        this.mesh.rotation.y = Math.PI;
        break;
      case 'left':
        this.mesh.rotation.y = -Math.PI / 2;
        break;
      case 'right':
        this.mesh.rotation.y = Math.PI / 2;
        break;
    }
    
    // 应用自定义旋转
    this.mesh.rotateX(rotation.x);
    this.mesh.rotateY(rotation.y);
    this.mesh.rotateZ(rotation.z);
  }

  /**
   * 完全重建网格（用于旋转后）
   */
  rebuild(preset: PegboardPreset): void {
    this.buildMesh(preset, this.data);
    this.updateTransform();
    this.updateUserData();
  }

  setPosition(position: Position): void {
    this.data.position = { ...position };
    this.mesh.position.set(position.x, position.y, position.z);
  }

  setRotation(rotation: { x: number; y: number; z: number }): void {
    this.data.rotation = { ...rotation };
    this.updateTransform();
  }

  setSelected(selected: boolean): void {
    if (this.outline) {
      (this.outline.material as THREE.LineBasicMaterial).opacity = selected ? 1 : 0;
    }
    const scale = selected ? 1.02 : 1;
    this.mesh.scale.set(scale, scale, scale);
  }

  setHighlighted(highlighted: boolean): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.pegboardId === this.id) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (highlighted) {
          mat.emissive = new THREE.Color('#4ade80');
          mat.emissiveIntensity = 0.2;
        } else {
          mat.emissive = new THREE.Color('#000000');
          mat.emissiveIntensity = 0;
        }
      }
    });
  }

  setOpacity(opacity: number): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.transparent = opacity < 1;
        mat.opacity = opacity;
      }
    });
  }

  toggleRotation(preset: PegboardPreset): void {
    this.data.isRotated = !this.data.isRotated;
    // 完全重建网格
    this.rebuild(preset);
  }

  getBoundingBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.mesh);
  }

  getWorldBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();
    this.mesh.updateWorldMatrix(true, false);
    box.setFromObject(this.mesh);
    return box;
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}

import type { Position } from '../types';

export class PegboardManager {
  private pegboards: Map<string, PegboardObject> = new Map();
  private presets: Map<string, PegboardPreset> = new Map();
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'pegboards';
  }

  addPreset(preset: PegboardPreset): void {
    this.presets.set(preset.id, { ...preset });
  }

  updatePreset(id: string, updates: Partial<PegboardPreset>): void {
    const preset = this.presets.get(id);
    if (preset) {
      Object.assign(preset, updates);
      this.pegboards.forEach(pb => {
        if (pb.configId === id) {
          pb.rebuild(preset);
        }
      });
    }
  }

  removePreset(id: string): void {
    this.presets.delete(id);
    const toDelete: string[] = [];
    this.pegboards.forEach((pb, pbId) => {
      if (pb.configId === id) {
        toDelete.push(pbId);
      }
    });
    toDelete.forEach(id => this.removePegboard(id));
  }

  getPreset(id: string): PegboardPreset | undefined {
    return this.presets.get(id);
  }

  getAllPresets(): PegboardPreset[] {
    return Array.from(this.presets.values());
  }

  addPegboard(instance: PegboardInstance): PegboardObject {
    const preset = this.presets.get(instance.configId);
    if (!preset) {
      throw new Error(`Preset not found: ${instance.configId}`);
    }
    
    const pegboard = new PegboardObject(instance, preset);
    this.pegboards.set(instance.id, pegboard);
    this.group.add(pegboard.mesh);
    
    return pegboard;
  }

  removePegboard(id: string): void {
    const pegboard = this.pegboards.get(id);
    if (pegboard) {
      this.group.remove(pegboard.mesh);
      pegboard.dispose();
      this.pegboards.delete(id);
    }
  }

  getPegboard(id: string): PegboardObject | undefined {
    return this.pegboards.get(id);
  }

  getAllPegboards(): PegboardObject[] {
    return Array.from(this.pegboards.values());
  }

  selectPegboard(id: string | null): void {
    this.pegboards.forEach((pb, pbId) => {
      pb.setSelected(pbId === id);
    });
  }

  highlightPegboard(id: string | null): void {
    this.pegboards.forEach((pb, pbId) => {
      pb.setHighlighted(pbId === id);
    });
  }

  updatePegboardPosition(id: string, position: THREE.Vector3): void {
    const pegboard = this.pegboards.get(id);
    if (pegboard) {
      pegboard.setPosition({ x: position.x, y: position.y, z: position.z });
    }
  }

  /**
   * 旋转洞洞板 - 修复后的方法
   */
  rotatePegboard(id: string): void {
    const pegboard = this.pegboards.get(id);
    const instance = pegboard?.data;
    const preset = instance ? this.getPreset(instance.configId) : undefined;
    
    if (pegboard && preset && instance) {
      // 调用 PegboardObject 的旋转方法
      pegboard.toggleRotation(preset);
    }
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  checkCollision(id: string, margin: number = 0.5): boolean {
    const pegboard = this.pegboards.get(id);
    if (!pegboard) return false;
    
    const boxA = pegboard.getWorldBoundingBox();
    boxA.expandByScalar(margin);
    
    for (const [otherId, other] of this.pegboards) {
      if (otherId === id) continue;
      
      const boxB = other.getWorldBoundingBox();
      if (boxA.intersectsBox(boxB)) {
        return true;
      }
    }
    
    return false;
  }

  getCollisions(id: string): string[] {
    const pegboard = this.pegboards.get(id);
    if (!pegboard) return [];
    
    const boxA = pegboard.getWorldBoundingBox();
    const collisions: string[] = [];
    
    for (const [otherId, other] of this.pegboards) {
      if (otherId === id) continue;
      
      const boxB = other.getWorldBoundingBox();
      if (boxA.intersectsBox(boxB)) {
        collisions.push(otherId);
      }
    }
    
    return collisions;
  }

  clear(): void {
    this.pegboards.forEach(pb => {
      pb.dispose();
    });
    this.pegboards.clear();
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }

  dispose(): void {
    this.clear();
  }
}
