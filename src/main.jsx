import React from "react";
import ReactDOM from "react-dom/client";
import { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

import App from "./App";
import "./index.css";

const particlesInit = async (engine) => {
  await loadSlim(engine);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ParticlesProvider init={particlesInit}>
      <App />
    </ParticlesProvider>
  </React.StrictMode>,
);
