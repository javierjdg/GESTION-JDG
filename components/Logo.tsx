
import React from 'react';

export const Logo = ({ className = "h-12" }: { className?: string }) => (
  <svg viewBox="0 0 280 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="logoGreenCenter" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#bada36" />
        <stop offset="60%" stopColor="#9ec82c" />
        <stop offset="100%" stopColor="#0e837d" />
      </radialGradient>
    </defs>

    {/* Left: Letter J in Lime Green (#9ec82c) */}
    <g fill="#9ec82c">
      <path d="M 8,10 L 25,10 L 25,17 L 19,17 L 19,74 C 19,82.5 15.5,92 5,92 C 1.2,92 0,88.5 0,84 C 0,80 3.2,77.5 6.5,77.5 C 9.8,77.5 12,79.8 12,83.2 C 12,85.2 10.8,86.5 9.2,86.8 C 10.2,87.8 11.8,88.2 13.8,88.2 C 16.8,88.2 18,83.5 18,76 L 18,17 L 8,17 Z" />
    </g>

    {/* Left: Letters DG in Deep Teal (#00787a) */}
    <g fill="#00787a">
      {/* Letter D */}
      <path d="M 36,10 L 61,10 C 76,10 83,21 83,36 C 83,51 76,62 61,62 L 36,62 Z M 43,17 L 43,55 L 59,55 C 70,55 75.5,47.5 75.5,36 C 75.5,24.5 70,17 59,17 Z" />

      {/* Letter G */}
      <path d="M 132,20.5 L 126.5,24.5 C 123.5,19 117.5,16.5 110.5,16.5 C 98,16.5 90,26 90,36 C 90,46.5 98,55.5 110.5,55.5 C 119.5,55.5 125,50 125.5,42.5 L 110.5,42.5 L 110.5,36.5 L 132.5,36.5 L 132.5,61 L 127,61 L 126.5,56.5 C 122.5,60.5 116.5,62 110,62 C 94,62 82.5,49.5 82.5,36 C 82.5,22 94.5,10 110.5,10 C 119.5,10 127.5,14 132,20.5 Z" />
    </g>

    {/* Box: TELECO in Deep Teal with white typography */}
    <g transform="translate(36, 66)">
      <rect x="0" y="0" width="97" height="26" fill="#00787a" rx="1.5" />
      <text x="48.5" y="18.5" fontFamily="'Courier New', Courier, 'Lucida Console', monospace, sans-serif" fontWeight="900" fontSize="15" fill="#ffffff" textAnchor="middle" letterSpacing="3.5">TELECO</text>
      {/* Characteristic target dot inside the O */}
      <circle cx="82.5" cy="13.5" r="2.2" fill="#00787a" />
      <circle cx="82.5" cy="13.5" r="1.1" fill="#ffffff" />
    </g>

    {/* Right: The Vortex Radar Swirl */}
    <g transform="translate(205, 50)">
      {/* Central Gradient Disc */}
      <circle cx="0" cy="0" r="16.5" fill="url(#logoGreenCenter)" />

      {/* Center Crimson Ruby Dot */}
      <circle cx="0" cy="0" r="3.2" fill="#c8102e" />

      {/* Inner fine ripples */}
      <circle cx="0" cy="0" r="7" fill="none" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.8" />
      <circle cx="0" cy="0" r="11.5" fill="none" stroke="#ffffff" strokeWidth="0.7" strokeDasharray="14 4" strokeOpacity="0.6" transform="rotate(-30)" />

      {/* Swirling Vortex Waves (Teal & Emerald) */}
      <path d="M -18,-5 A 19 19 0 0 1 12,-16 A 21 21 0 0 1 23,2" fill="none" stroke="#00787a" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M 23,6 A 24 24 0 0 1 -4,25 A 25 25 0 0 1 -25,2" fill="none" stroke="#00787a" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M -26,-2 A 28 28 0 0 1 15,-25 A 29 29 0 0 1 30,-2" fill="none" stroke="#00787a" strokeWidth="3" strokeLinecap="round" />
      <path d="M 30,4 A 31 31 0 0 1 -10,31 A 32 32 0 0 1 -32,-3" fill="none" stroke="#00787a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M -33,-3 A 35 35 0 0 1 20,-30 A 36 36 0 0 1 37,-1" fill="none" stroke="#00787a" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M 37,2 A 38 38 0 0 1 -18,37 A 39 39 0 0 1 -38,5" fill="none" stroke="#00787a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M -38,3 A 41 41 0 0 1 25,-35 A 42 42 0 0 1 42,-5" fill="none" stroke="#00787a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 42,-3 A 43 43 0 0 1 -22,41 A 44 44 0 0 1 -42,10" fill="none" stroke="#00787a" strokeWidth="1.4" strokeLinecap="round" />
      
      {/* Accent Green-Teal Spirals */}
      <path d="M -15,10 A 18 18 0 0 1 -6,-17" fill="none" stroke="#9ec82c" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 12,-15 A 20 20 0 0 1 21,7" fill="none" stroke="#9ec82c" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 18,12 A 22 22 0 0 1 -10,21" fill="none" stroke="#9ec82c" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M -22,-14 A 26 26 0 0 1 12,-24" fill="none" stroke="#9ec82c" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  </svg>
);
