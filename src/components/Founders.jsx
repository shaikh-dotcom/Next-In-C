import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ScrambleText from "./ScrambleText";
import SectionStars from "./SectionStars";
import "./Founders.css";

/*
 * Founders + Contact.
 *
 * Three arched doorways stand in a row, each lit from above and named for
 * the part of the company that person leads. Hover (or tap, or Tab to)
 * an arch to light it up: its portrait warms into colour and the reading
 * dock underneath switches to that person. The dock's notch slides to sit
 * under whoever is selected.
 *
 * Everything you will want to edit lives in the block below: copy, links,
 * photo paths and how each photo is framed.
 *
 * Photos: put files in /public/founders/. Any aspect ratio works, the
 * portrait is cropped to fit. Use `focus` to choose which part of the photo
 * stays in frame and `zoom` to push in. A missing photo falls back to the
 * person's initials.
 *
 * All bios, chips and links are starting points. Replace them with the
 * real thing.
 */

const INTRO =
  "The three people behind Next Inc.: one sets the direction, one designs the systems, one keeps the work moving.";

const CONTACT = {
  kicker: "Be a part of this family",
  title: "Ready to work with us?",
  note: "Tell us what you are building and we will tell you how we can help.",
  label: "Get in touch",
  // Swap for your contact page or a real address.
  href: "mailto:hello@nextinc.com",
  email: "hello@nextinc.com",
};

const FOUNDERS = [
  {
    id: "arib-labib",
    name: "Arib Labib",
    initials: "AL",
    role: "Founder & CEO",
    domain: "Vision",
    photo: "/founders/arib-labib.jpg",
    focus: "50% 30%", // which part of the photo stays in frame (x y)
    zoom: 1, // 1 = fit, above 1 pushes in
    bio: "Started Next Inc. and sets where it goes next: what we build, who we build it with, and why it matters.",
    leads: ["Direction", "Strategy", "Product"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
  {
    id: "shuaib-islam",
    name: "Shuaib Islam",
    initials: "SI",
    role: "Co-founder & CTO",
    domain: "Engineering",
    photo: "/founders/shuaib-islam.jpg",
    focus: "50% 32%",
    zoom: 1.55,
    bio: "Leads engineering at Next Inc., from the research behind our products to the systems that put them in people's hands.",
    leads: ["Architecture", "Research", "Engineering"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
  {
    id: "shaikh-muhammad",
    name: "Shaikh Muhammad",
    initials: "SM",
    role: "Co-founder & COO",
    domain: "Operations",
    photo: "/founders/shaikh-muhammad.jpg",
    focus: "50% 30%",
    zoom: 1,
    bio: "Runs day-to-day operations at Next Inc.: delivery, partnerships, and the rhythm that keeps the team shipping.",
    leads: ["Delivery", "Partnerships", "Operations"],
    links: { linkedin: "#", github: "#", x: "#" },
  },
];

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
   PHOTO TREATMENT
   Ink shadows, wine mid-tones, blush highlights. It is an SVG
   filter, so the original files stay untouched and any photo
   (light wall, busy background) ends up in the same world.
========================================================= */
function FilterDefs() {
  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <filter id="fx-duo" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.34 0.5 0.16 0 0.02  0.34 0.5 0.16 0 0.02  0.34 0.5 0.16 0 0.02  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.02 0.52 0.94" />
            <feFuncG type="table" tableValues="0.02 0.19 0.8" />
            <feFuncB type="table" tableValues="0.05 0.28 0.83" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

/* Photo with an initials fallback if the file is missing */
function Photo({ founder, className = "", eager = false }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <span className={`fx-mono ${className}`} aria-hidden="true">
        {founder.initials}
      </span>
    );
  }

  return (
    <>
      <img
        className={`fx-img fx-img-duo ${className}`}
        src={founder.photo}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setMissing(true)}
      />
      <img
        className={`fx-img fx-img-color ${className}`}
        src={founder.photo}
        alt=""
        aria-hidden="true"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </>
  );
}

/* =========================================================
   ARCH
   back to front: base, crown glow, dots, lintel text, portrait,
   vignette, lift, name plate, rim, travelling light, cursor light
========================================================= */
function Arch({ founder, index, active, select, colRef, reduced }) {
  const on = active === index;

  const style = {
    "--i": index,
    "--focus": founder.focus,
    "--zoom": founder.zoom,
  };

  const onMove = (e) => {
    if (reduced || e.pointerType !== "mouse") return;

    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;

    el.style.setProperty("--px", (nx * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (ny * 2 - 1).toFixed(3));
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const onLeave = (e) => {
    const el = e.currentTarget;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
    el.style.setProperty("--mx", "-400px");
    el.style.setProperty("--my", "-400px");
  };

  const arcId = `fx-arc-${founder.id}`;

  return (
    <li
      className={`fx-col${on ? " is-active" : ""}`}
      style={style}
      ref={colRef}
      data-index={index}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") select(index);
      }}
    >
      <article
        className="fp"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={() => select(index, true)}
      >
        <span className="fp-crown" aria-hidden="true" />
        <span className="fp-dots" aria-hidden="true" />

        {/* the word over the door, set on the curve of the arch */}
        <svg className="fp-lintel" viewBox="0 0 400 210" aria-hidden="true">
          <defs>
            <path id={arcId} d="M 30 200 A 170 170 0 0 1 370 200" />
          </defs>
          <text>
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {founder.domain}
            </textPath>
          </text>
        </svg>

        <div className="fp-photo">
          <Photo founder={founder} eager={index === 0} />
        </div>

        <span className="fp-vignette" aria-hidden="true" />
        <span className="fp-cone" aria-hidden="true" />
        <span className="fp-inset" aria-hidden="true" />
        <span className="fp-lift" aria-hidden="true" />

        <div className="fp-plate">
          <h3 className="fp-name">
            <button
              type="button"
              className="fp-toggle"
              aria-pressed={on}
              aria-controls="fx-dock"
              onFocus={() => select(index)}
            >
              {founder.name}
            </button>
          </h3>
          <p className="fp-role">{founder.role}</p>
        </div>

        <span className="fp-rim" aria-hidden="true" />
        <span className="fp-beam" aria-hidden="true" />
        <span className="fp-glint" aria-hidden="true" />
      </article>

      <span className="fp-foot" aria-hidden="true" />
    </li>
  );
}

/* =========================================================
   DOCK
   The reading area under the arches. Its notch follows the
   selected arch.
========================================================= */
function Dock({ founder, index, changed }) {
  return (
    <div
      className="fx-dock"
      id="fx-dock"
      style={{ "--n": index }}
      aria-live="polite"
    >
      <span className="fx-dock-notch" aria-hidden="true" />

      <div
        className={`fx-dock-body${changed ? " is-swap" : ""}`}
        key={founder.id}
      >
        <div className="fx-dock-copy">
          <h3 className="fx-dock-name">{founder.name}</h3>
          <p className="fx-dock-role">{founder.role}</p>
          <p className="fx-dock-bio">{founder.bio}</p>
        </div>

        <div className="fx-dock-side">
          <ul className="fx-chips" aria-label={`${founder.name} leads`}>
            {founder.leads.map((c) => (
              <li key={c} className="fx-chip">
                {c}
              </li>
            ))}
          </ul>

          <ul className="fx-socials">
            {Object.entries(founder.links).map(([key, href]) => {
              const s = SOCIALS[key];
              if (!s || !href) return null;
              const { Icon } = s;
              return (
                <li key={key}>
                  <a
                    className="fx-social"
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
  );
}

/* =========================================================
   SECTION
========================================================= */
export default function Founders() {
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const colRefs = useRef([]);
  const activeRef = useRef(0);

  const [active, setActive] = useState(0);
  const [changed, setChanged] = useState(false);
  const [seen, setSeen] = useState(false);

  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // one place that changes the selection, so the dock only animates when
  // the person actually changed
  const choose = useCallback((i) => {
    if (activeRef.current === i) return;
    activeRef.current = i;
    setActive(i);
    setChanged(true);
  }, []);

  const select = useCallback(
    (i, scroll = false) => {
      choose(i);

      // in the swipe layout, bring the chosen arch to the middle
      if (scroll && window.matchMedia("(max-width: 999px)").matches) {
        colRefs.current[i]?.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    },
    [choose],
  );

  // "Lights on" once, when the stage is a third visible
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Swipe layout: whichever arch is mostly in view becomes the selected one
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;

    const mq = window.matchMedia("(max-width: 999px)");
    let io = null;

    const setup = () => {
      if (io) io.disconnect();
      io = null;
      if (!mq.matches) return;

      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && e.intersectionRatio >= 0.6) {
              choose(Number(e.target.dataset.index));
            }
          });
        },
        { root: row, threshold: [0.6] },
      );

      colRefs.current.forEach((el) => el && io.observe(el));
    };

    setup();
    mq.addEventListener("change", setup);

    return () => {
      if (io) io.disconnect();
      mq.removeEventListener("change", setup);
    };
  }, [choose]);

  const current = FOUNDERS[active];

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
          <div className="fx-halo" aria-hidden="true" />

          <ul className="fx-row" ref={rowRef}>
            {FOUNDERS.map((f, i) => (
              <Arch
                key={f.id}
                founder={f}
                index={i}
                active={active}
                select={select}
                colRef={(el) => {
                  colRefs.current[i] = el;
                }}
                reduced={reduced}
              />
            ))}
          </ul>

          <Dock founder={current} index={active} changed={changed} />
        </div>

        <div className="fx-contact" id="contact">
          <span className="fx-contact-dots" aria-hidden="true" />

          <div className="fx-contact-copy">
            <div className="fx-family">
              <ul className="fx-faces" aria-hidden="true">
                {FOUNDERS.map((f) => (
                  <li
                    key={f.id}
                    className="fx-face"
                    style={{ "--focus": f.focus, "--zoom": f.zoom }}
                  >
                    <Photo founder={f} />
                  </li>
                ))}
              </ul>
              <p className="fx-contact-kicker">{CONTACT.kicker}</p>
            </div>

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

            <a className="fx-contact-mail" href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
