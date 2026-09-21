import React, { useMemo } from "react";
import "./SectionStars.css";

/* Deterministic pseudo-random so stars never jump between renders */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starField(count, seed, maxSize) {
  const rnd = mulberry(seed);
  return Array.from({ length: count }, () => {
    const x = (rnd() * 2000).toFixed(0);
    const y = (rnd() * 1200).toFixed(0);
    const s = (0.5 + rnd() * maxSize).toFixed(2);
    const a = (0.12 + rnd() * 0.5).toFixed(2);
    return `${x}px ${y}px ${s}px rgba(245,225,232,${a})`;
  }).join(",");
}

export default function SectionStars() {
  const far = useMemo(() => starField(70, 11, 1.1), []);
  const near = useMemo(() => starField(36, 47, 1.8), []);

  return (
    <div className="section-stars" aria-hidden="true">
      <i className="section-stars-layer" style={{ boxShadow: far }} />
      <i
        className="section-stars-layer section-stars-near"
        style={{ boxShadow: near }}
      />
    </div>
  );
}
