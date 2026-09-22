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
 *
 * onHeroReady (optional) fires once the "hero" layer has compiled its
 * shaders and painted a real first frame — the page preloader uses
 * this as one of its "safe to reveal the site" signals, since this
 * exact canvas is what sits behind the hero section from the very
 * first paint.
 *
 * splash (optional) is the "this IS the loading screen" mode: while
 * true, the hero layer is clipped down to a centered, rounded window
 * (see .is-splash in SiteBackdrop.css) instead of filling the page,
 * so it reads as a dedicated splash visual rather than a background.
 * When it flips false, that clip animates open to full-bleed — the
 * same canvas settling into its normal spot behind the Hero section,
 * with nothing torn down or restarted.
 */
export default function SiteBackdrop({ heroRef, onHeroReady, splash = false }) {
  const { inView: heroInView } = useLazyCanvas(heroRef, {
    rootMargin: "110% 0px 0px 0px",
  });

  return (
    <div
      className={`site-backdrop${heroInView ? "" : " is-hero-off"}${
        splash ? " is-splash" : ""
      }`}
      aria-hidden="true"
    >
      <HeroBackdrop
        variant="hero"
        running={heroInView}
        className="site-backdrop-layer site-backdrop-hero"
        onReady={onHeroReady}
      />
      <HeroBackdrop
        variant="ambient"
        running={!heroInView}
        className="site-backdrop-layer site-backdrop-ambient"
      />
    </div>
  );
}
