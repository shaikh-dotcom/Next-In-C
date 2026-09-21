import React, { useEffect, useRef, useState } from "react";

const SCRAMBLE_CHARS = "!<>-_\\/[]{}—=+*^?#01";

/**
 * Renders `text`, decoding it from random characters into the real
 * string once the element scrolls into view. Falls back to plain
 * text instantly if the user prefers reduced motion.
 */
export default function ScrambleText({
  text,
  className = "",
  as: Tag = "span",
  triggerOnce = true,
  duration = 900,
}) {
  const [display, setDisplay] = useState(text);
  const nodeRef = useRef(null);
  const hasRunRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const runScramble = () => {
      if (triggerOnce && hasRunRef.current) return;
      hasRunRef.current = true;

      if (reducedMotion) {
        setDisplay(text);
        return;
      }

      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const revealCount = Math.floor(progress * text.length);

        let out = "";
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] === " ") {
            out += " ";
          } else if (i < revealCount) {
            out += text[i];
          } else {
            out += SCRAMBLE_CHARS[
              Math.floor(Math.random() * SCRAMBLE_CHARS.length)
            ];
          }
        }

        setDisplay(out);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(text);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) runScramble();
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, triggerOnce, duration]);

  return (
    <Tag ref={nodeRef} className={className}>
      {display}
    </Tag>
  );
}
