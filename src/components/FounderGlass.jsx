import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

/*
 * Founder glass panels.
 *
 * Same rig as TechGlass/BuildNext: one shared orthographic canvas
 * renders each founder as a slab of refractive glass floating in
 * front of their portrait. World scale keeps 1 unit = 100 CSS px,
 * so the WebGL grid lines up 1:1 with the real DOM grid drawn over
 * it (name, role, story, socials all stay crisp, accessible DOM).
 *
 * Photos: drop files into /public/founders/. Until a photo lands,
 * each card paints a bold monogram in that founder's own colour, so
 * the section never looks unfinished. Colours are natural — no
 * duotone, no tint — and each founder gets a distinct accent that
 * lights their own slab.
 */

const PX = 100;
export const GAP = 24;
const ASPECT = 1.25; // portrait, dramatic hero-card proportions

const TEX_W = 480;
const TEX_H = 600;

function computeLayout(avail, count) {
  const cols = avail >= 760 ? Math.min(3, count) : 1;
  const raw = Math.floor((avail - GAP * (cols - 1)) / cols);
  const cardW =
    cols === 1
      ? Math.max(220, Math.min(raw, 420))
      : Math.max(220, Math.min(raw, 380));
  const cardH = Math.round(cardW * ASPECT);
  const rows = Math.ceil(count / cols);

  return {
    cols,
    cardW,
    cardH,
    gridW: cols * cardW + (cols - 1) * GAP,
    gridH: rows * cardH + (rows - 1) * GAP,
  };
}

export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ---------------------------------------------------------
   Artwork texture: the founder's photo (cover-fit, true
   colour) or, until a photo lands, a bold monogram card in
   their own accent colours.
--------------------------------------------------------- */
function loadPhoto(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx;
  let sy;
  let sw;
  let sh;

  if (ir > r) {
    sh = img.height;
    sw = sh * r;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / r;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function paintCard(img, founder) {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");

  roundedRectPath(ctx, 0, 0, TEX_W, TEX_H, TEX_W * 0.09);
  ctx.clip();

  const base = ctx.createLinearGradient(0, 0, TEX_W * 0.2, TEX_H);
  base.addColorStop(0, "#12131d");
  base.addColorStop(1, "#04050a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  if (img) {
    // True colour, full-bleed photo. No duotone, no tint.
    drawCover(ctx, img, 0, 0, TEX_W, TEX_H);

    const grade = ctx.createLinearGradient(0, 0, 0, TEX_H);
    grade.addColorStop(0, "rgba(4,5,10,0.10)");
    grade.addColorStop(0.62, "rgba(4,5,10,0.02)");
    grade.addColorStop(1, "rgba(4,5,10,0.4)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    const wash = ctx.createRadialGradient(
      TEX_W * 0.9,
      TEX_H * 0.05,
      0,
      TEX_W * 0.9,
      TEX_H * 0.05,
      TEX_W * 1.05,
    );
    wash.addColorStop(0, `${founder.accent}30`);
    wash.addColorStop(1, `${founder.accent}00`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
  } else {
    // Placeholder: soft aurora + a big monogram, in the founder's colours.
    const wash = ctx.createRadialGradient(
      TEX_W * 0.5,
      TEX_H * 0.32,
      0,
      TEX_W * 0.5,
      TEX_H * 0.32,
      TEX_W * 0.95,
    );
    wash.addColorStop(0, `${founder.accent}40`);
    wash.addColorStop(0.55, `${founder.accent2}22`);
    wash.addColorStop(1, `${founder.accent2}00`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    ctx.save();
    ctx.strokeStyle = founder.accent;
    ctx.lineWidth = 1.4;
    for (let r = 60; r < TEX_W; r += 46) {
      ctx.globalAlpha = Math.max(0, 0.24 - r / (TEX_W * 5.4));
      ctx.beginPath();
      ctx.arc(TEX_W * 0.5, TEX_H * 0.36, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const grad = ctx.createLinearGradient(
      TEX_W * 0.18,
      TEX_H * 0.14,
      TEX_W * 0.82,
      TEX_H * 0.54,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, founder.accent);
    grad.addColorStop(1, founder.accent2);

    ctx.fillStyle = grad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${TEX_W * 0.34}px "Syne", sans-serif`;
    ctx.fillText(initials(founder.name), TEX_W / 2, TEX_H * 0.36);

    ctx.font = `700 ${TEX_W * 0.048}px "Inter", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillText("PHOTO COMING SOON", TEX_W / 2, TEX_H * 0.55);
  }

  // dot matrix, thinning toward the top edge of the plate zone
  const step = 15;
  for (let y = TEX_H * 0.6; y < TEX_H; y += step) {
    for (let x = step / 2; x < TEX_W; x += step) {
      const t = (y - TEX_H * 0.6) / (TEX_H * 0.4);
      const a = 0.16 * t;
      if (a < 0.02) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function useFounderTextures(founders) {
  const [textures, setTextures] = useState([]);
  const key = founders.map((f) => `${f.name}|${f.photo}`).join("~");

  useEffect(() => {
    let cancelled = false;
    let made = [];

    Promise.all(founders.map((f) => loadPhoto(f.photo))).then((images) => {
      if (cancelled) return;
      made = images.map((img, i) => paintCard(img, founders[i]));
      setTextures(made);
    });

    return () => {
      cancelled = true;
      made.forEach((t) => t.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return textures;
}

/* ---------------------------------------------------------
   3D pieces
--------------------------------------------------------- */
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

function Slab({
  index,
  x,
  y,
  w,
  h,
  texture,
  accent,
  pointer,
  hovered,
  reduced,
}) {
  const tilt = useRef();
  const light = useRef();
  const state = useRef({ x: 0, y: 0, s: 1, li: 1.3 });
  // Own accumulator, not clock.elapsedTime: elapsedTime keeps advancing
  // in real time even while frameloop is "never" (paused off-screen), so
  // reading it directly makes sin/cos jump to a random new phase the
  // instant a paused canvas resumes — a visible pop on every scroll-in.
  // Accumulating with a clamped delta means the wave just holds its
  // phase while paused and resumes smoothly instead.
  const clock = useRef(0);

  useFrame(({ gl }, rawDelta) => {
    const node = tilt.current;
    if (!node) return;

    const delta = Math.min(rawDelta, 1 / 30);
    clock.current += delta;

    let tx = 0;
    let ty = 0;

    if (!reduced) {
      const t = clock.current;
      tx = Math.sin(t * 0.5 + index * 1.4) * 0.032;
      ty = Math.cos(t * 0.4 + index * 0.8) * 0.05;

      const p = pointer.current;
      if (p.has) {
        const rect = gl.domElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 + x * PX;
        const cy = rect.top + rect.height / 2 - y * PX;

        ty += clamp1((p.x - cx) / 380) * 0.28;
        tx += clamp1((p.y - cy) / 380) * 0.2;
      }
    }

    const ts = hovered ? 1.04 : 1;
    const li = hovered ? 3.4 : 1.3;

    const k = 1 - Math.exp(-delta * 6);
    const s = state.current;
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    s.s += (ts - s.s) * k;
    s.li += (li - s.li) * k;

    node.rotation.set(s.x, s.y, 0);
    node.scale.setScalar(s.s);

    if (light.current) light.current.intensity = s.li;
  });

  return (
    <group position={[x, y, 0]}>
      {/* Artwork stays put; the glass tilts in front of it */}
      <mesh position={[0, 0, -0.4]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>

      {/* This founder's own colour, lighting their own slab */}
      <pointLight
        ref={light}
        color={accent}
        intensity={1.3}
        position={[0, 0, 1.7]}
        distance={4.4}
        decay={2}
      />

      <group ref={tilt}>
        <RoundedBox args={[w, h, 0.52]} radius={w * 0.1} smoothness={8}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.7}
            roughness={0.02}
            ior={1.32}
            chromaticAberration={0.1}
            anisotropicBlur={0.15}
            distortion={0.12}
            distortionScale={0.35}
            temporalDistortion={0}
            color="#eef3fb"
            attenuationColor={accent}
            attenuationDistance={6}
            envMapIntensity={1.5}
            samples={5}
            resolution={1024}
            backside={false}
          />
        </RoundedBox>
      </group>
    </group>
  );
}

function Scene({ founders, textures, layout, active, pointer, reduced }) {
  const { cols, cardW, cardH, gridW, gridH } = layout;
  const w = cardW / PX;
  const h = cardH / PX;

  return (
    <>
      {/* Neutral studio lighting: colour comes from each founder's own light */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#ffffff"
          position={[0, 3.2, 4]}
          scale={[9, 2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3.6}
          color="#cfe0ff"
          position={[-5, -1, 3]}
          scale={[2, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3.6}
          color="#ffe3ee"
          position={[5, 0, 3]}
          scale={[2, 7, 1]}
        />
        <Lightformer
          form="ring"
          intensity={1.5}
          color="#ffffff"
          position={[0, -3, 5]}
          scale={4}
        />
      </Environment>

      <Sparkles
        count={40}
        scale={[gridW / PX + 1.4, gridH / PX + 1, 2]}
        size={1.5}
        speed={0.2}
        opacity={0.3}
        color="#f5d9df"
      />

      {founders.map((f, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = (col * (cardW + GAP) + cardW / 2 - gridW / 2) / PX;
        const y = (gridH / 2 - (row * (cardH + GAP) + cardH / 2)) / PX;

        return (
          <Slab
            key={f.id}
            index={i}
            x={x}
            y={y}
            w={w}
            h={h}
            texture={textures[i]}
            accent={f.accent}
            pointer={pointer}
            hovered={active === i}
            reduced={reduced}
          />
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------
   Fallback portrait (no WebGL): plain photo or a monogram
   avatar, still in the founder's own colours, no duotone.
--------------------------------------------------------- */
export function FallbackPortrait({ founder }) {
  const [missing, setMissing] = useState(!founder.photo);

  if (missing) {
    return (
      <div
        className="fp-avatar"
        style={{ "--accent": founder.accent, "--accent2": founder.accent2 }}
        aria-hidden="true"
      >
        <span>{initials(founder.name)}</span>
      </div>
    );
  }

  return (
    <img
      className="fp-photo"
      src={founder.photo}
      alt={`${founder.name}, ${founder.role}`}
      loading="lazy"
      decoding="async"
      onError={() => setMissing(true)}
    />
  );
}

/* ---------------------------------------------------------
   Public layout hook: lets Founders.jsx size its own DOM grid
   (name/role/story overlay) so it lines up with the canvas.
--------------------------------------------------------- */
export function useFounderLayout(hostRef, count) {
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setAvail(Math.floor(entry.contentRect.width));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [hostRef]);

  return useMemo(
    () => (avail ? computeLayout(avail, count) : null),
    [avail, count],
  );
}

/* ---------------------------------------------------------
   Component: just the WebGL layer. Founders.jsx positions
   this absolutely behind its own DOM grid, using the same
   `layout` object for both.
--------------------------------------------------------- */
export default function FounderGlass({
  founders,
  layout,
  active,
  hostRef,
  reduced,
}) {
  const pointer = useRef({ x: 0, y: 0, has: false });
  const [onScreen, setOnScreen] = useState(false);

  const textures = useFounderTextures(founders);
  const webgl = useMemo(supportsWebGL, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      // Large margin on purpose: this flips frameloop from "never" to
      // "always" well before the section scrolls into the viewport, so
      // shader/material warm-up happens off-screen instead of landing
      // on the same frame the user actually sees it appear.
      { rootMargin: "800px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hostRef]);

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

  if (!webgl || !layout) return null;

  return (
    <div
      className="fx-glass-canvas"
      style={{ width: layout.gridW, height: layout.gridH }}
      aria-hidden="true"
    >
      <Canvas
        orthographic
        dpr={[1, 1.5]}
        camera={{ zoom: PX, position: [0, 0, 10], near: 0.1, far: 50 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={onScreen ? (reduced ? "demand" : "always") : "never"}
        style={{ pointerEvents: "none" }}
        onCreated={({ gl, scene, camera }) => {
          // Force the (expensive) MeshTransmissionMaterial shaders to
          // compile now, while the canvas is still off-screen, rather
          // than on the first frame the user actually scrolls to.
          gl.compile(scene, camera);
        }}
      >
        {textures.length === founders.length && (
          <Scene
            founders={founders}
            textures={textures}
            layout={layout}
            active={active}
            pointer={pointer}
            reduced={reduced}
          />
        )}
      </Canvas>
    </div>
  );
}

export { computeLayout };
