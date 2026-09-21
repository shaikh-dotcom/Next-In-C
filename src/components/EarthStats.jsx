import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import useLazyCanvas from "./useLazyCanvas";

/*
 * Earth stat cards, rendered as refractive glass.
 *
 * Same technique as TechGlass: one shared orthographic WebGL canvas
 * (1 world unit = 100 CSS px) draws each card as a slab of
 * MeshTransmissionMaterial in front of a painted artwork plane.
 * The numbers and labels stay as real DOM on top, so they stay crisp,
 * selectable and accessible.
 *
 * Without WebGL (or while the textures are still being painted) the
 * cards fall back to a flat CSS version of the same look and crossfade
 * into the glass once it is ready.
 */

const PX = 100;
const GAP = 14;

// Artwork texture; aspect is shared with the DOM cards
const TEX_W = 640;
const TEX_H = 416;
const ASPECT = TEX_H / TEX_W;
const RADIUS = 0.14; // corner radius as a share of card height

// Light source per card (fractions of width / height)
const GLOWS = [
  [1, 1],
  [1, 0],
  [0, 1],
  [0.5, 0],
];

/* ---------------------------------------------------------
   THEME: identical to the TechGlass cards.
   RGB strings so alpha can be added in code.
--------------------------------------------------------- */
const THEME = {
  glassTint: "#f2dfe4",
  glassDepth: "#680a22",
  depthDistance: 5,

  base: ["#0c0306", "#1d080d"],

  glowInner: "180, 42, 78",
  glowOuter: "104, 10, 34",

  dots: "255, 220, 228",
  halo: "245, 217, 223",

  lights: {
    key: "#ffffff",
    left: "#ff6b8f",
    right: "#680a22",
    ring: "#ffc2d1",
  },
};
function computeLayout(avail) {
  if (!avail) return null;

  const cardW = Math.max(96, Math.floor((avail - GAP) / 2));
  const cardH = Math.round(cardW * ASPECT);

  return {
    cardW,
    cardH,
    radius: Math.round(cardH * RADIUS),
    gridW: cardW * 2 + GAP,
    gridH: cardH * 2 + GAP,
  };
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------
   Artwork: cool glow from one corner, radar-style rings that
   the glass will bend, a dot matrix that fades with distance,
   and a dark floor so the text always has contrast.
--------------------------------------------------------- */
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintStat(index) {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");

  const [gx, gy] = GLOWS[index % GLOWS.length];
  const glowX = gx * TEX_W;
  const glowY = gy * TEX_H;

  roundedRectPath(ctx, 0, 0, TEX_W, TEX_H, TEX_H * RADIUS);
  ctx.clip();

  // Base
  const base = ctx.createLinearGradient(0, 0, TEX_W * 0.3, TEX_H);
  base.addColorStop(0, THEME.base[0]);
  base.addColorStop(1, THEME.base[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Glow from this card's light source
  const glow = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    TEX_W * 1.05,
  );
  glow.addColorStop(0, `rgba(${THEME.glowInner}, 0.75)`);
  glow.addColorStop(0.35, `rgba(${THEME.glowOuter}, 0.7)`);
  glow.addColorStop(1, `rgba(${THEME.glowOuter}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Concentric rings around the light
  [130, 230, 330, 430].forEach((r, i) => {
    ctx.strokeStyle = `rgba(${THEME.halo}, ${0.15 - i * 0.033})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(glowX, glowY, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Dot matrix, strongest near the light
  const step = 14;
  for (let y = step / 2; y < TEX_H; y += step) {
    for (let x = step / 2; x < TEX_W; x += step) {
      const d = Math.hypot(x - glowX, y - glowY) / (TEX_W * 0.95);
      const a = Math.max(0, 1 - d) * 0.5;
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(${THEME.dots}, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Floor under the text
  const floor = ctx.createLinearGradient(0, TEX_H * 0.4, 0, TEX_H);
  floor.addColorStop(0, "rgba(3, 5, 9, 0)");
  floor.addColorStop(1, "rgba(3, 5, 9, 0.6)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function useStatTextures(count) {
  const [textures, setTextures] = useState([]);

  useEffect(() => {
    const made = Array.from({ length: count }, (_, i) => paintStat(i));
    setTextures(made);
    return () => made.forEach((t) => t.dispose());
  }, [count]);

  return textures;
}

/* ---------------------------------------------------------
   3D pieces
--------------------------------------------------------- */
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

function Slab({ index, position, w, h, texture, pointer, reduced }) {
  const tilt = useRef();
  const state = useRef({ x: 0, y: 0, s: 1 });

  useFrame(({ clock, gl }, delta) => {
    const node = tilt.current;
    if (!node) return;

    let tx = 0;
    let ty = 0;
    let ts = 1;

    if (!reduced) {
      const t = clock.elapsedTime;

      // idle sway so the glass always catches light
      tx = Math.sin(t * 0.7 + index * 1.3) * 0.05;
      ty = Math.cos(t * 0.55 + index * 0.9) * 0.08;

      const p = pointer.current;
      if (p.has) {
        const rect = gl.domElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 + position[0] * PX;
        const cy = rect.top + rect.height / 2 - position[1] * PX;

        ty += clamp1((p.x - cx) / 320) * 0.4;
        tx += clamp1((p.y - cy) / 320) * 0.3;

        if (
          Math.abs(p.x - cx) < (w * PX) / 2 &&
          Math.abs(p.y - cy) < (h * PX) / 2
        ) {
          ts = 1.04;
        }
      }
    }

    const k = 1 - Math.exp(-delta * 6);
    const s = state.current;
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    s.s += (ts - s.s) * k;

    node.rotation.set(s.x, s.y, 0);
    node.scale.setScalar(s.s);
  });

  return (
    <group position={position}>
      {/* Artwork stays put; the glass tilts in front of it */}
      <mesh position={[0, 0, -0.32]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>

      <group ref={tilt}>
        <RoundedBox
          args={[w, h, 0.42]}
          radius={Math.min(w, h) * RADIUS}
          smoothness={8}
        >
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.6}
            roughness={0.12}
            ior={1.35}
            chromaticAberration={0.08}
            anisotropicBlur={0.2}
            distortion={0.15}
            distortionScale={0.4}
            temporalDistortion={0}
            color={THEME.glassTint}
            attenuationColor={THEME.glassDepth}
            attenuationDistance={THEME.depthDistance}
            envMapIntensity={1.4}
            samples={5}
            resolution={384}
            backside={false}
          />
        </RoundedBox>
      </group>
    </group>
  );
}

function Scene({ textures, layout, pointer, reduced }) {
  const { cardW, cardH, gridW, gridH } = layout;
  const w = cardW / PX;
  const h = cardH / PX;

  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={4}
          color={THEME.lights.key}
          position={[0, 3, 4]}
          scale={[9, 2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={6}
          color={THEME.lights.left}
          position={[-5, -1, 3]}
          scale={[2, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color={THEME.lights.right}
          position={[5, 0, 3]}
          scale={[2, 7, 1]}
        />
        <Lightformer
          form="ring"
          intensity={2}
          color={THEME.lights.ring}
          position={[0, -3, 5]}
          scale={4}
        />
      </Environment>

      {textures.map((texture, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);

        const x = (col * (cardW + GAP) + cardW / 2 - gridW / 2) / PX;
        const y = (gridH / 2 - (row * (cardH + GAP) + cardH / 2)) / PX;

        return (
          <Slab
            key={i}
            index={i}
            position={[x, y, 0]}
            w={w}
            h={h}
            texture={texture}
            pointer={pointer}
            reduced={reduced}
          />
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------
   Count-up: numbers settle into place the first time the
   cards scroll into view.
--------------------------------------------------------- */
function useCountUp(target, run, { decimals, delay, reduced }) {
  const [value, setValue] = useState(reduced ? target : 0);

  useEffect(() => {
    if (!run) return undefined;

    if (reduced) {
      setValue(target);
      return undefined;
    }

    const duration = 1600;
    const t0 = performance.now() + delay;
    let raf = 0;

    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, delay, reduced]);

  return value.toFixed(decimals);
}

function StatValue({ value, unit, run, delay, reduced }) {
  const numeric = /^\d+(\.\d+)?$/.test(value);
  const decimals = numeric ? (value.split(".")[1] || "").length : 0;

  const shown = useCountUp(numeric ? parseFloat(value) : 0, numeric && run, {
    decimals,
    delay,
    reduced,
  });

  return (
    <span className="earth-stat-value">
      <span className="earth-sr">
        {value}
        {unit}
      </span>
      <span aria-hidden="true">{numeric ? shown : value}</span>
      {unit && (
        <span className="earth-stat-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------
   Component
--------------------------------------------------------- */
export default function EarthStats({ items }) {
  const hostRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, has: false });

  const [avail, setAvail] = useState(0);
  const [seen, setSeen] = useState(false);

  // WebGL canvas only exists while the cards are near the viewport
  const { near, epoch, onCreated } = useLazyCanvas(hostRef);

  const textures = useStatTextures(items.length);
  const webgl = useMemo(supportsWebGL, []);
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const ready = webgl && textures.length === items.length;

  // glass look only while the canvas exists; the flat card shows otherwise
  const glass = ready && near;

  // Available width -> card size
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setAvail(Math.floor(entry.contentRect.width));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Latch "seen" for the count-up
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: "100px", threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cursor position for tilt
  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      pointer.current.has = true;
    };
    const onLeave = () => {
      pointer.current.has = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const layout = useMemo(() => computeLayout(avail), [avail]);

  // Glare that follows the cursor across a card
  const onCardMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const onCardLeave = (e) => {
    e.currentTarget.style.setProperty("--mx", "-400px");
    e.currentTarget.style.setProperty("--my", "-400px");
  };

  return (
    <div className="earth-stats" ref={hostRef}>
      {layout && (
        <div
          className={`earth-stats-stage${glass ? " is-glass" : ""}`}
          style={{ width: layout.gridW, height: layout.gridH }}
        >
          {webgl && near && (
            <div className="earth-stats-canvas" aria-hidden="true">
              <Canvas
                key={epoch}
                onCreated={onCreated}
                orthographic
                dpr={[1, 1.5]}
                camera={{ zoom: PX, position: [0, 0, 10], near: 0.1, far: 50 }}
                gl={{ alpha: true, antialias: true }}
                frameloop={reduced ? "demand" : "always"}
                style={{ pointerEvents: "none" }}
              >
                {ready && (
                  <Scene
                    textures={textures}
                    layout={layout}
                    pointer={pointer}
                    reduced={reduced}
                  />
                )}
              </Canvas>
            </div>
          )}

          <div
            className="earth-stats-grid"
            style={{
              gridTemplateColumns: `repeat(2, ${layout.cardW}px)`,
              gap: GAP,
            }}
          >
            {items.map((stat, i) => {
              const Icon = stat.icon;
              const [gx, gy] = GLOWS[i % GLOWS.length];

              return (
                <div
                  key={stat.label}
                  className="earth-stat"
                  style={{
                    height: layout.cardH,
                    borderRadius: layout.radius,
                    "--glow-x": `${gx * 100}%`,
                    "--glow-y": `${gy * 100}%`,
                  }}
                  onPointerMove={onCardMove}
                  onPointerLeave={onCardLeave}
                >
                  <span className="earth-stat-base" aria-hidden="true" />

                  {Icon && (
                    <Icon
                      className="earth-stat-icon"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  )}

                  <div className="earth-stat-body">
                    <StatValue
                      value={stat.value}
                      unit={stat.unit}
                      run={seen}
                      delay={i * 110}
                      reduced={reduced}
                    />
                    <span className="earth-stat-label">{stat.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
