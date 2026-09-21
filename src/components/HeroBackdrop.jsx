import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import useLazyCanvas from "./useLazyCanvas";

/* =========================================================
   HERO BACKDROP

   One WebGL scene that replaces HeroParticles + HeroStrands.

     1. Atmosphere   dark volumetric haze: cool light from the
                     upper left, crimson from the lower right
     2. Streams      GPU particle streams sweeping in from both
                     sides and funnelling into the core
     3. Core         your morphing helix -> knot -> sphere
     4. Orbits       thin tilted rings with travelling light
     5. Dust/Bokeh   depth-of-field particles
     6. Bloom        (grain + vignette live in Hero.css)

   Everything that sits behind the headline is dimmed by a soft
   "text zone" mask in the shaders, so the copy stays readable
   without outlines or heavy scrims.
   ========================================================= */

/* =========================================================
   TUNABLES
   ========================================================= */

// Colours (linear, 0-1). Cool = left, warm = right, blush = hot core.
const COOL = [0.09, 0.72, 0.88];
const WARM = [1.0, 0.12, 0.29];
const BLUSH = [1.0, 0.85, 0.9];

// Where the headline / copy sits, in normalised device coords.
// Particles inside this box are dimmed to TEXT_DIM.
const TEXT_CENTER = [0.0, 0.14];
const TEXT_SIZE = [0.44, 0.58];
const TEXT_DIM = 0.3;

// Core morph
const MORPH_DURATION = 2.4;
const CYCLE_INTERVAL = 6.5;
const CORE_ROTATION_SPEED = 1.08; // rad / sec

// Streams: how fast particles travel toward the core (1 = ~11s trip)
const FLOW_SPEED = 0.09;

const TIERS = {
  low: {
    core: 1800,
    strands: 14,
    per: 100,
    dust: 500,
    bokeh: 8,
    orbits: false,
  },
  mid: {
    core: 3400,
    strands: 20,
    per: 190,
    dust: 900,
    bokeh: 16,
    orbits: true,
  },
  high: {
    core: 5200,
    strands: 28,
    per: 320,
    dust: 1500,
    bokeh: 26,
    orbits: true,
  },
};

// "ambient" is the quiet version used behind every section below the
// hero (see SectionStars.jsx): haze, dust, bokeh and bloom only.
const AMBIENT_TIERS = {
  low: { core: 0, strands: 0, per: 0, dust: 300, bokeh: 4, orbits: false },
  mid: { core: 0, strands: 0, per: 0, dust: 550, bokeh: 8, orbits: false },
  high: { core: 0, strands: 0, per: 0, dust: 800, bokeh: 12, orbits: false },
};

function getTier() {
  if (typeof window === "undefined") return "high";
  const w = window.innerWidth;
  if (w < 640) return "low";
  if (w < 1100) return "mid";
  return "high";
}

/* =========================================================
   SHARED GLSL
   ========================================================= */

const GLSL_COMMON = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform float uAspect;
  uniform vec2 uMouse;
  uniform vec2 uTextC;
  uniform vec2 uTextS;
  uniform float uDim;

  // 0 inside the text zone, 1 outside (soft edge)
  float textMask(vec2 ndc) {
    vec2 q = (ndc - uTextC) / uTextS;
    float d = pow(pow(abs(q.x), 4.0) + pow(abs(q.y), 4.0), 0.25);
    return smoothstep(0.8, 1.4, d);
  }

  // Push a view-space position away from the cursor
  vec4 mousePush(vec4 mv, float radius, float strength) {
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);

    if (dist < radius && dist > 0.0001) {
      float f = 1.0 - dist / radius;
      f = f * f * f;
      vec2 dir = d / dist;
      dir.x /= uAspect;
      vec2 off = dir * f * strength;
      mv.x += off.x * (-mv.z) / projectionMatrix[0][0];
      mv.y += off.y * (-mv.z) / projectionMatrix[1][1];
    }

    return mv;
  }
`;

/* =========================================================
   1. ATMOSPHERE
   ========================================================= */

const atmosphereVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const atmosphereFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform float uHero;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    p += uPointer * 0.035;

    float t = uTime * 0.03;

    // Domain-warped smoke
    vec2 q = vec2(
      fbm(p * 1.3 + vec2(t, -t * 0.7)),
      fbm(p * 1.3 + vec2(5.2, 1.3) - t)
    );
    float smoke = fbm(p * 1.7 + q * 1.9 + vec2(-t * 0.5, t * 0.4));

    // Light sources
    float cool = exp(-pow(length((p - vec2(-0.95, 0.30)) * vec2(0.85, 1.25)), 1.4) * 1.9);
    float warm = exp(-pow(length((p - vec2(0.90, -0.26)) * vec2(0.85, 1.2)), 1.4) * 1.75);
    float core = exp(-length((p - vec2(0.0, 0.04)) * vec2(0.75, 1.0)) * 2.7);

    vec3 col = vec3(0.0006, 0.0008, 0.0018);
    col += uCool * cool * (0.30 + 1.15 * smoke) * 0.05;
    col += uWarm * warm * (0.30 + 1.25 * smoke) * 0.07;
    col += vec3(0.34, 0.03, 0.10) * core * (0.35 + smoke) * 0.035 * uHero;

    // Horizontal light streak the streams feed into
    float streak = exp(-abs(p.y - 0.03) * 34.0) * exp(-abs(p.x) * 1.15);
    vec3 streakCol = mix(uCool, uWarm, smoothstep(-0.6, 0.6, p.x));
    col += streakCol * streak * (0.5 + smoke) * 0.05 * uHero;

    // Faint horizon glow along the bottom edge (sits behind the cards)
    float floorGlow = exp(-vUv.y * 5.5) * (0.4 + 0.8 * smoke);
    col += vec3(0.40, 0.05, 0.14) * floorGlow * 0.03;

    // Dither to avoid banding
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 1.6;

    gl_FragColor = vec4(col * uIntro, 1.0);
  }
`;

function Atmosphere({ shared }) {
  const uniforms = useMemo(
    () => ({
      uTime: shared.uTime,
      uIntro: shared.uIntro,
      uCool: shared.uCool,
      uWarm: shared.uWarm,
      uRes: shared.uRes,
      uPointer: shared.uPointerSoft,
      uHero: shared.uHero,
    }),
    [shared],
  );

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={atmosphereVert}
        fragmentShader={atmosphereFrag}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* =========================================================
   2. STREAMS
   ========================================================= */

function buildStreams(strands, per) {
  const n = strands * 2 * per;

  const position = new Float32Array(n * 3);
  const P0 = new Float32Array(n * 3);
  const P1 = new Float32Array(n * 3);
  const P2 = new Float32Array(n * 3);
  const P3 = new Float32Array(n * 3);
  const R = new Float32Array(n * 4);
  const J = new Float32Array(n * 3);
  const W = new Float32Array(n * 4);

  let k = 0;

  [-1, 1].forEach((side) => {
    for (let s = 0; s < strands; s += 1) {
      const ss = strands > 1 ? (s / (strands - 1)) * 2 - 1 : 0;
      const zr = (Math.random() - 0.5) * 22;

      const p0 = [
        side * (38 + Math.random() * 4),
        ss * (10.5 + Math.random() * 2.5),
        zr,
      ];
      const p1 = [side * (24 + Math.random() * 4), p0[1] * 0.9, zr * 0.8];
      const p2 = [
        side * (9 + Math.random() * 3),
        p0[1] * 0.2 + (Math.random() - 0.5) * 2,
        zr * 0.35,
      ];
      const p3 = [
        side * (0.8 + Math.random() * 1.6),
        (Math.random() - 0.5) * 1.4 + ss * 0.6,
        (Math.random() - 0.5) * 1.5,
      ];

      const wAmp = 0.5 + Math.random() * 1.8;
      const wFreq = 1.4 + Math.random() * 2.4;
      const wPh = Math.random() * 6.2832;

      for (let i = 0; i < per; i += 1) {
        const o3 = k * 3;
        const o4 = k * 4;

        P0.set(p0, o3);
        P1.set(p1, o3);
        P2.set(p2, o3);
        P3.set(p3, o3);

        const big = Math.random() < 0.035;
        R[o4] = (i + Math.random() * 0.6) / per;
        R[o4 + 1] = 0.7 + Math.random() * 0.6;
        R[o4 + 2] = big
          ? 0.42 + Math.random() * 0.22
          : 0.09 + Math.random() * Math.random() * 0.24;
        R[o4 + 3] = side > 0 ? 1 : 0;

        J[o3] = (Math.random() - 0.5) * 0.14;
        J[o3 + 1] = (Math.random() - 0.5) * 0.14;
        J[o3 + 2] = (Math.random() - 0.5) * 0.14;

        W[o4] = wAmp;
        W[o4 + 1] = wFreq;
        W[o4 + 2] = wPh;
        W[o4 + 3] = Math.random();

        k += 1;
      }
    }
  });

  return { n, position, P0, P1, P2, P3, R, J, W };
}

const streamVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uFlow;
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uBlush;

  attribute vec3 aP0;
  attribute vec3 aP1;
  attribute vec3 aP2;
  attribute vec3 aP3;
  attribute vec4 aR;
  attribute vec3 aJ;
  attribute vec4 aW;

  varying vec3 vColor;
  varying float vAlpha;

  vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
    float it = 1.0 - t;
    return it * it * it * a + 3.0 * it * it * t * b + 3.0 * it * t * t * c + t * t * t * d;
  }

  void main() {
    float u = fract(aR.x + uTime * uFlow * aR.y);
    float t = pow(u, 1.45);

    vec3 pos = bez(aP0, aP1, aP2, aP3, t);

    float env = pow(1.0 - t, 0.9);
    pos.y += sin(t * aW.y * 3.14159 + aW.z + uTime * 0.35) * aW.x * env;
    pos.z += cos(t * aW.y * 2.5 + aW.z * 1.7 + uTime * 0.27) * aW.x * 0.8 * env;
    pos += aJ * (0.4 + env * 2.4);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv = mousePush(mv, 0.2, 0.16);

    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    float mask = textMask(ndc);

    float fade = smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.9, 1.0, u));
    float depth = clamp((-mv.z - 16.0) / 40.0, 0.0, 1.0);

    gl_PointSize = aR.z * uPixelRatio * (300.0 / -mv.z) * (0.55 + 0.95 * t) * mix(1.0, 0.7, depth) * uIntro;

    vec3 side = mix(uCool, uWarm, aR.w);
    vec3 col = mix(side, uBlush, smoothstep(0.62, 1.0, t) * 0.85);
    col *= 0.65 + 0.6 * t;

    vColor = col;
    vAlpha = fade * mix(uDim, 1.0, mask) * mix(1.0, 0.6, depth) * uIntro;

    gl_Position = clip;
  }
`;

const dotFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.15, d) * 0.6;
    float a = (core + glow) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function Streams({ shared, strands, per }) {
  const data = useMemo(() => buildStreams(strands, per), [strands, per]);

  const uniforms = useMemo(
    () => ({
      ...shared.common,
      uFlow: { value: FLOW_SPEED },
      uCool: shared.uCool,
      uWarm: shared.uWarm,
      uBlush: shared.uBlush,
    }),
    [shared],
  );

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.position, 3]}
        />
        <bufferAttribute attach="attributes-aP0" args={[data.P0, 3]} />
        <bufferAttribute attach="attributes-aP1" args={[data.P1, 3]} />
        <bufferAttribute attach="attributes-aP2" args={[data.P2, 3]} />
        <bufferAttribute attach="attributes-aP3" args={[data.P3, 3]} />
        <bufferAttribute attach="attributes-aR" args={[data.R, 4]} />
        <bufferAttribute attach="attributes-aJ" args={[data.J, 3]} />
        <bufferAttribute attach="attributes-aW" args={[data.W, 4]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={streamVert}
        fragmentShader={dotFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* =========================================================
   3. CORE  (helix -> torus knot -> sphere)
   ========================================================= */

function genHelix(count) {
  const pts = new Float32Array(count * 3);
  const turns = 4.5;
  const radius = 6.5;
  const height = 16;

  for (let i = 0; i < count; i += 1) {
    const strand = i % 2;
    const t = i / count;
    const angle = t * Math.PI * 2 * turns + (strand ? Math.PI : 0);
    const r = radius + Math.sin(t * Math.PI * 6) * 0.4;

    pts[i * 3] = Math.cos(angle) * r;
    pts[i * 3 + 1] = (t - 0.5) * height;
    pts[i * 3 + 2] = Math.sin(angle) * r;
  }

  return pts;
}

function genTorusKnot(count) {
  const pts = new Float32Array(count * 3);
  const p = 2;
  const q = 3;
  const R = 6.2;
  const tubeR = 2.1;

  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2;
    const r = R + tubeR * Math.cos(q * t);

    pts[i * 3] = r * Math.cos(p * t) + (Math.random() - 0.5) * 1.1;
    pts[i * 3 + 1] = r * Math.sin(p * t) + (Math.random() - 0.5) * 1.1;
    pts[i * 3 + 2] =
      tubeR * Math.sin(q * t) * 2.2 + (Math.random() - 0.5) * 1.1;
  }

  return pts;
}

function genSphere(count) {
  const pts = new Float32Array(count * 3);
  const radius = 9;
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const jitter = 0.94 + Math.random() * 0.12;

    pts[i * 3] = Math.cos(theta) * r * radius * jitter;
    pts[i * 3 + 1] = y * radius * jitter;
    pts[i * 3 + 2] = Math.sin(theta) * r * radius * jitter;
  }

  return pts;
}

// Brand palette only: crimson, rose, wine, blush, plus a little cool cyan
const CORE_PALETTE = [
  { c: [0.95, 0.1, 0.25], w: 0.34 }, // crimson
  { c: [0.8, 0.24, 0.4], w: 0.24 }, // rose
  { c: [0.42, 0.03, 0.13], w: 0.16 }, // wine
  { c: [1.0, 0.82, 0.86], w: 0.14 }, // blush
  { c: [0.12, 0.62, 0.78], w: 0.12 }, // cyan
];

function genCoreColors(count) {
  const out = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    let roll = Math.random();
    let pick = CORE_PALETTE[0];

    for (const entry of CORE_PALETTE) {
      if (roll <= entry.w) {
        pick = entry;
        break;
      }
      roll -= entry.w;
    }

    out.set(pick.c, i * 3);
  }

  return out;
}

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const coreVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uProgress;

  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = mix(aFrom, aTo, uProgress);

    pos.x += sin(uTime * 0.6 + aSeed * 6.2831) * 0.15;
    pos.y += cos(uTime * 0.5 + aSeed * 6.2831) * 0.15;
    pos.z += sin(uTime * 0.4 + aSeed * 6.2831) * 0.12;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv = mousePush(mv, 0.22, 0.2);

    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    float mask = textMask(ndc);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + aSeed * 10.0);
    float depth = clamp((-mv.z - 22.0) / 22.0, 0.0, 1.0);

    gl_PointSize = aSize * pulse * uPixelRatio * (300.0 / -mv.z) * mix(1.0, 0.75, depth) * uIntro;

    vColor = aColor * mix(1.0, 0.6, depth);
    vAlpha = mix(uDim, 1.0, mask) * uIntro;

    gl_Position = clip;
  }
`;

function Core({ shared, count, reduced }) {
  const groupRef = useRef(null);
  const pointsRef = useRef(null);
  const matRef = useRef(null);

  const state = useRef({ shape: 0, progress: 1, timer: 0 });

  const shapes = useMemo(
    () => [genHelix(count), genTorusKnot(count), genSphere(count)],
    [count],
  );

  const colors = useMemo(() => genCoreColors(count), [count]);

  const sizes = useMemo(() => {
    const a = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      a[i] =
        Math.random() < 0.05
          ? 1.0 + Math.random() * 0.4
          : 0.34 + Math.random() * 0.3;
    }
    return a;
  }, [count]);

  const seeds = useMemo(
    () => Float32Array.from({ length: count }, Math.random),
    [count],
  );

  const fromAttr = useRef(shapes[0].slice());
  const toAttr = useRef(shapes[0].slice());

  const uniforms = useMemo(
    () => ({ ...shared.common, uProgress: { value: 1 } }),
    [shared],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = state.current;

    if (groupRef.current && !reduced) {
      groupRef.current.rotation.y += dt * CORE_ROTATION_SPEED;
    }

    if (reduced) return;

    s.timer += dt;

    if (s.progress < 1) {
      s.progress = Math.min(1, s.progress + dt / MORPH_DURATION);
      uniforms.uProgress.value = easeInOutCubic(s.progress);
    } else if (s.timer > CYCLE_INTERVAL) {
      s.timer = 0;
      s.shape = (s.shape + 1) % shapes.length;

      fromAttr.current.set(toAttr.current);
      toAttr.current.set(shapes[s.shape]);

      const g = pointsRef.current.geometry;
      g.attributes.aFrom.needsUpdate = true;
      g.attributes.aTo.needsUpdate = true;

      s.progress = 0;
      uniforms.uProgress.value = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shapes[0], 3]} />
          <bufferAttribute
            attach="attributes-aFrom"
            args={[fromAttr.current, 3]}
          />
          <bufferAttribute attach="attributes-aTo" args={[toAttr.current, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={coreVert}
          fragmentShader={dotFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* =========================================================
   4. ORBITS
   ========================================================= */

const RINGS = [
  { R: 15.5, tilt: 1.22, rot: 0.35, spin: 0.035, head: 0.05, phase: 0.0 },
  { R: 22.0, tilt: 1.02, rot: -0.55, spin: -0.026, head: -0.04, phase: 0.4 },
  { R: 29.0, tilt: 1.3, rot: 0.9, spin: 0.018, head: 0.03, phase: 0.75 },
];

const ringVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uHead;
  uniform float uPhase;

  attribute float aA;

  varying float vT;
  varying float vX;
  varying float vMask;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vX = wp.x;
    vT = fract(aA / 6.28318 - uTime * uHead - uPhase);

    vec4 clip = projectionMatrix * viewMatrix * wp;
    vMask = mix(uDim, 1.0, textMask(clip.xy / clip.w));

    gl_Position = clip;
  }
`;

const ringFrag = /* glsl */ `
  uniform float uIntro;
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uBlush;

  varying float vT;
  varying float vX;
  varying float vMask;

  void main() {
    float tail = pow(1.0 - vT, 7.0);
    float a = (0.07 + 0.9 * tail) * vMask * uIntro;

    vec3 col = mix(uCool, uWarm, smoothstep(-14.0, 14.0, vX));
    col = mix(col, uBlush, tail * 0.7);

    gl_FragColor = vec4(col, a);
  }
`;

function Ring({ shared, cfg, reduced }) {
  const ref = useRef(null);

  const geometry = useMemo(() => {
    const segs = 360;
    const pos = new Float32Array(segs * 3);
    const ang = new Float32Array(segs);

    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * cfg.R;
      pos[i * 3 + 1] = Math.sin(a) * cfg.R;
      pos[i * 3 + 2] = 0;
      ang[i] = a;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aA", new THREE.BufferAttribute(ang, 1));
    return g;
  }, [cfg.R]);

  const uniforms = useMemo(
    () => ({
      ...shared.common,
      uCool: shared.uCool,
      uWarm: shared.uWarm,
      uBlush: shared.uBlush,
      uHead: { value: cfg.head },
      uPhase: { value: cfg.phase },
    }),
    [shared, cfg],
  );

  useFrame((_, delta) => {
    if (ref.current && !reduced)
      ref.current.rotation.z += Math.min(delta, 0.05) * cfg.spin;
  });

  return (
    <group rotation={[cfg.tilt, 0, cfg.rot]}>
      <lineLoop ref={ref} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={ringVert}
          fragmentShader={ringFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>
    </group>
  );
}

/* =========================================================
   5. DUST + BOKEH  (depth of field)
   ========================================================= */

function buildDust(count, sizeMin, sizeMax, spread) {
  const position = new Float32Array(count * 3);
  const D = new Float32Array(count * 4);
  const C = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    position[i * 3] = (Math.random() - 0.5) * spread[0];
    position[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
    position[i * 3 + 2] = -spread[2] * 0.6 + Math.random() * spread[2];

    D[i * 4] = Math.random();
    D[i * 4 + 1] =
      sizeMin + Math.random() * Math.random() * (sizeMax - sizeMin);
    D[i * 4 + 2] = Math.random();
    D[i * 4 + 3] = 0.5 + Math.random();

    const roll = Math.random();
    const c = roll < 0.55 ? BLUSH : roll < 0.8 ? COOL : WARM;
    C.set(c, i * 3);
  }

  return { position, D, C };
}

const dustVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uBokeh;
  uniform float uHeight;

  attribute vec4 aD;
  attribute vec3 aC;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    p.x += sin(uTime * 0.05 * aD.w + aD.x * 40.0) * 1.4;
    p.y = mod(p.y + uHeight * 0.5 + uTime * (0.10 + 0.12 * aD.w) * (0.4 + uBokeh), uHeight) - uHeight * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;

    float mask = textMask(ndc);
    float tw = 0.6 + 0.4 * sin(uTime * (0.8 + aD.x * 2.0) + aD.x * 50.0);

    float edge = 1.0 - smoothstep(0.8, 1.0, abs(ndc.y));

    gl_PointSize = aD.y * uPixelRatio * (300.0 / -mv.z) * uIntro;

    vColor = aC;
    vAlpha = mix(0.9, 0.11, uBokeh) * tw * mix(uDim + 0.15, 1.0, mask) * uIntro * edge;

    gl_Position = clip;
  }
`;

const dustFrag = /* glsl */ `
  uniform float uBokeh;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a;

    if (uBokeh > 0.5) {
      // soft disc with a brighter rim, like an out-of-focus highlight
      a = smoothstep(0.5, 0.44, d) * (0.35 + 0.65 * smoothstep(0.28, 0.47, d));
    } else {
      a = smoothstep(0.5, 0.0, d);
      a *= a;
    }

    a *= vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function Specks({ shared, count, sizeMin, sizeMax, bokeh }) {
  const spread = bokeh ? [70, 40, 50] : [64, 36, 40];
  const data = useMemo(
    () => buildDust(count, sizeMin, sizeMax, spread),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, sizeMin, sizeMax, bokeh],
  );

  const uniforms = useMemo(
    () => ({
      ...shared.common,
      uBokeh: { value: bokeh ? 1 : 0 },
      uHeight: { value: spread[1] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shared, bokeh],
  );

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.position, 3]}
        />
        <bufferAttribute attach="attributes-aD" args={[data.D, 4]} />
        <bufferAttribute attach="attributes-aC" args={[data.C, 3]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={dustVert}
        fragmentShader={dustFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* =========================================================
   SCENE
   ========================================================= */

function Scene({ cfg, dim, hero, reduced, warm, containerRef }) {
  const shared = useMemo(() => {
    const common = {
      uTime: { value: reduced || warm ? 14 : 0 },
      uIntro: { value: reduced || warm ? 1 : 0 },
      // ...unchanged below
      uPixelRatio: { value: 1 },
      uAspect: { value: 1.78 },
      uMouse: { value: new THREE.Vector2(-10, -10) },
      uTextC: { value: new THREE.Vector2(...TEXT_CENTER) },
      uTextS: { value: new THREE.Vector2(...TEXT_SIZE) },
      uDim: { value: dim },
    };

    return {
      common,
      uTime: common.uTime,
      uIntro: common.uIntro,
      uCool: { value: new THREE.Color(...COOL) },
      uWarm: { value: new THREE.Color(...WARM) },
      uBlush: { value: new THREE.Color(...BLUSH) },
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uHero: { value: hero },
      uPointerSoft: { value: new THREE.Vector2(0, 0) },
    };
  }, [reduced, dim, hero]);

  const target = useRef({ x: 0, y: 0, mx: -10, my: -10 });
  const smooth = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = -(((e.clientY - r.top) / r.height) * 2 - 1);

      target.current.x = Math.max(-1, Math.min(1, x));
      target.current.y = Math.max(-1, Math.min(1, y));
      target.current.mx = x;
      target.current.my = y;
    };

    const onLeave = () => {
      target.current.x = 0;
      target.current.y = 0;
      target.current.mx = -10;
      target.current.my = -10;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [containerRef]);

  const mouseSm = useRef({ x: -10, y: -10 });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const c = shared.common;

    if (!reduced) {
      c.uTime.value += dt;
      c.uIntro.value = Math.min(1, c.uIntro.value + dt / 2.6);
    }

    c.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 1.5);
    c.uAspect.value = state.size.width / state.size.height;
    shared.uRes.value.set(state.size.width, state.size.height);

    // cursor for the repulsion effect
    const t = target.current;
    const k = 1 - Math.exp(-dt * 10);
    mouseSm.current.x += (t.mx - mouseSm.current.x) * k;
    mouseSm.current.y += (t.my - mouseSm.current.y) * k;
    c.uMouse.value.set(mouseSm.current.x, mouseSm.current.y);

    // camera parallax
    const s = smooth.current;
    const kp = 1 - Math.exp(-dt * 2.2);
    s.x += (t.x - s.x) * kp;
    s.y += (t.y - s.y) * kp;

    shared.uPointerSoft.value.set(s.x, s.y);

    const drift = reduced ? 0 : Math.sin(c.uTime.value * 0.12) * 0.5;
    state.camera.position.set(s.x * 1.8, s.y * 1.0, 32 + drift);
    state.camera.lookAt(0, 0, 0);
  }, -1);

  return (
    <>
      <Atmosphere shared={shared} />

      <Specks
        shared={shared}
        count={cfg.bokeh}
        sizeMin={2.5}
        sizeMax={8}
        bokeh
      />
      <Specks shared={shared} count={cfg.dust} sizeMin={0.2} sizeMax={1.0} />

      {cfg.orbits &&
        RINGS.map((ring) => (
          <Ring key={ring.R} shared={shared} cfg={ring} reduced={reduced} />
        ))}

      {cfg.strands > 0 && (
        <Streams shared={shared} strands={cfg.strands} per={cfg.per} />
      )}
      {cfg.core > 0 && (
        <Core shared={shared} count={cfg.core} reduced={reduced} />
      )}

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.32}
          luminanceSmoothing={0.3}
          mipmapBlur
          radius={0.7}
        />
      </EffectComposer>
    </>
  );
}

/* =========================================================
   PUBLIC COMPONENT
   ========================================================= */

export default function HeroBackdrop({
  variant = "hero",
  className,
  running = true,
}) {
  const hostRef = useRef(null);

  const ambient = variant === "ambient";
  const cfg = useMemo(
    () => (ambient ? AMBIENT_TIERS : TIERS)[getTier()],
    [ambient],
  );
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Mount once when first near; inView only pauses/resumes the loop.
  const { near, inView, epoch, onCreated } = useLazyCanvas(hostRef);
  const live = running && inView;
  const [ready, setReady] = useState(false);

  const handleCreated = useCallback(
    (state) => {
      onCreated(state);
      setReady(true);
      state.invalidate(); // paint one frame even if we start paused
    },
    [onCreated],
  );

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`${className ?? "hero-backdrop"}${ready ? " is-live" : ""}`}
    >
      {near && (
        <Canvas
          key={epoch}
          onCreated={handleCreated}
          dpr={ambient ? [1, 1.25] : [1, 1.5]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{ position: [0, 0, 32], fov: 50, near: 0.1, far: 200 }}
          frameloop={reduced ? "demand" : live ? "always" : "never"}
        >
          <Scene
            cfg={cfg}
            dim={ambient ? 0.7 : TEXT_DIM}
            hero={ambient ? 0.25 : 1}
            reduced={reduced}
            warm={ambient}
            containerRef={hostRef}
          />
        </Canvas>
      )}
    </div>
  );
}
