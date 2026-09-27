// Rating mark for "good" / "not good" results, drawn in the text colour (instead of emoji,
// which ignore the theme and render differently across macOS versions).
export default function ThumbIcon({ up = true, size = 13, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: up ? undefined : 'rotate(180deg)', flexShrink: 0 }}
    >
      <path d="M5 7v7H2.5V7H5z" />
      <path d="M5 7l3-5c1.1 0 1.8.8 1.6 1.9L9.2 6h3.6c.9 0 1.5.8 1.3 1.7l-1.1 5c-.2.7-.8 1.3-1.5 1.3H5" />
    </svg>
  )
}
