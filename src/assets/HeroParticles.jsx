import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* =========================================================
   TUNABLES
   ========================================================= */

const MORPH_DURATION = 2.4;
const CYCLE_INTERVAL = 6.5;

// X-axis rotation speed.
// ~1.08 rad/sec = approximately one full rotation every 5.8 sec.
const X_ROTATION_SPEED = 1.08;

// Mouse disturbance.
const MOUSE_SMOOTHING = 0.16;
const MOUSE_RADIUS = 0.15;
const MOUSE_STRENGTH = 0.2;

/* =========================================================
   QUALITY
   ========================================================= */

function getQualityTier() {
  if (typeof window === "undefined") return "high";

  const w = window.innerWidth;

  if (w < 640) return "low";
  if (w < 1100) return "mid";

  return "high";
}

const TIER_SETTINGS = {
  low: {
    count: 2000,
    stars: 700,
  },

  mid: {
    count: 3600,
    stars: 1400,
  },

  high: {
    count: 5200,
    stars: 2200,
  },
};

/* =========================================================
   SHAPE GENERATORS
   ========================================================= */

function genHelix(count) {
  const pts = new Float32Array(count * 3);

  const turns = 4.5;
  const radius = 6.5;
  const height = 16;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;

    const strand = i % 2;

    const t = i / count;

    const angle = t * Math.PI * 2 * turns + (strand ? Math.PI : 0);

    const y = (t - 0.5) * height;

    const r = radius + Math.sin(t * Math.PI * 6) * 0.4;

    pts[i3] = Math.cos(angle) * r;
    pts[i3 + 1] = y;
    pts[i3 + 2] = Math.sin(angle) * r;
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
    const i3 = i * 3;

    const t = (i / count) * Math.PI * 2;

    const r = R + tubeR * Math.cos(q * t);

    const x = r * Math.cos(p * t) + (Math.random() - 0.5) * 1.1;

    const y = r * Math.sin(p * t) + (Math.random() - 0.5) * 1.1;

    const z = tubeR * Math.sin(q * t) * 2.2 + (Math.random() - 0.5) * 1.1;

    pts[i3] = x;
    pts[i3 + 1] = y;
    pts[i3 + 2] = z;
  }

  return pts;
}

function genSphere(count) {
  const pts = new Float32Array(count * 3);

  const radius = 9;

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;

    const y = 1 - (i / Math.max(1, count - 1)) * 2;

    const r = Math.sqrt(Math.max(0, 1 - y * y));

    const theta = goldenAngle * i;

    const jitter = 0.94 + Math.random() * 0.12;

    pts[i3] = Math.cos(theta) * r * radius * jitter;

    pts[i3 + 1] = y * radius * jitter;

    pts[i3 + 2] = Math.sin(theta) * r * radius * jitter;
  }

  return pts;
}

/* =========================================================
   COLORS
   ========================================================= */

function genColors(count) {
  const palette = [
    [0.85, 0.08, 0.22],
    [0.55, 0.1, 0.3],
    [0.12, 0.55, 0.7],
    [0.95, 0.55, 0.05],
  ];

  const weights = [0.4, 0.28, 0.3, 0.02];

  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const roll = Math.random();

    let idx = 0;
    let acc = 0;

    for (let w = 0; w < weights.length; w += 1) {
      acc += weights[w];

      if (roll <= acc) {
        idx = w;
        break;
      }
    }

    const c = palette[idx];

    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }

  return colors;
}

/* =========================================================
   PARTICLE SIZE
   ========================================================= */

function genSizes(count) {
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    sizes[i] =
      Math.random() < 0.06
        ? 1.5 + Math.random() * 0.002
        : 0.6 + Math.random() * 0.002;
  }

  return sizes;
}

/* =========================================================
   RANDOM SEEDS
   ========================================================= */

function genSeeds(count) {
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    seeds[i] = Math.random();
  }

  return seeds;
}

/* =========================================================
   EASING
   ========================================================= */

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/* =========================================================
   VERTEX SHADER
   ========================================================= */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  // Mouse in normalized device coordinates.
  uniform vec2 uMouse;

  // Mouse disturbance settings.
  uniform float uMouseRadius;
  uniform float uMouseStrength;

  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vSeed;

  void main() {

    // ---------------------------------------
    // MORPHING POSITION
    // ---------------------------------------

    vec3 pos =
      mix(
        aFrom,
        aTo,
        uProgress
      );

    // ---------------------------------------
    // NATURAL PARTICLE MOTION
    // ---------------------------------------

    pos.x +=
      sin(
        uTime * 0.6 +
        aSeed * 6.2831
      ) * 0.15;

    pos.y +=
      cos(
        uTime * 0.5 +
        aSeed * 6.2831
      ) * 0.15;

    pos.z +=
      sin(
        uTime * 0.4 +
        aSeed * 6.2831
      ) * 0.12;

    // ---------------------------------------
    // WORLD -> VIEW
    // ---------------------------------------

    vec4 mvPosition =
      modelViewMatrix *
      vec4(pos, 1.0);

    // ---------------------------------------
    // PROJECT INTO SCREEN SPACE
    // ---------------------------------------

    vec4 clipPosition =
      projectionMatrix *
      mvPosition;

    vec2 ndc =
      clipPosition.xy /
      clipPosition.w;

    // Difference between the particle and mouse.
    vec2 mouseDelta =
      ndc - uMouse;

    float mouseDistance =
      length(mouseDelta);

    // ---------------------------------------
    // MOUSE REPULSION
    // ---------------------------------------

    if (
      mouseDistance <
      uMouseRadius
    ) {

      float influence =
        1.0 -
        mouseDistance /
        uMouseRadius;

      // Smooth cubic falloff.
      influence =
        influence *
        influence *
        influence;

      vec2 direction;

      if (
        mouseDistance >
        0.0001
      ) {

        direction =
          mouseDelta /
          mouseDistance;

      } else {

        direction =
          vec2(0.0);

      }

      // Screen-space displacement.
      vec2 offsetNDC =
        direction *
        influence *
        uMouseStrength;

      // Convert NDC displacement
      // back into view-space movement.
      //
      // This makes the effect work correctly
      // with the perspective camera and with
      // the X-axis rotation.
      mvPosition.x +=
        offsetNDC.x *
        (-mvPosition.z) /
        projectionMatrix[0][0];

      mvPosition.y +=
        offsetNDC.y *
        (-mvPosition.z) /
        projectionMatrix[1][1];
    }

    // ---------------------------------------
    // PARTICLE PULSE
    // ---------------------------------------

    float pulse =
      0.85 +
      0.15 *
      sin(
        uTime * 2.0 +
        aSeed * 10.0
      );

    // ---------------------------------------
    // POINT SIZE
    // ---------------------------------------

    gl_PointSize =
      aSize *
      pulse *
      uPixelRatio *
      (300.0 / -mvPosition.z);

    // ---------------------------------------
    // FINAL POSITION
    // ---------------------------------------

    gl_Position =
      projectionMatrix *
      mvPosition;

    vColor = aColor;
    vSeed = aSeed;
  }
`;

/* =========================================================
   FRAGMENT SHADER
   ========================================================= */

const fragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vColor;
  varying float vSeed;

  vec3 hueShift(
    vec3 c,
    float h
  ) {

    const vec3 k =
      vec3(0.57735);

    float cosA =
      cos(h);

    float sinA =
      sin(h);

    return
      c * cosA +
      cross(k, c) * sinA +
      k *
      dot(k, c) *
      (1.0 - cosA);
  }

  void main() {

    vec2 uv =
      gl_PointCoord -
      0.5;

    float d =
      length(uv);

    // Core.
    float core =
      smoothstep(
        0.5,
        0.0,
        d
      );

    // Glow.
    float glow =
      smoothstep(
        0.5,
        0.15,
        d
      ) * 0.6;

    float alpha =
      core +
      glow;

    if (
      alpha < 0.02
    ) {
      discard;
    }

    // Slow hue movement.
    vec3 color =
      hueShift(
        vColor,
        sin(
          uTime * 0.15 +
          vSeed * 3.0
        ) * 0.12
      );

    gl_FragColor =
      vec4(
        color,
        alpha
      );
  }
`;

/* =========================================================
   MAIN FIELD
   ========================================================= */

function MorphingField({ count }) {
  const groupRef = useRef(null);

  const pointsRef = useRef(null);

  const materialRef = useRef(null);

  // Smoothed mouse position.
  const pointer = useRef({
    x: -10,
    y: -10,
  });

  const target = useRef({
    x: -10,
    y: -10,
  });

  // Morph state.
  const shapeIndex = useRef(0);

  const progress = useRef(1);

  const cycleTimer = useRef(0);

  const reducedMotion = useRef(false);

  // ---------------------------------------
  // SHAPES
  // ---------------------------------------

  const shapes = useMemo(
    () => [genHelix(count), genTorusKnot(count), genSphere(count)],
    [count],
  );

  // ---------------------------------------
  // PARTICLE DATA
  // ---------------------------------------

  const colors = useMemo(() => genColors(count), [count]);

  const sizes = useMemo(() => genSizes(count), [count]);

  const seeds = useMemo(() => genSeeds(count), [count]);

  // ---------------------------------------
  // MORPH BUFFERS
  // ---------------------------------------

  const fromAttr = useRef(shapes[0].slice());

  const toAttr = useRef(shapes[0].slice());

  // ---------------------------------------
  // SHADER UNIFORMS
  // ---------------------------------------

  const uniforms = useMemo(
    () => ({
      uTime: {
        value: 0,
      },

      uProgress: {
        value: 1,
      },

      uPixelRatio: {
        value: 1,
      },

      uMouse: {
        value: new THREE.Vector2(-10, -10),
      },

      uMouseRadius: {
        value: MOUSE_RADIUS,
      },

      uMouseStrength: {
        value: MOUSE_STRENGTH,
      },
    }),
    [],
  );

  /* =======================================================
     MOUSE
     ======================================================= */

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (materialRef.current) {
      materialRef.current.uniforms.uPixelRatio.value = Math.min(
        window.devicePixelRatio || 1,
        1.5,
      );
    }

    const handleMove = (event) => {
      target.current.x = (event.clientX / window.innerWidth) * 2 - 1;

      target.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    const handleLeave = () => {
      target.current.x = -10;
      target.current.y = -10;
    };

    window.addEventListener("pointermove", handleMove, {
      passive: true,
    });

    window.addEventListener("pointerleave", handleLeave);

    return () => {
      window.removeEventListener("pointermove", handleMove);

      window.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  /* =======================================================
     ANIMATION
     ======================================================= */

  useFrame((_, delta) => {
    const mat = materialRef.current;

    if (!mat) return;

    // -----------------------------------
    // TIME
    // -----------------------------------

    mat.uniforms.uTime.value += delta;

    // -----------------------------------
    // SMOOTH MOUSE
    // -----------------------------------

    pointer.current.x +=
      (target.current.x - pointer.current.x) * MOUSE_SMOOTHING;

    pointer.current.y +=
      (target.current.y - pointer.current.y) * MOUSE_SMOOTHING;

    mat.uniforms.uMouse.value.set(pointer.current.x, pointer.current.y);

    // -----------------------------------
    // X-AXIS ROTATION
    // -----------------------------------

    if (groupRef.current && !reducedMotion.current) {
      groupRef.current.rotation.y += delta * X_ROTATION_SPEED;
    }

    // -----------------------------------
    // REDUCED MOTION
    // -----------------------------------

    if (reducedMotion.current) {
      return;
    }

    // -----------------------------------
    // MORPH TIMER
    // -----------------------------------

    cycleTimer.current += delta;

    // -----------------------------------
    // MORPHING
    // -----------------------------------

    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / MORPH_DURATION);

      mat.uniforms.uProgress.value = easeInOutCubic(progress.current);
    }

    // -----------------------------------
    // START NEXT SHAPE
    // -----------------------------------
    else if (cycleTimer.current > CYCLE_INTERVAL) {
      cycleTimer.current = 0;

      shapeIndex.current = (shapeIndex.current + 1) % shapes.length;

      // Current target becomes
      // the next starting shape.
      fromAttr.current.set(toAttr.current);

      // New target shape.
      toAttr.current.set(shapes[shapeIndex.current]);

      const geometry = pointsRef.current.geometry;

      geometry.attributes.aFrom.needsUpdate = true;

      geometry.attributes.aTo.needsUpdate = true;

      progress.current = 0;

      mat.uniforms.uProgress.value = 0;
    }
  });

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
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
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* =========================================================
   PUBLIC COMPONENT
   ========================================================= */

export default function HeroParticles() {
  const tier = useMemo(getQualityTier, []);

  const { count, stars } = TIER_SETTINGS[tier];

  return (
    <div className="hero-particles" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{
          position: [0, 0, 32],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
      >
        {/* ----------------------------------
            BACKGROUND STARS
        ---------------------------------- */}

        <Stars
          radius={25}
          depth={20}
          count={stars}
          factor={2.2}
          saturation={0}
          fade
          speed={0.4}
        />

        {/* ----------------------------------
            MAIN PARTICLE FIELD
        ---------------------------------- */}

        <MorphingField count={count} />

        {/* ----------------------------------
            BLOOM
        ---------------------------------- */}

        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.9}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.4}
            mipmapBlur
            radius={0.6}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
