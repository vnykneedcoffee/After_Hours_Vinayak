import type { ReactNode } from "react";

type BrandGlyphProps = { className?: string };

export function BrandGlyph({ className = "" }: BrandGlyphProps) {
  return <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none" focusable="false">
      <path d="M10 17.5h20v14H10z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m10 16 18.4-5 2 6.2-18.7 5L10 16Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m15.1 14.6 2.6 4.1m3.1-5.6 2.5 4.2m3-5.7 2.4 4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 25.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".72" />
      <circle cx="27.3" cy="27.1" r="1.35" fill="currentColor" />
    </svg>
  </span>;
}

type BrandLogoProps = {
  href?: string;
  className?: string;
  children?: ReactNode;
};

export function BrandLogo({ href = "/", className = "", children }: BrandLogoProps) {
  return <a className={`brand ${className}`.trim()} href={href} aria-label="After Hours home">
    <BrandGlyph />
    {children ?? <span className="brand-name"><span>AFTER</span><i>/</i><span>HOURS</span></span>}
  </a>;
}
