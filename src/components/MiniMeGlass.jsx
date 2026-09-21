import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import * as THREE from "three";
import { renderToStaticMarkup } from "react-dom/server";
import useLazyCanvas from "./useLazyCanvas";
import MiniMeLogo, { PATH_A, PATH_B, LOGO_VIEWBOX } from "./MiniMeLogo";
import { buildLogoGeometry, lensGeometry, slabGeometry } from "./glassGeometry";

/*
 * Mini Me in glass.
 *
 * One WebGL canvas sits over the agent-network canvas and replaces the
 * flat logo tile and the three flat feature nodes with real glass:
 *
 *   HUB    a thick glass tile. Behind it: a painted plate (warm black,
 *          red glow, dot matrix, a glowing copy of the logo). In front
 *          of it: the logo itself, extruded and bevelled, in ruby glass.
 *          The tile and the logo tilt by different amounts, so the red
 *          logo behind slides under the glass one.
 *
 *   PUCKS  three round glass lenses on the feature nodes. A coloured
 *          core sits behind each; the domed front magnifies and bends it.
 *
 * The 2D canvas still owns the network (links, packets, labels). It
 * writes node positions and highlight amounts into `shared`, and this
 * scene reads them every frame, so the glass stays locked to the links.
 *
 * World scale: orthographic camera, STAGE_UNITS across the stage.
 * The network is authored on a 560 stage, so 1 world unit = 100 stage px.
 *
 * Every colour lives in THEME.
 */

const STAGE_UNITS = 5.6;
const STAGE_PX = 560;

// hub
const TILE_W = 1.34;
const TILE_R = 0.34;
const TILE_D = 0.3;
const TILE_BEVEL = 0.075;
const LOGO_WORLD_W = 0.84;
const LOGO_Z = 0.25;

// pucks
const PUCK_R = 0.25;
const PUCK_DEPTH = 0.1;
const PUCK_DOME = 0.12;

// measured from the logo trace, in viewBox px (bevel included)
const LOGO_BBOX = { cx: 499, cy: 396, w: 724 };

/* ---------------------------------------------------------
   THEME
   Rule of thumb: the glass itself stays almost clear. Colour comes
   from the light behind it, from the thick parts of the glass
   (attenuation) and from one red strip light on the right edge.
   A low cool light from the left keeps it from going monochrome.
--------------------------------------------------------- */
const THEME = {
  // tile
  glassTint: "#f7eef0",
  glassDepth: "#7d1230",
  depthDistance: 2.6,

  // logo (thicker, more saturated ruby)
  logoTint: "#fff1f4",
  logoDepth: "#ff2052",
  logoDistance: 0.85,

  // painted plate behind the tile
  base: ["#1b0810", "#040204"],
  glowInner: "255, 32, 82",
  glowOuter: "101, 8, 31",
  dots: "255, 208, 218",
  logoCore: "#ff5c7d",

  halo: "#ff2052",

  lights: {
    key: "#ffffff",
    rim: "#ff2052",
    counter: "#8fa3d6",
    ring: "#ffd9e0",
    under: "#ff7a96",
  },
};

const TAU = Math.PI * 2;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/* ---------------------------------------------------------
   ARTWORK  (painted once, then handed to the GPU)
--------------------------------------------------------- */
function loadImage(element) {
  const markup = renderToStaticMarkup(element).replace(
    "<svg",
    '<svg xmlns="http://www.w3.org/2000/svg"',
  );

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

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function paintHub(img) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");

  roundedRectPath(ctx, 0, 0, S, S, S * (TILE_R / TILE_W));
  ctx.clip();

  const base = ctx.createLinearGradient(0, 0, S * 0.3, S);
  base.addColorStop(0, THEME.base[0]);
  base.addColorStop(1, THEME.base[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  const glow = ctx.createRadialGradient(
    S / 2,
    S / 2,
    0,
    S / 2,
    S / 2,
    S * 0.78,
  );
  glow.addColorStop(0, `rgba(${THEME.glowInner}, 0.72)`);
  glow.addColorStop(0.4, `rgba(${THEME.glowOuter}, 0.7)`);
  glow.addColorStop(1, `rgba(${THEME.glowOuter}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // dot matrix, strongest at the centre
  const step = 16;
  for (let y = step / 2; y < S; y += step) {
    for (let x = step / 2; x < S; x += step) {
      const d = Math.hypot(x - S / 2, y - S / 2) / (S * 0.6);
      const a = Math.max(0, 1 - d) * 0.5;
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(${THEME.dots}, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, TAU);
      ctx.fill();
    }
  }

  // The logo, centred on its own bounding box so it lines up with the
  // extruded one, with a bright bloom around it.
  const sc = ((S * LOGO_WORLD_W) / TILE_W / LOGO_BBOX.w) * 1;
  const w = LOGO_VIEWBOX.w * sc;
  const h = LOGO_VIEWBOX.h * sc;
  const x = S / 2 - LOGO_BBOX.cx * sc;
  const y = S / 2 - LOGO_BBOX.cy * sc;

  ctx.save();
  ctx.shadowColor = "rgba(255, 32, 82, 0.95)";
  ctx.shadowBlur = 44;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(img, x, y, w, h);
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  return toTexture(c);
}

function paintPuck(rgb) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  const m = S / 2;

  ctx.beginPath();
  ctx.arc(m, m, m, 0, TAU);
  ctx.clip();

  ctx.fillStyle = "#050307";
  ctx.fillRect(0, 0, S, S);

  const core = ctx.createRadialGradient(m, m, 0, m, m, m);
  core.addColorStop(0, `rgba(${rgb}, 0.98)`);
  core.addColorStop(0.3, `rgba(${rgb}, 0.6)`);
  core.addColorStop(0.72, `rgba(${THEME.glowOuter}, 0.55)`);
  core.addColorStop(1, "rgba(5, 3, 7, 1)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  const step = 12;
  for (let y = step / 2; y < S; y += step) {
    for (let x = step / 2; x < S; x += step) {
      const d = Math.hypot(x - m, y - m) / m;
      const a = Math.max(0, 1 - d) * 0.32;
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(255, 235, 240, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, TAU);
      ctx.fill();
    }
  }

  return toTexture(c);
}

function paintGlow() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  return toTexture(c);
}

function useArt(features) {
  const [art, setArt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let made = [];

    loadImage(<MiniMeLogo width="512" height="422" color={THEME.logoCore} />)
      .then((img) => {
        if (cancelled) return;

        const hub = paintHub(img);
        const pucks = features.map((f) => paintPuck(f.rgb.join(", ")));
        const glow = paintGlow();

        made = [hub, glow, ...pucks];
        setArt({ hub, pucks, glow });
      })
      .catch((err) => console.error("Mini Me glass artwork failed:", err));

    return () => {
      cancelled = true;
      made.forEach((t) => t.dispose());
    };
  }, [features]);

  return art;
}

/* ---------------------------------------------------------
   POINTER TILT
--------------------------------------------------------- */
function aim(pointer, state, wx, wy, halfW, halfH) {
  if (!pointer.has) return { nx: 0, ny: 0, over: false };

  const zoom = state.size.width / STAGE_UNITS;
  const rect = state.gl.domElement.getBoundingClientRect();
  const cx = rect.left + rect.width / 2 + wx * zoom;
  const cy = rect.top + rect.height / 2 - wy * zoom;
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const reach = 3.2 * zoom;

  return {
    nx: clamp1(dx / reach),
    ny: clamp1(dy / reach),
    over: Math.abs(dx) < halfW * zoom && Math.abs(dy) < halfH * zoom,
  };
}

// world position of a network node (canvas px -> world units)
function nodeWorld(sh, n) {
  return [
    (n.x - sh.w / 2) / sh.s / (STAGE_PX / STAGE_UNITS),
    -(n.y - sh.h / 2) / sh.s / (STAGE_PX / STAGE_UNITS),
  ];
}

/* ---------------------------------------------------------
   HUB
--------------------------------------------------------- */
function Hub({ art, geo, shared, features, pointer, reduced }) {
  const root = useRef();
  const tile = useRef();
  const logo = useRef();
  const bloom = useRef();
  const bloomMat = useRef();
  const haloMat = useRef();
  const st = useRef({ tx: 0, ty: 0, lx: 0, ly: 0, s: 0.84 });

  useFrame((state, delta) => {
    const sh = shared.current;
    const s = st.current;
    const t = state.clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 5);

    let tx = 0;
    let ty = 0;
    let over = false;

    if (!reduced) {
      const a = aim(pointer.current, state, 0, 0, TILE_W / 2, TILE_W / 2);
      over = a.over;
      ty = Math.sin(t * 0.6) * 0.08 + a.nx * 0.36;
      tx = Math.cos(t * 0.5) * 0.06 + a.ny * 0.28;
    }

    s.tx += (tx - s.tx) * k;
    s.ty += (ty - s.ty) * k;
    // the logo leans further than the tile, so the layers slide
    s.lx += (tx * 1.5 - s.lx) * k;
    s.ly += (ty * 1.5 - s.ly) * k;

    const appear = 0.84 + 0.16 * (sh.app || 0);
    const target = appear * (over ? 1.035 : 1);
    s.s += (target - s.s) * k;

    root.current.scale.setScalar(s.s);
    tile.current.rotation.set(s.tx, s.ty, 0);
    logo.current.rotation.set(s.lx, s.ly, 0);

    // The feature you are looking at throws a soft light onto the plate
    // from its side, and the glass carries it.
    let sw = 0;
    let px = 0;
    let py = 0;
    let cr = 0;
    let cg = 0;
    let cb = 0;

    for (let i = 0; i < 3; i += 1) {
      const h = sh.hi[i] || 0;
      if (h < 0.001) continue;

      const [wx, wy] = nodeWorld(sh, sh.f[i]);
      const len = Math.hypot(wx, wy) || 1;
      const rgb = features[i].rgb;

      px += (wx / len) * h;
      py += (wy / len) * h;
      cr += rgb[0] * h;
      cg += rgb[1] * h;
      cb += rgb[2] * h;
      sw += h;
    }

    if (sw > 0) {
      bloom.current.position.set(px * 0.4, py * 0.4, -0.3);
      bloomMat.current.color.setRGB(
        cr / sw / 255,
        cg / sw / 255,
        cb / sw / 255,
        THREE.SRGBColorSpace,
      );
    }
    bloomMat.current.opacity = 0.62 * Math.min(1, sw);

    // packets arriving at the hub make it breathe
    haloMat.current.opacity = 0.26 + (sh.hubGlow || 0) * 0.5;
  });

  return (
    <group ref={root}>
      {/* soft red light, wider than the tile, so the tile edges pick it up */}
      <mesh position={[0, 0, -0.42]}>
        <planeGeometry args={[TILE_W * 2.1, TILE_W * 2.1]} />
        <meshBasicMaterial
          ref={haloMat}
          map={art.glow}
          color={THEME.halo}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* painted plate */}
      <mesh position={[0, 0, -0.32]}>
        <planeGeometry args={[TILE_W, TILE_W]} />
        <meshBasicMaterial map={art.hub} transparent toneMapped={false} />
      </mesh>

      {/* feature bloom */}
      <mesh ref={bloom} position={[0, 0, -0.3]} scale={1.5}>
        <planeGeometry args={[TILE_W, TILE_W]} />
        <meshBasicMaterial
          ref={bloomMat}
          map={art.glow}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* the tile */}
      <group ref={tile}>
        <mesh geometry={geo.tile}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.55}
            roughness={0.1}
            ior={1.4}
            chromaticAberration={0.07}
            anisotropicBlur={0.16}
            distortion={0.14}
            distortionScale={0.4}
            temporalDistortion={0}
            color={THEME.glassTint}
            attenuationColor={THEME.glassDepth}
            attenuationDistance={THEME.depthDistance}
            envMapIntensity={1.6}
            samples={6}
            resolution={512}
            backside={false}
          />
        </mesh>
      </group>

      {/* the logo, floating in front */}
      <group ref={logo} position={[0, 0, LOGO_Z]}>
        <mesh geometry={geo.logo}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.8}
            roughness={0.03}
            ior={1.55}
            chromaticAberration={0.16}
            anisotropicBlur={0.08}
            distortion={0.1}
            distortionScale={0.3}
            temporalDistortion={0}
            color={THEME.logoTint}
            attenuationColor={THEME.logoDepth}
            attenuationDistance={THEME.logoDistance}
            envMapIntensity={2.3}
            samples={6}
            resolution={512}
            backside={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------
   PUCK
--------------------------------------------------------- */
function Puck({ index, art, geo, shared, feature, pointer, reduced }) {
  const grp = useRef();
  const tilt = useRef();
  const artMat = useRef();
  const st = useRef({ x: 0, y: 0, s: 0.6 });

  useFrame((state, delta) => {
    const sh = shared.current;
    const n = sh.f[index];
    const a = n.a || 0;
    const g = grp.current;

    g.visible = a > 0.01;
    if (!g.visible) return;

    const [wx, wy] = nodeWorld(sh, n);
    g.position.set(wx, wy, 0);

    const hi = sh.hi[index] || 0;
    const pulse = n.pulse || 0;
    const s = st.current;
    const t = state.clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 6);

    let tx = 0;
    let ty = 0;

    if (!reduced) {
      const p = aim(pointer.current, state, wx, wy, PUCK_R, PUCK_R);
      tx = Math.sin(t * 0.7 + index * 1.7) * 0.08 + p.ny * 0.35;
      ty = Math.cos(t * 0.6 + index * 1.1) * 0.1 + p.nx * 0.45;
    }

    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;

    const target = (0.55 + 0.45 * a) * (1 + 0.14 * hi + 0.1 * pulse);
    s.s += (target - s.s) * k;

    g.scale.setScalar(s.s);
    tilt.current.rotation.set(s.x, s.y, 0);

    // the core burns brighter while its feature is selected
    artMat.current.color.setScalar(0.62 + 0.55 * hi + 0.35 * pulse);
  });

  return (
    <group ref={grp}>
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[PUCK_R * 2, PUCK_R * 2]} />
        <meshBasicMaterial
          ref={artMat}
          map={art.pucks[index]}
          transparent
          toneMapped={false}
        />
      </mesh>

      <group ref={tilt}>
        <mesh geometry={geo.lens} rotation={[Math.PI / 2, 0, 0]}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.5}
            roughness={0.04}
            ior={1.5}
            chromaticAberration={0.1}
            anisotropicBlur={0.1}
            distortion={0.2}
            distortionScale={0.4}
            temporalDistortion={0}
            color="#ffffff"
            attenuationColor={hex(feature.rgb)}
            attenuationDistance={1.6}
            envMapIntensity={1.8}
            samples={4}
            resolution={256}
            backside={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------
   SCENE
--------------------------------------------------------- */
function Fit({ highlight }) {
  const { camera, size, invalidate } = useThree();

  useEffect(() => {
    camera.zoom = size.width / STAGE_UNITS;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, invalidate]);

  // reduced motion renders on demand, so nudge it when the selection moves
  useEffect(() => {
    invalidate();
  }, [highlight, invalidate]);

  return null;
}

function Lights() {
  const L = THEME.lights;

  return (
    <Environment resolution={256} frames={1}>
      {/* soft key from above: the top-edge highlight */}
      <Lightformer
        form="rect"
        intensity={4}
        color={L.key}
        position={[0, 3, 4]}
        scale={[9, 2, 1]}
      />
      {/* cool counter-light, left */}
      <Lightformer
        form="rect"
        intensity={3.5}
        color={L.counter}
        position={[-5, -1, 3]}
        scale={[2, 7, 1]}
      />
      {/* the one red edge, right */}
      <Lightformer
        form="rect"
        intensity={9}
        color={L.rim}
        position={[5, 0.5, 3]}
        scale={[0.9, 7, 1]}
      />
      <Lightformer
        form="ring"
        intensity={2}
        color={L.ring}
        position={[0, -3, 5]}
        scale={4}
      />
      {/* warm under-light so the bottom edges are not dead */}
      <Lightformer
        form="rect"
        intensity={2.2}
        color={L.under}
        position={[0, -4, 2]}
        scale={[8, 1, 1]}
      />
    </Environment>
  );
}

function Scene({ art, geo, shared, features, pointer, reduced, highlight }) {
  return (
    <>
      <Fit highlight={highlight} />
      <Lights />

      <Hub
        art={art}
        geo={geo}
        shared={shared}
        features={features}
        pointer={pointer}
        reduced={reduced}
      />

      {features.map((feature, i) => (
        <Puck
          key={feature.name}
          index={i}
          art={art}
          geo={geo}
          shared={shared}
          feature={feature}
          pointer={pointer}
          reduced={reduced}
        />
      ))}
    </>
  );
}

/* ---------------------------------------------------------
   COMPONENT
--------------------------------------------------------- */
export default function MiniMeGlass({
  shared,
  features,
  active,
  reduced,
  highlight,
}) {
  const hostRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, has: false });
  const art = useArt(features);

  // WebGL canvas only exists while this section is near the viewport
  const { near, epoch, onCreated, ready } = useLazyCanvas(hostRef, {
    id: "mini-me-glass",
    rootMargin: "300px 0px",
    priority: 20,
  });

  const geo = useMemo(
    () => ({
      logo: buildLogoGeometry([PATH_A, PATH_B], LOGO_WORLD_W),
      tile: slabGeometry(TILE_W, TILE_W, TILE_R, TILE_D, TILE_BEVEL),
      lens: lensGeometry(PUCK_R, PUCK_DEPTH, PUCK_DOME),
    }),
    [],
  );

  useEffect(
    () => () => {
      geo.logo.dispose();
      geo.tile.dispose();
      geo.lens.dispose();
    },
    [geo],
  );

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

  return (
    <div className={`mm-glass${ready ? " is-ready" : ""}`} ref={hostRef} aria-hidden="true">
      {near && (
        <Canvas
          key={epoch}
          onCreated={onCreated}
          orthographic
          dpr={[1, 2]}
          camera={{ zoom: 100, position: [0, 0, 10], near: 0.1, far: 50 }}
          gl={{ alpha: true, antialias: true }}
          frameloop={active ? (reduced ? "demand" : "always") : "never"}
          style={{ pointerEvents: "none" }}
        >
          {art && (
            <Scene
              art={art}
              geo={geo}
              shared={shared}
              features={features}
              pointer={pointer}
              reduced={reduced}
              highlight={highlight}
            />
          )}
          {!art && <Fit highlight={highlight} />}
        </Canvas>
      )}
    </div>
  );
}
