/**
 * PowerLighting.js — pencahayaan sinematik terkontrol: environment map (PMREM), key light dengan soft shadow,
 * rim light berwarna item, SATU point light dinamis (glow item), lantai penerima bayangan + glow decal.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { radialTexture } from './PowerAura.js';
import { clamp } from './PowerConfig.js';

export class PowerLighting {
  constructor(renderer, scene, q) {
    this.renderer = renderer; this.scene = scene; this.q = q;
    this.g = 0; this.punchV = 0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04);
    pm.dispose();
    scene.environment = this.env.texture;
    scene.environmentIntensity = 0.35 + 0.45 * q.ambientMul;

    this.hemi = new THREE.HemisphereLight(0x8fa8ff, 0x241a14, 0.1 + 0.35 * q.ambientMul);
    this.key = new THREE.DirectionalLight(0xfff2e0, 2.4);
    this.key.position.set(3.5, 7, 4.5);
    this.key.target.position.set(0, 1.2, 0);
    this.key.castShadow = true;
    const sc = this.key.shadow.camera;
    sc.near = 0.5; sc.far = 20; sc.left = sc.bottom = -4.5; sc.right = sc.top = 4.5;
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
    this.key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.rim = new THREE.DirectionalLight(0x88aaff, 1.4);
    this.rim.position.set(-5, 3.5, -4);
    this.glowLight = new THREE.PointLight(0xffffff, 0, 9, 2);
    this.glowLight.position.set(0, 1.7, 1.4);
    this.glowLight.visible = q.light;

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.38 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.decal = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.decal.rotation.x = -Math.PI / 2;
    this.decal.position.y = 0.012;

    scene.add(this.hemi, this.key, this.key.target, this.rim, this.glowLight, this.floor, this.decal);
    this.base = new THREE.Color('#ffffff');
  }

  /** Warnai lampu rim/glow sesuai item. */
  setItem(item) {
    this.base.set(item.aura?.color || item.colors.primary);
    this.rim.color.copy(this.base).lerp(new THREE.Color('#ffffff'), 0.35);
    this.glowLight.color.copy(this.base);
    this.decal.material.color.copy(this.base);
  }
  /** Kekuatan glow kontinu (0..~2). */
  setGlow(v) { this.g = v; }
  /** Lonjakan cahaya sesaat (impact). */
  punch(color, amt) { if (color) this.glowLight.color.set(color); this.punchV = Math.max(this.punchV, amt); }

  update(dt) {
    this.punchV *= Math.exp(-5 * dt);
    const v = this.g + this.punchV;
    this.glowLight.intensity = this.q.light ? v * 25 : 0;
    this.decal.material.opacity = clamp(0.1 + v * 0.35, 0, 0.9);
    if (this.punchV < 0.02) this.glowLight.color.lerp(this.base, 0.1);
  }

  dispose() {
    this.scene.remove(this.hemi, this.key, this.key.target, this.rim, this.glowLight, this.floor, this.decal);
    this.key.shadow.map?.dispose();
    this.env.dispose();
    this.scene.environment = null;
    this.floor.geometry.dispose(); this.floor.material.dispose();
    this.decal.geometry.dispose(); this.decal.material.dispose();
  }
}
