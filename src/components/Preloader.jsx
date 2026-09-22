import { useEffect, useState } from "react";
import "./Preloader.css";

const EXIT_MS = 900;

/*
 * PRELOADER
 *
 * A full-viewport intro screen shown while the page (and the hero
 * WebGL scene) warms up. It sits above the real page but has a
 * transparent background — the fixed SiteBackdrop "hero" canvas is
 * already mounted and animating underneath it, so what plays here is
 * literally the same knot/streams scene that becomes the hero
 * section's background a moment later. This overlay only ever fades
 * its own chrome (mark + progress rail) away; the canvas itself never
 * moves or restarts.
 *
 * `ready` comes from useSiteReady() and only ever goes false -> true,
 * so it doubles as the "start closing" flag. Once true we run the CSS
 * fade-out, then unmount so the loader stops intercepting scroll and
 * clicks and leaves no DOM behind.
 */
export default function Preloader({ ready }) {
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setUnmounted(true), EXIT_MS);
    return () => clearTimeout(t);
  }, [ready]);

  // Lock scroll while the loader owns the screen; release it the
  // moment the close transition starts so the reveal feels immediate.
  useEffect(() => {
    if (ready) {
      document.body.style.overflow = "";
      return undefined;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ready]);

  if (unmounted) return null;

  return (
    <div
      className={`preloader${ready ? " is-closing" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="preloader-mark">
        NEXT <span>INC.</span>
      </div>

      <div className="preloader-rail" aria-hidden="true">
        <div className="preloader-rail-fill" />
      </div>

      <p className="preloader-hint">Calibrating the signal…</p>
    </div>
  );
}
