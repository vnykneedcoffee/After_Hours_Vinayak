import type { ReactNode } from "react";

type BrandGlyphProps = { className?: string };

export function BrandGlyph({ className = "" }: BrandGlyphProps) {
  return <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none" focusable="false">
      <path d="M8.5 29 17.2 11h5.1L31 29h-5.4l-2-4.5h-8L13.6 29H8.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16.8 20.7h5.3M24.3 11.4v17.2M31.2 11.4v17.2M24.5 20h6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
