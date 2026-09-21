import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowUpRight } from "lucide-react";
import ScrambleText from "./ScrambleText";
import SectionStars from "./SectionStars";
import "./Founders.css";

/*
 * Founders + Contact.
 *
 * Three glass portrait panels stand in a row under one lamp. Hover
 * (or focus, or tap) opens one panel into its story; three threads run
 * down from the panels and meet at the contact block.
 *
 * Everything you will want to change later lives in the block below.
 * All copy, links and photo paths are placeholders.
 *
 * Photos: drop files into /public/founders/. While `cutout` is false
 * the photo is treated as a plain rectangle (feathered into the panel).
 * Once you have transparent cutouts, set `cutout: true` for that person
 * and the ghost letters will show behind the head with a rim light.
 * If a photo fails to load, a silhouette is shown instead.
 */

const INTRO =
  "Three engineers who wanted better tools and ended up building a company around them.";

const CONTACT = {
  kicker: "Let's build something",
  title: "Ready to work with us?",
  note: "Write to us and we reply within two working days.",
  label: "Get in touch",
  // Swap for the contact page later (for example "/contact").
  href: "mailto:hello@nextinc.com",
  email: "hello@nextinc.com",
  locationsHref: "#locations",
};

const FOUNDERS = [
  {
    id: "arib-labib",
    name: "Arib Labib",
    role: "Founder & CEO",
    ghost: "CEO",
    photo: "/founders/arib-labib.jpg",
    cutout: false,
    bio: "Sets the direction for Mini Me and the company around it. Placeholder bio: replace with two real sentences.",
    owns: ["Product vision", "Strategy", "Hiring"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
  {
    id: "shuaib-islam",
    name: "Shuaib Islam",
    role: "Co-founder & CTO",
    ghost: "CTO",
    photo: "/founders/shuaib-islam.jpg",
    cutout: false,
    bio: "Designs the agent architecture that Mini Me runs on. Placeholder bio: replace with two real sentences.",
    owns: ["Architecture", "Agents", "Infrastructure"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
  {
    id: "shaikh-muhammad",
    name: "Shaikh Muhammad",
    role: "Co-founder & COO",
    ghost: "COO",
    photo: "/founders/shaikh-muhammad.jpg",
    cutout: false,
    bio: "Keeps the work shipping and the team pointed the same way. Placeholder bio: replace with two real sentences.",
    owns: ["Operations", "Partnerships", "Delivery"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
];

const THREAD_H = 96;

/* =========================================================
   ICONS (inline, so nothing depends on the icon library's
   brand set)
========================================================= */
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1-.01 5 2.5 2.5 0 0 1 .01-5zM3 9.75h4V21H3V9.75zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4V9.75z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = {
  linkedin: { label: "LinkedIn", Icon: LinkedInIcon },
  github: { label: "GitHub", Icon: GithubIcon },
  x: { label: "X", Icon: XIcon },
};

/* =========================================================
   PORTRAIT
   Two stacked copies of the same photo: a duotone base and a
   natural-colour layer that fades in on hover. The duotone is an
   SVG filter (see <FilterDefs />), so it respects transparency
   and the original file stays untouched.
========================================================= */
function Silhouette() {
  return (
    <svg className="fp-silhouette" viewBox="0 0 200 260" aria-hidden="true">
      <defs>
        <linearGradient id="fp-sil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5d9df" stopOpacity="0.22" />
          <stop offset="1" stopColor="#a83b59" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="92" r="44" fill="url(#fp-sil)" />
      <path d="M20 260c0-70 40-96 80-96s80 26 80 96z" fill="url(#fp-sil)" />
    </svg>
  );
}

function Portrait({ founder }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className="fp-portrait fp-missing" aria-hidden="true">
        <Silhouette />
      </div>
    );
  }

  return (
    <div className={`fp-portrait ${founder.cutout ? "is-cutout" : "is-rect"}`}>
      <img
        className="fp-img fp-img-duo"
        src={founder.photo}
        alt={`${founder.name}, ${founder.role}`}
        loading="lazy"
        decoding="async"
        onError={() => setMissing(true)}
      />
      <img
        className="fp-img fp-img-color"
        src={founder.photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/* Shared duotone: shadows go to Ink, mid-tones to Wine, highlights to Blush */
function FilterDefs() {
  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <filter id="fx-duo" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.4 0.4 0.4 0 -0.1  0.4 0.4 0.4 0 -0.1  0.4 0.4 0.4 0 -0.1  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.02 0.4 0.96" />
            <feFuncG type="table" tableValues="0.02 0.08 0.85" />
            <feFuncB type="table" tableValues="0.04 0.16 0.87" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

/* =========================================================
   PANEL
========================================================= */
function FounderPanel({
  founder,
  index,
  count,
  active,
  setActive,
  colRef,
  down,
  reduced,
}) {
  const open = active === index;
  const t = count > 1 ? index / (count - 1) : 0.5;

  // Each panel is lit from the side that faces the lamp
  const style = {
    "--i": index,
    "--lx": `${Math.round(86 - t * 72)}%`,
    "--ang": t < 0.34 ? "225deg" : t > 0.66 ? "135deg" : "180deg",
    "--rim-x": `${Math.round((0.5 - t) * 10)}px`,
    "--rim-y": "-2px",
  };

  const moreId = `fp-more-${founder.id}`;

  const onMove = (e) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const onLeave = (e) => {
    e.currentTarget.style.setProperty("--mx", "-400px");
    e.currentTarget.style.setProperty("--my", "-400px");
  };

  const onDown = (e) => {
    down.current = { type: e.pointerType, wasActive: open };
  };

  // Touch and pen: tap opens, tap again closes. Mouse and keyboard use
  // hover and focus instead.
  const onClick = (e) => {
    if (e.target.closest("a")) return;
    const d = down.current;
    if (d.type === "mouse" || d.type === "key") return;
    setActive(d.wasActive ? -1 : index);
  };

  return (
    <li
      className={`fx-col${open ? " is-active" : ""}`}
      style={style}
      ref={colRef}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setActive(index);
      }}
    >
      <article
        className="fp"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onClick={onClick}
        onFocus={() => setActive(index)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setActive((cur) => (cur === index ? -1 : cur));
          }
        }}
        onKeyDown={(e) => {
          down.current = { type: "key", wasActive: open };
          if (e.key === "Escape") setActive(-1);
        }}
      >
        <span className="fp-dots" aria-hidden="true" />
        <span className="fp-ghost" aria-hidden="true">
          {founder.ghost}
        </span>

        <Portrait founder={founder} />

        <span className="fp-lift" aria-hidden="true" />
        <span className="fp-rim" aria-hidden="true" />

        <div className="fp-plate">
          <h3 className="fp-name">
            <button
              type="button"
              className="fp-toggle"
              aria-expanded={open}
              aria-controls={moreId}
            >
              {founder.name}
            </button>
          </h3>
          <p className="fp-role">{founder.role}</p>

          <div className="fp-more" id={moreId}>
            <div className="fp-more-inner">
              <p className="fp-bio">{founder.bio}</p>

              <ul className="fp-chips">
                {founder.owns.map((c) => (
                  <li key={c} className="fp-chip">
                    {c}
                  </li>
                ))}
              </ul>

              <ul className="fp-socials">
                {Object.entries(founder.links).map(([key, href]) => {
                  const s = SOCIALS[key];
                  if (!s) return null;
                  const { Icon } = s;
                  return (
                    <li key={key}>
                      <a
                        className="fp-social"
                        href={href}
                        aria-label={`${founder.name} on ${s.label}`}
                      >
                        <Icon />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </article>

      <span className="fp-bead" aria-hidden="true" />
    </li>
  );
}

/* =========================================================
   THREAD
   Three lines drop from the panel beads and meet at the contact
   block. Paths are re-measured from the real panel positions, so
   they follow the accordion while it moves. Hovering a panel sends
   one light packet down its line; on arrival the contact block
   glows once.
========================================================= */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function FounderThread({ count, colRefs, rowRef, active, reduced, onArrive }) {
  const svgRef = useRef(null);
  const pathRefs = useRef([]);
  const hubRef = useRef(null);
  const packetRef = useRef(null);

  const layout = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const box = svg.getBoundingClientRect();
    const cx = box.width / 2;

    pathRefs.current.forEach((p, i) => {
      const col = colRefs.current[i];
      if (!p || !col) return;

      const r = col.getBoundingClientRect();
      const x = r.left - box.left + r.width / 2;

      p.setAttribute(
        "d",
        `M ${x} 0 C ${x} ${THREAD_H * 0.55}, ${cx} ${THREAD_H * 0.4}, ${cx} ${THREAD_H}`,
      );
    });

    const hub = hubRef.current;
    if (hub) {
      hub.setAttribute("cx", cx);
      hub.setAttribute("cy", THREAD_H);
    }
  }, [colRefs]);

  useEffect(() => {
    layout();

    const row = rowRef.current;
    const observer = new ResizeObserver(layout);
    if (row) observer.observe(row);
    window.addEventListener("resize", layout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", layout);
    };
  }, [layout, rowRef]);

  // Keep the lines glued to the panels while the accordion moves, and
  // run the packet for the hovered panel.
  useEffect(() => {
    const packet = packetRef.current;
    const path = active >= 0 ? pathRefs.current[active] : null;

    const t0 = performance.now();
    const settleUntil = t0 + (reduced ? 0 : 700);
    let packetDone = reduced || !path;
    let raf = 0;

    const tick = (now) => {
      layout();

      if (!packetDone && path && packet) {
        const p = clamp01((now - t0 - 150) / 1100);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const pt = path.getPointAtLength(path.getTotalLength() * e);

        packet.setAttribute("cx", pt.x);
        packet.setAttribute("cy", pt.y);
        packet.style.opacity = p > 0 ? 1 : 0;

        if (p >= 1) {
          packetDone = true;
          packet.style.opacity = 0;
          onArrive();
        }
      }

      if (!packetDone || now < settleUntil) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (packet) packet.style.opacity = 0;
    };
  }, [active, reduced, layout, onArrive]);

  return (
    <svg
      className="fx-thread"
      ref={svgRef}
      height={THREAD_H}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="fx-thread-grad"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={THREAD_H}
        >
          <stop offset="0" stopColor="#a83b59" />
          <stop offset="1" stopColor="#65081f" />
        </linearGradient>
      </defs>

      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          ref={(el) => {
            pathRefs.current[i] = el;
          }}
          pathLength="1"
          className={`fx-thread-path${active === i ? " is-hot" : ""}`}
        />
      ))}

      <circle ref={hubRef} r="4" className="fx-thread-hub" />
      <circle ref={packetRef} r="3" className="fx-thread-packet" />
    </svg>
  );
}

/* =========================================================
   SECTION
========================================================= */
export default function Founders() {
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const contactRef = useRef(null);
  const colRefs = useRef([]);
  const down = useRef({ type: "mouse", wasActive: false });
  const pulseTimer = useRef(0);

  const [active, setActive] = useState(-1);
  const [seen, setSeen] = useState(false);

  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // "Lights on" once, when the section is about a quarter visible
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Touch: tapping outside the row closes the open panel
  useEffect(() => {
    const onDoc = (e) => {
      const row = rowRef.current;
      if (row && !row.contains(e.target)) setActive(-1);
    };

    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  useEffect(() => () => clearTimeout(pulseTimer.current), []);

  const pulse = useCallback(() => {
    const el = contactRef.current;
    if (!el) return;

    el.classList.remove("is-pulse");
    // restart the animation if it is already running
    void el.offsetWidth;
    el.classList.add("is-pulse");

    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(
      () => el.classList.remove("is-pulse"),
      1000,
    );
  }, []);

  return (
    <section
      className={`fx-section${seen ? " is-in" : ""}`}
      id="founders"
      ref={sectionRef}
      aria-labelledby="fx-title"
    >
      <FilterDefs />

      <div className="fx-stars" aria-hidden="true">
        <SectionStars />
      </div>

      <div className="fx-wrap">
        <header className="fx-head">
          <h2 className="fx-title" id="fx-title" data-text="Meet the Founders">
            <span className="fx-title-text">
              <ScrambleText text="Meet the Founders" />
            </span>
          </h2>

          <p className="fx-intro">{INTRO}</p>
        </header>

        <div className="fx-stage">
          <div className="fx-beam" aria-hidden="true" />
          <div className="fx-lamp" aria-hidden="true" />

          <ul
            className="fx-row"
            ref={rowRef}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setActive(-1);
            }}
          >
            {FOUNDERS.map((f, i) => (
              <FounderPanel
                key={f.id}
                founder={f}
                index={i}
                count={FOUNDERS.length}
                active={active}
                setActive={setActive}
                colRef={(el) => {
                  colRefs.current[i] = el;
                }}
                down={down}
                reduced={reduced}
              />
            ))}
          </ul>

          <div className="fx-floor" aria-hidden="true" />
        </div>

        <FounderThread
          count={FOUNDERS.length}
          colRefs={colRefs}
          rowRef={rowRef}
          active={active}
          reduced={reduced}
          onArrive={pulse}
        />
        <div className="fx-stem" aria-hidden="true" />

        <div className="fx-contact" id="contact" ref={contactRef}>
          <span className="fx-contact-dots" aria-hidden="true" />
          <span className="fx-contact-glow" aria-hidden="true" />

          <div className="fx-contact-copy">
            <p className="fx-contact-kicker">{CONTACT.kicker}</p>

            <h2 className="fx-contact-title" data-text={CONTACT.title}>
              <span className="fx-title-text">
                <ScrambleText text={CONTACT.title} />
              </span>
            </h2>

            <p className="fx-contact-note">{CONTACT.note}</p>
          </div>

          <div className="fx-contact-actions">
            <a className="fx-cta" href={CONTACT.href}>
              {CONTACT.label}
              <ArrowUpRight aria-hidden="true" />
            </a>

            <div className="fx-contact-links">
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={CONTACT.locationsHref}>Locations</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
