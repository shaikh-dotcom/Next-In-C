import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Award } from "lucide-react";
import ScrambleText from "./ScrambleText";
import MiniMeLogo from "./MiniMeLogo";
import MiniMeGlass from "./MiniMeGlass";
import "./MiniMe.css";

/*
 * Mini Me: the flagship showcase.
 *
 * The idea: Mini Me is "connected by multiple agents", so the logo sits
 * inside a rotating award seal, with a small network of agents wired
 * into it. Three of those agents are the three product features. Hover
 * a feature (or its node) and that agent lights up, its data packets
 * speed up, and its description appears. Left alone, the section
 * cycles through them.
 *
 * When WebGL is available, MiniMeGlass replaces the flat logo tile and the
 * three feature nodes with glass. The canvas below still owns the network and
 * shares node positions with it through `shared`; without WebGL it falls back
 * to the flat tile and nodes.
 *
 * Copy lives in FEATURES / CTA below. The three `detail` sentences are
 * placeholder wording, so replace them with what Mini Me really does.
 */

const CTA = { label: "Coming Soon", href: "#contact" };

const FEATURES = [
  {
    name: "Fast Execution",
    rgb: [20, 200, 157],
    detail: "Agents split the work between them and run it in parallel.",
  },
  {
    name: "Detailed Results",
    rgb: [255, 139, 150],
    detail: "Every step is traced, so you can see how each answer was reached.",
  },
  {
    name: "Customizable",
    rgb: [255, 172, 0],
    detail: "Shape the agents, tools and workflow around how your team builds.",
  },
];

/* =========================================================
   AGENT NETWORK  (canvas 2D)

   Everything is authored on a 560 x 560 stage and scaled to the
   real size. The topology is fixed:

     hub points (just outside the seal)  ->  3 feature agents
     3 relay agents between the features ->  linked to both neighbours
     3 outer agents, one behind each feature

   Data packets travel along those links.
========================================================= */
const TAU = Math.PI * 2;
const STAGE = 560;
const HUB_R = 127; // just outside the text ring of the seal
const R_FEATURE = 170;
const R_RELAY = 205;
const R_OUTER = 246;

const FEATURE_ANGLES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const RELAY_ANGLES = [-Math.PI / 6, Math.PI / 2, (7 * Math.PI) / 6];

// node index map: 0-2 features, 3-5 relays, 6-8 outer, 9-11 hub points
const NODE_DEFS = (() => {
  const d = [];
  FEATURE_ANGLES.forEach((ang, fi) =>
    d.push({ kind: "f", ang, R: R_FEATURE, fi }),
  );
  RELAY_ANGLES.forEach((ang, fi) => d.push({ kind: "r", ang, R: R_RELAY, fi }));
  FEATURE_ANGLES.forEach((ang, fi) =>
    d.push({ kind: "o", ang, R: R_OUTER, fi }),
  );
  FEATURE_ANGLES.forEach((ang, fi) => d.push({ kind: "h", ang, R: HUB_R, fi }));
  return d;
})();

const EDGES = [
  ...[0, 1, 2].map((i) => ({
    a: 9 + i,
    b: i,
    fi: [i],
    rate: 0.75,
    kind: "hub",
  })),
  ...[0, 1, 2].map((i) => ({
    a: 6 + i,
    b: i,
    fi: [i],
    rate: 0.5,
    kind: "out",
  })),
  ...[0, 1, 2].flatMap((j) => [
    { a: 3 + j, b: j, fi: [j], rate: 0.22, kind: "mid" },
    { a: 3 + j, b: (j + 1) % 3, fi: [(j + 1) % 3], rate: 0.22, kind: "mid" },
  ]),
  ...[0, 1, 2].map((i) => ({
    a: i,
    b: (i + 1) % 3,
    fi: [i, (i + 1) % 3],
    rate: 0.1,
    kind: "tri",
  })),
];

const MONO = '"Courier New", Courier, monospace';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function AgentField({ active, highlight, onPick, reduced, shared, glass }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const hiRef = useRef(highlight);
  const pickRef = useRef(onPick);
  const glassRef = useRef(glass);

  glassRef.current = glass;
  hiRef.current = highlight;
  pickRef.current = onPick;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas.parentElement;
    const ctx = canvas.getContext("2d");

    let w = 0;
    let h = 0;
    let s = 1;
    let raf = 0;
    let last = 0;
    let time = 0;
    let appearT = reduced ? 9 : 0;
    let hubGlow = 0;
    let lastPick = -1;

    const nodes = NODE_DEFS.map((d) => ({ ...d, x: 0, y: 0, a: 0, pulse: 0 }));
    const hi = [0, 0, 0];
    const packets = [];
    const flashes = [];

    const dust = (() => {
      const r = seeded(5);
      return Array.from({ length: 46 }, () => ({
        x: r(),
        y: r(),
        p: r() * TAU,
        sp: 0.4 + r() * 0.9,
        z: 0.4 + r() * 1.2,
      }));
    })();

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = r.width;
      h = r.height;
      s = w / STAGE;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const place = () => {
      const cx = w / 2;
      const cy = h / 2;
      const sway = reduced ? 0 : Math.sin(time * 0.25) * 0.09;

      nodes.forEach((n, i) => {
        const bob =
          reduced || n.kind === "h" ? 0 : Math.sin(time * 0.8 + i * 1.3) * 3;
        const R = (n.R + bob) * s;
        const ang = n.ang + sway;
        n.x = cx + Math.cos(ang) * R;
        n.y = cy + Math.sin(ang) * R;
      });
    };

    const delayOf = (n) => {
      if (n.kind === "f") return 0.35 + n.fi * 0.14;
      if (n.kind === "h") return 0.5;
      if (n.kind === "r") return 0.8 + n.fi * 0.1;
      return 1.1 + n.fi * 0.1;
    };

    const edgeLen = (e) =>
      Math.hypot(nodes[e.a].x - nodes[e.b].x, nodes[e.a].y - nodes[e.b].y) || 1;

    const update = (dt) => {
      time += dt;
      appearT += dt;

      nodes.forEach((n) => {
        n.a = easeOut((appearT - delayOf(n)) / 0.6);
        n.pulse = Math.max(0, n.pulse - dt * 2.2);
      });

      for (let i = 0; i < 3; i += 1) {
        const target = hiRef.current === i ? 1 : 0;
        hi[i] = reduced
          ? target
          : hi[i] + (target - hi[i]) * Math.min(1, dt * 5);
      }

      hubGlow = Math.max(0, hubGlow - dt * 1.6);
      place();

      // hand the glass layer what it needs to stay locked to the network
      const sh = shared.current;
      sh.w = w;
      sh.h = h;
      sh.s = s;
      sh.app = easeOut(appearT / 1.2);
      sh.hubGlow = hubGlow;
      for (let i = 0; i < 3; i += 1) {
        const f = sh.f[i];
        f.x = nodes[i].x;
        f.y = nodes[i].y;
        f.a = nodes[i].a;
        f.pulse = nodes[i].pulse;
        sh.hi[i] = hi[i];
      }

      if (!reduced && appearT > 1.7 && dt > 0) {
        EDGES.forEach((e, ei) => {
          const lift = e.fi.reduce((m, f) => Math.max(m, hi[f]), 0);
          const rate = e.rate * (1 + lift * 3.2);

          if (Math.random() < rate * dt && packets.length < 48) {
            const bidir = e.kind === "hub" || e.kind === "tri";
            const dir = bidir && Math.random() < 0.5 ? -1 : 1;
            packets.push({
              ei,
              dir,
              t: dir > 0 ? 0 : 1,
              v: 0.8 + Math.random() * 0.4,
            });
          }
        });
      }

      for (let i = packets.length - 1; i >= 0; i -= 1) {
        const p = packets[i];
        const e = EDGES[p.ei];
        p.t += p.dir * ((150 * s * p.v) / edgeLen(e)) * dt;

        if (p.t > 1 || p.t < 0) {
          const end = p.dir > 0 ? e.b : e.a;

          if (end < 3) nodes[end].pulse = 1;

          if (end >= 9) {
            flashes.push({
              x: nodes[end].x,
              y: nodes[end].y,
              rgb: FEATURES[e.fi[0]].rgb,
              age: 0,
            });
            hubGlow = Math.min(1, hubGlow + 0.35);
          }

          packets.splice(i, 1);
        }
      }

      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        flashes[i].age += dt;
        if (flashes[i].age > 0.6) flashes.splice(i, 1);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const app = easeOut(appearT / 1.2);

      // Core glow behind the seal
      const pulse = reduced ? 0 : (Math.sin(time * 1.1) * 0.5 + 0.5) * 0.05;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 215 * s);
      core.addColorStop(
        0,
        `rgba(255,32,82,${(0.2 + pulse + hubGlow * 0.25) * app})`,
      );
      core.addColorStop(1, "rgba(255,32,82,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);

      // Dust
      dust.forEach((d) => {
        const tw = 0.5 + 0.5 * Math.sin(time * d.sp + d.p);
        ctx.fillStyle = `rgba(245,217,223,${(0.08 + 0.22 * tw) * app})`;
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.z * s * 1.1, 0, TAU);
        ctx.fill();
      });

      // Orbits
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.055 * app})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R_FEATURE * s, 0, TAU);
      ctx.stroke();

      ctx.setLineDash([2 * s, 9 * s]);
      ctx.strokeStyle = `rgba(255,255,255,${0.09 * app})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R_OUTER * s, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // Links
      EDGES.forEach((e) => {
        const A = nodes[e.a];
        const B = nodes[e.b];
        const al = Math.min(A.a, B.a);
        if (al <= 0.01) return;

        const lift = e.fi.reduce((m, f) => Math.max(m, hi[f]), 0);
        const rgb = FEATURES[e.fi[0]].rgb;
        const base =
          e.kind === "hub"
            ? 0.28
            : e.kind === "out"
              ? 0.16
              : e.kind === "mid"
                ? 0.12
                : 0.08;
        const boost = e.kind === "hub" ? 0.65 : 0.45;

        ctx.save();
        if (lift > 0.05) {
          ctx.shadowColor = `rgb(${rgb})`;
          ctx.shadowBlur = 10 * lift;
        }
        ctx.strokeStyle = `rgba(${rgb},${(base + lift * boost) * al})`;
        ctx.lineWidth = (1 + lift * 1.1) * s;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
        ctx.restore();
      });

      // Packets
      packets.forEach((p) => {
        const e = EDGES[p.ei];
        const A = nodes[e.a];
        const B = nodes[e.b];
        const rgb = FEATURES[e.fi[0]].rgb;

        const x = A.x + (B.x - A.x) * p.t;
        const y = A.y + (B.y - A.y) * p.t;
        const back = (16 * s) / edgeLen(e);
        const t0 = clamp01(p.t - p.dir * back);
        const tx = A.x + (B.x - A.x) * t0;
        const ty = A.y + (B.y - A.y) * t0;

        const trail = ctx.createLinearGradient(tx, ty, x, y);
        trail.addColorStop(0, `rgba(${rgb},0)`);
        trail.addColorStop(1, `rgba(${rgb},0.9)`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = `rgb(${rgb})`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.4 * s, 0, TAU);
        ctx.fill();
        ctx.restore();
      });

      // Arrival flashes at the seal
      flashes.forEach((f) => {
        const k = f.age / 0.6;
        const g = ctx.createRadialGradient(
          f.x,
          f.y,
          0,
          f.x,
          f.y,
          (10 + 30 * k) * s,
        );
        g.addColorStop(0, `rgba(${f.rgb},${(1 - k) * 0.7})`);
        g.addColorStop(1, `rgba(${f.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, (10 + 30 * k) * s, 0, TAU);
        ctx.fill();
      });

      // Outer + relay agents (quiet)
      nodes.forEach((n) => {
        if (n.kind !== "o" && n.kind !== "r") return;
        const r = (n.kind === "r" ? 5 : 4) * s * (0.6 + 0.4 * n.a);

        ctx.fillStyle = `rgba(10,11,17,${n.a})`;
        ctx.strokeStyle = `rgba(245,217,223,${0.45 * n.a})`;
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      });

      // Hub points
      nodes.forEach((n) => {
        if (n.kind !== "h" || n.a <= 0.01) return;
        const rgb = FEATURES[n.fi].rgb;
        ctx.fillStyle = `rgba(${rgb},${0.85 * n.a})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.4 * s, 0, TAU);
        ctx.fill();
      });

      // Feature agents
      const showLabels = w >= 460;

      nodes.slice(0, 3).forEach((n, i) => {
        if (n.a <= 0.01) return;

        const rgb = FEATURES[i].rgb;
        const f = hi[i];
        const r = 10 * s * (0.6 + 0.4 * n.a);

        const glow = ctx.createRadialGradient(
          n.x,
          n.y,
          0,
          n.x,
          n.y,
          (26 + 18 * f) * s,
        );
        glow.addColorStop(0, `rgba(${rgb},${(0.16 + 0.3 * f) * n.a})`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, (26 + 18 * f) * s, 0, TAU);
        ctx.fill();

        // with glass on, the puck itself is the node: ripples start at its rim
        const glass = glassRef.current;

        if (f > 0.05 && !reduced) {
          const ph = (time * 0.7) % 1;
          ctx.strokeStyle = `rgba(${rgb},${(1 - ph) * 0.6 * f})`;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ((glass ? 27 : 10) + ph * 30) * s, 0, TAU);
          ctx.stroke();
        }

        if (!glass) {
          ctx.strokeStyle = `rgba(${rgb},${(0.35 + 0.5 * f) * n.a})`;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.arc(n.x, n.y, (15 + n.pulse * 4) * s, 0, TAU);
          ctx.stroke();

          ctx.fillStyle = `rgba(10,11,17,${n.a})`;
          ctx.strokeStyle = `rgba(${rgb},${0.9 * n.a})`;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, TAU);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = `rgba(${rgb},${(0.7 + 0.3 * f) * n.a})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, (3.5 + 2 * f + n.pulse * 2) * s, 0, TAU);
          ctx.fill();
        }

        if (showLabels) {
          ctx.save();
          ctx.font = `600 ${Math.max(9.5, 10.5 * s)}px ${MONO}`;
          ctx.textBaseline = "middle";
          if ("letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
          ctx.fillStyle = `rgba(${rgb},${(0.42 + 0.58 * f) * n.a})`;

          const text = FEATURES[i].name.toUpperCase();
          if (i === 0) {
            ctx.textAlign = "center";
            ctx.fillText(text, n.x, n.y - (glass ? 42 : 27) * s);
          } else if (i === 1) {
            ctx.textAlign = "left";
            ctx.fillText(text, n.x + (glass ? 39 : 22) * s, n.y + 2 * s);
          } else {
            ctx.textAlign = "right";
            ctx.fillText(text, n.x - (glass ? 39 : 22) * s, n.y + 2 * s);
          }
          ctx.restore();
        }
      });
    };

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
    };

    const start = () => {
      if (raf || reduced) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const redraw = () => {
      update(0);
      draw();
    };

    apiRef.current = { start, stop, redraw };

    // Hover / tap a feature agent to select it
    const onMove = (ev) => {
      const r = canvas.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;

      let best = -1;
      let bd = (38 * s) ** 2;
      for (let i = 0; i < 3; i += 1) {
        const dx = nodes[i].x - x;
        const dy = nodes[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }

      if (best !== lastPick) {
        lastPick = best;
        host.style.cursor = best >= 0 ? "pointer" : "";
        pickRef.current(best);
      }
    };

    const onLeave = () => {
      if (lastPick !== -1) {
        lastPick = -1;
        host.style.cursor = "";
        pickRef.current(-1);
      }
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerdown", onMove);
    host.addEventListener("pointerleave", onLeave);

    resize();
    update(0);
    draw();

    const observer = new ResizeObserver(() => {
      resize();
      if (!raf) redraw();
    });
    observer.observe(host);

    return () => {
      stop();
      observer.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.style.cursor = "";
    };
  }, [reduced]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    if (active) api.start();
    else api.stop();
  }, [active]);

  useEffect(() => {
    if (reduced && apiRef.current) apiRef.current.redraw();
  }, [highlight, reduced]);

  return <canvas ref={canvasRef} className="mm-canvas" aria-hidden="true" />;
}

/* =========================================================
   SEAL  (rotating text ring + tick ring around the logo)
========================================================= */
const SEAL_TEXT =
  "FLAGSHIP PROJECT  •  NEXT GEN AI  •  FLAGSHIP PROJECT  •  NEXT GEN AI  •  ";

const TICKS = Array.from({ length: 90 }, (_, i) => {
  const a = (i / 90) * TAU;
  const long = i % 5 === 0;
  const r1 = long ? 95 : 99;
  const r2 = 106;

  return {
    x1: 150 + Math.cos(a) * r1,
    y1: 150 + Math.sin(a) * r1,
    x2: 150 + Math.cos(a) * r2,
    y2: 150 + Math.sin(a) * r2,
    long,
  };
});

function SealText() {
  return (
    <svg
      className="mm-seal mm-seal-text"
      viewBox="0 0 300 300"
      aria-hidden="true"
    >
      <defs>
        <path
          id="mm-seal-path"
          d="M150 150 m-119 0 a119 119 0 1 1 238 0 a119 119 0 1 1 -238 0"
        />
      </defs>
      <text>
        <textPath href="#mm-seal-path" textLength="744" lengthAdjust="spacing">
          {SEAL_TEXT}
        </textPath>
      </text>
    </svg>
  );
}

function SealTicks() {
  return (
    <svg
      className="mm-seal mm-seal-ticks"
      viewBox="0 0 300 300"
      aria-hidden="true"
    >
      {TICKS.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.long ? "rgba(255,32,82,0.75)" : "rgba(255,255,255,0.16)"}
          strokeWidth={t.long ? 1.4 : 1}
        />
      ))}
    </svg>
  );
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* =========================================================
   SECTION
========================================================= */
export default function MiniMe() {
  const sectionRef = useRef(null);

  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);

  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const glass = useMemo(supportsWebGL, []);

  // network -> glass: node positions, highlight amounts, hub glow
  const shared = useRef({
    w: 1,
    h: 1,
    s: 1,
    app: 0,
    hubGlow: 0,
    hi: [0, 0, 0],
    f: [0, 1, 2].map(() => ({ x: 0, y: 0, a: 0, pulse: 0 })),
  });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Walk through the three features until someone interacts
  useEffect(() => {
    if (!visible || paused || reduced) return undefined;

    const id = setInterval(
      () => setCycle((c) => (c + 1) % FEATURES.length),
      3600,
    );
    return () => clearInterval(id);
  }, [visible, paused, reduced]);

  const select = (i) => {
    setCycle(i);
    setPaused(true);
  };

  const release = () => setPaused(false);

  const pick = (i) => {
    if (i >= 0) select(i);
    else release();
  };

  const onVisualMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const current = FEATURES[cycle];

  return (
    <section className="mm-section" id="mini-me" ref={sectionRef}>
      <div className={`mm-card${seen ? " is-in" : ""}`}>
        <div className="mm-copy">
          <div className="mm-chips">
            <span className="mm-chip mm-chip-flag">
              <Award aria-hidden="true" />
              Flagship project
            </span>
            <span className="mm-chip">Next gen AI</span>
          </div>

          <h2 className="mm-title" data-text="Mini Me">
            <span className="mm-title-text">
              <ScrambleText text="Mini Me" />
            </span>
          </h2>

          <p className="mm-lede">
            The revolutionary AI that changes the future. Connected by multiple
            agents to futurize engineering.
          </p>

          <ul className="mm-features">
            {FEATURES.map((f, i) => (
              <li key={f.name}>
                <button
                  type="button"
                  className={`mm-feature${cycle === i ? " is-active" : ""}`}
                  style={{ "--rgb": f.rgb.join(",") }}
                  onPointerEnter={() => select(i)}
                  onPointerLeave={release}
                  onFocus={() => select(i)}
                  onBlur={release}
                  onClick={() => select(i)}
                >
                  <span className="mm-dot" />
                  {f.name}
                </button>
              </li>
            ))}
          </ul>

          <p
            className="mm-note"
            key={cycle}
            style={{ "--rgb": current.rgb.join(",") }}
          >
            {current.detail}
          </p>

          <a className="mm-cta" href={CTA.href}>
            {CTA.label}
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>

        <div className="mm-visual" onPointerMove={onVisualMove}>
          <div className="mm-beam" />

          <div className="mm-stage">
            <AgentField
              active={visible}
              highlight={cycle}
              onPick={pick}
              reduced={reduced}
              shared={shared}
              glass={glass}
            />

            <SealTicks />
            <SealText />

            {glass ? (
              <MiniMeGlass
                shared={shared}
                features={FEATURES}
                active={visible}
                reduced={reduced}
                highlight={cycle}
              />
            ) : (
              <div className="mm-tile">
                <MiniMeLogo className="mm-logo" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
