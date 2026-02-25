import type { Position, SnapResult } from '../types';
import * as THREE from 'three';
import { snapToGrid, Vec3 } from '../utils/math';

/**
 * 吸附系统 - 处理洞洞板的对齐和吸附逻辑
 * 
 * 吸附类型：
 * 1. 网格吸附 - 基础网格对齐
 * 2. 货架边缘吸附 - 与货架四边对齐
 * 3. 层板高度吸附 - 与层板Y坐标对齐
 * 4. 洞洞板边缘吸附 - 与其他洞洞板边缘对齐
 * 5. 中心对齐 - 与其他洞洞板中心对齐
 */
export class SnapSystem {
  // 吸附精度设置
  public gridSize: number = 0.5; // 网格大小 (cm)
  public snapDistance: number = 3; // 吸附距离 (cm) - 增大以便更容易吸附
  public enableEdgeSnap: boolean = true; // 边缘吸附
  public enableCenterSnap: boolean = true; // 中心点吸附
  public enableLayerSnap: boolean = true; // 层板高度吸附
  
  // 货架参考
  private shelfBounds: {
    width: number;
    height: number;
    depth: number;
    center: Position;
  } | null = null;
  
  // 层板位置
  private layerYPositions: number[] = [];
  
  // 其他洞洞板位置
  private otherPegboards: { 
    id?: string;
    position: Position; 
    width: number; 
    height: number; 
    face: string;
    isRotated?: boolean;
  }[] = [];

  constructor(options?: {
    gridSize?: number;
    snapDistance?: number;
  }) {
    if (options) {
      this.gridSize = options.gridSize ?? 0.5;
      this.snapDistance = options.snapDistance ?? 3;
    }
  }

  /**
   * 设置货架边界
   */
  setShelfBounds(width: number, height: number, depth: number, center: Position): void {
    this.shelfBounds = { width, height, depth, center };
  }

  /**
   * 设置层板位置
   */
  setLayerPositions(positions: number[]): void {
    this.layerYPositions = [...positions];
  }

  /**
   * 设置其他洞洞板 (用于边缘吸附)
   */
  setOtherPegboards(pegboards: { 
    id?: string;
    position: Position; 
    width: number; 
    height: number; 
    face: string;
    isRotated?: boolean;
  }[]): void {
    this.otherPegboards = [...pegboards];
  }

  /**
   * 计算吸附位置
   * @param currentPos 当前位置
   * @param pegboardWidth 洞洞板宽度
   * @param pegboardHeight 洞洞板高度
   * @param face 安装面
   * @param currentId 当前洞洞板ID（可选，用于排除自身）
   */
  calculateSnap(
    currentPos: Position,
    pegboardWidth: number,
    pegboardHeight: number,
    face: 'back' | 'left' | 'right',
    currentId?: string
  ): SnapResult {
    let snappedPos = { ...currentPos };
    let hasSnap = false;
    let minSnapDistance = Infinity;

    // 1. 基础网格吸附
    snappedPos.x = snapToGrid(snappedPos.x, this.gridSize);
    snappedPos.y = snapToGrid(snappedPos.y, this.gridSize);
    snappedPos.z = snapToGrid(snappedPos.z, this.gridSize);

    // 2. 根据安装面进行约束和边缘吸附
    if (this.shelfBounds) {
      const bounds = this.getFaceBounds(face);
      
      // 约束在面内（允许稍微超出以便边缘吸附）
      const halfW = pegboardWidth / 2;
      const halfH = pegboardHeight / 2;
      
      // 货架边缘吸附 - 关键修复：根据面的类型选择正确的坐标
      const isSideFace = face === 'left' || face === 'right';
      
      // 水平方向坐标（背面是X，侧面是Z）
      const horizontalPos = isSideFace ? snappedPos.z : snappedPos.x;
      
      // 左边缘吸附（水平方向）
      const leftEdge = bounds.minX + halfW;
      if (Math.abs(horizontalPos - leftEdge) < this.snapDistance) {
        if (isSideFace) {
          snappedPos.z = leftEdge;
        } else {
          snappedPos.x = leftEdge;
        }
        hasSnap = true;
        minSnapDistance = Math.min(minSnapDistance, Math.abs(horizontalPos - leftEdge));
      }
      
      // 右边缘吸附（水平方向）
      const rightEdge = bounds.maxX - halfW;
      if (Math.abs(horizontalPos - rightEdge) < this.snapDistance) {
        if (isSideFace) {
          snappedPos.z = rightEdge;
        } else {
          snappedPos.x = rightEdge;
        }
        hasSnap = true;
        minSnapDistance = Math.min(minSnapDistance, Math.abs(horizontalPos - rightEdge));
      }
      
      // 下边缘吸附（Y方向，所有面都一样）
      const bottomEdge = bounds.minY + halfH;
      if (Math.abs(snappedPos.y - bottomEdge) < this.snapDistance) {
        snappedPos.y = bottomEdge;
        hasSnap = true;
        minSnapDistance = Math.min(minSnapDistance, Math.abs(snappedPos.y - bottomEdge));
      }
      
      // 上边缘吸附（Y方向，所有面都一样）
      const topEdge = bounds.maxY - halfH;
      if (Math.abs(snappedPos.y - topEdge) < this.snapDistance) {
        snappedPos.y = topEdge;
        hasSnap = true;
        minSnapDistance = Math.min(minSnapDistance, Math.abs(snappedPos.y - topEdge));
      }
      
      // 固定在面的垂直坐标（背面固定Z，侧面固定X）
      if (isSideFace) {
        snappedPos.x = bounds.z;
      } else {
        snappedPos.z = bounds.z;
      }
    }

    // 3. 层板高度吸附
    if (this.enableLayerSnap) {
      for (const layerY of this.layerYPositions) {
        const dist = Math.abs(snappedPos.y - layerY);
        if (dist < this.snapDistance && dist < minSnapDistance) {
          snappedPos.y = layerY;
          hasSnap = true;
          minSnapDistance = dist;
        }
      }
    }

    // 4. 与其他洞洞板边缘吸附
    if (this.enableEdgeSnap) {
      const edgeSnap = this.calculateEdgeSnap(
        snappedPos,
        pegboardWidth,
        pegboardHeight,
        face,
        currentId
      );
      if (edgeSnap.snapped) {
        snappedPos = edgeSnap.position;
        hasSnap = true;
      }
    }

    // 确保在边界内 - 关键修复：根据面的类型正确约束坐标
    if (this.shelfBounds) {
      const bounds = this.getFaceBounds(face);
      const halfW = pegboardWidth / 2;
      const halfH = pegboardHeight / 2;
      
      // 对于侧面（left/right），X和Z的处理需要交换
      // 因为在侧面，洞洞板的"宽度"方向实际上是货架的"深度"方向
      if (face === 'left' || face === 'right') {
        // 侧面：X 固定，约束 Z（在getFaceBounds中，minX/maxX实际上是Z范围）
        snappedPos.z = Vec3.clamp(snappedPos.z, bounds.minX + halfW, bounds.maxX - halfW);
        snappedPos.y = Vec3.clamp(snappedPos.y, bounds.minY + halfH, bounds.maxY - halfH);
        // X 坐标保持固定（由调用者设置）
      } else {
        // 背面：约束 X 和 Y
        snappedPos.x = Vec3.clamp(snappedPos.x, bounds.minX + halfW, bounds.maxX - halfW);
        snappedPos.y = Vec3.clamp(snappedPos.y, bounds.minY + halfH, bounds.maxY - halfH);
        // Z 坐标保持固定（由调用者设置）
      }
    }

    return {
      snapped: hasSnap,
      position: snappedPos,
      rotation: { x: 0, y: 0, z: 0 },
      distance: minSnapDistance,
    };
  }

  /**
   * 计算边缘吸附（与其他洞洞板）
   * 关键修复：正确处理侧面（left/right）的坐标映射
   */
  private calculateEdgeSnap(
    pos: Position,
    width: number,
    height: number,
    face: string,
    currentId?: string
  ): SnapResult {
    let bestSnap: SnapResult = {
      snapped: false,
      position: pos,
      rotation: { x: 0, y: 0, z: 0 },
      distance: Infinity,
    };

    const halfW = width / 2;
    const halfH = height / 2;
    
    // 关键修复：对于侧面，水平移动发生在Z轴方向
    // 使用正确的坐标进行计算
    const isSideFace = face === 'left' || face === 'right';
    const myHorizontal = isSideFace ? pos.z : pos.x; // 水平方向坐标
    const myBottom = pos.y - halfH;
    const myTop = pos.y + halfH;
    
    // 当前洞洞板的四边（水平方向）
    const myLeft = myHorizontal - halfW;
    const myRight = myHorizontal + halfW;

    for (const other of this.otherPegboards) {
      // 跳过自身
      if (currentId && other.id === currentId) continue;
      // 只吸附同一面的
      if (other.face !== face) continue;
      
      const otherHalfW = other.width / 2;
      const otherHalfH = other.height / 2;
      
      // 其他洞洞板的水平坐标
      const otherHorizontal = isSideFace ? other.position.z : other.position.x;
      const otherLeft = otherHorizontal - otherHalfW;
      const otherRight = otherHorizontal + otherHalfW;
      const otherBottom = other.position.y - otherHalfH;
      const otherTop = other.position.y + otherHalfH;

      // 左对右吸附（我的左边对齐其他右边）
      const distLR = Math.abs(myLeft - otherRight);
      if (distLR < this.snapDistance && distLR < bestSnap.distance) {
        if (Math.abs(pos.y - other.position.y) < (halfH + otherHalfH + this.snapDistance)) {
          const newHorizontal = otherRight + halfW;
          bestSnap = {
            snapped: true,
            position: isSideFace 
              ? { ...pos, z: newHorizontal }
              : { ...pos, x: newHorizontal },
            rotation: { x: 0, y: 0, z: 0 },
            distance: distLR,
          };
        }
      }

      // 右对左吸附
      const distRL = Math.abs(myRight - otherLeft);
      if (distRL < this.snapDistance && distRL < bestSnap.distance) {
        if (Math.abs(pos.y - other.position.y) < (halfH + otherHalfH + this.snapDistance)) {
          const newHorizontal = otherLeft - halfW;
          bestSnap = {
            snapped: true,
            position: isSideFace 
              ? { ...pos, z: newHorizontal }
              : { ...pos, x: newHorizontal },
            rotation: { x: 0, y: 0, z: 0 },
            distance: distRL,
          };
        }
      }

      // 下对上吸附
      const distBU = Math.abs(myBottom - otherTop);
      if (distBU < this.snapDistance && distBU < bestSnap.distance) {
        if (Math.abs(myHorizontal - otherHorizontal) < (halfW + otherHalfW + this.snapDistance)) {
          bestSnap = {
            snapped: true,
            position: { ...pos, y: otherTop + halfH },
            rotation: { x: 0, y: 0, z: 0 },
            distance: distBU,
          };
        }
      }

      // 上对下吸附
      const distUB = Math.abs(myTop - otherBottom);
      if (distUB < this.snapDistance && distUB < bestSnap.distance) {
        if (Math.abs(myHorizontal - otherHorizontal) < (halfW + otherHalfW + this.snapDistance)) {
          bestSnap = {
            snapped: true,
            position: { ...pos, y: otherBottom - halfH },
            rotation: { x: 0, y: 0, z: 0 },
            distance: distUB,
          };
        }
      }

      // 中心水平对齐
      const distCH = Math.abs(myHorizontal - otherHorizontal);
      if (distCH < this.snapDistance && distCH < bestSnap.distance) {
        bestSnap = {
          snapped: true,
          position: isSideFace 
            ? { ...pos, z: otherHorizontal }
            : { ...pos, x: otherHorizontal },
          rotation: { x: 0, y: 0, z: 0 },
          distance: distCH,
        };
      }

      // 中心Y对齐
      const distCY = Math.abs(pos.y - other.position.y);
      if (distCY < this.snapDistance && distCY < bestSnap.distance) {
        bestSnap = {
          snapped: true,
          position: { ...pos, y: other.position.y },
          rotation: { x: 0, y: 0, z: 0 },
          distance: distCY,
        };
      }
    }

    return bestSnap;
  }

  /**
   * 获取面的边界
   */
  private getFaceBounds(face: 'back' | 'left' | 'right') {
    if (!this.shelfBounds) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, z: 0 };
    }

    const { width, height, depth, center } = this.shelfBounds;
    const halfW = width / 2;
    const halfD = depth / 2;

    switch (face) {
      case 'back':
        return {
          minX: center.x - halfW,
          maxX: center.x + halfW,
          minY: center.y - height / 2,
          maxY: center.y + height / 2,
          z: center.z - halfD,
        };
      case 'left':
        return {
          minX: center.z - halfD,
          maxX: center.z + halfD,
          minY: center.y - height / 2,
          maxY: center.y + height / 2,
          z: center.x - halfW,
        };
      case 'right':
        return {
          minX: center.z - halfD,
          maxX: center.z + halfD,
          minY: center.y - height / 2,
          maxY: center.y + height / 2,
          z: center.x + halfW,
        };
      default:
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, z: 0 };
    }
  }

  /**
   * 检查位置是否有效
   */
  isValidPosition(
    pos: Position,
    width: number,
    height: number,
    face: 'back' | 'left' | 'right'
  ): boolean {
    if (!this.shelfBounds) return false;

    const bounds = this.getFaceBounds(face);
    const halfW = face === 'back' ? width / 2 : height / 2;
    const halfH = height / 2;

    // 检查边界
    if (
      pos.x - halfW < bounds.minX - 0.01 ||
      pos.x + halfW > bounds.maxX + 0.01 ||
      pos.y - halfH < bounds.minY - 0.01 ||
      pos.y + halfH > bounds.maxY + 0.01
    ) {
      return false;
    }

    return true;
  }

  /**
   * 吸附旋转角度
   */
  snapRotation(angle: number, step: number = 15): number {
    const stepRad = (step * Math.PI) / 180;
    return Math.round(angle / stepRad) * stepRad;
  }

  /**
   * 获取货架边界（用于App.vue中的层板拖拽）
   */
  getShelfBounds() {
    return this.shelfBounds;
  }
}

/**
 * 创建吸附辅助线
 */
export function createSnapIndicator(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'snap-indicator';

  // 水平线
  const hLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-50, 0, 0),
    new THREE.Vector3(50, 0, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: '#4ade80',
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  const hLine = new THREE.Line(hLineGeom, lineMat);
  hLine.name = 'h-line';
  group.add(hLine);

  // 垂直线
  const vLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -50, 0),
    new THREE.Vector3(0, 50, 0),
  ]);
  const vLine = new THREE.Line(vLineGeom, lineMat.clone());
  vLine.name = 'v-line';
  group.add(vLine);

  // 中心点
  const dotGeom = new THREE.CircleGeometry(0.5, 16);
  const dotMat = new THREE.MeshBasicMaterial({
    color: '#4ade80',
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const dot = new THREE.Mesh(dotGeom, dotMat);
  dot.name = 'center-dot';
  group.add(dot);

  group.visible = false;
  return group;
}
