import Link from "next/link";

export function BrandMark({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <rect className="brand-mark-frame" x="2" y="2" width="60" height="60" rx="18" />
      <path className="brand-mark-ticket" d="M16 13h32a7 7 0 0 1 7 7v5a7 7 0 0 0 0 14v5a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7v-5a7 7 0 0 0 0-14v-5a7 7 0 0 1 7-7Z" />
      <path className="brand-mark-perforation" d="M23 18v28" />
      <circle className="brand-mark-punch" cx="19" cy="32" r="2.5" />
      <circle className="brand-mark-portal" cx="39" cy="32" r="10.5" />
      <path className="brand-mark-arrow" d="m34.5 36.5 9-9m-6 0h6v6" />
    </svg>
  );
}

export function BrandLink({ className = "" }) {
  return (
    <Link className={`wordmark ${className}`.trim()} href="/" aria-label="Take Me Somewhere home">
      <BrandMark className="wordmark-mark" />
      <span className="wordmark-copy"><span>take me</span><em>somewhere</em></span>
    </Link>
  );
}
