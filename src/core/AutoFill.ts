import type { 
  FillSolution, 
  FillConstraints, 
  PegboardPreset, 
  Position,
  PegboardInstance 
} from '../types';
import { generateId } from '../utils/storage';

/**
 * 矩形包装类 - 用于装箱算法
 */
class Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  presetId: string;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    rotated: boolean = false,
    presetId: string = ''
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotated = rotated;
    this.presetId = presetId;
  }

  get area(): number {
    return this.width * this.height;
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height, this.rotated, this.presetId);
  }
}

/**
 * 自动填充算法
 * 使用简单的贪心装箱算法，尝试不同的策略找到最佳方案
 */
export class AutoFill {
  private containerWidth: number;
  private containerHeight: number;
  private presets: PegboardPreset[];
  private constraints: FillConstraints;
  private placedRects: Rect[] = [];

  constructor(
    containerWidth: number,
    containerHeight: number,
    presets: PegboardPreset[],
    constraints: FillConstraints
  ) {
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    this.presets = [...presets];
    this.constraints = { ...constraints };
  }

  /**
   * 执行自动填充计算
   * @returns 最佳填充方案
   */
  calculate(): FillSolution {
    this.placedRects = [];

    // 如果没有可用预设，返回空方案
    if (this.presets.length === 0) {
      return this.createSolution();
    }

    // 根据约束筛选可用预设
    let availablePresets = this.presets;
    if (this.constraints.preferredPresetIds) {
      availablePresets = this.presets.filter(p => 
        this.constraints.preferredPresetIds!.includes(p.id)
      );
    }

    if (availablePresets.length === 0) {
      availablePresets = this.presets;
    }

    // 按面积从大到小排序预设 (通常先用大的可以更高效利用空间)
    const sortedPresets = [...availablePresets].sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      return areaB - areaA;
    });

    // 使用最佳适配算法 (Best Fit)
    this.bestFitAlgorithm(sortedPresets);

    return this.createSolution();
  }

  /**
   * 最佳适配算法
   */
  private bestFitAlgorithm(presets: PegboardPreset[]): void {
    // 可用空间列表 - 使用简单的间隙管理
    const freeSpaces: Rect[] = [
      new Rect(0, 0, this.containerWidth, this.containerHeight)
    ];

    for (const preset of presets) {
      let placed = false;
      let count = 0;
      const maxCount = Math.floor(this.constraints.maxPegboards / presets.length) || 20;

      while (!placed && count < maxCount) {
        // 尝试放置
        const placedRect = this.tryPlaceInSpaces(preset, freeSpaces);
        
        if (placedRect) {
          this.placedRects.push(placedRect);
          this.updateFreeSpaces(freeSpaces, placedRect);
          count++;
        } else {
          placed = true; // 无法再放这个尺寸的
        }
      }
    }

    // 尝试用更小的填充剩余空间
    this.fillGapsWithSmallest(presets, freeSpaces);
  }

  /**
   * 尝试在空间列表中放置预设
   */
  private tryPlaceInSpaces(preset: PegboardPreset, spaces: Rect[]): Rect | null {
    const variants: { width: number; height: number; rotated: boolean }[] = [
      { width: preset.width, height: preset.height, rotated: false },
    ];

    // 如果允许旋转且旋转后更优，添加旋转变体
    if (this.constraints.allowRotation && preset.width !== preset.height) {
      variants.push({ width: preset.height, height: preset.width, rotated: true });
    }

    let bestFit: { rect: Rect; spaceIndex: number; score: number } | null = null;

    for (const variant of variants) {
      for (let i = 0; i < spaces.length; i++) {
        const space = spaces[i];
        
        if (this.canFit(variant.width, variant.height, space)) {
          // 计算适配分数 (越小越好，优先使用角落)
          const score = this.calculateFitScore(variant.width, variant.height, space);
          
          if (!bestFit || score < bestFit.score) {
            bestFit = {
              rect: new Rect(
                space.x,
                space.y,
                variant.width,
                variant.height,
                variant.rotated,
                preset.id
              ),
              spaceIndex: i,
              score,
            };
          }
        }
      }
    }

    return bestFit ? bestFit.rect : null;
  }

  /**
   * 检查是否可以放入
   */
  private canFit(width: number, height: number, space: Rect): boolean {
    return width <= space.width + 0.01 && height <= space.height + 0.01;
  }

  /**
   * 计算适配分数
   */
  private calculateFitScore(width: number, height: number, space: Rect): number {
    // 剩余空间越小越好 (更紧密的填充)
    const waste = (space.width - width) * space.height + 
                  space.width * (space.height - height);
    // 优先使用角落位置
    const cornerBonus = (space.x === 0 ? 0 : 10) + (space.y === 0 ? 0 : 10);
    return waste + cornerBonus;
  }

  /**
   * 更新可用空间列表
   */
  private updateFreeSpaces(spaces: Rect[], placed: Rect): void {
    const newSpaces: Rect[] = [];

    for (const space of spaces) {
      if (!this.intersects(placed, space)) {
        newSpaces.push(space);
        continue;
      }

      // 分割空间
      // 右侧剩余空间
      if (placed.x + placed.width < space.x + space.width) {
        newSpaces.push(new Rect(
          placed.x + placed.width,
          space.y,
          space.x + space.width - placed.x - placed.width,
          space.height
        ));
      }

      // 上方剩余空间
      if (placed.y + placed.height < space.y + space.height) {
        newSpaces.push(new Rect(
          space.x,
          placed.y + placed.height,
          space.width,
          space.y + space.height - placed.y - placed.height
        ));
      }

      // 左侧剩余空间
      if (placed.x > space.x) {
        newSpaces.push(new Rect(
          space.x,
          space.y,
          placed.x - space.x,
          space.height
        ));
      }

      // 下方剩余空间
      if (placed.y > space.y) {
        newSpaces.push(new Rect(
          space.x,
          space.y,
          space.width,
          placed.y - space.y
        ));
      }
    }

    // 过滤掉太小的空间并合并
    const minSize = 5; // 最小可用尺寸
    spaces.length = 0;
    spaces.push(...newSpaces.filter(s => s.width >= minSize && s.height >= minSize));
    
    // 合并相邻空间 (简化版)
    this.mergeSpaces(spaces);
  }

  /**
   * 检查两个矩形是否相交
   */
  private intersects(a: Rect, b: Rect): boolean {
    return !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  }

  /**
   * 合并相邻空间
   */
  private mergeSpaces(spaces: Rect[]): void {
    let merged = true;
    while (merged && spaces.length > 1) {
      merged = false;
      for (let i = 0; i < spaces.length && !merged; i++) {
        for (let j = i + 1; j < spaces.length && !merged; j++) {
          const a = spaces[i];
          const b = spaces[j];

          // 检查是否水平相邻且高度相同
          if (Math.abs(a.y - b.y) < 0.1 && Math.abs(a.height - b.height) < 0.1) {
            if (Math.abs(a.x + a.width - b.x) < 0.1) {
              a.width += b.width;
              spaces.splice(j, 1);
              merged = true;
            } else if (Math.abs(b.x + b.width - a.x) < 0.1) {
              a.x = b.x;
              a.width += b.width;
              spaces.splice(j, 1);
              merged = true;
            }
          }

          // 检查是否垂直相邻且宽度相同
          if (!merged && Math.abs(a.x - b.x) < 0.1 && Math.abs(a.width - b.width) < 0.1) {
            if (Math.abs(a.y + a.height - b.y) < 0.1) {
              a.height += b.height;
              spaces.splice(j, 1);
              merged = true;
            } else if (Math.abs(b.y + b.height - a.y) < 0.1) {
              a.y = b.y;
              a.height += b.height;
              spaces.splice(j, 1);
              merged = true;
            }
          }
        }
      }
    }
  }

  /**
   * 用小尺寸预设填充剩余空隙
   */
  private fillGapsWithSmallest(presets: PegboardPreset[], spaces: Rect[]): void {
    // 找到最小的预设
    const sortedBySize = [...presets].sort((a, b) => {
      return (a.width * a.height) - (b.width * b.height);
    });

    if (sortedBySize.length === 0) return;

    const smallest = sortedBySize[0];

    for (const space of spaces) {
      // 计算这个空间可以放多少
      const cols = Math.floor(space.width / smallest.width);
      const rows = Math.floor(space.height / smallest.height);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.placedRects.length >= this.constraints.maxPegboards) {
            return;
          }

          this.placedRects.push(new Rect(
            space.x + c * smallest.width,
            space.y + r * smallest.height,
            smallest.width,
            smallest.height,
            false,
            smallest.id
          ));
        }
      }
    }
  }

  /**
   * 创建填充方案
   */
  private createSolution(): FillSolution {
    const totalArea = this.containerWidth * this.containerHeight;
    const coveredArea = this.placedRects.reduce((sum, r) => sum + r.area, 0);
    const coverage = totalArea > 0 ? coveredArea / totalArea : 0;

    // 转换为洞洞板实例数据
    const pegboards = this.placedRects.map(rect => ({
      presetId: rect.presetId,
      position: this.rectToPosition(rect),
      rotation: { x: 0, y: 0, z: 0 },
      isRotated: rect.rotated,
    }));

    return {
      pegboards,
      coverage: Math.min(coverage, 1),
      wasteArea: totalArea - coveredArea,
    };
  }

  /**
   * 将矩形转换为3D位置
   */
  private rectToPosition(rect: Rect): Position {
    // 转换为以中心为原点的坐标
    return {
      x: rect.x + rect.width / 2 - this.containerWidth / 2,
      y: rect.y + rect.height / 2,
      z: 0,
    };
  }
}

/**
 * 生成自动填充的洞洞板实例
 */
export function generateAutoFillPegboards(
  solution: FillSolution,
  face: 'back' | 'left' | 'right',
  shelfDepth: number
): PegboardInstance[] {
  const instances: PegboardInstance[] = [];
  const halfDepth = shelfDepth / 2;

  for (const pb of solution.pegboards) {
    let position = { ...pb.position };

    // 根据安装面调整坐标
    switch (face) {
      case 'back':
        position.z = -halfDepth;
        break;
      case 'left':
        position.z = position.x;
        position.x = -halfDepth;
        break;
      case 'right':
        position.z = position.x;
        position.x = halfDepth;
        break;
    }

    instances.push({
      id: generateId(),
      configId: pb.presetId,
      position,
      rotation: pb.rotation,
      isRotated: pb.isRotated,
      face,
    });
  }

  return instances;
}

/**
 * 多策略填充 - 尝试不同算法选择最佳
 */
export function calculateBestFill(
  width: number,
  height: number,
  presets: PegboardPreset[],
  constraints: FillConstraints
): FillSolution {
  // 策略1: 最佳适配
  const filler1 = new AutoFill(width, height, presets, constraints);
  const solution1 = filler1.calculate();

  // 策略2: 优先使用小尺寸
  const smallFirstConstraints = { ...constraints };
  const sortedPresets = [...presets].sort((a, b) => 
    (a.width * a.height) - (b.width * b.height)
  );
  const filler2 = new AutoFill(width, height, sortedPresets, smallFirstConstraints);
  const solution2 = filler2.calculate();

  // 选择覆盖率更高的方案
  return solution1.coverage >= solution2.coverage ? solution1 : solution2;
}
