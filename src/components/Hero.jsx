import React from "react";
import { Award, BadgeCheck, CircleCheck, FastForward } from "lucide-react";
import TechGlass from "./TechGlass";
import {
  SolidityIcon,
  ElixirIcon,
  PhpIcon,
  PythonIcon,
  TypeScriptIcon,
  RustIcon,
} from "./TechIcons";
import "./Hero.css";

export default function Hero() {
  const trustBadges = [
    {
      icon: <CircleCheck />,
      text: "TRUSTED BY HUNDREDS",
      className: "badge-red",
    },
    {
      icon: <Award />,
      text: "MULTIPLE AWARD WINNING FIRM",
      className: "badge-orange",
    },
    {
      icon: <BadgeCheck />,
      text: "SMART SOLUTIONS",
      className: "badge-pink",
    },
    {
      icon: <FastForward />,
      text: "FAST RESULTS",
      className: "badge-green",
    },
  ];

  const technologies = [
    {
      name: "Solidity",
      detail: "EVM",
      className: "tech-solidity",
      icon: <SolidityIcon />,
    },
    {
      name: "Elixir",
      detail: "BEAM Concurrency",
      className: "tech-elixir",
      icon: <ElixirIcon />,
    },
    {
      name: "PHP",
      detail: "v8.3",
      className: "tech-php",
      icon: <PhpIcon />,
    },
    {
      name: "Python",
      detail: "v3.12",
      className: "tech-python",
      icon: <PythonIcon />,
    },
    {
      name: "TypeScript",
      detail: "v5.4",
      className: "tech-typescript",
      icon: <TypeScriptIcon />,
    },
    {
      name: "Rust",
      detail: "Low-Level",
      className: "tech-rust",
      icon: <RustIcon />,
    },
  ];

  return (
    <section className="hero">
      <div className="hero-scrim" />

      <div className="hero-inner">
        <div className="hero-badges" aria-label="Company highlights">
          {trustBadges.map((badge) => (
            <div key={badge.text} className={`hero-badge ${badge.className}`}>
              <span className="hero-badge-icon">{badge.icon}</span>

              <span>{badge.text}</span>
            </div>
          ))}
        </div>

        <h1 className="hero-title">
          <span>CHANGING</span>

          <span>
            LIVES <span className="hero-gradient-text">THROUGH</span>
          </span>

          <span>VISION &amp;</span>

          <span>INNOVATION</span>
        </h1>

        <p className="hero-description">
          <strong>Next Inc.</strong> is an innovation lab and full-stack
          technology partner. We bridge the gap between cutting-edge research
          and practical application, offering a comprehensive suite of services
          including web and app development, enterprise SaaS, and sophisticated
          AI and LLM modeling. Our research-first approach ensures that the
          solutions we build today are ready to meet the challenges of tomorrow.
        </p>

        <div className="hero-tech-heading">
          <span className="hero-tech-dot" />

          <span>CORE ENGINEERING LANGUAGES &amp; HIGH-FREQUENCY STACK</span>
        </div>

        <TechGlass items={technologies} />
      </div>
    </section>
  );
}
