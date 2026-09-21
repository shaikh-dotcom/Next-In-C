import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * Geometry for the Mini Me glass scene.
 *
 *   buildLogoGeometry  the two logo paths, extruded with a rounded bevel
 *   slabGeometry       a thick rounded-square glass tile
 *   lensGeometry       a round glass cabochon (flat back, domed front)
 *
 * Kept out of the component so the (slightly fiddly) logo tessellation
 * can be tested on its own.
 */

/* ---------------------------------------------------------
   LOGO
   The logo paths come from a potrace export: y-up coordinates in
   1/10 px, normally drawn through translate(0,H) scale(.1,-.1).
   Read raw, that y-up data is already the orientation three.js
   wants, so we only need to scale by 0.1 (no flip, no inverted
   normals).
--------------------------------------------------------- */
const TRACE_SCALE = 0.1;

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function loopPoints(subPath) {
  const out = [];

  subPath.getPoints(10).forEach((p) => {
    const q = new THREE.Vector2(p.x * TRACE_SCALE, p.y * TRACE_SCALE);
    const last = out[out.length - 1];
    if (!last || last.distanceTo(q) > 0.05) out.push(q);
  });

  // the loop is closed: drop the duplicated end point
  if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) < 0.05) {
    out.pop();
  }

  return out;
}

/*
 * Every path in the logo is "one big outline plus counters". Instead of
 * trusting the winding order of the trace, the biggest loop is the
 * outline and the rest are holes.
 */
export function buildLogoShapes(pathData) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${pathData
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;

  const parsed = new SVGLoader().parse(svg);

  return parsed.paths.map((path) => {
    const loops = path.subPaths
      .map(loopPoints)
      .filter((pts) => pts.length > 2)
      .map((pts) => ({ pts, area: Math.abs(signedArea(pts)) }))
      .sort((a, b) => b.area - a.area);

    const shape = new THREE.Shape(loops[0].pts);
    loops.slice(1).forEach((l) => shape.holes.push(new THREE.Path(l.pts)));
    return shape;
  });
}

export function buildLogoGeometry(pathData, targetWidth) {
  const shapes = buildLogoShapes(pathData);

  // bevel values are in trace pixels (the logo is roughly 1000 wide)
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 100,
    bevelEnabled: true,
    bevelThickness: 30,
    bevelSize: 20,
    bevelSegments: 6,
    steps: 1,
  });

  geo.center();
  geo.computeBoundingBox();

  const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
  const k = targetWidth / width;
  geo.scale(k, k, k);

  // smooth across the bevel, keep real creases sharp
  const creased = toCreasedNormals(geo, 0.55);
  geo.dispose();
  return creased;
}

/* ---------------------------------------------------------
   SLAB
--------------------------------------------------------- */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;

  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);

  return s;
}

/*
 * A thick tile with a big corner radius in the face plane and a small
 * rounded bevel on the edges. (drei's RoundedBox ties both radii
 * together, which would make the corners too tight.)
 */
export function slabGeometry(w, h, cornerRadius, depth, bevel) {
  const shape = roundedRect(w - 2 * bevel, h - 2 * bevel, cornerRadius - bevel);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 32,
  });

  geo.center();

  const creased = toCreasedNormals(geo, 0.6);
  geo.dispose();
  return creased;
}

/* ---------------------------------------------------------
   LENS
   Lathe profile, bottom to top so the normals face outward:
   flat back -> small rounded corner -> straight wall -> dome.
   The axis is +Y; the mesh is rotated so the dome faces the camera.
--------------------------------------------------------- */
export function lensGeometry(radius, depth, dome, corner = 0.045) {
  const pts = [];

  pts.push(new THREE.Vector2(0, -depth));
  pts.push(new THREE.Vector2(radius - corner, -depth));

  for (let i = 1; i <= 6; i += 1) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(
        radius - corner + Math.sin(a) * corner,
        -depth + corner - Math.cos(a) * corner,
      ),
    );
  }

  pts.push(new THREE.Vector2(radius, 0));

  for (let i = 1; i <= 28; i += 1) {
    const a = (i / 28) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius * Math.cos(a), dome * Math.sin(a)));
  }

  return new THREE.LatheGeometry(pts, 72);
}
