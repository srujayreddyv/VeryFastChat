/**
 * Single amethyst chat cloud logo. Same SVG used everywhere; size controlled by variant or size prop.
 */
const LOGO_PATH =
  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z";

const SIZES = { sm: 24, md: 28, lg: 32 } as const;

export function Logo({
  size,
  variant = "md",
  className = "",
  "aria-hidden": ariaHidden = true
}: {
  size?: number;
  variant?: keyof typeof SIZES;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const px = size ?? SIZES[variant];
  return (
    <span
      className={`logo-accent ${className}`.trim()}
      aria-hidden={ariaHidden}
      style={{ display: "inline-flex" }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={LOGO_PATH} />
      </svg>
    </span>
  );
}

export function LogoWithText({
  variant = "md",
  className = ""
}: {
  variant?: keyof typeof SIZES;
  className?: string;
}) {
  const size = SIZES[variant];
  return (
    <span className={`logo-with-text ${className}`.trim()}>
      <Logo size={size} className="logo-accent" aria-hidden />
      <span className="logo-text">VeryFastChat</span>
    </span>
  );
}
