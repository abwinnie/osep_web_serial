import { flaskGeometry, liquidGeometry, flaskMarkings } from "./flask";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FoamSurface } from "./foam-surface";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  visualParameters,
  DURATION,
  type FoamSimulation,
  type Parameters,
} from "./model";
export class LabScene {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
  readonly controls: OrbitControls;
  private environmentTarget: THREE.WebGLRenderTarget;
  private markingsTexture: THREE.Texture;
  private foam: THREE.InstancedMesh;
  private surface = new FoamSurface();
  private foamStyle: "cream" | "particles" = "cream";
  private liquid: THREE.Mesh;
  private overflow: THREE.Mesh;
  private matrix = new THREE.Object3D();
  private resize: ResizeObserver;
  private foamMaterial = new THREE.MeshStandardMaterial({
    color: 0x41cca9,
    roughness: 0.6,
  });
  constructor(private host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.transmissionResolutionScale = 0.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xeaf0ee);
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "可拖曳旋轉與縮放的三維錐形瓶及泡沫場景",
    );
    this.camera.position.set(135, 150, 180);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 49, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 85;
    this.controls.maxDistance = 420;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x869990, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(80, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -110,
      right: 110,
      top: 140,
      bottom: -110,
      far: 450,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const fill = new THREE.PointLight(0xaee9ff, 12000, 300);
    fill.position.set(-50, 65, -40);
    this.scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: 0xc5ceca, roughness: 0.85 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(250, 20, 0x9eafaa, 0xbac6c1);
    grid.position.y = 0.03;
    this.scene.add(grid);
    // Revolved closed glass wall profile: flat base, broad body, shoulder and open neck.
    const glass = new THREE.Mesh(
      flaskGeometry(),
      new THREE.MeshPhysicalMaterial({
        color: 0xf1faf8,
        transparent: true,
        opacity: 0.62,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.88,
        thickness: 0.8,
        ior: 1.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    glass.renderOrder = 3;
    this.scene.add(glass);
    const markings = flaskMarkings();
    this.markingsTexture = markings.texture;
    this.scene.add(markings.mesh);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(3.65, 0.4, 12, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xe5fffb,
        transparent: true,
        opacity: 0.7,
        roughness: 0.12,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 40;
    this.scene.add(rim);
    // Geometry is rebuilt only when the top level changes; bottom remains at y=1.5.
    this.liquid = new THREE.Mesh(
      liquidGeometry(12.5),
      new THREE.MeshStandardMaterial({
        color: 0x41cca9,
        transparent: true,
        opacity: 0.8,
        roughness: 0.25,
      }),
    );
    this.liquid.position.y = 0;
    this.scene.add(this.liquid);
    this.foam = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      this.foamMaterial,
      6000,
    );
    this.foam.count = 0;
    this.foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foam.castShadow = true;
    this.foam.receiveShadow = true;
    this.foam.frustumCulled = false;
    this.scene.add(this.foam);
    this.scene.add(this.surface);
    this.overflow = new THREE.Mesh(
      new THREE.TorusGeometry(4, 1.6, 12, 32),
      this.foamMaterial,
    );
    this.overflow.rotation.x = Math.PI / 2;
    this.overflow.position.y = 39;
    this.overflow.visible = false;
    this.scene.add(this.overflow);
    this.resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.resize.observe(host);
  }
  setFoamStyle(style: "cream" | "particles") {
    this.foamStyle = style;
  }
  focusBottle() {
    this.controls.target.set(-6, 25, 0);
    this.camera.position.set(72, 65, 100);
  }
  private renderFrame = 0;
  private lastLevel = -1;
  private lastSimulation: FoamSimulation | null = null;
  private settling = 0;
  get foamStage() {
    if (this.settling >= 24) return "泡沫堆積完成";
    if ((this.lastSimulation?.maxHeight ?? 0) - 39 <= 34) return "泡沫緩慢沉降";
    if (this.settling < 2) return "泡沫直立觀察";
    return this.settling < 12 ? "泡沫側傾中" : "泡沫坍塌中";
  }
  update(sim: FoamSimulation | null, p: Parameters, dt = 0) {
    if (sim !== this.lastSimulation) {
      this.lastSimulation = sim;
      this.settling = 0;
      if (sim) {
        const height = Math.max(
          128,
          42 + visualParameters(sim.parameters).eruptionVelocity ** 2 / 19.6,
        );
        const scale = height / 128;
        this.controls.target.set(0, height * 0.38, 0);
        this.camera.position.set(135 * scale, 150 * scale, 180 * scale);
      }
    }
    if (sim && sim.elapsed >= DURATION) this.settling += dt;
    const color = new THREE.Color().setRGB(
      p.rgb[0] / 255,
      p.rgb[1] / 255,
      p.rgb[2] / 255,
      THREE.SRGBColorSpace,
    );
    this.foamMaterial.color.copy(color);
    (this.liquid.material as THREE.MeshStandardMaterial).color.copy(
      p.syncLiquid ? color : new THREE.Color(0x79bfee),
    );
    const level = 12.5 - (sim?.liquidDrop ?? 0);
    if (Math.abs(level - this.lastLevel) > 0.06) {
      this.lastLevel = level;
      this.liquid.geometry.dispose();
      this.liquid.geometry = liquidGeometry(level);
    }
    const particles = sim?.particles ?? [];
    this.foam.count = particles.length;
    this.foam.visible = this.foamStyle === "particles";
    let currentTop = 0,
      landed = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const t = this.settling;
      let x = p.x,
        z = p.z,
        y = p.y;
      if (t > 0) {
        x += p.vx * t;
        z += p.vz * t;
        y = p.landed
          ? p.y
          : Math.max(p.radius + 3, p.y + p.vy * t - 4.9 * t * t);
        if (y < 40 && Math.hypot(x, z) < 14) {
          const a = Math.atan2(z, x);
          x = Math.cos(a) * 15;
          z = Math.sin(a) * 15;
        }
        const spread = 1 + Math.min(t, 40) * 0.003;
        x *= spread;
        z *= spread;
      }
      const decay = 1 - Math.min(0.35, Math.max(0, t - 30) / 180);
      currentTop = Math.max(currentTop, y + p.radius);
      if (p.landed) landed++;
      const hiddenCore =
        this.foamStyle === "cream" && !p.landed && Math.hypot(x, z) < 6;
      const radius = p.radius * decay * (hiddenCore ? 0.48 : 1);
      this.matrix.position.set(x, y, z);
      this.matrix.scale.set(radius, radius * (p.landed ? 0.85 : 1.15), radius);
      this.matrix.updateMatrix();
      this.foam.setMatrixAt(i, this.matrix.matrix);
    }
    this.foam.instanceMatrix.needsUpdate = true;
    this.overflow.visible = particles.length > 0;
    this.surface.update(
      particles.length ? sim!.elapsed : 0,
      currentTop,
      this.settling,
      color,
      landed,
    );
    this.surface.visible = particles.length > 0 && this.foamStyle === "cream";
    this.controls.update();
    if (this.renderFrame++ % 8 === 0)
      this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resize.disconnect();
    this.controls.dispose();
    this.surface.dispose();
    this.scene.remove(this.surface);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.markingsTexture.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
