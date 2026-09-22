import React, { useCallback, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import BuildNext from "./components/BuildNext";
import MiniMe from "./components/MiniMe";
import Hero from "./components/Hero";
import Founders from "./components/Founders";
import Earth from "./components/Earth";
import SiteBackdrop from "./components/SiteBackdrop";
import Preloader from "./components/Preloader";
import useSiteReady from "./components/useSiteReady";

export default function App() {
  const heroRef = useRef(null);
  const [heroCanvasReady, setHeroCanvasReady] = useState(false);
  const handleHeroReady = useCallback(() => setHeroCanvasReady(true), []);
  const siteReady = useSiteReady(heroCanvasReady);

  return (
    <div className="min-h-screen bg-[#04060e] text-slate-100">
      {/* Mounted immediately so it starts compiling shaders and
          animating the moment the tab opens — this is the same
          canvas the Preloader lets show through, and the same one
          that stays put as the Hero section's background once the
          loader clears. */}
      <SiteBackdrop
        heroRef={heroRef}
        onHeroReady={handleHeroReady}
        splash={!siteReady}
      />

      <Preloader ready={siteReady} />

      {/* The rest of the page mounts and loads right away too — just
          hidden until siteReady — so nothing is idle behind the
          loader waiting to start. */}
      <div className={`site-content${siteReady ? " is-revealed" : ""}`}>
        <Navbar />
        <main>
          <Hero hostRef={heroRef} />
          <Earth />
          <BuildNext />
          <MiniMe />
          <Founders />
        </main>
      </div>
    </div>
  );
}
