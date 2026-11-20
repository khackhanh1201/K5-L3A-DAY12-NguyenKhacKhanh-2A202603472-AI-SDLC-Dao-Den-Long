// Trang trí chỉ để hiển thị (bầu trời, biển mây, sương, cây cỏ, quầng sáng). Không ảnh hưởng core/headless.
import * as THREE from 'three';

// Ngẫu nhiên có seed riêng cho trang trí (render), để mỗi lần mở cảnh trông giống nhau
export function decoRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let glowTex = null;
/** Texture quầng sáng tròn (radial gradient) dùng chung cho sprite phát sáng. */
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  return s;
}

/** Bầu trời gradient + sao + trăng. */
export function createSky(scene, PAL) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x060a1e) }, mid: { value: new THREE.Color(PAL.sky) }, low: { value: new THREE.Color(PAL.fog) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, low, smoothstep(0.0, -0.25, h));
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const rnd = decoRng(7);
  const n = 1400;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rnd() * Math.PI * 2, v = 0.08 + rnd() * 0.92;
    const r = 280;
    pos.set([Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r], i * 3);
    const w = 0.6 + rnd() * 0.4;
    col.set([w, w, 0.85 + rnd() * 0.15], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
  scene.add(stars);

  const moon = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xfff3d6, fog: false }));
  const halo = glowSprite(0xbfc8ff, 70, 0.5);
  halo.material.fog = false;
  moon.add(halo, disc);
  moon.position.set(-150, 140, 180);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  return { sky, stars, moon };
}

/** Biển mây: các cụm mây dẹt trôi chậm bên dưới đảo (InstancedMesh, 1 draw call). */
export function createCloudSea(scene) {
  const rnd = decoRng(11);
  const n = 140;
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a5068, emissive: 0x0c1c30, transparent: true, opacity: 0.85 }),
    n,
  );
  const data = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 160;
    data.push({ a, r, y: -9 - rnd() * 4, s: 6 + rnd() * 14, sp: 0.004 + rnd() * 0.01, ph: rnd() * 6 });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  function update(t) {
    data.forEach((d, i) => {
      const a = d.a + t * d.sp;
      p.set(Math.cos(a) * d.r + 35, d.y + Math.sin(t * 0.3 + d.ph) * 0.4, Math.sin(a) * d.r);
      sc.set(d.s, d.s * 0.28, d.s * 0.7);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  scene.add(mesh);
  return { mesh, update };
}

/** Sương trôi sát mặt đất quanh Mây (sprite mờ). */
export function createMist(scene) {
  const grp = new THREE.Group();
  const rnd = decoRng(23);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3a4a8a, transparent: true, opacity: 0.18, depthWrite: false }));
    s.scale.set(14 + rnd() * 10, 3 + rnd() * 2, 1);
    s.userData = { ox: (rnd() - 0.5) * 60, oz: (rnd() - 0.5) * 60, sp: 0.2 + rnd() * 0.5, ph: rnd() * 10 };
    grp.add(s);
  }
  scene.add(grp);
  function update(t, center, lightK) {
    grp.children.forEach((s) => {
      const u = s.userData;
      const x = ((u.ox + t * u.sp + 30) % 60 + 60) % 60 - 30;
      s.position.set(center[0] + x, center[1] + 0.6 + Math.sin(t + u.ph) * 0.2, center[2] + u.oz);
      s.material.opacity = 0.2 * (1 - 0.7 * lightK); // đảo sáng lên thì sương tan bớt
    });
  }
  return { grp, update };
}

/** Cỏ, đá, cây trên đảo theo bản đồ; né đèn, bục và đường dốc. */
export function decorateIsland(level, map, PAL) {
  const rnd = decoRng(100 + map.night);
  const avoid = [...map.lanterns.map((l) => l.pos), ...map.pads.map((p) => p.pos), map.start, ...map.charms.map((c) => c.pos)];
  const free = (x, z, r) => avoid.every((a) => Math.hypot(a[0] - x, a[2] - z) > r) && (!map.tower || Math.hypot(x, z) > 3);
  const spot = (minR, maxR, cx, cz, clear) => {
    for (let k = 0; k < 20; k++) {
      const a = rnd() * Math.PI * 2, r = minR + Math.sqrt(rnd()) * (maxR - minR);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = map.ground(x, z);
      if (h !== null && free(x, z, clear) && Number.isInteger(h)) return [x, h, z];
    }
    return null;
  };
  const islands = map.night === 2 ? [[0, 0, 26], [70, 0, 26]] : map.night === 3 ? [[0, 0, 43]] : [[0, 0, 38]];

  // cỏ (instanced)
  const grassN = 900;
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x4f9273 }), grassN);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let gi = 0;
  for (let i = 0; i < grassN; i++) {
    const [cx, cz, R] = islands[i % islands.length];
    const pt = spot(0, R, cx, cz, 1.2);
    if (!pt) continue;
    e.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
    q.setFromEuler(e);
    const k = 0.6 + rnd() * 0.9;
    m.compose(p.set(pt[0], pt[1] + 0.2 * k, pt[2]), q, s.set(k, k, k));
    grass.setMatrixAt(gi++, m);
  }
  grass.count = gi;
  level.add(grass);

  // đá
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0x4a4f63 }), 60);
  let ri = 0;
  for (let i = 0; i < 60; i++) {
    const [cx, cz, R] = islands[i % islands.length];
    const pt = spot(R * 0.3, R, cx, cz, 2.5);
    if (!pt) continue;
    e.set(rnd(), rnd(), rnd());
    q.setFromEuler(e);
    const k = 0.4 + rnd() * 1.2;
    m.compose(p.set(pt[0], pt[1] + 0.15, pt[2]), q, s.set(k, k * 0.7, k));
    rocks.setMatrixAt(ri++, m);
  }
  rocks.count = ri;
  level.add(rocks);

  // cây: cây cau ở Đêm 2, cây tròn ở Đêm 1/3
  const trunkMat = new THREE.MeshLambertMaterial({ color: PAL.wood });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x24584a });
  const treeN = map.night === 2 ? 22 : 18;
  for (let i = 0; i < treeN; i++) {
    const [cx, cz, R] = islands[i % islands.length];
    const pt = spot(R * 0.45, R * 0.97, cx, cz, 9);
    if (!pt) continue;
    const t = new THREE.Group();
    if (map.night === 2) {
      const hgt = 6 + rnd() * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, hgt, 6), trunkMat);
      trunk.position.y = hgt / 2;
      t.add(trunk);
      for (let k = 0; k < 6; k++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), leafMat);
        leaf.position.set(Math.cos(k) * 0.9, hgt - 0.2, Math.sin(k) * 0.9);
        leaf.rotation.set(Math.sin(k) * 1.2, 0, -Math.cos(k) * 1.2);
        t.add(leaf);
      }
    } else {
      const hgt = 1.6 + rnd();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, hgt, 6), trunkMat);
      trunk.position.y = hgt / 2;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rnd() * 0.6, 0), leafMat);
      crown.position.y = hgt + 0.9;
      crown.scale.y = 0.85;
      t.add(trunk, crown);
    }
    t.position.set(pt[0], pt[1], pt[2]);
    t.rotation.y = rnd() * 6;
    level.add(t);
  }
}
