import React from "react";

export default function BrandLogo({ tone = "auto" }) {
  return <strong className="brand-logo" data-tone={tone}>
    <span className="brand-logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg></span>
    <span className="brand-logo-word">BuildMyCV<span className="brand-logo-now">Now</span></span>
  </strong>;
}
