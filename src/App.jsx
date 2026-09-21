import React from "react";
import Navbar from "./components/Navbar";
import BuildNext from "./components/BuildNext";
import MiniMe from "./components/MiniMe";
import Hero from "./components/Hero";
import Founders from "./components/Founders";
import Earth from "./components/Earth";
import HeroBackdrop from "./components/HeroBackdrop";
export default function App() {
  return (
    <div className="site-shell min-h-screen bg-[#04060e] text-slate-100">
      <HeroBackdrop className="site-backdrop" />

      <div className="site-content">
        <Navbar />

        <main>
          <Hero />
          <Earth />
          <BuildNext />
          <MiniMe />
          <Founders />
        </main>
      </div>
    </div>
  );
}
