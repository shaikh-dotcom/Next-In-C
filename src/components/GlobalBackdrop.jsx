import React from "react";
import HeroBackdrop from "./HeroBackdrop";

/*
 * The one and only full-page WebGL backdrop.
 *
 * Fixed behind every section, mounted once, never unmounted. It shows the
 * full hero scene (streams, core, rings) at the top of the page and blends
 * into the quiet ambient haze as the user scrolls down. Sections must have
 * transparent backgrounds so it shows through.
 */
export default function GlobalBackdrop() {
  return <HeroBackdrop variant="global" className="gl-backdrop" />;
}
