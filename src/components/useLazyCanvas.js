import { useCallback, useEffect, useRef, useState } from "react";

/*
 * useLazyCanvas
 *
 * Browsers allow only ~16 live WebGL contexts per page, and this site
 * has many canvases (hero backdrop, glass cards, section stars, glass
 * logo...). Mount a <Canvas> only while its host element is near the
 * viewport and unmount it when it is far away; unmounting frees the GPU
 * context for the next section.
 *
 *   const hostRef = useRef(null);
 *   const { near, epoch, onCreated } = useLazyCanvas(hostRef);
 *
 *   <div ref={hostRef}>
 *     {near && <Canvas key={epoch} onCreated={onCreated} ... />}
 *   </div>
 *
 * near       true while the host is within `rootMargin` of the viewport
 * epoch      changes after a lost GL context; use it as the Canvas key so
 *            the canvas is rebuilt from scratch
 * onCreated  pass to <Canvas onCreated>; it watches for context loss
 */

const RETRY_WINDOW_MS = 8000;
const MAX_RETRIES = 3;

export default function useLazyCanvas(ref, { rootMargin = "400px 0px" } = {}) {
  const [near, setNear] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const retries = useRef([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  const onCreated = useCallback(({ gl }) => {
    const canvas = gl.domElement;

    const onLost = (event) => {
      // keep the browser from giving up on the context for good
      event.preventDefault();

      // rebuild the canvas, but never in a tight loop
      const now = Date.now();
      retries.current = retries.current.filter((t) => now - t < RETRY_WINDOW_MS);
      if (retries.current.length >= MAX_RETRIES) return;

      retries.current.push(now);
      setTimeout(() => setEpoch((e) => e + 1), 250);
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
  }, []);

  return { near, epoch, onCreated };
}
