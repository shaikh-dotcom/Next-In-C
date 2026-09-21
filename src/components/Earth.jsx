import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Globe from "react-globe.gl";
import { scaleSequentialSqrt } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { Activity, Eye, Network, Timer } from "lucide-react";
import ScrambleText from "./ScrambleText";
import SectionStars from "./SectionStars";
import EarthStats from "./EarthStats";
import "./Earth.css";

/*
 * A subset of the routing locations gets a live label + connector
 * line anchored to its real lat/lng on the globe. dx/dy place the
 * label relative to that point so the three don't collide.
 */
const FEATURED_NODES = [
  {
    name: "Bay Area",
    lat: 37.7749,
    lng: -122.4194,
    status: "ONLINE",
    dx: -190,
    dy: -20,
  },
  {
    name: "London",
    lat: 51.5074,
    lng: -0.1278,
    status: "ACTIVE",
    dx: 150,
    dy: -70,
  },
  {
    name: "Bangladesh",
    lat: 23.8103,
    lng: 90.4125,
    status: "ROUTING",
    dx: 120,
    dy: 90,
  },
];

const STATS = [
  { value: "6", label: "Active nodes", icon: Network },
  { value: "11", unit: "ms", label: "Average latency", icon: Timer },
  { value: "99.98", unit: "%", label: "Uptime", icon: Activity },
  { value: "24/7", label: "Monitoring", icon: Eye },
];

const LOCATIONS = [
  { name: "Bay Area", lat: 37.7749, lng: -122.4194 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Bangladesh", lat: 23.8103, lng: 90.4125 },
];

const ROUTES = [
  { startLat: 37.7749, startLng: -122.4194, endLat: 51.5074, endLng: -0.1278 },
  { startLat: 51.5074, startLng: -0.1278, endLat: 23.8103, endLng: 90.4125 },
  { startLat: 23.8103, startLng: 90.4125, endLat: 1.3521, endLng: 103.8198 },
  { startLat: 1.3521, startLng: 103.8198, endLat: 35.6762, endLng: 139.6503 },
  { startLat: 37.7749, startLng: -122.4194, endLat: 40.7128, endLng: -74.006 },
  { startLat: 40.7128, startLng: -74.006, endLat: 51.5074, endLng: -0.1278 },
];

const HEADING_TEXT = "Distributed Global Routing";

export default function Earth() {
  const globeRef = useRef(null);
  const wrapperRef = useRef(null);
  const badgeRefs = useRef([]);
  const lineRefs = useRef([]);
  const rafRef = useRef(null);

  const [countries, setCountries] = useState({ features: [] });
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [dims, setDims] = useState({ width: 850, height: 650 });

  /*
   * Load world country GeoJSON
   */
  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson",
    )
      .then((res) => res.json())
      .then((data) => setCountries(data))
      .catch((err) => {
        console.error("Failed to load country data:", err);
      });
  }, []);

  /*
   * Size the globe to its actual column instead of the window, so it
   * behaves correctly inside the two-column layout.
   */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
   * Choropleth color scale
   */
  const colorScale = useMemo(() => scaleSequentialSqrt(interpolateYlOrRd), []);

  const getValue = useCallback((feature) => {
    const gdp = Number(feature?.properties?.GDP_MD_EST) || 0;
    const population = Number(feature?.properties?.POP_EST) || 1;

    return gdp / Math.max(100000, population);
  }, []);

  const maxValue = useMemo(() => {
    if (!countries.features.length) return 1;
    return Math.max(...countries.features.map(getValue));
  }, [countries, getValue]);

  colorScale.domain([0, maxValue]);

  /*
   * Automatically rotate the globe
   */
  useEffect(() => {
    if (!globeRef.current) return;

    const controls = globeRef.current.controls();

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enablePan = false;

    globeRef.current.pointOfView({ lat: 20, lng: 15, altitude: 2.05 }, 0);
  }, []);

  /*
   * Pin each featured node's badge + connector line to its real
   * lat/lng every frame, and fade it out once that point rotates to
   * the far side of the globe (checked via a camera-facing dot
   * product against the point's world position).
   */
  useEffect(() => {
    const tick = () => {
      const gEl = globeRef.current;

      if (gEl) {
        const camera = gEl.camera();
        const camPos = camera.position;
        const camLen = Math.hypot(camPos.x, camPos.y, camPos.z) || 1;

        FEATURED_NODES.forEach((node, i) => {
          const badge = badgeRefs.current[i];
          const line = lineRefs.current[i];
          if (!badge || !line) return;

          const world = gEl.getCoords(node.lat, node.lng, 0.02);
          const worldLen = Math.hypot(world.x, world.y, world.z) || 1;

          const facing =
            (world.x * camPos.x + world.y * camPos.y + world.z * camPos.z) /
            (worldLen * camLen);

          if (facing > 0.1) {
            const screen = gEl.getScreenCoords(node.lat, node.lng, 0.02);

            badge.style.opacity = "1";
            badge.style.left = `${screen.x}px`;
            badge.style.top = `${screen.y}px`;
            badge.style.transform = `translate(calc(-50% + ${node.dx}px), calc(-50% + ${node.dy}px))`;

            line.setAttribute("x1", screen.x);
            line.setAttribute("y1", screen.y);
            line.setAttribute("x2", screen.x + node.dx);
            line.setAttribute("y2", screen.y + node.dy);
            line.style.opacity = "0.55";
          } else {
            badge.style.opacity = "0";
            line.style.opacity = "0";
          }
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className="earth-section">
      <SectionStars />

      <div className="earth-layout">
        {/* Copy column */}
        <div className="earth-copy">
          <div className="earth-eyebrow">// DISTRIBUTED GLOBAL ROUTING</div>
          <h2 className="earth-heading" data-text={HEADING_TEXT}>
            <span className="earth-heading-text">
              <ScrambleText text={HEADING_TEXT} />
            </span>
          </h2>

          <p className="earth-lede">
            Connecting infrastructure, people and systems across the world.
          </p>

          <EarthStats items={STATS} />
        </div>

        {/* Globe column */}
        <div className="earth-globe-col">
          <div className="earth-globe-wrapper" ref={wrapperRef}>
            <Globe
              ref={globeRef}
              globeImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
              showAtmosphere={true}
              atmosphereColor="#4ddcff"
              atmosphereAltitude={0.18}
              backgroundColor="rgba(0,0,0,0)"
              polygonsData={countries.features.filter(
                (d) => d.properties.ISO_A2 !== "AQ",
              )}
              polygonAltitude={(d) => (d === hoveredCountry ? 0.12 : 0.06)}
              polygonCapColor={(d) =>
                d === hoveredCountry ? "#4d9fff" : colorScale(getValue(d))
              }
              polygonSideColor={() => "rgba(0, 100, 0, 0.15)"}
              polygonStrokeColor={() => "#111"}
              polygonLabel={({ properties: d }) => (
                <div>
                  <div>
                    <b>
                      {d.ADMIN} ({d.ISO_A2})
                    </b>
                  </div>

                  <div>
                    GDP: <i>{d.GDP_MD_EST}</i> M$
                  </div>

                  <div>
                    Population: <i>{d.POP_EST}</i>
                  </div>
                </div>
              )}
              onPolygonHover={setHoveredCountry}
              polygonsTransitionDuration={300}
              pointsData={LOCATIONS}
              pointLat="lat"
              pointLng="lng"
              pointColor={() => "#67e8f9"}
              pointAltitude={0.015}
              pointRadius={0.32}
              arcsData={ROUTES}
              arcStartLat="startLat"
              arcStartLng="startLng"
              arcEndLat="endLat"
              arcEndLng="endLng"
              arcAltitudeAutoScale={0.65}
              arcColor={() => [
                "rgba(80,220,255,0.95)",
                "rgba(120,120,255,0.35)",
              ]}
              arcDashLength={0.35}
              arcDashGap={0.8}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={2200}
              arcsTransitionDuration={800}
              ringsData={LOCATIONS}
              ringLat="lat"
              ringLng="lng"
              ringColor={() => () => "rgba(70,220,255,0.8)"}
              ringMaxRadius={2.2}
              ringPropagationSpeed={2}
              ringRepeatPeriod={1800}
              enablePointerInteraction={true}
              width={dims.width}
              height={dims.height}
            />

            <svg
              className="earth-connector-svg"
              width={dims.width}
              height={dims.height}
            >
              {FEATURED_NODES.map((node, i) => (
                <line
                  key={node.name}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className="earth-connector-line"
                />
              ))}
            </svg>

            {FEATURED_NODES.map((node, i) => (
              <div
                key={node.name}
                ref={(el) => {
                  badgeRefs.current[i] = el;
                }}
                className="earth-node-badge"
              >
                <span className="status-dot" />
                <span>{node.name}</span>
                <small>{node.status}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
