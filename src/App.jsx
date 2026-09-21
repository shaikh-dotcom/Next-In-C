import React, { useRef } from "react";
import Navbar from "./components/Navbar";
import BuildNext from "./components/BuildNext";
import MiniMe from "./components/MiniMe";
import Hero from "./components/Hero";
import Founders from "./components/Founders";
import Earth from "./components/Earth";
import SiteBackdrop from "./components/SiteBackdrop";

export default function App() {
  const heroRef = useRef(null);

  return (
    <div className="min-h-screen bg-[#04060e] text-slate-100">
      <SiteBackdrop heroRef={heroRef} />
      <Navbar />
      <main>
        <Hero hostRef={heroRef} />
        <Earth />
        <BuildNext />
        <MiniMe />
        <Founders />
      </main>
    </div>
  );
}
