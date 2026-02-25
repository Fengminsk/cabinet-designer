import type { Position, Dimensions, SnapResult } from '../types';

/** 向量运算 */
export const Vec3 = {
  add: (a: Position, b: Position): Position => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a: Position, b: Position): Position => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a: Position, s: number): Position => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  length: (a: Position): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  distance: (a: Position, b: Position): number => Vec3.length(Vec3.sub(a, b)),
  clamp: (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v)),
};

/** 网格对齐 */
export function snapToGrid(value: number, gridSize: number = 1): number {
  return Math.round(value / gridSize) * gridSize;
}

/** 角度对齐到90度 */
export function snapAngle(angle: number, step: number = Math.PI / 2): number {
  return Math.round(angle / step) * step;
}

/** 检测两个矩形是否重叠 (2D) */
export function checkRectOverlap(
  a: { x: number; z: number; width: number; height: number },
  b: { x: number; z: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width / 2 < b.x - b.width / 2 ||
    a.x - a.width / 2 > b.x + b.width / 2 ||
    a.z + a.height / 2 < b.z - b.height / 2 ||
    a.z - a.height / 2 > b.z + b.height / 2
  );
}

/** 计算矩形交集面积 */
export function getRectIntersectionArea(
  a: { x: number; z: number; width: number; height: number },
  b: { x: number; z: number; width: number; height: number }
): number {
  const left = Math.max(a.x - a.width / 2, b.x - b.width / 2);
  const right = Math.min(a.x + a.width / 2, b.x + b.width / 2);
  const top = Math.max(a.z - a.height / 2, b.z - b.height / 2);
  const bottom = Math.min(a.z + a.height / 2, b.z + b.height / 2);
  
  if (right < left || bottom < top) return 0;
  return (right - left) * (bottom - top);
}

/** 计算点是否在矩形内 */
export function isPointInRect(
  point: { x: number; z: number },
  rect: { x: number; z: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x - rect.width / 2 &&
    point.x <= rect.x + rect.width / 2 &&
    point.z >= rect.z - rect.height / 2 &&
    point.z <= rect.z + rect.height / 2
  );
}

/** 线性插值 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** 三维线性插值 */
export function lerpPosition(a: Position, b: Position, t: number): Position {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/** 计算边界框 */
export function calculateBounds(positions: Position[]): { min: Position; max: Position } | null {
  if (positions.length === 0) return null;
  
  const min = { ...positions[0] };
  const max = { ...positions[0] };
  
  for (const p of positions) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  
  return { min, max };
}

/** 计算放置位置是否有效 */
export function isValidPlacement(
  position: Position,
  dimensions: Dimensions,
  bounds: { min: Position; max: Position }
): boolean {
  const halfW = dimensions.width / 2;
  const halfH = dimensions.height / 2;
  const halfD = dimensions.depth / 2;
  
  return (
    position.x - halfW >= bounds.min.x &&
    position.x + halfW <= bounds.max.x &&
    position.y - halfH >= bounds.min.y &&
    position.y + halfH <= bounds.max.y &&
    position.z - halfD >= bounds.min.z &&
    position.z + halfD <= bounds.max.z
  );
}

/** 计算最佳吸附位置 (用于拖拽时的智能吸附) */
export function calculateSnapPosition(
  currentPos: Position,
  targetPositions: Position[],
  snapDistance: number = 2
): SnapResult {
  let bestSnap: SnapResult = {
    snapped: false,
    position: currentPos,
    rotation: { x: 0, y: 0, z: 0 },
    distance: Infinity,
  };
  
  for (const target of targetPositions) {
    const dist = Vec3.distance(currentPos, target);
    if (dist < snapDistance && dist < bestSnap.distance) {
      bestSnap = {
        snapped: true,
        position: target,
        rotation: { x: 0, y: 0, z: 0 },
        distance: dist,
      };
    }
  }
  
  return bestSnap;
}

/** 极坐标转笛卡尔坐标 */
export function polarToCartesian(radius: number, angle: number): { x: number; z: number } {
  return {
    x: radius * Math.cos(angle),
    z: radius * Math.sin(angle),
  };
}

/** 计算贝塞尔曲线点 */
export function bezierPoint(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const oneMinusT = 1 - t;
  return (
    Math.pow(oneMinusT, 3) * p0 +
    3 * Math.pow(oneMinusT, 2) * t * p1 +
    3 * oneMinusT * Math.pow(t, 2) * p2 +
    Math.pow(t, 3) * p3
  );
}

/** 防抖函数 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/** 节流函数 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
