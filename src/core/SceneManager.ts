import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Position, ThemeSettings } from '../types';

/**
 * Three.js 场景管理器
 * 负责场景的初始化、渲染循环、灯光、相机等基础功能
 */
export class SceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationId: number = 0;
  private onRenderCallbacks: (() => void)[] = [];
  
  // 灯光引用
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  
  // 性能监控
  private stats: { frames: number; lastTime: number; fps: number } = {
    frames: 0,
    lastTime: performance.now(),
    fps: 0,
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    this.init();
  }

  private init() {
    // 1. 场景设置 - 动物派对风格的暖色调背景
    this.scene.background = new THREE.Color('#faf6f0');
    // 柔和雾效增加空间感
    this.scene.fog = new THREE.Fog('#faf6f0', 200, 800);

    // 2. 相机设置
    this.camera.position.set(250, 200, 300);
    this.camera.lookAt(0, 100, 0);

    // 3. 渲染器设置
    const dpr = Math.min(window.devicePixelRatio, 2); // 限制DPR以优化性能
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 4. 控制器设置
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI / 2; // 可以平视
    this.controls.minPolarAngle = 0; // 可以俯视
    this.controls.target.set(0, 100, 0);

    // 5. 设置灯光
    this.setupLights();

    // 6. 设置环境
    this.setupEnvironment();

    // 7. 开始渲染循环
    this.animate();

    // 8. 监听窗口大小变化
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * 设置灯光 - 营造软萌画风
   */
  private setupLights() {
    // 环境光 - 温暖的基底色
    this.ambientLight = new THREE.AmbientLight('#fff8f0', 0.5);
    this.scene.add(this.ambientLight);

    // 主光源 - 模拟阳光
    this.dirLight = new THREE.DirectionalLight('#fff5e6', 1.5);
    this.dirLight.position.set(150, 300, 100);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 1000;
    this.dirLight.shadow.camera.left = -300;
    this.dirLight.shadow.camera.right = 300;
    this.dirLight.shadow.camera.top = 300;
    this.dirLight.shadow.camera.bottom = -300;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.radius = 4; // 柔和阴影边缘
    this.scene.add(this.dirLight);

    // 补光 - 填充阴影
    this.fillLight = new THREE.DirectionalLight('#e8f4ff', 0.4);
    this.fillLight.position.set(-100, 100, -100);
    this.scene.add(this.fillLight);

    // 轮廓光 - 增加立体感
    const rimLight = new THREE.DirectionalLight('#ffffff', 0.3);
    rimLight.position.set(0, 100, -200);
    this.scene.add(rimLight);
  }

  /**
   * 设置环境 - 地面、网格等
   */
  private setupEnvironment() {
    // 地面 - 使用圆角效果
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: '#f0ebe4',
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 网格辅助线 - 柔和的颜色
    const gridHelper = new THREE.GridHelper(1000, 50, '#e0d5c8', '#e8e0d5');
    gridHelper.position.y = 0.01;
    (gridHelper.material as THREE.Material).opacity = 0.3;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);
  }

  /**
   * 渲染循环
   */
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    // 更新控制器
    this.controls.update();
    
    // 执行注册的渲染回调
    this.onRenderCallbacks.forEach(cb => cb());
    
    // 渲染
    this.renderer.render(this.scene, this.camera);
    
    // 计算FPS
    this.stats.frames++;
    const now = performance.now();
    if (now - this.stats.lastTime >= 1000) {
      this.stats.fps = this.stats.frames;
      this.stats.frames = 0;
      this.stats.lastTime = now;
    }
  };

  /**
   * 窗口大小变化处理
   */
  private handleResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // ==================== 公共方法 ====================

  /**
   * 获取场景
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * 获取相机
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 获取渲染器
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * 获取控制器
   */
  getControls(): OrbitControls {
    return this.controls;
  }

  /**
   * 添加对象到场景
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * 从场景移除对象
   */
  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  /**
   * 注册渲染回调
   */
  onRender(callback: () => void): void {
    this.onRenderCallbacks.push(callback);
  }

  /**
   * 移除渲染回调
   */
  offRender(callback: () => void): void {
    const index = this.onRenderCallbacks.indexOf(callback);
    if (index >= 0) {
      this.onRenderCallbacks.splice(index, 1);
    }
  }

  /**
   * 设置相机位置
   */
  setCameraPosition(position: Position, lookAt?: Position): void {
    this.camera.position.set(position.x, position.y, position.z);
    if (lookAt) {
      this.controls.target.set(lookAt.x, lookAt.y, lookAt.z);
    }
    this.camera.updateProjectionMatrix();
  }

  /**
   * 获取相机位置
   */
  getCameraPosition(): Position {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    };
  }

  /**
   * 设置主题
   */
  setTheme(settings: ThemeSettings): void {
    this.scene.background = new THREE.Color(settings.backgroundColor);
    this.scene.fog = new THREE.Fog(settings.backgroundColor, 200, 800);
    this.ambientLight.intensity = settings.ambientLightIntensity;
    this.dirLight.intensity = settings.directionalLightIntensity;
  }

  /**
   * 获取FPS
   */
  getFPS(): number {
    return this.stats.fps;
  }

  /**
   * 射线检测
   */
  raycast(
    normalizedX: number,
    normalizedY: number,
    objects: THREE.Object3D[]
  ): THREE.Intersection[] {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(normalizedX, normalizedY);
    raycaster.setFromCamera(mouse, this.camera);
    return raycaster.intersectObjects(objects, true);
  }

  /**
   * 世界坐标转屏幕坐标
   */
  worldToScreen(position: THREE.Vector3): { x: number; y: number } {
    const vector = position.clone();
    vector.project(this.camera);
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    return {
      x: (vector.x + 1) / 2 * width,
      y: -(vector.y - 1) / 2 * height,
    };
  }

  /**
   * 屏幕坐标转世界坐标 (在指定平面上)
   */
  screenToWorld(
    screenX: number,
    screenY: number,
    planeY: number = 0
  ): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (screenX / this.container.clientWidth) * 2 - 1,
      -(screenY / this.container.clientHeight) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, this.camera);
    
    // 创建一个虚拟平面
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const target = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(plane, target)) {
      return target;
    }
    return null;
  }

  /**
   * 聚焦到指定的洞洞板
   */
  focusOnPegboard(instance: { position: Position; face: string }): void {
    const targetPos = new THREE.Vector3(instance.position.x, instance.position.y, instance.position.z);
    const cameraOffset = new THREE.Vector3();
    
    // Determine camera offset based on face
    const distance = 150; // Distance from pegboard
    switch (instance.face) {
      case 'back':
        cameraOffset.set(0, 0, -distance);
        break;
      case 'left':
        cameraOffset.set(-distance, 0, 0);
        break;
      case 'right':
        cameraOffset.set(distance, 0, 0);
        break;
    }
    
    const targetCameraPos = targetPos.clone().add(cameraOffset);
    
    // Animate camera
    this.animateCamera(targetCameraPos, targetPos);
  }
  
  /**
   * 取消聚焦，退回全局视角（保持当前角度）
   */
  focusOnShelf(shelfHeight: number = 100): void {
    const targetLookAt = new THREE.Vector3(0, shelfHeight / 2, 0);
    
    // 获取当前相机位置和观察点
    const currentPos = this.camera.position.clone();
    const currentLookAt = this.controls.target.clone();
    
    // 计算当前视线方向
    const dir = new THREE.Vector3().subVectors(currentPos, currentLookAt).normalize();
    
    // 如果方向异常（比如完全垂直），给一个默认方向
    if (dir.lengthSq() < 0.1) {
      dir.set(0.8, 0.5, 1).normalize();
    }
    
    // 沿当前视线方向后退
    const distance = 350; // 默认全局距离
    const targetCameraPos = targetLookAt.clone().add(dir.multiplyScalar(distance));
    
    // 确保相机不会钻入地下
    if (targetCameraPos.y < 10) {
      targetCameraPos.y = 10;
    }
    
    this.animateCamera(targetCameraPos, targetLookAt);
  }
  
  private animateCamera(targetPos: THREE.Vector3, targetLookAt: THREE.Vector3): void {
    const startPos = this.camera.position.clone();
    const startLookAt = this.controls.target.clone();
    
    const duration = 800;
    const startTime = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in out cubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startLookAt, targetLookAt, ease);
      this.controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * 销毁
   */
  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.handleResize);
    
    // 清理场景
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
