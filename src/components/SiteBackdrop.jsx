import React from "react";
import HeroBackdrop from "./HeroBackdrop";
import useLazyCanvas from "./useLazyCanvas";
import "./SiteBackdrop.css";

/*
 * ONE fixed, full-page WebGL background shared by every section.
 *
 * Two layers, exactly one visible and running at a time:
 *   hero    full scene (streams, core, orbits) while the hero is up
 *   ambient haze + dust + bokeh below the hero
 *
 * The switch is a pure CSS opacity crossfade — no context is ever
 * destroyed, no shader ever recompiles. Both layers mount early
 * (600px hook margin), and the ambient layer starts pre-warmed, so it
 * is fully formed by the time the user scrolls past the hero.
 */
export default function SiteBackdrop({ heroRef }) {
  const { inView: heroInView } = useLazyCanvas(heroRef, {
    rootMargin: "0px 0px -35% 0px",
  });

  return (
    <div
      className={`site-backdrop${heroInView ? "" : " is-hero-off"}`}
      aria-hidden="true"
    >
      <HeroBackdrop
        variant="hero"
        running={heroInView}
        className="site-backdrop-layer site-backdrop-hero"
      />
      <HeroBackdrop
        variant="ambient"
        running={!heroInView}
        className="site-backdrop-layer site-backdrop-ambient"
      />
    </div>
  );
}
