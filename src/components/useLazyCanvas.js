import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ROOT_MARGIN = "260px 0px";
const DEFAULT_PRIORITY = 10;

let instanceCounter = 0;
let activeOwner = null;
let handoffTimer = null;

const records = new Map();

function viewportScore(record) {
  if (!record.near || !record.element) return -Infinity;

  const rect = record.element.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;
  const elementCenter = (rect.top + rect.bottom) / 2;
  const distance = Math.abs(elementCenter - viewportCenter);

  return (
    10000 +
    record.ratio * 5000 -
    distance +
    record.priority * 100
  );
}

function chooseOwner() {
  let best = null;
  let bestScore = -Infinity;

  records.forEach((record) => {
    const score = viewportScore(record);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  });

  return best;
}

function applyOwner(nextOwner) {
  if (handoffTimer) {
    clearTimeout(handoffTimer);
    handoffTimer = null;
  }

  if (activeOwner?.id === nextOwner?.id) return;

  const previous = activeOwner;
  activeOwner = null;

  if (previous) {
    previous.setGranted(false);
  }

  if (!nextOwner) return;

  handoffTimer = window.setTimeout(() => {
    handoffTimer = null;

    const candidate = chooseOwner();

    if (!candidate || candidate.id !== nextOwner.id) {
      recomputeOwner();
      return;
    }

    activeOwner = candidate;
    candidate.setGranted(true);
  }, 60);
}

function recomputeOwner() {
  const nextOwner = chooseOwner();

  if (activeOwner && activeOwner.near) {
    const currentScore = viewportScore(activeOwner);
    const nextScore = nextOwner ? viewportScore(nextOwner) : -Infinity;

    // Small hysteresis prevents the foreground canvas from thrashing
    // when two adjacent sections overlap the preload margin.
    if (
      nextOwner &&
      nextOwner.id !== activeOwner.id &&
      nextScore < currentScore + 180
    ) {
      return;
    }
  }

  applyOwner(nextOwner);
}

export default function useLazyCanvas(
  ref,
  {
    id: providedId,
    rootMargin = DEFAULT_ROOT_MARGIN,
    priority = DEFAULT_PRIORITY,
  } = {},
) {
  const idRef = useRef(null);

  if (!idRef.current) {
    instanceCounter += 1;
    idRef.current = providedId || `webgl-section-${instanceCounter}`;
  }

  const id = idRef.current;
  const [near, setNear] = useState(false);
  const [granted, setGranted] = useState(false);
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);

  const retries = useRef([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const el = ref.current;
    if (!el) return undefined;

    const record = {
      id,
      element: el,
      near: false,
      ratio: 0,
      priority,
      setGranted,
    };

    records.set(id, record);

    const updateEntry = (entry) => {
      record.near = entry.isIntersecting;
      record.ratio = entry.intersectionRatio || 0;
      setNear(entry.isIntersecting);
      recomputeOwner();
    };

    let observer = null;

    if (typeof IntersectionObserver === "undefined") {
      record.near = true;
      record.ratio = 1;
      setNear(true);
      recomputeOwner();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => updateEntry(entry),
        {
          rootMargin,
          threshold: [0, 0.15, 0.35, 0.6, 1],
        },
      );

      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      mountedRef.current = false;

      const wasOwner = activeOwner?.id === id;
      records.delete(id);

      if (wasOwner) {
        activeOwner = null;
        setGranted(false);
        recomputeOwner();
      }
    };
  }, [id, priority, ref, rootMargin]);

  useEffect(() => {
    if (!granted) setReady(false);
  }, [granted]);

  const onCreated = useCallback(
    ({ gl }) => {
      const canvas = gl.domElement;
      let disposed = false;

      const onLost = (event) => {
        event.preventDefault();
        setReady(false);

        if (!mountedRef.current || !granted) return;

        const now = Date.now();

        retries.current = retries.current.filter(
          (t) => now - t < 8000,
        );

        if (retries.current.length >= 3) return;

        retries.current.push(now);

        window.setTimeout(() => {
          if (!mountedRef.current || !granted) return;
          setEpoch((value) => value + 1);
        }, 250);
      };

      const onReady = () => {
        if (disposed || !mountedRef.current) return;

        window.requestAnimationFrame(() => {
          if (mountedRef.current && granted) {
            setReady(true);
          }
        });
      };

      canvas.addEventListener("webglcontextlost", onLost, false);
      onReady();

      return () => {
        disposed = true;
        canvas.removeEventListener("webglcontextlost", onLost, false);
      };
    },
    [granted],
  );

  return {
    near,
    granted,
    ready,
    epoch,
    onCreated,
  };
}
