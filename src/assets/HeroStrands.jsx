import React, { useEffect, useRef } from "react";

export default function HeroStrands() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!ctx) return;

    // Keep resolution high without making the canvas unnecessarily expensive.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let width = 0;
    let height = 0;
    let rafId = 0;

    let time = 0;
    let lastTime = performance.now();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const TAU = Math.PI * 2;

    const rand = (min, max) => min + Math.random() * (max - min);

    // ---------------------------------------
    // END POINT
    // ---------------------------------------

    const END_X = 0.5;
    const END_Y = 0.48;

    // ---------------------------------------
    // MOUSE
    // ---------------------------------------

    const mouse = {
      x: -9999,
      y: -9999,
      active: false,
    };

    const MOUSE_RADIUS = 180;
    const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
    const MOUSE_STRENGTH = 230;

    // Faster response than the original.
    const MOUSE_SMOOTHING = 0.18;

    // Cached canvas position.
    let canvasRect = null;

    const updateCanvasRect = () => {
      canvasRect = canvas.getBoundingClientRect();
    };

    const onMouseMove = (event) => {
      if (!canvasRect) return;

      mouse.x = event.clientX - canvasRect.left;
      mouse.y = event.clientY - canvasRect.top;
      mouse.active = true;
    };

    const onMouseLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener("mousemove", onMouseMove, {
      passive: true,
    });

    window.addEventListener("mouseleave", onMouseLeave);

    window.addEventListener("scroll", updateCanvasRect, {
      passive: true,
    });

    // ---------------------------------------
    // RESIZE
    // ---------------------------------------

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      updateCanvasRect();
    };

    // ---------------------------------------
    // STRANDS
    // ---------------------------------------

    const strands = [];

    const buildStrands = () => {
      strands.length = 0;

      const strandsPerSide = width < 640 ? 44 : 60;
      const particlesPerStrand = width < 640 ? 65 : 100;

      for (const side of ["left", "right"]) {
        const isLeft = side === "left";

        for (let s = 0; s < strandsPerSide; s++) {
          const spread = (s / (strandsPerSide - 1) - 0.5) * 3;

          const hue = isLeft ? rand(185, 200) : rand(300, 355);

          const light = isLeft ? rand(55, 72) : rand(45, 60);

          const sat = rand(70, 90);

          const particles = [];

          for (let i = 0; i < particlesPerStrand; i++) {
            particles.push({
              progress: i / particlesPerStrand,

              // Converted to "per second" movement.
              speed: rand(0.096, 0.192),

              sizeJitter: rand(0.7, 1.5),

              drift: rand(-6, 6),

              offsetX: 0,
              offsetY: 0,
            });
          }

          strands.push({
            side,
            isLeft,

            startX: isLeft ? -20 : width + 20,

            baseOffset: spread * height * 0.42,

            amplitude: rand(14, 46),

            frequency: rand(2.2, 4.2),

            phase: rand(0, TAU),

            wobble: rand(0.15, 0.45) * (Math.random() < 0.5 ? -1 : 1),

            hue,
            sat,
            light,

            // One color calculation per strand instead of
            // one per particle.
            color: `hsla(${hue}, ${sat}%, ${light}%, 0.55)`,

            particles,
          });
        }
      }
    };

    // ---------------------------------------
    // DRAW
    // ---------------------------------------

    const draw = (now) => {
      // Frame independent timing.
      let dt = (now - lastTime) / 1000;

      // Prevent a huge jump if the browser briefly stalls,
      // switches tabs, etc.
      dt = Math.min(dt, 0.033);

      lastTime = now;
      time += dt;

      ctx.clearRect(0, 0, width, height);

      const endX = width * END_X;
      const endY = height * END_Y;

      for (let s = 0; s < strands.length; s++) {
        const strand = strands[s];

        /*
         * IMPORTANT OPTIMIZATION:
         *
         * Instead of:
         *   beginPath()
         *   arc()
         *   fill()
         *
         * for every particle,
         *
         * we create ONE path for the entire strand
         * and fill it once.
         */

        ctx.beginPath();

        const particles = strand.particles;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // -----------------------------------
          // PARTICLE MOVEMENT
          // -----------------------------------

          p.progress += p.speed * dt * (0.4 + p.progress * 1.6);

          if (p.progress >= 1) {
            p.progress -= 1;

            p.sizeJitter = rand(0.7, 1.5);
            p.speed = rand(0.096, 0.192);
          }

          const pull = p.progress;

          // Smooth S curve.
          const eased = pull * pull * (3 - 2 * pull);

          // -----------------------------------
          // X
          // -----------------------------------

          const baseX = strand.startX + (endX - strand.startX) * eased;

          // -----------------------------------
          // WAVE
          // -----------------------------------

          const wave =
            Math.sin(
              pull * strand.frequency * Math.PI +
                strand.phase +
                time * strand.wobble * 4,
            ) * strand.amplitude;

          // -----------------------------------
          // Y
          // -----------------------------------

          const convergence = Math.pow(1 - pull, 2.2);

          const strandY = height * 0.5 + strand.baseOffset + wave + p.drift;

          const baseY = endY + (strandY - endY) * convergence;

          // -----------------------------------
          // MOUSE
          // -----------------------------------

          let targetOffsetX = 0;
          let targetOffsetY = 0;

          if (mouse.active) {
            const dx = baseX - mouse.x;
            const dy = baseY - mouse.y;

            const distanceSq = dx * dx + dy * dy;

            // Avoid sqrt unless particle is inside radius.
            if (distanceSq > 0 && distanceSq < MOUSE_RADIUS_SQ) {
              const distance = Math.sqrt(distanceSq);

              const normalized = 1 - distance / MOUSE_RADIUS;

              const force = normalized * normalized * normalized;

              const inverseDistance = 1 / distance;

              targetOffsetX = dx * inverseDistance * force * MOUSE_STRENGTH;

              targetOffsetY = dy * inverseDistance * force * MOUSE_STRENGTH;
            }
          }

          // Smooth mouse movement.
          p.offsetX +=
            (targetOffsetX - p.offsetX) *
            Math.min(1, MOUSE_SMOOTHING * dt * 60);

          p.offsetY +=
            (targetOffsetY - p.offsetY) *
            Math.min(1, MOUSE_SMOOTHING * dt * 60);

          const x = baseX + p.offsetX;
          const y = baseY + p.offsetY;

          // Slight size variation toward the end.
          const size = 1.4 * p.sizeJitter * (0.9 + pull * 0.12);

          // -----------------------------------
          // ADD PARTICLE TO CURRENT PATH
          // -----------------------------------

          ctx.moveTo(x + size, y);

          ctx.arc(x, y, size, 0, TAU);
        }

        // -----------------------------------
        // ONE FILL PER STRAND
        // -----------------------------------

        ctx.fillStyle = strand.color;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    // ---------------------------------------
    // INITIALIZE
    // ---------------------------------------

    resize();
    buildStrands();

    const onResize = () => {
      resize();
      buildStrands();
    };

    window.addEventListener("resize", onResize);

    if (reducedMotion) {
      draw(performance.now());
    } else {
      lastTime = performance.now();
      rafId = requestAnimationFrame(draw);
    }

    // ---------------------------------------
    // CLEANUP
    // ---------------------------------------

    return () => {
      cancelAnimationFrame(rafId);

      window.removeEventListener("resize", onResize);

      window.removeEventListener("mousemove", onMouseMove);

      window.removeEventListener("mouseleave", onMouseLeave);

      window.removeEventListener("scroll", updateCanvasRect);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-strands" />;
}
