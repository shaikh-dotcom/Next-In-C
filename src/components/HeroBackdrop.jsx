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

   One WebGL scene behind the hero. The look is a "quantum knot"
   at the heart of a river of light:

     1. Atmosphere   deep teal nebula upper left, crimson nebula
                     lower right, near-black in the middle
     2. Streams      fine, evenly dotted strands that sweep in
                     from both sides and pinch into the knot
     3. Knot         a dense stippled (2,3) torus knot, lit from
                     a cool key light and a crimson fill, with a
                     pulse of light that travels along the tube
     4. Orbits       dotted, tilted rings carrying comets
     5. Dust/Bokeh   depth-of-field particles and soft coloured
                     bokeh discs around the edges
     6. Bloom        (grain + vignette live in Hero.css)

   Everything that sits behind the headline is dimmed by a soft
   "text zone" mask in the shaders, so the copy stays readable
   without outlines or heavy scrims.
   ========================================================= */

/* =========================================================
   TUNABLES
   ========================================================= */

// Colours (linear, 0-1). Cool = left, warm = right, blush = hot core.
const COOL = [0.06, 0.66, 0.84];
const WARM = [1.0, 0.12, 0.29];
const BLUSH = [1.0, 0.85, 0.9];

// Where the headline / copy sits, in normalised device coords.
// Particles inside this box are dimmed to TEXT_DIM (the knot uses
// CORE_DIM so it stays a little more present behind the copy).
const TEXT_CENTER = [0.0, 0.14];
const TEXT_SIZE = [0.44, 0.58];
const TEXT_DIM = 0.3;
const CORE_DIM = 1;

// Knot: a (2,3) torus knot swept with a thick tube.
const KNOT_SCALE = 3.0; // world units; silhouette is ~3.7x this wide (half)
const KNOT_TUBE = 0.66; // tube radius, in KNOT_SCALE units (max ~0.83)
const KNOT_Z = 1.25; // how far the tube weaves in and out of the plane
const KNOT_SPIN = 0.05; // rad / sec, in-plane spin
const KNOT_PULSE_SPEED = 0.07; // laps / sec of the travelling light

// Where the streams pinch into the knot (world x, each side)
const NECK_X = KNOT_SCALE * 4.75;

// Streams: how fast dots travel toward the knot (1 = ~11s trip)
const FLOW_SPEED = 0.06;

const TIERS = {
  low: {
    core: 24000,
    strands: 22,
    per: 70,
    dust: 500,
    bokeh: 8,
    orbits: 3,
  },
  mid: {
    core: 42000,
    strands: 36,
    per: 100,
    dust: 900,
    bokeh: 14,
    orbits: 5,
  },
  high: {
    core: 70000,
    strands: 78,
    per: 130,
    dust: 1500,
    bokeh: 20,
    orbits: 5,
  },
};

// "ambient" is the quiet version used behind every section below the
// hero (see SiteBackdrop.jsx): haze, dust, bokeh and bloom only.
const AMBIENT_TIERS = {
  low: { core: 0, strands: 0, per: 0, dust: 300, bokeh: 4, orbits: 0 },
  mid: { core: 0, strands: 0, per: 0, dust: 550, bokeh: 8, orbits: 0 },
  high: { core: 0, strands: 0, per: 0, dust: 800, bokeh: 12, orbits: 0 },
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
  uniform float uViewScale;
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

    // Hero only (hb = 1 in the hero layer, 0 in the ambient layer)
    float hb = clamp((uHero - 0.25) / 0.75, 0.0, 1.0);

    // hero haze leans true crimson rather than pink
    vec3 warmH = mix(uWarm, vec3(0.85, 0.06, 0.1), hb * 0.7);

    // Light sources
    float cool = exp(-pow(length((p - vec2(-0.95, 0.30)) * vec2(0.85, 1.25)), 1.4) * 1.9);
    float warm = exp(-pow(length((p - vec2(0.90, -0.26)) * vec2(0.85, 1.2)), 1.4) * 1.75);
    float core = exp(-length((p - vec2(0.0, 0.04)) * vec2(0.75, 1.0)) * 2.7);

    vec3 col = vec3(0.0006, 0.0008, 0.0018);
    col += uCool * cool * (0.30 + 1.15 * smoke) * 0.05 * (1.0 - 0.55 * hb);
    col += warmH * warm * (0.30 + 1.25 * smoke) * 0.07 * (1.0 - 0.55 * hb);

    // Hero nebulae: a teal cloud upper left and a crimson one lower
    // right, with a dark, quiet middle for the knot to sit in
    float cloud = fbm(p * 1.1 + q * 1.4 + vec2(3.1, 7.7) + t * 0.6);
    float coolCloud = exp(-length((p - vec2(-0.75, 0.42)) * vec2(0.7, 1.0)) * 2.1);
    float warmCloud = exp(-length((p - vec2(0.85, -0.42)) * vec2(0.65, 1.0)) * 1.8);
    col += uCool * coolCloud * (0.25 + 1.4 * cloud * cloud) * 0.05 * hb;
    col += warmH * warmCloud * (0.2 + 1.6 * cloud) * 0.055 * hb;
    col += vec3(0.34, 0.03, 0.10) * core * (0.35 + smoke) * mix(0.035, 0.06, hb) * uHero;

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

   Evenly spaced dots riding cubic curves from the screen edges
   into the knot. Every dot on a strand shares one speed, so each
   strand stays a crisp dotted line while it flows. Neighbouring
   strands share a wave phase, so the bundle undulates as one
   sheet, then pinches into a bright rope at the knot.
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

      // golden-ratio depth layers: neighbours sit at different depths,
      // so some strands are crisp and some drift out of focus
      const layer = ((s * 0.61803 + (side > 0 ? 0.31 : 0)) % 1) - 0.5;
      const zr = layer * 22 + (Math.random() - 0.5) * 2;

      const spread = 12.5 * (0.93 + Math.random() * 0.14);

      const p0 = [side * (46 + Math.random() * 3), ss * spread, zr];
      const p1 = [
        side * (30 + Math.random() * 2),
        ss * spread * 0.78,
        zr * 0.85,
      ];
      const p2 = [
        side * (13 + Math.random() * 1.5),
        ss * 2.7 + (Math.random() - 0.5) * 0.6,
        zr * 0.35,
      ];
      const p3 = [
        side * (NECK_X + (Math.random() - 0.5) * 0.9),
        ss * 0.6 + (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 1.8,
      ];

      // 0 = cyan, 1 = crimson. Left fan: cyan on top, crimson below.
      // Right fan: the other way round. A little noise per strand.
      const mixv = Math.min(
        1,
        Math.max(0, 0.5 + 0.5 * ss * side + (Math.random() - 0.5) * 0.35),
      );

      const speed = 0.75 + Math.random() * 0.5;
      const phase = Math.random();

      const wAmp = 0.3 + Math.random() * 0.6;
      const wFreq = 2.1 + (Math.random() - 0.5) * 0.4;
      const wPh = ss * 1.3 + side * 0.9 + (Math.random() - 0.5) * 0.3;

      const focus = Math.abs(zr) > 7 ? 1.25 : 1;

      for (let i = 0; i < per; i += 1) {
        const o3 = k * 3;
        const o4 = k * 4;

        P0.set(p0, o3);
        P1.set(p1, o3);
        P2.set(p2, o3);
        P3.set(p3, o3);

        const big = Math.random() < 0.04;
        R[o4] = (i + phase) / per;
        R[o4 + 1] = speed;
        R[o4 + 2] =
          (big
            ? 0.3 + Math.random() * 0.14
            : 0.1 + Math.random() * Math.random() * 0.12) * focus;
        R[o4 + 3] = mixv;

        J[o3] = (Math.random() - 0.5) * 0.06;
        J[o3 + 1] = (Math.random() - 0.5) * 0.06;
        J[o3 + 2] = (Math.random() - 0.5) * 0.06;

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

    // dots bunch up as they near the knot
    float t = 1.0 - pow(1.0 - u, 1.7);

    vec3 pos = bez(aP0, aP1, aP2, aP3, t);

    float env = pow(1.0 - t, 0.9);
    pos.y += sin(t * aW.y * 3.14159 + aW.z + uTime * 0.35) * aW.x * env;
    pos.z += cos(t * aW.y * 2.5 + aW.z * 1.7 + uTime * 0.27) * aW.x * 0.8 * env;
    pos += aJ * (0.3 + env * 0.8);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv = mousePush(mv, 0.2, 0.16);

    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    float mask = textMask(ndc);

    float fade = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.93, 1.0, u));
    float depth = clamp((-mv.z - 16.0) / 40.0, 0.0, 1.0);

    float px = aR.z * uPixelRatio * uViewScale * (300.0 / -mv.z) * (0.6 + 0.9 * t) * mix(1.0, 0.75, depth) * uIntro;
    float floorPx = 1.0 * uPixelRatio;
    gl_PointSize = max(px, floorPx);

    vec3 side = mix(uCool, uWarm, aR.w);
    vec3 col = mix(side, uBlush, smoothstep(0.6, 1.0, t) * 0.4);
    col *= 0.6 + 0.55 * t;

    vColor = col;
    vAlpha = fade * mix(uDim, 1.0, mask) * mix(1.0, 0.6, depth) * (0.6 + 0.4 * t) * sqrt(min(1.0, px / floorPx)) * uIntro;

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
   3. KNOT  (stippled torus knot, lit in the vertex shader)

   Points are scattered over the surface of a thick tube swept
   along a (2,3) torus knot, evenly by arc length. Each point
   carries its surface normal, so the vertex shader can light it:
   a cool key from the upper left, a crimson fill from the lower
   right, a rim, and darker back faces for depth. A fine helical
   grain in the point density gives the tube a woven texture.
   ========================================================= */

function buildKnot(count) {
  const S = KNOT_SCALE;
  const rho = KNOT_TUBE * S;
  const TAU = Math.PI * 2;

  const curve = (t) => {
    const r = 2 + Math.cos(3 * t);
    return [
      S * r * Math.cos(2 * t),
      S * r * Math.sin(2 * t),
      S * KNOT_Z * Math.sin(3 * t),
    ];
  };

  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  // arc-length table so points are spread evenly along the tube
  const N = 2048;
  const cum = new Float32Array(N + 1);
  let prev = curve(0);
  for (let i = 1; i <= N; i += 1) {
    const cur = curve((i / N) * TAU);
    cum[i] =
      cum[i - 1] +
      Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
    prev = cur;
  }
  const total = cum[N];

  const tAt = (u) => {
    const target = u * total;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const f = (target - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    return ((lo + f) / N) * TAU;
  };

  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const attr = new Float32Array(count * 4); // seed, size, inner, t

  const eps = 1e-3;
  let k = 0;

  while (k < count) {
    const t = tAt(Math.random());
    const phi = Math.random() * TAU;

    // fine helical grain in the point density
    const grain = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(phi * 3 + t * 18));
    if (Math.random() > grain) continue;

    const p = curve(t);
    const pp = curve(t + eps);
    const pm = curve(t - eps);

    const T = norm([pp[0] - pm[0], pp[1] - pm[1], pp[2] - pm[2]]);
    const acc = [
      pp[0] - 2 * p[0] + pm[0],
      pp[1] - 2 * p[1] + pm[1],
      pp[2] - 2 * p[2] + pm[2],
    ];
    const d = acc[0] * T[0] + acc[1] * T[1] + acc[2] * T[2];
    const Nn = norm([acc[0] - T[0] * d, acc[1] - T[1] * d, acc[2] - T[2] * d]);
    const B = [
      T[1] * Nn[2] - T[2] * Nn[1],
      T[2] * Nn[0] - T[0] * Nn[2],
      T[0] * Nn[1] - T[1] * Nn[0],
    ];

    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const n = [
      Nn[0] * cp + B[0] * sp,
      Nn[1] * cp + B[1] * sp,
      Nn[2] * cp + B[2] * sp,
    ];

    // most points on the skin, some just under it for glow
    const inner = Math.random() < 0.18;
    const rf = inner
      ? 0.35 + Math.random() * 0.5
      : 1 + (Math.random() - 0.5) * 0.05;

    const o3 = k * 3;
    const o4 = k * 4;

    position[o3] = p[0] + n[0] * rho * rf;
    position[o3 + 1] = p[1] + n[1] * rho * rf;
    position[o3 + 2] = p[2] + n[2] * rho * rf;

    normal[o3] = n[0];
    normal[o3 + 1] = n[1];
    normal[o3 + 2] = n[2];

    const spark = Math.random() < 0.03;
    attr[o4] = Math.random();
    attr[o4 + 1] = spark
      ? 0.3 + Math.random() * 0.1
      : 0.14 + Math.random() * Math.random() * 0.16;
    attr[o4 + 2] = inner ? 1 : 0;
    attr[o4 + 3] = t;

    k += 1;
  }

  return { position, normal, attr };
}

const knotVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uBlush;
  uniform float uCoreDim;
  uniform float uPulse;

  attribute vec3 aN;
  attribute vec4 aS; // x seed, y size, z inner, w param along the knot

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position + aN * sin(uTime * 1.3 + aS.x * 6.2831) * 0.03;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv = mousePush(mv, 0.22, 0.2);

    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    float mask = textMask(ndc);

    // view-space normal; the lights stay put while the knot turns
    vec3 n = normalize(normalMatrix * aN);
    float facing = clamp(n.z * 0.5 + 0.5, 0.0, 1.0);

    float key  = max(dot(n, normalize(vec3(-0.70, 0.60, 0.50))), 0.0);
    float fill = max(dot(n, normalize(vec3( 0.75, -0.50, 0.45))), 0.0);
    float rim  = pow(1.0 - abs(n.z), 3.0);

    vec3 base = vec3(0.40, 0.03, 0.09);

    vec3 col = base * (0.25 + 0.75 * facing * facing);
    col += uWarm * pow(fill, 2.0) * 0.65 * facing;
    col += uCool * pow(key, 3.0) * 0.7 * facing;
    col += mix(uWarm, uCool, smoothstep(0.2, 0.8, key)) * rim * 0.35 * (key + 0.25);

    col *= 0.7 + 0.6 * aS.x;
    col *= mix(1.0, 0.5, aS.z);

    // a bead of light circling the knot
    float w = fract(aS.w / 6.28318 - uTime * uPulse);
    float pulse = pow(1.0 - w, 26.0);
    col += uBlush * pulse * 0.9;

    float depth = clamp((-mv.z - 22.0) / 22.0, 0.0, 1.0);

    float px = aS.y * (1.0 + pulse * 0.9) * uPixelRatio * uViewScale * (300.0 / -mv.z) * mix(1.0, 0.8, depth) * uIntro;
    float floorPx = 1.0 * uPixelRatio;
    gl_PointSize = max(px, floorPx);

    vColor = col * mix(1.0, 0.7, depth);
    vAlpha = mix(uCoreDim, 1.0, mask) * (0.18 + 0.72 * pow(facing, 1.3)) * mix(1.0, 0.5, rim) * sqrt(min(1.0, px / floorPx)) * uIntro;

    gl_Position = clip;
  }
`;

const stippleFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.18, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function Core({ shared, count, reduced }) {
  const groupRef = useRef(null);
  const clock = useRef(0);

  const data = useMemo(() => buildKnot(count), [count]);

  const uniforms = useMemo(
    () => ({
      ...shared.common,
      uCool: shared.uCool,
      uWarm: shared.uWarm,
      uBlush: shared.uBlush,
      uCoreDim: { value: CORE_DIM },
      uPulse: { value: KNOT_PULSE_SPEED },
    }),
    [shared],
  );

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    if (reduced) {
      g.rotation.set(0.3, 0.28, 0);
      return;
    }

    clock.current += Math.min(delta, 0.05);
    const t = clock.current;

    // in-plane spin, then a slow sway so the crossings keep changing
    g.rotation.set(
      0.3 + Math.sin(t * 0.21) * 0.16,
      Math.sin(t * 0.17) * 0.5,
      t * KNOT_SPIN,
    );
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[data.position, 3]}
          />
          <bufferAttribute attach="attributes-aN" args={[data.normal, 3]} />
          <bufferAttribute attach="attributes-aS" args={[data.attr, 4]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={knotVert}
          fragmentShader={stippleFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* =========================================================
   4. ORBITS  (dotted rings with comets)
   ========================================================= */

const RINGS = [
  {
    R: 12.8,
    tilt: 0.95,
    rot: 0.45,
    spin: 0.03,
    head: 0.045,
    phase: 0.0,
    comets: 2,
  },
  {
    R: 15.6,
    tilt: 0.55,
    rot: -0.6,
    spin: -0.022,
    head: -0.035,
    phase: 0.35,
    comets: 1,
  },
  {
    R: 18.8,
    tilt: 1.15,
    rot: 1.25,
    spin: 0.018,
    head: 0.03,
    phase: 0.7,
    comets: 2,
  },
  {
    R: 22.5,
    tilt: 0.75,
    rot: -1.05,
    spin: -0.014,
    head: -0.024,
    phase: 0.15,
    comets: 1,
  },
  {
    R: 27.0,
    tilt: 0.42,
    rot: 0.25,
    spin: 0.01,
    head: 0.02,
    phase: 0.55,
    comets: 2,
  },
];

const ringVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uHead;
  uniform float uPhase;
  uniform float uComets;

  attribute float aA;

  varying float vT;
  varying float vX;
  varying float vMask;
  varying float vTail;
  varying float vArc;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vX = wp.x;

    // uComets evenly spaced heads, each trailing a short tail of dots
    vT = fract((aA / 6.28318 - uTime * uHead - uPhase) * uComets);
    vTail = pow(1.0 - vT, 12.0);

    // the ring itself fades in and out along its length
    vArc = 0.35 + 0.65 * (0.5 + 0.5 * sin(aA * 2.0 + uPhase * 9.0));

    vec4 mv = viewMatrix * wp;
    vec4 clip = projectionMatrix * mv;
    vMask = mix(uDim, 1.0, textMask(clip.xy / clip.w));

    gl_PointSize = (1.3 + 4.0 * pow(vTail, 3.0)) * uPixelRatio * uViewScale * (32.0 / -mv.z) * uIntro;

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
  varying float vTail;
  varying float vArc;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float shape = smoothstep(0.5, 0.1, d);

    float a = (0.34 * vArc + 0.9 * vTail) * shape * vMask * uIntro;
    if (a < 0.01) discard;

    vec3 col = mix(uCool, uWarm, smoothstep(-14.0, 14.0, vX));
    col = mix(col, uBlush, vTail * 0.75);

    gl_FragColor = vec4(col, a);
  }
`;

function Ring({ shared, cfg, reduced }) {
  const ref = useRef(null);

  const geometry = useMemo(() => {
    const segs = Math.round(cfg.R * 36);
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
      uComets: { value: cfg.comets },
    }),
    [shared, cfg],
  );

  useFrame((_, delta) => {
    if (ref.current && !reduced)
      ref.current.rotation.z += Math.min(delta, 0.05) * cfg.spin;
  });

  return (
    <group rotation={[cfg.tilt, 0, cfg.rot]}>
      <points ref={ref} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={ringVert}
          fragmentShader={ringFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* =========================================================
   5. DUST + BOKEH  (depth of field)
   ========================================================= */

// Hero bokeh palette: crimson, rose, teal and a little blush
const BOKEH_PALETTE = [
  { c: [1.0, 0.16, 0.3], w: 0.4 },
  { c: [0.95, 0.5, 0.56], w: 0.2 },
  { c: [0.12, 0.66, 0.78], w: 0.25 },
  { c: BLUSH, w: 0.15 },
];

function pickPalette(palette) {
  let roll = Math.random();
  for (const entry of palette) {
    if (roll <= entry.w) return entry.c;
    roll -= entry.w;
  }
  return palette[0].c;
}

function buildDust(count, sizeMin, sizeMax, spread, palette, keepClear) {
  const position = new Float32Array(count * 3);
  const D = new Float32Array(count * 4);
  const C = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    let x = (Math.random() - 0.5) * spread[0];
    let y = (Math.random() - 0.5) * spread[1];

    // keep the busiest depth-of-field discs off the knot
    if (keepClear) {
      for (
        let tries = 0;
        tries < 8 && Math.abs(x) < 10 && Math.abs(y) < 8;
        tries += 1
      ) {
        x = (Math.random() - 0.5) * spread[0];
        y = (Math.random() - 0.5) * spread[1];
      }
    }

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = -spread[2] * 0.6 + Math.random() * spread[2];

    D[i * 4] = Math.random();
    D[i * 4 + 1] =
      sizeMin + Math.random() * Math.random() * (sizeMax - sizeMin);
    D[i * 4 + 2] = Math.random();
    D[i * 4 + 3] = 0.5 + Math.random();

    if (palette) {
      C.set(pickPalette(palette), i * 3);
    } else {
      const roll = Math.random();
      const c = roll < 0.55 ? BLUSH : roll < 0.8 ? COOL : WARM;
      C.set(c, i * 3);
    }
  }

  return { position, D, C };
}

const dustVert = /* glsl */ `
  ${GLSL_COMMON}

  uniform float uBokeh;
  uniform float uBokehAlpha;
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

    gl_PointSize = aD.y * uPixelRatio * uViewScale * (300.0 / -mv.z) * uIntro;

    vColor = aC;
    vAlpha = mix(0.9, uBokehAlpha, uBokeh) * tw * mix(uDim + 0.15, 1.0, mask) * uIntro * edge;

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

function Specks({ shared, count, sizeMin, sizeMax, bokeh, hero }) {
  const spread = bokeh ? [70, 40, 50] : [64, 36, 40];
  const data = useMemo(
    () =>
      buildDust(
        count,
        sizeMin,
        sizeMax,
        spread,
        bokeh && hero ? BOKEH_PALETTE : null,
        bokeh && hero,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, sizeMin, sizeMax, bokeh, hero],
  );

  const uniforms = useMemo(
    () => ({
      ...shared.common,
      uBokeh: { value: bokeh ? 1 : 0 },
      uBokehAlpha: { value: hero ? 0.3 : 0.11 },
      uHeight: { value: spread[1] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shared, bokeh, hero],
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
      uTime: { value: 14 }, // was: reduced || warm ? 14 : 0
      uIntro: { value: 1 },
      uPixelRatio: { value: 1 },
      uViewScale: { value: 1 },
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

    // hero layer only: keep dot sizes proportional to the canvas, and
    // pull the camera back on tall/narrow screens so the knot fits
    const isHero = hero > 0.5;
    const fit = isHero ? Math.max(1, 0.95 / c.uAspect.value) : 1;
    c.uViewScale.value = isHero
      ? Math.min(
          1.6,
          Math.max(0.9, Math.sqrt(state.size.width * state.size.height) / 1100),
        )
      : 1;
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
    state.camera.position.set(s.x * 1.8 * fit, s.y * fit, 32 * fit + drift);
    state.camera.lookAt(0, 0, 0);
  }, -1);

  return (
    <>
      <Atmosphere shared={shared} />

      <Specks
        shared={shared}
        count={cfg.bokeh}
        sizeMin={hero > 0.5 ? 3 : 2.5}
        sizeMax={hero > 0.5 ? 11 : 8}
        bokeh
        hero={hero > 0.5}
      />
      <Specks shared={shared} count={cfg.dust} sizeMin={0.2} sizeMax={1.0} />

      {cfg.orbits > 0 &&
        RINGS.slice(0, cfg.orbits).map((ring) => (
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
          intensity={hero > 0.5 ? 1.0 : 0.85}
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
  const apiRef = useRef(null);

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
      apiRef.current = state;
      setReady(true);
      // Paint a real first frame SYNCHRONOUSLY — advance() works even when
      // frameloop is "never", invalidate() does not (R3F v9).
      try {
        state.advance(performance.now());
      } catch {
        state.invalidate();
      }
    },
    [onCreated],
  );

  // Drive the loop imperatively — never rely on the frameloop prop alone.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    if (reduced) {
      api.setFrameloop("demand");
      api.invalidate();
    } else if (live) {
      api.setFrameloop("always");
      api.invalidate();
    } else {
      // Freeze on the last real frame instead of an empty black canvas.
      api.setFrameloop("never");
      try {
        api.advance(performance.now());
      } catch {
        /* noop */
      }
    }
  }, [live, ready, reduced]);

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
          frameloop="always" // actual mode is owned by the effect above
          dpr={ambient ? [1, 1.25] : [1, 1.5]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{ position: [0, 0, 32], fov: 50, near: 0.1, far: 200 }}
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
