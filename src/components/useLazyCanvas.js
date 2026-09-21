import { useCallback, useEffect, useRef, useState } from "react";

/*
 * useLazyCanvas v2 — "create once, pause forever"
 *
 * v1 mounted the <Canvas> near the viewport and UNMOUNTED it when it
 * scrolled away. Every unmount destroys the WebGL context and every
 * remount recompiles every shader + rebuilds every buffer on the main
 * thread. That was the flicker and the scroll jank.
 *
 * v2 splits the old `near` flag into two:
 *
 *   near   "has ever been near" — LATCHED true. Mount once, never
 *          unmount. Context, compiled shaders and geometry live for
 *          the whole session; re-entering a section costs 0.
 *   inView "is near right now" — flips with the viewport AND tab
 *          visibility. Use it to pause/resume render loops, so at
 *          most ~2 canvases ever draw per frame.
 */

const RETRY_WINDOW_MS = 8000;
const MAX_RETRIES = 3;

export default function useLazyCanvas(ref, { rootMargin = "600px 0px" } = {}) {
  const [near, setNear] = useState(false); // latched mount flag
  const [inView, setInView] = useState(false); // live run flag
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const [epoch, setEpoch] = useState(0);
  const retries = useRef([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true); // latch: once mounted, stay mounted
          setInView(true);
        } else {
          setInView(false); // just pause the loop
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const onCreated = useCallback(({ gl }) => {
    const canvas = gl.domElement;

    const onLost = (event) => {
      event.preventDefault();
      const now = Date.now();
      retries.current = retries.current.filter(
        (t) => now - t < RETRY_WINDOW_MS,
      );
      if (retries.current.length >= MAX_RETRIES) return;
      retries.current.push(now);
      setTimeout(() => setEpoch((e) => e + 1), 250);
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
  }, []);

  return { near, inView: inView && !tabHidden, epoch, onCreated };
}
