import React from "react";

/* =========================================================
   PYTHON
   Two intertwined bodies (blue on top, yellow below) with
   the classic "eye" cut-outs.
========================================================= */
export function PythonIcon() {
  return (
    <svg viewBox="0 0 128 128" width="46" height="46">
      <path
        d="M63.4 0c-6.2 0-12.1.5-17.3 1.5-15.3 2.7-18.1 8.4-18.1 18.9v13.9h36.2v4.6H21.9c-10.7 0-20.1 6.4-23 18.7-3.4 14.1-3.6 22.9 0 37.6 2.7 10.9 9.1 18.7 19.8 18.7h12.8V96.2c0-12.2 10.6-22.9 23-22.9h36.2c10.2 0 18.4-8.4 18.4-18.7V20.4c0-10-8.4-17.5-18.4-19.1C82.8 1 73 0 63.4 0zM44.1 12.6c3.8 0 6.9 3.1 6.9 7 0 3.8-3.1 6.9-6.9 6.9-3.8 0-6.9-3.1-6.9-6.9 0-3.9 3.1-7 6.9-7z"
        fill="#3776AB"
      />
      <path
        d="M100.9 39v13.5c0 12.7-10.8 23.4-23 23.4H41.7c-10 0-18.4 8.6-18.4 18.7v35c0 10 8.7 15.9 18.4 18.7 11.6 3.3 22.7 3.9 36.2 0 9.1-2.6 18.4-7.9 18.4-18.7v-14H60.1v-4.6h55.6c10.7 0 14.7-7.5 18.4-18.7 3.8-11.5 3.6-22.6 0-37.6-2.6-10.8-7.6-18.7-18.4-18.7h-14.8zM84.8 100.5c3.8 0 6.9 3.1 6.9 6.9 0 3.9-3.1 7-6.9 7-3.8 0-6.9-3.1-6.9-7 0-3.8 3.1-6.9 6.9-6.9z"
        fill="#FFD43B"
      />
    </svg>
  );
}

/* =========================================================
   TYPESCRIPT
   Rounded square, brand blue, white "TS" wordmark.
========================================================= */
export function TypeScriptIcon() {
  return (
    <svg viewBox="0 0 128 128" width="46" height="46">
      <rect width="128" height="128" rx="10" fill="#3178C6" />
      <text
        x="64"
        y="87"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="64"
        fill="#ffffff"
      >
        TS
      </text>
    </svg>
  );
}

/* =========================================================
   RUST
   Gear ring with a bolt/tooth pattern and an "R" mark,
   mirroring the real cog-and-letter Rust icon.
========================================================= */
export function RustIcon() {
  const teeth = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 360) / 12;
    return (
      <rect
        key={i}
        x="60"
        y="6"
        width="8"
        height="14"
        rx="1.5"
        fill="currentColor"
        transform={`rotate(${angle} 64 64)`}
      />
    );
  });

  return (
    <svg viewBox="0 0 128 128" width="46" height="46" color="#E4E6EB">
      <g>{teeth}</g>
      <circle
        cx="64"
        cy="64"
        r="42"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <text
        x="64"
        y="82"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="46"
        fill="currentColor"
      >
        R
      </text>
    </svg>
  );
}

/* =========================================================
   SOLIDITY  (user-provided asset)
========================================================= */
export function SolidityIcon() {
  return (
    <svg viewBox="0 0 523.9 813" width="42" height="42" fill="#9B9DB0">
      <path
        className="st0"
        opacity="0.45"
        d="M391.9 0l-130.7 232.3H0L130.6 0 391.9 0"
      />
      <path
        className="st1"
        opacity="0.6"
        d="M261.2 232.3h261.3L391.9 0h-261.3L261.2 232.3z"
      />
      <path
        className="st2"
        opacity="0.8"
        d="M130.6 464.5l130.6-232.2L130.6 0 0 232.3 130.6 464.5z"
      />
      <path
        className="st0"
        opacity="0.45"
        d="M131.9 813l130.7-232.3h261.3L393.2 813H131.9"
      />
      <path
        className="st1"
        opacity="0.6"
        d="M262.6 580.7h-261.3L131.9 813H393.2L262.6 580.7z"
      />
      <path
        className="st2"
        opacity="0.8"
        d="M393.2 348.5l-130.6 232.2L393.2 813l130.7-232.3L393.2 348.5z"
      />
    </svg>
  );
}

/* =========================================================
   ELIXIR  (user-provided asset)
========================================================= */
export function ElixirIcon() {
  return (
    <svg viewBox="0 0 128 128" width="44" height="44">
      <linearGradient
        id="elixir-original-a"
        gradientUnits="userSpaceOnUse"
        x1="835.592"
        y1="-36.546"
        x2="821.211"
        y2="553.414"
        gradientTransform="matrix(.1297 0 0 .2 -46.03 17.198)"
      >
        <stop offset="0" stopColor="#d9d8dc" />
        <stop offset="1" stopColor="#fff" stopOpacity=".385" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-a)"
        d="M64.4.5C36.7 13.9 1.9 83.4 30.9 113.9c26.8 33.5 85.4 1.3 68.4-40.5-21.5-36-35-37.9-34.9-72.9z"
      />
      <linearGradient
        id="elixir-original-b"
        gradientUnits="userSpaceOnUse"
        x1="942.357"
        y1="-40.593"
        x2="824.692"
        y2="472.243"
        gradientTransform="matrix(.1142 0 0 .2271 -47.053 17.229)"
      >
        <stop offset="0" stopColor="#8d67af" stopOpacity=".672" />
        <stop offset="1" stopColor="#9f8daf" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-b)"
        d="M64.4.2C36.8 13.6 1.9 82.9 31 113.5c10.7 12.4 28 16.5 37.7 9.1 26.4-18.8 7.4-53.1 10.4-78.5C68.1 33.9 64.2 11.3 64.4.2z"
      />
      <linearGradient
        id="elixir-original-c"
        gradientUnits="userSpaceOnUse"
        x1="924.646"
        y1="120.513"
        x2="924.646"
        y2="505.851"
        gradientTransform="matrix(.1227 0 0 .2115 -46.493 17.206)"
      >
        <stop offset="0" stopColor="#26053d" stopOpacity=".762" />
        <stop offset="1" stopColor="#b7b4b4" stopOpacity=".278" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-c)"
        d="M56.7 4.3c-22.3 15.9-28.2 75-24.1 94.2 8.2 48.1 75.2 28.3 69.6-16.5-6-29.2-48.8-39.2-45.5-77.7z"
      />
      <linearGradient
        id="elixir-original-d"
        gradientUnits="userSpaceOnUse"
        x1="428.034"
        y1="198.448"
        x2="607.325"
        y2="559.255"
        gradientTransform="matrix(.1848 0 0 .1404 -42.394 17.138)"
      >
        <stop offset="0" stopColor="#91739f" stopOpacity=".46" />
        <stop offset="1" stopColor="#32054f" stopOpacity=".54" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-d)"
        d="M78.8 49.8c10.4 13.4 12.7 22.6 6.8 27.9-27.7 19.4-61.3 7.4-54-37.3C22.1 63 4.5 96.8 43.3 101.6c20.8 3.6 54 2 58.9-16.1-.2-15.9-10.8-22.9-23.4-35.7z"
      />
      <linearGradient
        id="elixir-original-e"
        gradientUnits="userSpaceOnUse"
        x1="907.895"
        y1="540.636"
        x2="590.242"
        y2="201.281"
        gradientTransform="matrix(.1418 0 0 .1829 -45.23 17.18)"
      >
        <stop offset="0" stopColor="#463d49" stopOpacity=".331" />
        <stop offset="1" stopColor="#340a50" stopOpacity=".821" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-e)"
        d="M38.1 36.4c-2.9 21.2 35.1 77.9 58.3 71-17.7 35.6-56.9-21.2-64-41.7 1.5-11 2.2-16.4 5.7-29.3z"
      />
      <linearGradient
        id="elixir-original-f"
        gradientUnits="userSpaceOnUse"
        x1="1102.297"
        y1="100.542"
        x2="1008.071"
        y2="431.648"
        gradientTransform="matrix(.106 0 0 .2448 -47.595 17.242)"
      >
        <stop offset="0" stopColor="#715383" stopOpacity=".145" />
        <stop offset="1" stopColor="#f4f4f4" stopOpacity=".234" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-f)"
        d="M60.4 49.7c.8 7.9 3.9 20.5 0 28.8S38.7 102 43.6 115.3c11.4 24.8 37.1-4.4 36.9-19 1.1-11.8-6.6-38.7-1.8-52.5L76.5 41l-13.6-4c-2.2 3.2-3 7.5-2.5 12.7z"
      />
      <linearGradient
        id="elixir-original-g"
        gradientUnits="userSpaceOnUse"
        x1="1354.664"
        y1="140.06"
        x2="1059.233"
        y2="84.466"
        gradientTransform="matrix(.09173 0 0 .2828 -48.536 17.28)"
      >
        <stop offset="0" stopColor="#a5a1a8" stopOpacity=".356" />
        <stop offset="1" stopColor="#370c50" stopOpacity=".582" />
      </linearGradient>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#elixir-original-g)"
        d="M65.3 10.8C36 27.4 48 53.4 49.3 81.6l19.1-55.4c-1.4-5.7-2.3-9.5-3.1-15.4z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#330A4C"
        fillOpacity=".316"
        d="M68.3 26.1c-14.8 11.7-14.1 31.3-18.6 54 8.1-21.3 4.1-38.2 18.6-54z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFF"
        d="M45.8 119.7c8 1.1 12.1 2.2 12.5 3 .3 4.2-11.1 1.2-12.5-3z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#EDEDED"
        fillOpacity=".603"
        d="M49.8 10.8c-6.9 7.7-14.4 21.8-18.2 29.7-1 6.5-.5 15.7.6 23.5.9-18.2 7.5-39.2 17.6-53.2z"
      />
    </svg>
  );
}

/* =========================================================
   PHP  (user-provided asset)
========================================================= */
export function PhpIcon() {
  return (
    <svg viewBox="0 0 32 32" width="44" height="44">
      <circle cx="16" cy="16" r="14" fill="#8892BF" />
      <path
        d="M14.4392 10H16.1192L15.6444 12.5242H17.154C17.9819 12.5419 18.5986 12.7269 19.0045 13.0793C19.4184 13.4316 19.5402 14.1014 19.3698 15.0881L18.5541 19.4889H16.8497L17.6288 15.2863C17.7099 14.8457 17.6856 14.533 17.5558 14.348C17.426 14.163 17.146 14.0705 16.7158 14.0705L15.3644 14.0573L14.3661 19.4889H12.6861L14.4392 10Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.74092 12.5243H10.0036C10.9612 12.533 11.6552 12.8327 12.0854 13.4229C12.5156 14.0132 12.6576 14.8193 12.5115 15.8414C12.4548 16.3085 12.3289 16.7665 12.1341 17.2159C11.9474 17.6652 11.6878 18.0704 11.355 18.4317C10.9491 18.8898 10.5149 19.1805 10.0523 19.304C9.58969 19.4274 9.11076 19.489 8.61575 19.489H7.15484L6.69222 22H5L6.74092 12.5243ZM7.43485 17.9956L8.16287 14.0441H8.40879C8.49815 14.0441 8.5914 14.0396 8.6888 14.0309C9.33817 14.0221 9.87774 14.0882 10.308 14.2291C10.7462 14.37 10.8923 14.9031 10.7462 15.8282C10.5678 16.9296 10.2186 17.5727 9.69926 17.7577C9.1799 17.934 8.53053 18.0176 7.75138 18.0088H7.58094C7.53224 18.0088 7.48355 18.0043 7.43485 17.9956Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24.4365 12.5243H21.1738L19.4329 22H21.1251L21.5878 19.489H23.0487C23.5437 19.489 24.0226 19.4274 24.4852 19.304C24.9479 19.1805 25.382 18.8898 25.7879 18.4317C26.1207 18.0704 26.3803 17.6652 26.567 17.2159C26.7618 16.7665 26.8877 16.3085 26.9444 15.8414C27.0905 14.8193 26.9486 14.0132 26.5183 13.4229C26.0881 12.8327 25.3942 12.533 24.4365 12.5243ZM22.5958 14.0441L21.8678 17.9956C21.9165 18.0043 21.9652 18.0088 22.0139 18.0088H22.1843C22.9635 18.0176 23.6128 17.934 24.1322 17.7577C24.6515 17.5727 25.0007 16.9296 25.1792 15.8282C25.3253 14.9031 25.1792 14.37 24.7409 14.2291C24.3107 14.0882 23.7711 14.0221 23.1217 14.0309C23.0243 14.0396 22.9311 14.0441 22.8417 14.0441H22.5958Z"
        fill="white"
      />
    </svg>
  );
}
