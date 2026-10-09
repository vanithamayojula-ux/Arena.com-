// Small standalone 3D ship viewer used by the hangar / ship select cards.
import { buildShip } from './shipmodel.js';
import { LIVERIES } from './sim.js';

const THREE = window.THREE;

export class ShipPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.gl.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(32, 1, 0.5, 100);
    this.cam.position.set(8.5, 5.2, 12.5);
    this.cam.lookAt(0, 0.2, 0);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x201830, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 8, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x66ccff, 0.9); rim.position.set(-6, 2, -7); this.scene.add(rim);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    // pedestal ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.15, 64), new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -1.4;
    this.scene.add(ring);
    this.ring = ring;
    this.t = 0;
    this.raf = 0;
    this.ship = null;
    this.state = { boosting: false, speedFrac: 0.8, idx: 0, hitFlash: 0, shield: 0, invuln: 0, alive: true, h: 2.4 };
    this.spin = true;
    this.yaw = 0.6;
  }

  setShip(typeId, livery) {
    if (this.ship) this.pivot.remove(this.ship);
    this.ship = buildShip(typeId, livery % LIVERIES.length);
    if (this.ship.userData.under) this.ship.userData.under.visible = false;
    this.ship.scale.setScalar(1.05);
    this.pivot.add(this.ship);
    this.ring.material.color.set(LIVERIES[livery % LIVERIES.length].glow);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(40, Math.round(r.width)), h = Math.max(40, Math.round(r.height));
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  start() {
    if (this.raf) return;
    this.resize();
    let last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.t += dt;
      if (this.spin) this.yaw += dt * 0.6;
      this.pivot.rotation.y = this.yaw;
      this.ship?.position.set(0, Math.sin(this.t * 2) * 0.12, 0);
      this.ship?.userData.setLook?.(this.state, this.t);
      this.gl.render(this.scene, this.cam);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
}
