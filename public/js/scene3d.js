// Live 3D scenes. One shared WebGL renderer draws into a fixed full-viewport
// canvas; "bg" scenes fill the viewport behind the UI, "stage" scenes are
// scissored to a [data-stage] element so they scroll with the page. Three.js is
// vendored and lazy-loaded, so a failed load or missing WebGL2 leaves the
// regular CSS UI untouched.
(function () {
  'use strict';

  const THREE_URL = '/vendor/three-0.186.1.min.js';
  const C = {
    amber: 0xE8B060, amberDark: 0xB67A2E, amberLight: 0xF2C87E, blue: 0x7FA8E8,
    green: 0x74D69E, red: 0xE88A7F, purple: 0xC79BF2, muted: 0x656B75, ink: 0x0A0C10,
  };
  const MODES = {
    landing: 'bg', ambient: 'bg',
    overview: 'stage', agents: 'stage', growth: 'stage', money: 'stage', approvals: 'stage',
  };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const low = coarse || (navigator.hardwareConcurrency || 8) <= 4;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let T = null;
  let loading = null;
  let failed = false;
  let renderer = null;
  let canvas = null;
  let active = null;
  let want = null;
  let raf = 0;
  let lastTs = 0;
  let clock = 0;
  let sizeKey = '';
  let lastDraw = 0;
  const ptr = { x: -1, y: -1 };
  const ctx = { aspect: 1, local: { x: 0, y: 0 }, low, reduce: () => reduce.matches };

  // ---------- shared helpers ----------

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const parseNum = (s) => Number(String(s == null ? '' : s).replace(/[^0-9.\-]/g, '')) || 0;

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  function fitGroup(camera, group, spanX, spanY) {
    const dist = camera.position.z;
    const vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const vw = vh * camera.aspect;
    const s = Math.min(vw / spanX, vh / spanY, 1.4);
    if (!group.userData.fitted) { group.userData.fitted = true; group.scale.setScalar(s); return; }
    group.scale.setScalar(lerp(group.scale.x, s, 0.2));
  }

  function makeStars(count, spread, minR) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = minR + Math.random() * spread;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      seed[i] = Math.random();
      size[i] = 0.6 + Math.random() * 1.8;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new T.BufferAttribute(size, 1));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uPx: { value: 1 },
        uA: { value: new T.Color(C.amber) }, uB: { value: new T.Color(C.blue) },
      },
      vertexShader: `
        attribute float aSeed; attribute float aSize;
        uniform float uTime; uniform float uPx;
        varying float vTw; varying float vSeed;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vTw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
          vSeed = aSeed;
          gl_PointSize = aSize * uPx * (90.0 / -mv.z);
        }`,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB;
        varying float vTw; varying float vSeed;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a *= a;
          float tint = step(0.72, fract(vSeed * 13.0));
          vec3 col = mix(vec3(1.0), mix(uA, uB, step(0.5, fract(vSeed * 5.0))), tint * 0.8);
          gl_FragColor = vec4(col, a * vTw);
          #include <colorspace_fragment>
        }`,
    });
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;
    return { points, mat };
  }

  function makeGlow(color, intensity) {
    return new T.Mesh(new T.SphereGeometry(1, 40, 40), new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uColor: { value: new T.Color(color) }, uI: { value: intensity == null ? 1 : intensity } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uI; varying vec3 vN;
        void main() {
          float i = pow(max(dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 2.4) * uI;
          gl_FragColor = vec4(uColor * i, i);
          #include <colorspace_fragment>
        }`,
    }));
  }

  function makePlanet(radius) {
    const planet = new T.Mesh(new T.SphereGeometry(radius, 96, 96), new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDark: { value: new T.Color(0x0B0F17) }, uMid: { value: new T.Color(0x1C2638) },
        uRim: { value: new T.Color(C.amber) }, uCool: { value: new T.Color(C.blue) },
      },
      vertexShader: `
        varying vec3 vN; varying vec2 vUv;
        void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uDark; uniform vec3 uMid; uniform vec3 uRim; uniform vec3 uCool;
        varying vec3 vN; varying vec2 vUv;
        void main() {
          vec3 n = normalize(vN);
          float lit = max(dot(n, normalize(vec3(-0.55, 0.6, 0.6))), 0.0);
          float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
          float bands = 0.5 + 0.5 * sin(vUv.y * 46.0 + sin(vUv.x * 14.0 + uTime * 0.25) * 1.6 + uTime * 0.18);
          vec3 base = mix(uDark, uMid, lit * 0.85 + bands * 0.12);
          vec3 col = base + uRim * rim * (0.25 + 0.9 * lit) + uCool * rim * (1.0 - lit) * 0.35;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    return planet;
  }

  function addLights(scene) {
    scene.add(new T.AmbientLight(0x8fa0c0, 0.7));
    const key = new T.DirectionalLight(0xfff0d8, 1.4); key.position.set(-3, 4, 5); scene.add(key);
    const warm = new T.PointLight(C.amber, 14, 14, 1.6); warm.position.set(0, 1.5, 3.5); scene.add(warm);
  }

  function makeCamera(fov, z) {
    const cam = new T.PerspectiveCamera(fov, 1, 0.1, 120);
    cam.position.set(0, 0.35, z);
    cam.lookAt(0, 0, 0);
    return cam;
  }

  // ---------- scenes ----------

  const FACTORIES = {};

  FACTORIES.landing = function () {
    const scene = new T.Scene();
    const camera = makeCamera(42, 8);
    const root = new T.Group();
    scene.add(root);

    const stars = makeStars(low ? 650 : 1500, 26, 10);
    scene.add(stars.points);

    const planet = makePlanet(1.55);
    const halo = makeGlow(C.amber, 0.55);
    halo.scale.setScalar(2.25);
    const cool = makeGlow(C.blue, 0.22);
    cool.scale.setScalar(3.1);
    root.add(cool, halo, planet);

    const orbits = [
      { r: 2.35, tilt: [1.2, 0.2, 0.3], color: C.amber, speed: 0.32, moon: 0.09 },
      { r: 2.95, tilt: [0.9, -0.35, -0.5], color: C.blue, speed: -0.21, moon: 0.07 },
      { r: 3.7, tilt: [1.45, 0.1, 0.9], color: 0xffffff, speed: 0.14, moon: 0.06 },
    ].map((o) => {
      const g = new T.Group();
      g.rotation.set(o.tilt[0], o.tilt[1], o.tilt[2]);
      const ring = new T.Mesh(new T.TorusGeometry(o.r, 0.006, 8, 180), new T.MeshBasicMaterial({
        color: o.color, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false,
      }));
      const pivot = new T.Group();
      const moon = new T.Mesh(new T.SphereGeometry(o.moon, 20, 20), new T.MeshBasicMaterial({ color: o.color }));
      moon.position.x = o.r;
      pivot.add(moon);
      g.add(ring, pivot);
      root.add(g);
      return { pivot, speed: o.speed };
    });

    let rotY = 0;
    let rotX = 0;
    return {
      scene, camera,
      update(t, dt) {
        const wide = ctx.aspect > 1.15;
        root.position.x = lerp(root.position.x, wide ? 3.7 : 0, 0.06);
        root.position.y = lerp(root.position.y, wide ? -0.5 : -2.4, 0.06);
        const s = wide ? 1 : 0.78;
        root.scale.setScalar(lerp(root.scale.x || s, s, 0.06));
        rotY = lerp(rotY, ctx.local.x * 0.3, 0.04);
        rotX = lerp(rotX, -ctx.local.y * 0.15, 0.04);
        root.rotation.set(rotX, rotY, 0);
        planet.rotation.y += dt * 0.05;
        planet.material.uniforms.uTime.value = t;
        halo.material.uniforms.uI.value = 0.5 + Math.sin(t * 0.8) * 0.06;
        orbits.forEach((o) => { o.pivot.rotation.z = t * o.speed; });
        stars.points.rotation.y = t * 0.004;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  FACTORIES.ambient = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(45, 9);
    const stars = makeStars(low ? 500 : 1100, 26, 8);
    scene.add(stars.points);
    const glow = makeGlow(C.amber, 0.5);
    glow.position.set(0, 0.5, -3);
    scene.add(glow);
    let progress = (data && data.progress) || 0;
    return {
      scene, camera,
      setData(d) { progress = (d && d.progress) || 0; },
      update(t) {
        const target = 2.2 + progress * 2.4;
        glow.scale.setScalar(lerp(glow.scale.x, target, 0.05));
        glow.material.uniforms.uI.value = 0.3 + progress * 0.6 + Math.sin(t * 1.4) * 0.05;
        stars.points.rotation.y = t * 0.006;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  function secondsToCycle() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return (next - now) / 1000;
  }

  FACTORIES.overview = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(38, 7.5);
    addLights(scene);
    const root = new T.Group();
    scene.add(root);

    const stars = makeStars(low ? 140 : 320, 6, 5);
    scene.add(stars.points);

    const core = new T.Mesh(new T.IcosahedronGeometry(0.75, 2), new T.MeshStandardMaterial({
      color: C.amber, emissive: C.amber, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.2,
    }));
    const shell = new T.LineSegments(new T.WireframeGeometry(new T.IcosahedronGeometry(1.2, 1)), new T.LineBasicMaterial({
      color: C.amberLight, transparent: true, opacity: 0.4,
    }));
    const halo = makeGlow(C.amber, 0.8);
    halo.scale.setScalar(2.5);
    root.add(halo, core, shell);

    const orbitTilt = new T.Group();
    orbitTilt.rotation.set(1.15, 0.25, 0.2);
    root.add(orbitTilt);
    orbitTilt.add(new T.Mesh(new T.TorusGeometry(1.95, 0.007, 8, 160), new T.MeshBasicMaterial({
      color: C.blue, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false,
    })));
    let orbs = [];
    let pillars = [];
    const arcGroup = new T.Group();
    arcGroup.position.set(-4.6, 0, 0);
    root.add(arcGroup);
    arcGroup.add(new T.Mesh(new T.TorusGeometry(0.95, 0.025, 8, 96), new T.MeshBasicMaterial({
      color: C.muted, transparent: true, opacity: 0.55,
    })));
    let arc = null;
    let arcKey = -1;
    let pending = 0;

    const toneColor = { shipped: C.green, leads: C.blue, review: C.amber };
    const pillarGroup = new T.Group();
    pillarGroup.position.set(3.4, -1.15, 0);
    root.add(pillarGroup);

    function rebuild(d) {
      orbs.forEach((o) => { orbitTilt.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); });
      pillars.forEach((p) => { pillarGroup.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
      const report = (d && d.report) || [];
      orbs = report.map((r, i) => ({
        mesh: new T.Mesh(new T.SphereGeometry(0.16, 24, 24), new T.MeshStandardMaterial({
          color: toneColor[r.tone] || C.blue, emissive: toneColor[r.tone] || C.blue, emissiveIntensity: 0.9, roughness: 0.4,
        })),
        offset: (i / Math.max(report.length, 1)) * Math.PI * 2,
        review: r.tone === 'review',
      }));
      orbs.forEach((o) => orbitTilt.add(o.mesh));
      const metrics = (d && d.metrics) || [];
      pillars = metrics.map((m, i) => {
        const v = Math.abs(parseNum(m.value));
        const target = 0.25 + 1.7 * clamp(Math.log10(1 + v) / 3, 0, 1);
        const mesh = new T.Mesh(new T.BoxGeometry(0.4, 1, 0.4), new T.MeshStandardMaterial({
          color: m.deltaTone === 'up' ? C.green : C.blue, emissive: m.deltaTone === 'up' ? C.green : C.blue,
          emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.3,
        }));
        mesh.position.x = i * 0.72;
        mesh.scale.y = 0.05;
        pillarGroup.add(mesh);
        return { mesh, target };
      });
      pending = (d && d.pendingCount) || 0;
    }
    rebuild(data);

    return {
      scene, camera,
      setData: rebuild,
      update(t) {
        camera.position.x = lerp(camera.position.x, ctx.local.x * 0.4, 0.05);
        camera.lookAt(0, 0, 0);
        fitGroup(camera, root, 11.6, 5.4);
        const beat = pending > 0 ? 3.4 : 1.2;
        const pulse = 1 + Math.sin(t * beat) * (pending > 0 ? 0.07 : 0.03);
        core.scale.setScalar(pulse);
        core.rotation.y = t * 0.3;
        shell.rotation.y = -t * 0.12;
        shell.rotation.x = t * 0.07;
        halo.material.uniforms.uI.value = (pending > 0 ? 0.95 : 0.65) + Math.sin(t * beat) * 0.1;
        orbs.forEach((o) => {
          const a = t * 0.45 + o.offset;
          o.mesh.position.set(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0);
          if (o.review && pending > 0) o.mesh.scale.setScalar(1 + Math.sin(t * 5) * 0.25);
        });
        pillars.forEach((p) => { p.mesh.scale.y = lerp(p.mesh.scale.y, p.target, 0.06); p.mesh.position.y = p.mesh.scale.y / 2; });
        const day = 1 - secondsToCycle() / 86400;
        const k = Math.floor(day * 360);
        if (k !== arcKey) {
          arcKey = k;
          if (arc) { arcGroup.remove(arc); arc.geometry.dispose(); arc.material.dispose(); }
          arc = new T.Mesh(new T.TorusGeometry(0.95, 0.06, 12, 96, Math.max(day, 0.01) * Math.PI * 2), new T.MeshBasicMaterial({ color: C.amber }));
          arc.rotation.z = Math.PI / 2;
          arc.scale.x = -1;
          arcGroup.add(arc);
        }
        arcGroup.rotation.y = Math.sin(t * 0.4) * 0.35;
        stars.points.rotation.y = t * 0.01;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  const AGENT_COLOR = { thinking: C.purple, active: C.green, idle: C.blue, paused: C.muted };

  FACTORIES.agents = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(38, 7.5);
    addLights(scene);
    const root = new T.Group();
    scene.add(root);
    const stars = makeStars(low ? 140 : 320, 6, 5);
    scene.add(stars.points);

    const raycaster = new T.Raycaster();
    let nodes = [];
    let hoverKey = null;
    let focusKey = null;

    function rebuild(d) {
      nodes.forEach((n) => { [n.group, n.link, n.pulse].forEach((o) => { root.remove(o); disposeTree(o); }); });
      const agents = (d && d.agents) || [];
      nodes = agents.map((a, i) => {
        const color = AGENT_COLOR[a.status] || C.blue;
        const hub = i === 0;
        const group = new T.Group();
        const body = new T.Mesh(new T.OctahedronGeometry(hub ? 0.62 : 0.38, 0), new T.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: a.busy ? 0.9 : 0.25, roughness: 0.3, metalness: 0.35,
          transparent: true, opacity: a.status === 'paused' ? 0.45 : 1,
        }));
        body.userData.key = a.key;
        const wire = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(hub ? 0.86 : 0.56, 0)), new T.LineBasicMaterial({
          color, transparent: true, opacity: a.busy ? 0.7 : 0.25,
        }));
        const link = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({
          color, transparent: true, opacity: a.busy ? 0.55 : 0.12,
        }));
        const pulse = new T.Mesh(new T.SphereGeometry(0.055, 12, 12), new T.MeshBasicMaterial({ color }));
        pulse.visible = !!a.busy && !hub;
        group.add(body, wire);
        root.add(group, link, pulse);
        return { a, hub, group, body, wire, link, pulse, phase: i * 0.7 };
      });
    }
    rebuild(data);

    const ellipse = (i, count, t) => {
      const ang = ((i - 1) / Math.max(count - 1, 1)) * Math.PI * 2 + t * 0.12;
      return [Math.cos(ang) * 4.1, Math.sin(ang) * 1.15, Math.sin(ang) * 1.2];
    };

    return {
      scene, camera,
      setData: rebuild,
      focus(key) { focusKey = key; },
      pick(x, y) {
        raycaster.setFromCamera({ x, y }, camera);
        const hit = raycaster.intersectObjects(nodes.map((n) => n.body), false)[0];
        hoverKey = hit ? hit.object.userData.key : null;
        return hoverKey;
      },
      update(t, dt) {
        camera.position.x = lerp(camera.position.x, ctx.local.x * 0.5, 0.05);
        camera.lookAt(0, 0, 0);
        fitGroup(camera, root, 10.2, 4.2);
        nodes.forEach((n, i) => {
          const p = n.hub ? [0, 0, 0] : ellipse(i, nodes.length, t);
          n.group.position.set(p[0], p[1], p[2]);
          const sel = n.a.key === focusKey || n.a.key === hoverKey;
          const target = (n.a.busy ? 1 + Math.sin(t * 3 + n.phase) * 0.08 : 1) * (sel ? 1.35 : 1);
          n.group.scale.setScalar(lerp(n.group.scale.x, target, 0.15));
          n.body.rotation.y += dt * (n.a.busy ? 1.1 : 0.3);
          n.wire.rotation.y -= dt * 0.4;
          const pos = n.link.geometry.attributes.position;
          pos.setXYZ(0, 0, 0, 0);
          pos.setXYZ(1, p[0], p[1], p[2]);
          pos.needsUpdate = true;
          if (n.pulse.visible) {
            const f = (t * 0.6 + n.phase) % 1;
            n.pulse.position.set(p[0] * f, p[1] * f, p[2] * f);
          }
        });
        stars.points.rotation.y = t * 0.01;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  FACTORIES.growth = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(36, 7.5);
    camera.position.y = 1.1;
    addLights(scene);
    const root = new T.Group();
    scene.add(root);
    const stars = makeStars(low ? 140 : 320, 6, 5);
    scene.add(stars.points);
    const funnel = new T.Group();
    root.add(funnel);

    const flow = [];
    const FLOW_N = low ? 40 : 90;
    let levels = [];
    let flowPts = null;

    function rebuild(d) {
      while (funnel.children.length) { const c = funnel.children[0]; funnel.remove(c); disposeTree(c); }
      flowPts = null;
      const rows = (d && d.funnel) || [];
      const rad = rows.map((r) => 0.4 + 1.35 * Math.sqrt(clamp(Number(r.pct) || 0, 0, 100) / 100));
      const h = 0.62;
      const total = rows.length * h;
      levels = rows.map((r, i) => {
        const top = rad[i];
        const bottom = i < rows.length - 1 ? rad[i + 1] : rad[i] * 0.7;
        const color = [C.blue, C.purple, C.amberLight, C.amber][i % 4];
        const geo = new T.CylinderGeometry(top, bottom, h * 0.92, 40, 1, true);
        const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.22, transparent: true, opacity: 0.32, side: T.DoubleSide, roughness: 0.5,
        }));
        mesh.position.y = total / 2 - h * (i + 0.5);
        const wire = new T.LineSegments(new T.EdgesGeometry(geo, 15), new T.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
        wire.position.copy(mesh.position);
        funnel.add(mesh, wire);
        return { mesh, y: mesh.position.y, top, bottom, h };
      });
      flow.length = 0;
      const arr = new Float32Array(FLOW_N * 3);
      for (let i = 0; i < FLOW_N; i++) flow.push({ f: Math.random(), a: Math.random() * Math.PI * 2, r: Math.random() * 0.85, s: 0.12 + Math.random() * 0.12 });
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      flowPts = new T.Points(geo, new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uPx: { value: 1 } },
        vertexShader: 'uniform float uPx; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = 5.0*uPx*(7.0/-mv.z); }',
        fragmentShader: `
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(1.0, 0.82, 0.5, a);
            #include <colorspace_fragment>
          }`,
      }));
      flowPts.frustumCulled = false;
      funnel.add(flowPts);
      funnel.userData.total = total;
    }
    rebuild(data);

    const radiusAt = (f) => {
      if (!levels.length) return 0.5;
      const idx = Math.min(levels.length - 1, Math.floor(f * levels.length));
      const local = f * levels.length - idx;
      return lerp(levels[idx].top, levels[idx].bottom, local);
    };

    return {
      scene, camera,
      setData: rebuild,
      update(t, dt) {
        camera.lookAt(0, 0, 0);
        fitGroup(camera, root, 5.2, 4.1);
        funnel.rotation.y = t * 0.22 + ctx.local.x * 0.5;
        funnel.rotation.x = 0.12 - ctx.local.y * 0.08;
        if (flowPts) {
          const total = funnel.userData.total || 2.4;
          const arr = flowPts.geometry.attributes.position.array;
          flow.forEach((p, i) => {
            p.f += dt * p.s;
            if (p.f > 1) { p.f -= 1; p.a = Math.random() * Math.PI * 2; p.r = Math.random() * 0.85; }
            const rr = radiusAt(p.f) * p.r;
            arr[i * 3] = Math.cos(p.a + p.f * 4) * rr;
            arr[i * 3 + 1] = total / 2 - p.f * total;
            arr[i * 3 + 2] = Math.sin(p.a + p.f * 4) * rr;
          });
          flowPts.geometry.attributes.position.needsUpdate = true;
          flowPts.material.uniforms.uPx.value = renderer.getPixelRatio();
        }
        stars.points.rotation.y = t * 0.01;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  FACTORIES.money = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(36, 7.5);
    camera.position.y = 1.2;
    addLights(scene);
    const root = new T.Group();
    scene.add(root);
    const stars = makeStars(low ? 140 : 320, 6, 5);
    scene.add(stars.points);

    const floor = new T.Mesh(new T.RingGeometry(0.2, 3.6, 64, 3), new T.MeshBasicMaterial({
      color: C.amber, transparent: true, opacity: 0.06, side: T.DoubleSide, depthWrite: false,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    root.add(floor);

    let pillars = [];
    const coins = [];
    const COINS = low ? 8 : 14;
    for (let i = 0; i < COINS; i++) {
      const mesh = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.05, 28), new T.MeshStandardMaterial({
        color: C.amberLight, emissive: C.amber, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.25,
      }));
      root.add(mesh);
      coins.push({ mesh, f: Math.random(), col: i % 3, s: 0.18 + Math.random() * 0.14 });
    }

    function rebuild(d) {
      pillars.forEach((p) => { root.remove(p.mesh); disposeTree(p.mesh); });
      const m = (d && d.money) || {};
      const vals = [parseNum(m.revenue), parseNum(m.share), parseNum(m.keep)];
      const max = Math.max(...vals, 1);
      const colors = [C.amber, C.purple, C.green];
      pillars = vals.map((v, i) => {
        const mesh = new T.Mesh(new T.CylinderGeometry(0.55, 0.62, 1, 40), new T.MeshStandardMaterial({
          color: colors[i], emissive: colors[i], emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.45,
          transparent: true, opacity: 0.92,
        }));
        mesh.position.x = (i - 1) * 2.1;
        mesh.scale.y = 0.04;
        root.add(mesh);
        return { mesh, target: 0.3 + 2.4 * clamp(Math.sqrt(v / max), 0, 1) * (v > 0 ? 1 : 0.15) };
      });
    }
    rebuild(data);

    return {
      scene, camera,
      setData: rebuild,
      update(t, dt) {
        camera.lookAt(0, 0.8, 0);
        fitGroup(camera, root, 8.2, 5.6);
        root.rotation.y = Math.sin(t * 0.25) * 0.35 + ctx.local.x * 0.3;
        pillars.forEach((p) => { p.mesh.scale.y = lerp(p.mesh.scale.y, p.target, 0.06); p.mesh.position.y = p.mesh.scale.y / 2; });
        coins.forEach((c) => {
          c.f += dt * c.s;
          if (c.f > 1) { c.f -= 1; c.col = Math.floor(Math.random() * 3); }
          const p = pillars[c.col];
          const topY = p ? p.mesh.scale.y : 0.3;
          c.mesh.position.set((c.col - 1) * 2.1 + Math.sin(c.f * 6 + c.col) * 0.12, lerp(4.4, topY + 0.05, c.f), Math.cos(c.f * 6) * 0.12);
          c.mesh.rotation.set(t * 2 + c.col, 0, c.f * 6);
          c.mesh.visible = c.f < 0.97;
        });
        stars.points.rotation.y = t * 0.01;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  FACTORIES.approvals = function (data) {
    const scene = new T.Scene();
    const camera = makeCamera(36, 7.5);
    addLights(scene);
    const root = new T.Group();
    scene.add(root);
    const stars = makeStars(low ? 140 : 320, 6, 5);
    scene.add(stars.points);
    let cards = [];

    const stateOf = (s) => {
      if (s === 'pending') return { color: C.amber, y: 0.35, rx: -0.12, glow: 1 };
      if (s === 'approved') return { color: C.green, y: -0.35, rx: -0.5, glow: 0.35 };
      return { color: C.red, y: -0.6, rx: -0.9, glow: 0.2 };
    };

    function rebuild(d) {
      const list = (d && d.approvals) || [];
      cards.forEach((c) => { root.remove(c.group); disposeTree(c.group); });
      cards = list.map((a, i) => {
        const st = stateOf(a.status);
        const group = new T.Group();
        const face = new T.Mesh(new T.BoxGeometry(1.55, 1, 0.05), new T.MeshStandardMaterial({
          color: 0x14181F, emissive: st.color, emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.4,
        }));
        const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.55, 1, 0.05)), new T.LineBasicMaterial({ color: st.color }));
        const bar = new T.Mesh(new T.BoxGeometry(1.1, 0.06, 0.02), new T.MeshBasicMaterial({ color: st.color }));
        bar.position.set(-0.2, 0.22, 0.04);
        const bar2 = new T.Mesh(new T.BoxGeometry(0.8, 0.04, 0.02), new T.MeshBasicMaterial({ color: 0x656B75 }));
        bar2.position.set(-0.35, 0.02, 0.04);
        group.add(face, edge, bar, bar2);
        const x = (i - (list.length - 1) / 2) * 1.95;
        group.position.set(x, st.y, 0);
        root.add(group);
        return { group, face, edge, bar, a, st, x, phase: i * 1.3 };
      });
    }
    rebuild(data);

    return {
      scene, camera,
      setData(d) {
        const list = (d && d.approvals) || [];
        if (list.length !== cards.length) return rebuild(d);
        list.forEach((a, i) => {
          const c = cards[i];
          if (c.a.status !== a.status) {
            c.a = a;
            c.st = stateOf(a.status);
            c.edge.material.color.setHex(c.st.color);
            c.bar.material.color.setHex(c.st.color);
            c.face.material.emissive.setHex(c.st.color);
          }
        });
      },
      update(t) {
        camera.lookAt(0, 0, 0);
        const span = Math.max(cards.length, 1) * 1.95 + 0.6;
        fitGroup(camera, root, span, 4.8);
        root.rotation.y = ctx.local.x * 0.25;
        cards.forEach((c) => {
          const bob = c.a.status === 'pending' ? Math.sin(t * 1.6 + c.phase) * 0.09 : 0;
          c.group.position.y = lerp(c.group.position.y, c.st.y + bob, 0.1);
          c.group.rotation.x = lerp(c.group.rotation.x, c.st.rx, 0.08);
          c.group.rotation.y = c.a.status === 'pending' ? Math.sin(t * 0.8 + c.phase) * 0.18 : lerp(c.group.rotation.y, 0, 0.08);
          c.face.material.emissiveIntensity = lerp(c.face.material.emissiveIntensity, 0.08 + c.st.glow * 0.25, 0.1);
        });
        stars.points.rotation.y = t * 0.01;
        stars.mat.uniforms.uTime.value = t;
        stars.mat.uniforms.uPx.value = renderer.getPixelRatio();
      },
      dispose() { disposeTree(scene); },
    };
  };

  // ---------- renderer + loop ----------

  function ensureThree() {
    if (T) return Promise.resolve(T);
    if (!loading) {
      loading = import(THREE_URL).then((mod) => { T = mod; return T; });
    }
    return loading;
  }

  function ensureRenderer() {
    if (renderer) return true;
    canvas = document.getElementById('scene3d');
    if (!canvas) return false;
    try {
      renderer = new T.WebGLRenderer({
        canvas, alpha: true, antialias: !low, powerPreference: 'high-performance',
      });
    } catch (e) {
      failed = true;
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
    canvas.addEventListener('webglcontextrestored', () => { if (active) start(); });
    return true;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
    const key = w + 'x' + h + '@' + dpr;
    if (key === sizeKey) return;
    sizeKey = key;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
  }

  function computeClip(mode) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (mode === 'bg') return { x: 0, y: 0, w: W, h: H };
    const el = document.querySelector('[data-stage]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let left = r.left; let top = r.top; let right = r.right; let bottom = r.bottom;
    const scroller = el.closest('.scroll-area');
    if (scroller) {
      const s = scroller.getBoundingClientRect();
      left = Math.max(left, s.left); top = Math.max(top, s.top);
      right = Math.min(right, s.right); bottom = Math.min(bottom, s.bottom);
    }
    const chat = document.querySelector('.chat-panel');
    if (chat) right = Math.min(right, chat.getBoundingClientRect().left);
    left = Math.max(left, 0); top = Math.max(top, 0); right = Math.min(right, W); bottom = Math.min(bottom, H);
    if (right - left < 4 || bottom - top < 4) return null;
    return { x: Math.floor(left), y: Math.floor(top), w: Math.ceil(right - left), h: Math.ceil(bottom - top) };
  }

  function frame(ts) {
    raf = 0;
    if (!active || document.hidden || !renderer) return;
    const frozen = reduce.matches;
    if (frozen && ts - lastDraw < 66) { raf = requestAnimationFrame(frame); return; }
    lastDraw = ts;
    const dt = frozen ? 0 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    clock += dt;

    resize();
    renderer.setScissorTest(false);
    renderer.clear();
    const clip = computeClip(active.mode);
    if (clip) {
      const nx = ((ptr.x - clip.x) / clip.w) * 2 - 1;
      const ny = -(((ptr.y - clip.y) / clip.h) * 2 - 1);
      const inside = ptr.x >= 0 && Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
      if (active.mode === 'bg') {
        ctx.local.x = lerp(ctx.local.x, (ptr.x / window.innerWidth) * 2 - 1, 0.1);
        ctx.local.y = lerp(ctx.local.y, -((ptr.y / window.innerHeight) * 2 - 1), 0.1);
      } else {
        ctx.local.x = lerp(ctx.local.x, inside ? nx : 0, 0.08);
        ctx.local.y = lerp(ctx.local.y, inside ? ny : 0, 0.08);
      }
      if (frozen) { ctx.local.x = 0; ctx.local.y = 0; }
      const cam = active.api.camera;
      ctx.aspect = clip.w / clip.h;
      cam.aspect = ctx.aspect;
      cam.updateProjectionMatrix();
      const vy = window.innerHeight - (clip.y + clip.h);
      renderer.setViewport(clip.x, vy, clip.w, clip.h);
      renderer.setScissor(clip.x, vy, clip.w, clip.h);
      renderer.setScissorTest(true);
      active.api.update(clock, dt);
      if (active.api.pick && inside && !frozen) {
        const key = active.api.pick(nx, ny);
        const el = document.querySelector('[data-stage]');
        if (el) el.style.cursor = key ? 'pointer' : '';
        if (key !== active.hover) {
          active.hover = key;
          document.dispatchEvent(new CustomEvent('scene3d:hover', { detail: { key } }));
        }
      }
      renderer.render(active.api.scene, cam);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !active) return;
    lastTs = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function teardown() {
    stop();
    if (active) { active.api.dispose(); active = null; }
    if (renderer) { renderer.setScissorTest(false); renderer.clear(); }
    document.body.removeAttribute('data-scene');
  }

  function apply() {
    if (!want || !T || failed) return;
    if (!ensureRenderer()) return;
    const { name, data } = want;
    if (active && active.name === name) {
      if (active.api.setData) active.api.setData(data);
      document.body.setAttribute('data-scene', active.mode);
      start();
      return;
    }
    if (active) active.api.dispose();
    active = { name, mode: MODES[name], api: FACTORIES[name](data), hover: null };
    document.body.setAttribute('data-scene', active.mode);
    canvas.classList.remove('scene3d--ready');
    requestAnimationFrame(() => canvas && canvas.classList.add('scene3d--ready'));
    start();
  }

  function show(name, data) {
    if (failed) return;
    if (!name || !MODES[name]) { want = null; if (renderer || active) teardown(); return; }
    want = { name, data };
    if (!T) { ensureThree().then(apply).catch(() => { failed = true; }); return; }
    apply();
  }

  window.addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { ptr.x = -1; ptr.y = -1; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  // Touch has no hover, so a tap re-runs the pick at the tap point instead of
  // trusting the last pointermove.
  document.addEventListener('click', (e) => {
    if (!active || !active.api.pick || !e.target.closest || !e.target.closest('[data-stage]')) return;
    const clip = computeClip(active.mode);
    if (!clip) return;
    const nx = ((e.clientX - clip.x) / clip.w) * 2 - 1;
    const ny = -(((e.clientY - clip.y) / clip.h) * 2 - 1);
    const key = active.api.pick(nx, ny);
    if (key) document.dispatchEvent(new CustomEvent('scene3d:pick', { detail: { key } }));
  });

  window.Scene3D = {
    show,
    focus(key) { if (active && active.api.focus) active.api.focus(key); },
    get supported() { return !failed; },
  };
})();
