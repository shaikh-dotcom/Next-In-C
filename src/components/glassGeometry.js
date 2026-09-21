import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/*
 * Geometry for the glass pieces.
 *
 *   buildLogoGeometry   the Mini Me mark, extruded and bevelled
 *   slabGeometry        a rounded slab with bevelled edges
 *   lensGeometry        a round puck with a domed front
 *
 * All are centred on the origin and face +Z.
 */

// Logo path data lives in MiniMeLogo.jsx as raw path units inside
// `translate(0,844) scale(.1,-.1)`, i.e. on a 1024 x 844 viewBox.
const LOGO_TRANSFORM = "translate(0,844) scale(0.1,-0.1)";
const LOGO_VIEWBOX_H = 844;

// How far the bevel grows the outline, in viewBox px. MiniMeGlass
// measures the finished logo at 724 px wide (bevel included).
const LOGO_BEVEL = 20.2;

/* ---------------------------------------------------------
   LOGO
--------------------------------------------------------- */
export function buildLogoGeometry(paths, worldWidth, { depth = 26, curveDivisions = 10 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 ${LOGO_VIEWBOX_H}"><g transform="${LOGO_TRANSFORM}">${paths
    .map((d) => `<path d="${d}"/>`)
    .join("")}</g></svg>`;

  const data = new SVGLoader().parse(svg);

  // SVG space is y-down. Mirror every outline into y-up (reversing the
  // point order to keep the winding) so the extrusion faces the right way.
  const flip = (pts) => pts.map((p) => new THREE.Vector2(p.x, -p.y)).reverse();

  const shapes = [];

  data.paths.forEach((shapePath) => {
    shapePath.toShapes(true).forEach((shape) => {
      const { shape: outline, holes } = shape.extractPoints(curveDivisions);

      const s = new THREE.Shape(flip(outline));
      s.holes = holes.map((h) => new THREE.Path(flip(h)));
      shapes.push(s);
    });
  });

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: 18,
    bevelSize: LOGO_BEVEL,
    bevelOffset: 0,
    bevelSegments: 6,
    curveSegments: 12,
  });

  // centre on the bounding box, then scale so the whole thing
  // (bevel included) is `worldWidth` wide
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const k = worldWidth / (box.max.x - box.min.x);

  geometry.translate(-cx, -cy, -cz);
  geometry.scale(k, k, k);
  geometry.computeVertexNormals();

  return geometry;
}

/* ---------------------------------------------------------
   SLAB   width x height x depth, corner radius r, edge bevel
--------------------------------------------------------- */
export function slabGeometry(width, height, radius, depth, bevel) {
  const w = width - bevel * 2;
  const h = height - bevel * 2;
  const r = Math.max(0.0001, Math.min(radius - bevel, w / 2, h / 2));

  const x = -w / 2;
  const y = -h / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 8,
    curveSegments: 24,
  });

  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  return geometry;
}

/* ---------------------------------------------------------
   LENS   a puck: flat back, straight side, domed (spherical) front
   The axis is Y, so rotate it by +90deg about X to face the camera.
--------------------------------------------------------- */
export function lensGeometry(radius, depth, dome, segments = 72) {
  const pts = [];
  const back = -depth / 2;
  const edge = Math.min(0.02, radius * 0.12);

  // flat back with a small rounded corner
  pts.push(new THREE.Vector2(0, back));
  pts.push(new THREE.Vector2(radius - edge, back));
  for (let i = 1; i <= 4; i += 1) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(
        radius - edge + Math.sin(a) * edge,
        back + edge - Math.cos(a) * edge,
      ),
    );
  }

  // straight side up to the rim of the dome
  const rim = depth / 2;
  pts.push(new THREE.Vector2(radius, rim));

  // spherical cap
  const Rs = (radius * radius + dome * dome) / (2 * dome);
  const cy = rim + dome - Rs;
  const a0 = Math.asin(Math.min(1, radius / Rs));
  const steps = 24;

  for (let i = 1; i <= steps; i += 1) {
    const a = a0 * (1 - i / steps);
    pts.push(new THREE.Vector2(Rs * Math.sin(a), cy + Rs * Math.cos(a)));
  }

  return new THREE.LatheGeometry(pts, segments);
}
