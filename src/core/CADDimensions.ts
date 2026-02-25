import * as THREE from 'three';
import type { PegboardInstance, PegboardPreset, ShelfConfig, ShelfLayer } from '../types';

/**
 * CAD尺寸线样式
 */
interface DimensionStyle {
  color: number;
  lineWidth: number;
  fontSize: number;
  extensionLength: number;
  arrowSize: number;
}

/**
 * CAD尺寸标注管理器
 * 
 * 货架尺寸：持续显示
 * 洞洞板尺寸：交互后显示，3秒后淡出
 */
export class CADDimensions {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private shelfGroup: THREE.Group;
  private pegboardGroup: THREE.Group;
  private style: DimensionStyle;
  
  constructor(scene: THREE.Scene, options?: Partial<DimensionStyle>) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'cad-dimensions';
    this.scene.add(this.group);
    
    // 货架尺寸组 - 持续显示
    this.shelfGroup = new THREE.Group();
    this.shelfGroup.name = 'shelf-dimensions';
    this.group.add(this.shelfGroup);
    
    // 洞洞板尺寸组 - 临时显示
    this.pegboardGroup = new THREE.Group();
    this.pegboardGroup.name = 'pegboard-dimensions';
    this.group.add(this.pegboardGroup);
    
    this.style = {
      color: 0x4ade80,
      lineWidth: 2,
      fontSize: 12,
      extensionLength: 10,
      arrowSize: 5,
      ...options,
    };
  }

  /**
   * 显示/更新货架整体尺寸 - 持续显示
   */
  showShelfDimensions(config: ShelfConfig, layers: ShelfLayer[]): void {
    this.clearShelfDimensions();
    
    const { width, height, depth } = config;
    const halfW = width / 2;
    const halfD = depth / 2;
    
    const dimGroup = new THREE.Group();
    
    // 1. 宽度尺寸线 (底部前方)
    this.createDimensionLine(
      dimGroup,
      new THREE.Vector3(-halfW, -5, halfD + 30),
      new THREE.Vector3(halfW, -5, halfD + 30),
      `宽 ${width}cm`,
      'horizontal',
      0x2196F3 // 蓝色
    );
    
    // 2. 高度尺寸线 (右侧)
    this.createDimensionLine(
      dimGroup,
      new THREE.Vector3(halfW + 30, 0, halfD),
      new THREE.Vector3(halfW + 30, height, halfD),
      `高 ${height}cm`,
      'vertical',
      0x2196F3
    );
    
    // 3. 深度尺寸线 (顶部)
    this.createDimensionLine(
      dimGroup,
      new THREE.Vector3(-halfW, height + 30, -halfD),
      new THREE.Vector3(-halfW, height + 30, halfD),
      `深 ${depth}cm`,
      'depth',
      0x2196F3
    );
    
    // 4. 层板间距标注 (左侧前方)
    let previousY = 0;
    const sortedLayers = [...layers].sort((a, b) => a.y - b.y);
    
    // 标注每个层板之间的间距
    sortedLayers.forEach((layer, index) => {
      const gap = layer.y - previousY;
      this.createDimensionLine(
        dimGroup,
        new THREE.Vector3(-halfW - 20, previousY, halfD),
        new THREE.Vector3(-halfW - 20, layer.y, halfD),
        `${gap.toFixed(0)}`,
        'vertical',
        0xFF9800 // 橙色
      );
      previousY = layer.y;
    });
    
    // 最后一个层板到顶部的间距
    if (previousY < height) {
      const topGap = height - previousY;
      this.createDimensionLine(
        dimGroup,
        new THREE.Vector3(-halfW - 20, previousY, halfD),
        new THREE.Vector3(-halfW - 20, height, halfD),
        `${topGap.toFixed(0)}`,
        'vertical',
        0xFF9800 // 橙色
      );
    }
    
    this.shelfGroup.add(dimGroup);
    this.shelfGroup.visible = true;
  }

  clearShelfDimensions(): void {
    while (this.shelfGroup.children.length > 0) {
      const child = this.shelfGroup.children[0];
      this.shelfGroup.remove(child);
      this.disposeObject(child);
    }
  }

  /**
   * 显示洞洞板尺寸标注 - 临时显示，带淡出
   */
  showPegboardDimensions(
    instance: PegboardInstance,
    preset: PegboardPreset,
    shelfDepth: number
  ): void {
    this.clearPegboardDimensions();
    
    const width = instance.isRotated ? preset.height : preset.width;
    const height = instance.isRotated ? preset.width : preset.height;
    const pos = instance.position;
    
    let dimGroup: THREE.Group;
    
    switch (instance.face) {
      case 'back':
        dimGroup = this.createBackFaceDimensions(width, height, pos, shelfDepth);
        break;
      case 'left':
        dimGroup = this.createLeftFaceDimensions(width, height, pos, shelfDepth);
        break;
      case 'right':
        dimGroup = this.createRightFaceDimensions(width, height, pos, shelfDepth);
        break;
      default:
        return;
    }
    
    this.pegboardGroup.add(dimGroup);
    
    // 3秒后淡出
    setTimeout(() => {
      this.fadeOutPegboardDimensions();
    }, 3000);
  }

  clearPegboardDimensions(): void {
    while (this.pegboardGroup.children.length > 0) {
      const child = this.pegboardGroup.children[0];
      this.pegboardGroup.remove(child);
      this.disposeObject(child);
    }
  }

  /**
   * 显示层板调整提示
   */
  showLayerAdjustmentHint(layer: ShelfLayer, x: number, z: number, prevLayerY: number, nextLayerY: number): void {
    this.clearPegboardDimensions();
    
    const dimGroup = new THREE.Group();
    
    const text = this.createTextSprite(
      `高度: ${layer.y.toFixed(1)}cm`,
      this.style.fontSize + 4,
      0xff6b6b
    );
    text.position.set(0, layer.y + 15, z);
    dimGroup.add(text);
    
    // 显示与上一层的间距
    if (prevLayerY !== undefined) {
      const gapBottom = layer.y - prevLayerY;
      this.createDimensionLine(
        dimGroup,
        new THREE.Vector3(x - 20, prevLayerY, z),
        new THREE.Vector3(x - 20, layer.y, z),
        `间距: ${gapBottom.toFixed(1)}cm`,
        'vertical',
        0x4ade80
      );
    }
    
    // 显示与下一层的间距
    if (nextLayerY !== undefined) {
      const gapTop = nextLayerY - layer.y;
      this.createDimensionLine(
        dimGroup,
        new THREE.Vector3(x - 20, layer.y, z),
        new THREE.Vector3(x - 20, nextLayerY, z),
        `间距: ${gapTop.toFixed(1)}cm`,
        'vertical',
        0x4ade80
      );
    }
    
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-50, layer.y, z),
      new THREE.Vector3(50, layer.y, z),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0xff6b6b, 
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    dimGroup.add(line);
    
    this.pegboardGroup.add(dimGroup);
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      } else if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }

  private createBackFaceDimensions(
    width: number,
    height: number,
    pos: { x: number; y: number; z: number },
    shelfDepth: number
  ): THREE.Group {
    const group = new THREE.Group();
    const halfW = width / 2;
    const halfH = height / 2;
    const z = pos.z + 20;
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(pos.x - halfW, pos.y - halfH - 20, z),
      new THREE.Vector3(pos.x + halfW, pos.y - halfH - 20, z),
      `${width.toFixed(0)}cm`,
      'horizontal'
    );
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(pos.x + halfW + 20, pos.y - halfH, z),
      new THREE.Vector3(pos.x + halfW + 20, pos.y + halfH, z),
      `${height.toFixed(0)}cm`,
      'vertical'
    );
    
    return group;
  }

  private createLeftFaceDimensions(
    width: number,
    height: number,
    pos: { x: number; y: number; z: number },
    shelfDepth: number
  ): THREE.Group {
    const group = new THREE.Group();
    const halfW = width / 2;
    const halfH = height / 2;
    const x = pos.x - 20;
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(x, pos.y - halfH - 20, pos.z - halfW),
      new THREE.Vector3(x, pos.y - halfH - 20, pos.z + halfW),
      `${width.toFixed(0)}cm`,
      'depth'
    );
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(x, pos.y - halfH, pos.z + halfW + 20),
      new THREE.Vector3(x, pos.y + halfH, pos.z + halfW + 20),
      `${height.toFixed(0)}cm`,
      'vertical-side'
    );
    
    return group;
  }

  private createRightFaceDimensions(
    width: number,
    height: number,
    pos: { x: number; y: number; z: number },
    shelfDepth: number
  ): THREE.Group {
    const group = new THREE.Group();
    const halfW = width / 2;
    const halfH = height / 2;
    const x = pos.x + 20;
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(x, pos.y - halfH - 20, pos.z - halfW),
      new THREE.Vector3(x, pos.y - halfH - 20, pos.z + halfW),
      `${width.toFixed(0)}cm`,
      'depth'
    );
    
    this.createDimensionLine(
      group,
      new THREE.Vector3(x, pos.y - halfH, pos.z + halfW + 20),
      new THREE.Vector3(x, pos.y + halfH, pos.z + halfW + 20),
      `${height.toFixed(0)}cm`,
      'vertical-side'
    );
    
    return group;
  }

  private createDimensionLine(
    parent: THREE.Group,
    start: THREE.Vector3,
    end: THREE.Vector3,
    text: string,
    orientation: 'horizontal' | 'vertical' | 'depth' | 'vertical-side',
    color: number = this.style.color
  ): void {
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    
    let extDirection: THREE.Vector3;
    switch (orientation) {
      case 'horizontal':
        extDirection = new THREE.Vector3(0, -1, 0);
        break;
      case 'vertical':
      case 'vertical-side':
        extDirection = new THREE.Vector3(1, 0, 0);
        break;
      case 'depth':
        extDirection = new THREE.Vector3(0, -1, 0);
        break;
      default:
        extDirection = new THREE.Vector3(0, 1, 0);
    }
    
    const extLength = this.style.extensionLength;
    
    // 延伸线
    const extLine1Geom = new THREE.BufferGeometry().setFromPoints([
      start.clone(),
      start.clone().add(extDirection.clone().multiplyScalar(extLength))
    ]);
    const extLine1 = new THREE.Line(extLine1Geom, new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    }));
    extLine1.renderOrder = 999;
    parent.add(extLine1);
    
    const extLine2Geom = new THREE.BufferGeometry().setFromPoints([
      end.clone(),
      end.clone().add(extDirection.clone().multiplyScalar(extLength))
    ]);
    const extLine2 = new THREE.Line(extLine2Geom, new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    }));
    extLine2.renderOrder = 999;
    parent.add(extLine2);
    
    // 尺寸线
    const dimLineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
    const dimLine = new THREE.Line(dimLineGeom, new THREE.LineBasicMaterial({ 
      color, 
      linewidth: this.style.lineWidth,
      depthTest: false,
    }));
    dimLine.renderOrder = 999;
    parent.add(dimLine);
    
    // 箭头
    this.createArrow(parent, start, direction, color);
    this.createArrow(parent, end, direction.clone().negate(), color);
    
    // 文字
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const textSprite = this.createTextSprite(text, this.style.fontSize, color);
    const textOffset = extDirection.clone().multiplyScalar(extLength + 8);
    textSprite.position.copy(midPoint).add(textOffset);
    parent.add(textSprite);
  }

  private createArrow(
    parent: THREE.Group,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    color: number
  ): void {
    const arrowSize = this.style.arrowSize;
    const perp = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
    
    const arrowGeom = new THREE.BufferGeometry().setFromPoints([
      position.clone().add(direction.clone().multiplyScalar(arrowSize)),
      position.clone().add(perp.clone().multiplyScalar(arrowSize * 0.3)),
      position.clone().add(perp.clone().multiplyScalar(-arrowSize * 0.3)),
      position.clone().add(direction.clone().multiplyScalar(arrowSize)),
    ]);
    
    const arrow = new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 2,
      depthTest: false,
    }));
    arrow.renderOrder = 999;
    parent.add(arrow);
  }

  private createTextSprite(text: string, fontSize: number, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = `bold ${fontSize * 2}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    ctx.fillStyle = colorHex;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      depthTest: false,
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width / 8, canvas.height / 8, 1);
    sprite.renderOrder = 999;
    
    return sprite;
  }

  private fadeOutPegboardDimensions(): void {
    const startOpacity = 1;
    const duration = 500;
    const startTime = performance.now();
    
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = startOpacity * (1 - progress);
      
      this.pegboardGroup.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          obj.material.opacity = opacity;
        } else if (obj instanceof THREE.Line) {
          (obj.material as THREE.LineBasicMaterial).opacity = opacity;
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.clearPegboardDimensions();
      }
    };
    
    requestAnimationFrame(animate);
  }

  dispose(): void {
    this.clearShelfDimensions();
    this.clearPegboardDimensions();
    this.scene.remove(this.group);
  }
}
