import React from "react";
import HeroBackdrop from "./HeroBackdrop";

/*
 * Background layer for every section below the Hero (Earth, BuildNext, ...).
 *
 * It is the Hero's backdrop in its "ambient" variant: the same haze
 * (cool light left, crimson right), dust and bokeh, and the same bloom,
 * without the streams, core or rings. Usage is unchanged:
 * make it the FIRST child of a `position: relative` section.
 *
 *   <section className="earth-section">
 *     <SectionStars />
 *     ...
 */
export default function SectionStars() {
  return <HeroBackdrop variant="ambient" className="section-stars" />;
}
