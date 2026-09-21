import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import { renderToStaticMarkup } from "react-dom/server";
import useLazyCanvas from "./useLazyCanvas";

/*
 * Glass tech cards.
 *
 * One shared WebGL canvas renders every card as a slab of refractive
 * glass (drei's MeshTransmissionMaterial, the same material the
 * pmndrs glass examples use). Behind each slab sits a flat plane
 * carrying the card artwork + logo, so the logo bends and shifts as
 * the glass tilts toward the cursor.
 *
 * The name/detail text stays as real DOM on top so it remains crisp
 * and accessible.
 *
 * World scale: orthographic camera with zoom = PX, so 1 world unit
 * = 100 CSS pixels and the 3D grid lines up 1:1 with the DOM grid.
 */

const PX = 100;
const GAP = 16;

// Artwork texture size (aspect must match the card aspect below)
const TEX_W = 512;
const TEX_H = 624;
const ASPECT = TEX_H / TEX_W;

// Light source per card, same idea as the Earth stat cards
const GLOWS = [
  [1, 1],
  [1, 0],
  [0, 1],
  [0.5, 0],
  [0, 0],
  [1, 0.6],
];

/* ---------------------------------------------------------
   THEME: every color of the glass cards lives here.
   RGB values are "r, g, b" strings so alpha can be added in code.
--------------------------------------------------------- */
const THEME = {
  // Neutral dark glass that works on pure black
  glassTint: "#dfe7f2",
  glassDepth: "#6f7f95",
  depthDistance: 5,

  // Very dark base so the card still feels glassy
  base: ["#111722", "#030509"],

  // Cool subtle glow
  glowInner: "90, 125, 180",
  glowOuter: "38, 62, 110",

  // Soft white-blue details
  dots: "210, 225, 245",
  halo: "190, 215, 255",

  lights: {
    key: "#ffffff",
    left: "#6ea8ff",
    right: "#5865f2",
    ring: "#b9c9ff",
  },
};

/* ---------------------------------------------------------
   Layout: 6 across on desktop, 3x2 on tablet, 2x3 on phones
--------------------------------------------------------- */
function computeLayout(avail, count) {
  for (const target of [6, 3, 2]) {
    const cols = Math.min(target, count);
    const w = Math.floor((avail - GAP * (cols - 1)) / cols);

    if (w >= 128 || target === 2) {
      const cardW = Math.max(96, Math.min(w, 168));
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
  }

  return null;
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
   Artwork textures
   The existing React SVG icons are serialised to images and
   painted onto a 2D canvas together with the card background.
--------------------------------------------------------- */
function loadIcon(element) {
  const markup = renderToStaticMarkup(element)
    .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, '$1 width="256"')
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, '$1 height="256"');

  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
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

function paintCard(img, index) {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");

  const [gx, gy] = GLOWS[index % GLOWS.length];
  const glowX = gx * TEX_W;
  const glowY = gy * TEX_H;

  roundedRectPath(ctx, 0, 0, TEX_W, TEX_H, TEX_W * 0.12);
  ctx.clip();

  // Base
  const base = ctx.createLinearGradient(0, 0, TEX_W * 0.3, TEX_H);
  base.addColorStop(0, THEME.base[0]);
  base.addColorStop(1, THEME.base[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Wine glow from this card's light source (#65081f family)
  const glow = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    TEX_W * 1.15,
  );
  glow.addColorStop(0, `rgba(${THEME.glowInner}, 0.8)`);
  glow.addColorStop(0.35, `rgba(${THEME.glowOuter}, 0.75)`);
  glow.addColorStop(1, `rgba(${THEME.glowOuter}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

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

  // Logo with a soft halo
  const lx = TEX_W / 2;
  const ly = TEX_H * 0.4;
  const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 190);
  halo.addColorStop(0, `rgba(${THEME.halo}, 0.14)`);
  halo.addColorStop(1, `rgba(${THEME.halo}, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.drawImage(img, lx - 110, ly - 110, 220, 220);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function useCardTextures(items) {
  const [textures, setTextures] = useState([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const key = items.map((i) => i.name).join("|");

  useEffect(() => {
    let cancelled = false;
    let made = [];

    Promise.all(itemsRef.current.map((item) => loadIcon(item.icon)))
      .then((images) => {
        if (cancelled) return;
        made = images.map((img, i) => paintCard(img, i));
        setTextures(made);
      })
      .catch((err) => console.error("Tech icon texture failed:", err));

    return () => {
      cancelled = true;
      made.forEach((t) => t.dispose());
    };
  }, [key]);

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

        ty += clamp1((p.x - cx) / 320) * 0.42;
        tx += clamp1((p.y - cy) / 320) * 0.32;

        if (
          Math.abs(p.x - cx) < (w * PX) / 2 &&
          Math.abs(p.y - cy) < (h * PX) / 2
        ) {
          ts = 1.05;
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
        <RoundedBox args={[w, h, 0.42]} radius={w * 0.12} smoothness={8}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.6}
            roughness={0}
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
            resolution={1080}
            backside={false}
          />
        </RoundedBox>
      </group>
    </group>
  );
}

function Scene({ textures, layout, pointer, reduced }) {
  const { cols, cardW, cardH, gridW, gridH } = layout;
  const w = cardW / PX;
  const h = cardH / PX;

  return (
    <>
      {/* Local studio lighting, no network fetch */}
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
        const col = i % cols;
        const row = Math.floor(i / cols);

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
   Component
--------------------------------------------------------- */
export default function TechGlass({ items }) {
  const hostRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, has: false });

  const [avail, setAvail] = useState(0);

  // WebGL canvas only exists while the cards are near the viewport
  const { near, epoch, onCreated } = useLazyCanvas(hostRef);

  const textures = useCardTextures(items);
  const webgl = useMemo(supportsWebGL, []);
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Available width -> grid layout
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

  const layout = useMemo(
    () => (avail ? computeLayout(avail, items.length) : null),
    [avail, items.length],
  );

  return (
    <div className="hero-tech-list" ref={hostRef}>
      {layout && (
        <div
          className={`hero-tech-stage${webgl ? "" : " is-fallback"}`}
          style={{ width: layout.gridW, height: layout.gridH }}
        >
          {webgl && near && (
            <div className="hero-tech-canvas" aria-hidden="true">
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
                {textures.length === items.length && (
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
            className="hero-tech-grid"
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardW}px)`,
              gap: GAP,
            }}
          >
            {items.map((tech) => (
              <div
                key={tech.name}
                className={`hero-tech-card ${tech.className}`}
                style={{ height: layout.cardH }}
              >
                <span className="hero-tech-name">{tech.name}</span>
                <span className="hero-tech-detail">{tech.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
