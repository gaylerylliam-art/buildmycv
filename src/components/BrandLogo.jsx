import React from "react";

export default function BrandLogo({ tone = "auto" }) {
  return <strong className="brand-logo" data-tone={tone}>
    <img className="brand-logo-artwork" src="/assets/buildmycvnow-logo.webp" width="448" height="405" alt="BuildMyCVNow" decoding="async" />
  </strong>;
}
