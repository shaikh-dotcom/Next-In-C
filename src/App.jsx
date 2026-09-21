import React from "react";
import Navbar from "./components/Navbar";
import BuildNext from "./components/BuildNext";
import MiniMe from "./components/MiniMe";
import Hero from "./components/Hero";
import Founders from "./components/Founders";
import Earth from "./components/Earth";
export default function App() {
  return (
    <div className="min-h-screen bg-[#04060e] text-slate-100">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <main>
        <Hero />
        {/* Global Routing / Earth */}
        <Earth />
        <BuildNext />
        <MiniMe />
        <Founders />
      </main>
    </div>
  );
}
