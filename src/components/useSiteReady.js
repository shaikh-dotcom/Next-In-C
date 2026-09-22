import { useEffect, useState } from "react";

/*
 * useSiteReady
 *
 * Drives the intro preloader. The site is "ready" once ALL of these
 * are true:
 *
 *   canvasReady   the hero WebGL layer (SiteBackdrop's "hero" variant
 *                 of HeroBackdrop) has compiled its shaders and
 *                 painted a real first frame — passed in from App.
 *   pageLoaded    the window "load" event has fired, so images,
 *                 fonts and other assets have had their chance too.
 *   fontsReady    document.fonts.ready has resolved, so headings
 *                 don't reflow right after the reveal.
 *   minDelayDone  a minimum amount of time has passed, so the intro
 *                 animation actually gets to build before it's
 *                 revealed as the hero background instead of just
 *                 flashing past on a fast connection.
 *
 * A safety timeout forces `ready` regardless, so a slow or failing
 * signal (e.g. WebGL unavailable) never traps someone behind the
 * loader.
 */

const MIN_VISIBLE_MS = 2200;
const REDUCED_MOTION_MIN_MS = 400;
const SAFETY_TIMEOUT_MS = 6000;

function usePageLoaded() {
  const [loaded, setLoaded] = useState(
    () =>
      typeof document !== "undefined" && document.readyState === "complete",
  );

  useEffect(() => {
    if (loaded) return undefined;
    const onLoad = () => setLoaded(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [loaded]);

  return loaded;
}

function useFontsReady() {
  const [ready, setReady] = useState(
    () => typeof document === "undefined" || !document.fonts,
  );

  useEffect(() => {
    if (ready || typeof document === "undefined" || !document.fonts) {
      return undefined;
    }
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

function useMinDelayDone() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(
      () => setDone(true),
      reduced ? REDUCED_MOTION_MIN_MS : MIN_VISIBLE_MS,
    );
    return () => clearTimeout(t);
  }, []);

  return done;
}

export default function useSiteReady(canvasReady) {
  const pageLoaded = usePageLoaded();
  const fontsReady = useFontsReady();
  const minDelayDone = useMinDelayDone();
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setForced(true), SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  return forced || (canvasReady && pageLoaded && fontsReady && minDelayDone);
}
