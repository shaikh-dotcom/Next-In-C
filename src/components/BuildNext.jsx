import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Edges,
  Environment,
  Html,
  Lightformer,
  MeshReflectorMaterial,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";
import ScrambleText from "./ScrambleText";
import SectionStars from "./SectionStars";
import "./BuildNext.css";

/*
 * "Building what comes next."
 *
 * Four product cubes standing on a reflective floor. Every cube is a
 * dark gunmetal frame with recessed glowing screens on the two faces
 * you can see, plus a raised icon plate on top. All artwork is drawn
 * procedurally onto 2D canvases (no image assets), then mapped onto
 * the faces.
 *
 * Edit PRODUCTS below to change names, colours and which artwork each
 * face shows.
 *
 * Face artwork kinds:  code | terminal | chart | net | topo | wave |
 *                      app  | minime
 * Top icon kinds:      chip | orbit | constellation | spark
 */

const HEADING = "Building what comes next.";

const PRODUCTS = [
  {
    name: "Web & App Studio",
    detail: "Interfaces that ship",
    accent: "#4de3ff",
    accent2: "#9af2ff",
    top: "chip",
    left: "code",
    right: "terminal",
  },
  {
    name: "Enterprise SaaS",
    detail: "Platforms that scale",
    accent: "#3ff2c4",
    accent2: "#b6ffe9",
    top: "orbit",
    left: "chart",
    right: "net",
  },
  {
    name: "AI & LLM Lab",
    detail: "From research to production",
    accent: "#ff5f8f",
    accent2: "#ffb04d",
    top: "constellation",
    left: "topo",
    right: "wave",
  },
  {
    name: "MiniMe",
    detail: "Our flagship app",
    accent: "#ff4d6d",
    accent2: "#5cf2d0",
    top: "spark",
    left: "app",
    right: "minime",
  },
];

/* ---------------------------------------------------------
   Scene constants
   World units. The camera is a narrow-FOV perspective camera,
   which reads as near-isometric while still giving the floor
   reflection correct depth.
--------------------------------------------------------- */
const CUBE = 1.7;
const HALF = CUBE / 2;
const BASE_Y = 1.15; // cube centre height above the floor
const SCREEN = CUBE - 0.075; // face plane size (sits between frame bars)
const SPACING_X = 3.5;
const ROW_STEP = 4.0; // vertical screen distance between rows (2-col layout)
const ELEV = (28 * Math.PI) / 180;
const FOV = 16;
const TARGET_Y = 0.55;

function getLayout(width) {
  const cols = width >= 880 ? 4 : 2;
  const rows = Math.ceil(PRODUCTS.length / cols);

  return {
    cols,
    rows,
    W: cols * SPACING_X,
    H: 6.6 + (rows - 1) * ROW_STEP,
    zStep: ROW_STEP / Math.sin(ELEV),
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
   Shared geometry + materials (created once)
--------------------------------------------------------- */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);

const FRAME_MAT = new THREE.MeshStandardMaterial({
  color: "#232733",
  metalness: 1,
  roughness: 0.3,
  envMapIntensity: 1.25,
});

const BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#080a10",
  metalness: 0.6,
  roughness: 0.5,
});

const BARS = (() => {
  const T = 0.06;
  const out = [];

  [-1, 1].forEach((a) =>
    [-1, 1].forEach((b) => {
      out.push({ p: [0, a * HALF, b * HALF], s: [CUBE + T, T, T] });
      out.push({ p: [a * HALF, 0, b * HALF], s: [T, CUBE + T, T] });
      out.push({ p: [a * HALF, b * HALF, 0], s: [T, T, CUBE + T] });
    }),
  );

  return out;
})();

const CORNERS = (() => {
  const out = [];

  [-1, 1].forEach((a) =>
    [-1, 1].forEach((b) =>
      [-1, 1].forEach((c) => {
        out.push([a * HALF, b * HALF, c * HALF]);
      }),
    ),
  );

  return out;
})();

/* =========================================================
   ARTWORK  (2D canvas painters)
========================================================= */
const TEX = 512;
const TAU = Math.PI * 2;
const PAD = 26;

const MONO = '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace';
const SANS = 'Inter, "Segoe UI", system-ui, sans-serif';
const DISPLAY = 'Syne, Inter, "Segoe UI", sans-serif';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgba = (hex, a) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const mix = (h1, h2, t) => {
  const a = toRgb(h1);
  const b = toRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

function mk() {
  const c = document.createElement("canvas");
  c.width = TEX;
  c.height = TEX;
  return [c, c.getContext("2d")];
}

function toTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function curve(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

/* The recessed screen every face shares: dark bezel, dark glass,
   a wash of the accent from one corner, and a neon border. */
function screen(ctx, accent, glowAt = [0.85, 0.1]) {
  const S = TEX;

  ctx.fillStyle = "#03050a";
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  rr(ctx, PAD, PAD, S - PAD * 2, S - PAD * 2, 26);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, "#0b101a");
  bg.addColorStop(1, "#05070c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  const gx = glowAt[0] * S;
  const gy = glowAt[1] * S;
  const wash = ctx.createRadialGradient(gx, gy, 0, gx, gy, S * 0.95);
  wash.addColorStop(0, rgba(accent, 0.34));
  wash.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, S, S);

  ctx.fillStyle = "rgba(255,255,255,0.022)";
  for (let y = PAD; y < S; y += 4) ctx.fillRect(0, y, S, 1);

  ctx.restore();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = rgba(accent, 0.95);
  ctx.lineWidth = 3;
  rr(ctx, PAD, PAD, S - PAD * 2, S - PAD * 2, 26);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = rgba(accent, 0.22);
  ctx.lineWidth = 1;
  rr(ctx, PAD + 9, PAD + 9, S - (PAD + 9) * 2, S - (PAD + 9) * 2, 18);
  ctx.stroke();
}

function label(ctx, text, x, y, align = "left", alpha = 0.4) {
  ctx.save();
  ctx.font = `700 13px ${MONO}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ---------- code / terminal ---------- */
const SYN = {
  k: null, // accent
  s: "#ff9ec0",
  f: "#ffe08a",
  d: "#cfd9e8",
  c: "#5d6b80",
  g: "#5cf2b0",
};

const CODE_LINES = [
  [["// ship it", "c"]],
  [
    ["import ", "k"],
    ["{ build } ", "d"],
    ["from ", "k"],
    ['"next"', "s"],
  ],
  [],
  [
    ["const ", "k"],
    ["app = ", "d"],
    ["build", "f"],
    ["({", "d"],
  ],
  [
    ["  edge: ", "d"],
    ["true", "k"],
    [",", "d"],
  ],
  [
    ["  ai: ", "d"],
    ['"llm"', "s"],
    [",", "d"],
  ],
  [
    ["  scale: ", "d"],
    ['"global"', "s"],
    [",", "d"],
  ],
  [["});", "d"]],
  [
    ["await ", "k"],
    ["app.", "d"],
    ["ship", "f"],
    ["();", "d"],
  ],
];

const TERM_LINES = [
  [
    ["$ ", "k"],
    ["next init", "d"],
  ],
  [
    ["✓ ", "g"],
    ["scaffolded project", "d"],
  ],
  [
    ["✓ ", "g"],
    ["edge runtime ready", "d"],
  ],
  [],
  [
    ["$ ", "k"],
    ["next deploy --prod", "d"],
  ],
  [
    ["▲ ", "f"],
    ["building ", "d"],
    ["████████", "k"],
    ["░░ ", "c"],
    ["82%", "d"],
  ],
  [
    ["✓ ", "g"],
    ["live in 11ms", "d"],
  ],
  [],
  [
    ["$ ", "k"],
    ["▍", "d"],
  ],
];

function paintText(ctx, item, lines, numbers, title) {
  screen(ctx, item.accent, [0.92, 0.04]);

  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(66 + i * 20, 72, 5, 0, TAU);
    ctx.fill();
  });

  label(ctx, title, 462, 77, "right", 0.32);

  ctx.font = `600 20px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  lines.forEach((segs, i) => {
    const y = 128 + i * 36;
    let x = numbers ? 88 : 60;

    if (numbers) {
      ctx.fillStyle = "#3b4658";
      ctx.fillText(String(i + 1).padStart(2, " "), 58, y);
    }

    segs.forEach(([txt, key]) => {
      ctx.fillStyle = SYN[key] || item.accent;
      ctx.fillText(txt, x, y);
      x += ctx.measureText(txt).width;
    });
  });
}

/* ---------- chart ---------- */
function paintChart(ctx, item, i) {
  const a = item.accent;
  screen(ctx, a, [0.85, 0.95]);

  label(ctx, "MONTHLY RECURRING REVENUE", 56, 84, "left", 0.4);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 60px ${SANS}`;
  ctx.fillText("+248%", 54, 152);

  ctx.fillStyle = a;
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText("▲ year over year", 58, 180);

  const x0 = 58;
  const x1 = 454;
  const y0 = 214;
  const y1 = 436;

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g += 1) {
    const y = y0 + ((y1 - y0) * g) / 4;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  const r = rng(7 + i);
  const pts = [];
  let v = 0.12;
  for (let k = 0; k < 16; k += 1) {
    v += 0.04 + r() * 0.07 - (r() < 0.25 ? 0.05 : 0);
    v = Math.max(0.06, Math.min(0.96, v));
    pts.push([x0 + ((x1 - x0) * k) / 15, y1 - (y1 - y0) * v]);
  }

  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(0, rgba(a, 0.42));
  fill.addColorStop(1, rgba(a, 0));
  ctx.beginPath();
  curve(ctx, pts);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x0, y1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = a;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = item.accent2;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  curve(ctx, pts);
  ctx.stroke();

  const end = pts[pts.length - 1];
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(end[0], end[1], 7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------- neural network ---------- */
function paintNet(ctx, item, i) {
  const a = item.accent;
  screen(ctx, a, [0.1, 0.9]);

  label(ctx, "INFERENCE", 56, 84, "left", 0.4);
  label(ctx, "11 ms", 458, 84, "right", 0.6);

  const layers = [3, 5, 6, 5, 3];
  const r = rng(21 + i);
  const x0 = 86;
  const x1 = 434;
  const y0 = 140;
  const y1 = 424;

  const nodes = layers.map((n, li) =>
    Array.from({ length: n }, (_, k) => [
      x0 + ((x1 - x0) * li) / (layers.length - 1),
      y0 + ((y1 - y0) * (k + 0.5)) / n,
    ]),
  );

  for (let li = 0; li < nodes.length - 1; li += 1) {
    nodes[li].forEach((p) => {
      nodes[li + 1].forEach((q) => {
        const hot = r() < 0.16;
        ctx.strokeStyle = hot ? rgba(a, 0.8) : rgba(a, 0.13);
        ctx.lineWidth = hot ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      });
    });
  }

  nodes.flat().forEach((p) => {
    const hot = r() < 0.32;
    ctx.save();
    ctx.shadowColor = a;
    ctx.shadowBlur = hot ? 18 : 8;
    ctx.fillStyle = hot ? item.accent2 : rgba(a, 0.9);
    ctx.beginPath();
    ctx.arc(p[0], p[1], hot ? 9 : 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

/* ---------- topographic rings ---------- */
function paintTopo(ctx, item) {
  const a = item.accent;
  screen(ctx, a, [0.5, 0.5]);

  ctx.save();
  rr(ctx, PAD + 2, PAD + 2, TEX - (PAD + 2) * 2, TEX - (PAD + 2) * 2, 24);
  ctx.clip();

  const N = 15;
  for (let k = 1; k <= N; k += 1) {
    const base = 12 + k * 9.6;
    ctx.beginPath();
    for (let s = 0; s <= 140; s += 1) {
      const ang = (s / 140) * TAU;
      const rad =
        base *
        (1 +
          0.16 * Math.sin(3 * ang + k * 0.35) +
          0.09 * Math.sin(5 * ang - k * 0.6) +
          0.05 * Math.sin(2 * ang + k));
      const x = 256 + rad * Math.cos(ang) * 1.08;
      const y = 262 + rad * Math.sin(ang) * 0.94;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = a;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = mix(a, item.accent2, k / N);
    ctx.globalAlpha = 0.35 + 0.65 * (k / N);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/* ---------- audio waveform ---------- */
function paintWave(ctx, item, i) {
  const a = item.accent;
  screen(ctx, a, [0.5, 0.9]);

  label(ctx, "VOICE", 56, 84, "left", 0.4);
  label(ctx, "24 kHz", 458, 84, "right", 0.6);

  const r = rng(11 + i);
  const N = 38;
  const cy = 262;

  ctx.save();
  ctx.shadowColor = a;
  ctx.shadowBlur = 12;

  for (let k = 0; k < N; k += 1) {
    const x = 64 + (k * 384) / (N - 1);
    const env = Math.pow(Math.sin((Math.PI * k) / (N - 1)), 0.8);
    const h =
      (26 +
        118 * Math.abs(Math.sin(k * 0.55) * Math.sin(k * 0.21 + 1.3) + 0.35 * r())) *
      (0.35 + 0.65 * env);

    ctx.fillStyle = mix(a, item.accent2, k / (N - 1));
    rr(ctx, x - 3.2, cy - h, 6.4, h * 2, 3.2);
    ctx.fill();
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, cy);
  ctx.lineTo(456, cy);
  ctx.stroke();
}

/* ---------- MiniMe app icon + wordmark ---------- */
function paintApp(ctx, item) {
  const a = item.accent;
  screen(ctx, a, [0.5, 0.5]);

  const s = 230;
  const x = (TEX - s) / 2;
  const y = 116;

  ctx.save();
  ctx.shadowColor = a;
  ctx.shadowBlur = 54;
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, "#ff6f80");
  g.addColorStop(1, "#cf1c45");
  ctx.fillStyle = g;
  rr(ctx, x, y, s, s, 58);
  ctx.fill();
  ctx.restore();

  const sheen = ctx.createLinearGradient(0, y, 0, y + s * 0.55);
  sheen.addColorStop(0, "rgba(255,255,255,0.3)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  rr(ctx, x, y, s, s, 58);
  ctx.fill();

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 30;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + 62, y + 168);
  ctx.lineTo(x + 62, y + 66);
  ctx.lineTo(x + 115, y + 128);
  ctx.lineTo(x + 168, y + 66);
  ctx.lineTo(x + 168, y + 168);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `600 26px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("MiniMe", 256, 410);
}

function paintMiniMe(ctx, item) {
  const b = item.accent2;
  screen(ctx, b, [0.5, 0.5]);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 132px ${DISPLAY}`;

  const g = ctx.createLinearGradient(0, 130, 0, 380);
  g.addColorStop(0, "#d9fff6");
  g.addColorStop(1, b);

  ctx.save();
  ctx.shadowColor = b;
  ctx.shadowBlur = 26;
  ctx.fillStyle = g;
  ctx.fillText("Mini", 256, 244);
  ctx.fillText("Me", 256, 372);
  ctx.restore();
}

/* ---------- top face base (grid + concentric frames) ---------- */
function paintTopBase(ctx, item) {
  const a = item.accent;
  screen(ctx, a, [0.5, 0.5]);

  ctx.strokeStyle = rgba(a, 0.09);
  ctx.lineWidth = 1;
  for (let g = PAD + 22; g < TEX - PAD; g += 32) {
    ctx.beginPath();
    ctx.moveTo(g, PAD);
    ctx.lineTo(g, TEX - PAD);
    ctx.moveTo(PAD, g);
    ctx.lineTo(TEX - PAD, g);
    ctx.stroke();
  }

  [62, 88].forEach((inset, k) => {
    ctx.strokeStyle = rgba(a, 0.3 - k * 0.1);
    ctx.lineWidth = 2;
    rr(ctx, inset, inset, TEX - inset * 2, TEX - inset * 2, 18);
    ctx.stroke();
  });
}

const PAINTERS = {
  code: (ctx, item) => paintText(ctx, item, CODE_LINES, true, "app.ts"),
  terminal: (ctx, item) => paintText(ctx, item, TERM_LINES, false, "zsh"),
  chart: paintChart,
  net: paintNet,
  topo: paintTopo,
  wave: paintWave,
  app: paintApp,
  minime: paintMiniMe,
};

/* ---------- icons for the raised top plate ---------- */
function neon(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

const ICONS = {
  chip(ctx, item) {
    const a = item.accent;
    const s = 132;
    const x = 256 - s / 2;
    const y = 256 - s / 2;

    neon(ctx, a, 22, () => {
      ctx.strokeStyle = a;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      rr(ctx, x, y, s, s, 16);
      ctx.stroke();

      for (let i = 0; i < 4; i += 1) {
        const o = (i + 0.5) * (s / 4);
        ctx.beginPath();
        ctx.moveTo(x + o, y);
        ctx.lineTo(x + o, y - 36);
        ctx.moveTo(x + o, y + s);
        ctx.lineTo(x + o, y + s + 36);
        ctx.moveTo(x, y + o);
        ctx.lineTo(x - 36, y + o);
        ctx.moveTo(x + s, y + o);
        ctx.lineTo(x + s + 36, y + o);
        ctx.stroke();
      }
    });

    ctx.fillStyle = rgba(a, 0.28);
    rr(ctx, 216, 216, 80, 80, 10);
    ctx.fill();
    ctx.strokeStyle = item.accent2;
    ctx.lineWidth = 3;
    ctx.stroke();
  },

  orbit(ctx, item) {
    const a = item.accent;

    neon(ctx, a, 18, () => {
      ctx.strokeStyle = a;
      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k += 1) {
        ctx.save();
        ctx.translate(256, 256);
        ctx.rotate((Math.PI / 3) * k);
        ctx.beginPath();
        ctx.ellipse(0, 0, 142, 54, 0, 0, TAU);
        ctx.stroke();

        const ang = k * 2.1 + 0.6;
        ctx.fillStyle = item.accent2;
        ctx.beginPath();
        ctx.arc(142 * Math.cos(ang), 54 * Math.sin(ang), 9, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    });

    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 30);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, a);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(256, 256, 26, 0, TAU);
    ctx.fill();
  },

  constellation(ctx, item, i) {
    const a = item.accent;
    const r = rng(3 + i);
    const pts = [];

    while (pts.length < 32) {
      const x = (r() * 2 - 1) * 132;
      const y = (r() * 2 - 1) * 132;
      if (x * x + y * y < 132 * 132) pts.push([256 + x, 256 + y]);
    }

    for (let p = 0; p < pts.length; p += 1) {
      for (let q = p + 1; q < pts.length; q += 1) {
        const d = Math.hypot(pts[p][0] - pts[q][0], pts[p][1] - pts[q][1]);
        if (d < 74) {
          ctx.strokeStyle = rgba(a, 0.15 + (1 - d / 74) * 0.6);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(pts[p][0], pts[p][1]);
          ctx.lineTo(pts[q][0], pts[q][1]);
          ctx.stroke();
        }
      }
    }

    pts.forEach((p, k) => {
      neon(ctx, a, 14, () => {
        ctx.fillStyle = k % 5 === 0 ? item.accent2 : a;
        ctx.beginPath();
        ctx.arc(p[0], p[1], k % 5 === 0 ? 7 : 5, 0, TAU);
        ctx.fill();
      });
    });
  },

  spark(ctx, item) {
    const a = item.accent;

    ctx.strokeStyle = rgba(a, 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, 150, 0, TAU);
    ctx.stroke();

    neon(ctx, a, 28, () => {
      const g = ctx.createLinearGradient(256, 110, 256, 402);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, a);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(256, 112);
      ctx.quadraticCurveTo(256, 256, 400, 256);
      ctx.quadraticCurveTo(256, 256, 256, 400);
      ctx.quadraticCurveTo(256, 256, 112, 256);
      ctx.quadraticCurveTo(256, 256, 256, 112);
      ctx.fill();
    });
  },
};

function paintIcon(item, i) {
  const [canvas, ctx] = mk();

  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, TEX, TEX);

  const glow = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
  glow.addColorStop(0, rgba(item.accent, 0.4));
  glow.addColorStop(1, rgba(item.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, TEX, TEX);

  ICONS[item.top](ctx, item, i);

  neon(ctx, item.accent, 16, () => {
    ctx.strokeStyle = rgba(item.accent, 0.9);
    ctx.lineWidth = 4;
    rr(ctx, 12, 12, TEX - 24, TEX - 24, 30);
    ctx.stroke();
  });

  return toTex(canvas);
}

function paintFace(kind, item, i) {
  const [canvas, ctx] = mk();
  PAINTERS[kind](ctx, item, i);
  return toTex(canvas);
}

function buildSet(item, i) {
  const [topCanvas, topCtx] = mk();
  paintTopBase(topCtx, item);

  return {
    left: paintFace(item.left, item, i),
    right: paintFace(item.right, item, i),
    top: toTex(topCanvas),
    icon: paintIcon(item, i),
  };
}

function buildPool() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  return new THREE.CanvasTexture(c);
}

function useArtwork() {
  const [art, setArt] = useState(null);

  useEffect(() => {
    let dead = false;
    let sets = [];
    let pool = null;

    const fonts = document.fonts
      ? Promise.all([
          document.fonts.load(`700 60px Inter`),
          document.fonts.load(`800 132px Syne`),
        ]).catch(() => null)
      : Promise.resolve();

    fonts.then(() => {
      if (dead) return;
      sets = PRODUCTS.map(buildSet);
      pool = buildPool();
      setArt({ sets, pool });
    });

    return () => {
      dead = true;
      sets.forEach((s) => Object.values(s).forEach((t) => t.dispose()));
      if (pool) pool.dispose();
    };
  }, []);

  return art;
}

/* =========================================================
   3D
========================================================= */
const easeOutBack = (p) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

function Cube({ item, tex, pool, index, position, hovered, onHover, reduced }) {
  const root = useRef();
  const mats = useRef([]);
  const poolMat = useRef();
  const st = useRef({ wait: 0, appear: 0, hover: 0 });

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;

    const dt = Math.min(delta, 0.05);
    const s = st.current;
    const t = state.clock.elapsedTime;

    // One orchestrated reveal: cubes pop in left to right, once.
    if (reduced) {
      s.appear = 1;
      s.hover = hovered ? 1 : 0;
    } else {
      s.wait += dt;
      if (s.wait > 0.1 + index * 0.16) {
        s.appear = Math.min(1, s.appear + dt / 1.05);
      }
      s.hover += ((hovered ? 1 : 0) - s.hover) * (1 - Math.exp(-dt * 8));
    }

    const p = s.appear;
    const e = easeOutBack(p);
    const float = reduced ? 0 : Math.sin(t * 0.9 + index * 1.7) * 0.09;
    const sway = reduced
      ? 0
      : Math.sin(t * 0.35 + index * 1.1) * 0.07 + state.pointer.x * 0.2;

    g.position.y = BASE_Y + float + s.hover * 0.3;
    g.rotation.y = Math.PI / 4 + sway + (1 - p) * 1.4;
    g.scale.setScalar(Math.max(0.001, e) * (1 + s.hover * 0.05));

    const b =
      0.92 + s.hover * 0.45 + (reduced ? 0 : Math.sin(t * 2.2 + index * 2) * 0.04);
    mats.current.forEach((m) => m && m.color.setScalar(b));

    if (poolMat.current) poolMat.current.opacity = (0.5 + s.hover * 0.5) * p;
  });

  const setMat = (k) => (m) => {
    mats.current[k] = m;
  };

  return (
    <group position={position}>
      <group
        ref={root}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(index);
        }}
        onPointerOut={() => onHover(-1)}
      >
        <mesh geometry={BOX} material={BODY_MAT} scale={CUBE} />

        {BARS.map((b, k) => (
          <mesh key={k} geometry={BOX} material={FRAME_MAT} position={b.p} scale={b.s} />
        ))}

        {CORNERS.map((p, k) => (
          <mesh key={k} geometry={BOX} material={FRAME_MAT} position={p} scale={0.11} />
        ))}

        {/* Face toward the right of the screen (+Z) */}
        <mesh geometry={PLANE} position={[0, 0, HALF + 0.004]} scale={[SCREEN, SCREEN, 1]}>
          <meshBasicMaterial ref={setMat(0)} map={tex.right} toneMapped={false} />
        </mesh>

        {/* Face toward the left of the screen (-X) */}
        <mesh
          geometry={PLANE}
          position={[-(HALF + 0.004), 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[SCREEN, SCREEN, 1]}
        >
          <meshBasicMaterial ref={setMat(1)} map={tex.left} toneMapped={false} />
        </mesh>

        {/* Top face */}
        <mesh
          geometry={PLANE}
          position={[0, HALF + 0.004, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[SCREEN, SCREEN, 1]}
        >
          <meshBasicMaterial ref={setMat(2)} map={tex.top} toneMapped={false} />
        </mesh>

        {/* Raised icon plate */}
        <mesh
          geometry={BOX}
          material={FRAME_MAT}
          position={[0, HALF + 0.04, 0]}
          scale={[0.98, 0.07, 0.98]}
        >
          <Edges color={item.accent} />
        </mesh>

        <mesh
          geometry={PLANE}
          position={[0, HALF + 0.0765, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.9, 0.9, 1]}
        >
          <meshBasicMaterial ref={setMat(3)} map={tex.icon} toneMapped={false} />
        </mesh>
      </group>

      {/* Coloured light pool on the floor */}
      <mesh
        geometry={PLANE}
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[6.4, 6.4, 1]}
      >
        <meshBasicMaterial
          ref={poolMat}
          map={pool}
          color={item.accent}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <Html position={[0, -0.35, 1.55]} center zIndexRange={[10, 0]}>
        <div
          className={`bn-caption${hovered ? " is-hover" : ""}`}
          style={{ "--accent": item.accent }}
        >
          <span className="bn-caption-name">{item.name}</span>
          <span className="bn-caption-detail">{item.detail}</span>
        </div>
      </Html>
    </group>
  );
}

function Rig({ layout }) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const fov = (FOV * Math.PI) / 180;
    const dist = layout.W / 2 / (Math.tan(fov / 2) * aspect);

    camera.fov = FOV;
    camera.near = 0.1;
    camera.far = 200;
    camera.position.set(
      0,
      TARGET_Y + Math.sin(ELEV) * dist,
      Math.cos(ELEV) * dist,
    );
    camera.lookAt(0, TARGET_Y, 0);
    camera.updateProjectionMatrix();
  }, [camera, size, layout]);

  return null;
}

// The floor only ever ADDS light (reflections) and leaves the canvas alpha
// alone, so it can never show up as a dark rectangle over the section's
// ambient stars: black adds nothing, the reflected cubes add their glow.
function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} renderOrder={-1}>
      <planeGeometry args={[90, 90]} />
      <MeshReflectorMaterial
        blur={[260, 70]}
        resolution={512}
        mixBlur={1}
        mixStrength={2.4}
        mixContrast={1.1}
        roughness={1}
        depthScale={1}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.4}
        color="#000000"
        metalness={0.4}
        mirror={0.75}
        envMapIntensity={0}
        transparent
        depthWrite={false}
        blending={THREE.CustomBlending}
        blendEquation={THREE.AddEquation}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
      />
    </mesh>
  );
}

function Scene({ art, layout, hovered, setHovered, reduced }) {
  const { cols, rows, W, zStep } = layout;

  return (
    <>
      <Rig layout={layout} />

      {/* Local studio lighting, no network fetch */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#ffffff"
          position={[0, 5, 4]}
          scale={[10, 2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={5}
          color="#4de3ff"
          position={[-6, 1, 3]}
          scale={[2, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={5}
          color="#ff5f8f"
          position={[6, 1, 3]}
          scale={[2, 6, 1]}
        />
        <Lightformer
          form="ring"
          intensity={2}
          color="#ffd6df"
          position={[0, -2, 6]}
          scale={4}
        />
      </Environment>

      <Floor />

      <Sparkles
        count={70}
        scale={[W * 0.95, 5, Math.max(6, rows * 6)]}
        position={[0, 2.2, 0]}
        size={2.2}
        speed={0.25}
        opacity={0.55}
        color="#9fdcff"
      />

      {PRODUCTS.map((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        return (
          <Cube
            key={item.name}
            item={item}
            tex={art.sets[i]}
            pool={art.pool}
            index={i}
            position={[
              (col - (cols - 1) / 2) * SPACING_X,
              0,
              (row - (rows - 1) / 2) * zStep,
            ]}
            hovered={hovered === i}
            onHover={setHovered}
            reduced={reduced}
          />
        );
      })}
    </>
  );
}

/* =========================================================
   SECTION
========================================================= */
export default function BuildNext() {
  const hostRef = useRef(null);

  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(-1);

  const art = useArtwork();
  const webgl = useMemo(supportsWebGL, []);
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only render while on screen (Hero and Earth already run canvases)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "150px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hover cursor feedback is left to the cubes themselves; make sure a
  // stale hover never sticks when the pointer leaves the section.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const clear = () => setHovered(-1);
    el.addEventListener("pointerleave", clear);
    return () => el.removeEventListener("pointerleave", clear);
  }, []);

  const layout = useMemo(() => (width ? getLayout(width) : null), [width]);
  const height = layout ? Math.round((width * layout.H) / layout.W) : 0;

  return (
    <section className="bn-section" id="products">
      <SectionStars />

      <div className="bn-head">
        <div className="bn-eyebrow">// FROM IDEAS TO IMPACT</div>

        <h2 className="bn-heading" data-text={HEADING}>
          <span className="bn-heading-text">
            <ScrambleText text={HEADING} />
          </span>
        </h2>
      </div>

      <div className="bn-stage" ref={hostRef}>
        {layout && webgl && (
          <div className="bn-canvas" style={{ height }}>
            <Canvas
              dpr={[1, 1.75]}
              camera={{ fov: FOV, position: [0, 8, 20], near: 0.1, far: 200 }}
              gl={{ alpha: true, antialias: true }}
              frameloop={active ? (reduced ? "demand" : "always") : "never"}
            >
              {art && (
                <Scene
                  art={art}
                  layout={layout}
                  hovered={hovered}
                  setHovered={setHovered}
                  reduced={reduced}
                />
              )}
            </Canvas>
          </div>
        )}

        {!webgl && (
          <ul className="bn-fallback">
            {PRODUCTS.map((item) => (
              <li key={item.name} style={{ "--accent": item.accent }}>
                <span className="bn-caption-name">{item.name}</span>
                <span className="bn-caption-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
