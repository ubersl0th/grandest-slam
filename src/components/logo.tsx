type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 320, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="The Grandest Slam"
    >
      <defs>
        <radialGradient id="sun" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fbe06b" />
          <stop offset="65%" stopColor="#e8a838" />
          <stop offset="100%" stopColor="#d2502d" />
        </radialGradient>
        <pattern id="rays" patternUnits="userSpaceOnUse" width="20" height="320">
          <rect x="0" y="0" width="10" height="320" fill="#e8a838" />
        </pattern>
      </defs>

      {/* outer disc */}
      <circle cx="160" cy="160" r="156" fill="#1a1410" />
      <circle cx="160" cy="160" r="148" fill="#f7ecd2" />

      {/* sun rays */}
      <g transform="translate(160 160)">
        {Array.from({ length: 18 }).map((_, i) => (
          <rect
            key={i}
            x="-5"
            y="-148"
            width="10"
            height="60"
            fill="#e8a838"
            transform={`rotate(${i * 20})`}
          />
        ))}
      </g>

      {/* central sun */}
      <circle cx="160" cy="138" r="60" fill="url(#sun)" stroke="#1a1410" strokeWidth="4" />

      {/* sport icons orbiting */}
      <g stroke="#1a1410" strokeWidth="3" fill="#f7ecd2">
        <circle cx="78" cy="78" r="16" />
        <circle cx="242" cy="78" r="16" />
      </g>
      {/* tennis ball seam */}
      <path d="M 65 78 Q 78 65 91 78" stroke="#2f7e7a" strokeWidth="2.5" fill="none" />
      <path d="M 65 78 Q 78 91 91 78" stroke="#2f7e7a" strokeWidth="2.5" fill="none" />
      {/* padel ball seam — lighter */}
      <path d="M 229 78 Q 242 65 255 78" stroke="#2f7e7a" strokeWidth="2.5" fill="none" />
      <path d="M 229 78 Q 242 91 255 78" stroke="#2f7e7a" strokeWidth="2.5" fill="none" />

      {/* disc */}
      <ellipse cx="78" cy="240" rx="22" ry="6" fill="#2f7e7a" stroke="#1a1410" strokeWidth="3" />
      <ellipse cx="78" cy="237" rx="22" ry="6" fill="#6b3464" stroke="#1a1410" strokeWidth="3" />

      {/* golf ball + tee */}
      <rect x="238" y="244" width="4" height="14" fill="#1a1410" />
      <circle cx="240" cy="240" r="10" fill="#fbf6e8" stroke="#1a1410" strokeWidth="3" />
      <circle cx="237" cy="237" r="1.2" fill="#1a1410" />
      <circle cx="241" cy="237" r="1.2" fill="#1a1410" />
      <circle cx="239" cy="240" r="1.2" fill="#1a1410" />
      <circle cx="243" cy="241" r="1.2" fill="#1a1410" />

      {/* banner */}
      <g>
        <path
          d="M 40 195 L 40 230 L 60 220 L 80 230 L 100 220 L 120 230 L 120 195 Z M 200 195 L 200 230 L 220 220 L 240 230 L 260 220 L 280 230 L 280 195 Z"
          fill="#d2502d"
          stroke="#1a1410"
          strokeWidth="3"
        />
        <rect x="40" y="195" width="240" height="34" fill="#d2502d" stroke="#1a1410" strokeWidth="3" />
        <text
          x="160"
          y="218"
          textAnchor="middle"
          fontFamily="Bowlby One, Arial Black, sans-serif"
          fontSize="22"
          fill="#f7ecd2"
          letterSpacing="2"
        >
          GRANDEST SLAM
        </text>
      </g>

      {/* THE — top arc */}
      <path id="thearc" d="M 60 110 Q 160 50 260 110" fill="none" />
      <text
        fontFamily="Bowlby One, Arial Black, sans-serif"
        fontSize="22"
        fill="#1a1410"
        letterSpacing="3"
      >
        <textPath href="#thearc" startOffset="50%" textAnchor="middle">
          THE
        </textPath>
      </text>

      {/* year ribbon */}
      <text
        x="160"
        y="270"
        textAnchor="middle"
        fontFamily="Bowlby One, Arial Black, sans-serif"
        fontSize="14"
        fill="#1a1410"
        letterSpacing="6"
      >
        EST. 2026
      </text>
    </svg>
  );
}
