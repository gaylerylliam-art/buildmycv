import React, { useEffect, useState } from 'react';

export const mascotMoods = ['welcoming', 'thoughtful', 'focused', 'confident', 'excited', 'reassuring'];

export default function Mascot({ mood = 'welcoming', size = 'medium', placement = 'inline', animation = 'auto', image, eager = false }) {
  const safeMood = mascotMoods.includes(mood) ? mood : 'welcoming';
  const source = image || `/assets/mascots/${safeMood}.webp?v=cutout`;
  const [images, setImages] = useState({ active: source, previous: null });
  useEffect(() => {
    if (source === images.active) return;
    let cancelled = false;
    const next = new Image();
    next.src = source;
    next.decode().then(() => {
      if (!cancelled) setImages(current => ({ active: source, previous: current.active }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [source, images.active]);
  useEffect(() => {
    if (!images.previous) return;
    const timer = window.setTimeout(() => setImages(current => ({ ...current, previous: null })), 400);
    return () => window.clearTimeout(timer);
  }, [images.active, images.previous]);
  return <span className={`site-mascot mascot-size-${size} mascot-placement-${placement}`} data-mascot="" data-mood={safeMood} data-mascot-static={animation === 'none' ? 'true' : undefined} data-mascot-swapping={images.previous ? 'true' : undefined} aria-hidden="true" data-html2canvas-ignore="true">
    <span className="mascot-reveal"><span className="mascot-life"><span className="mascot-hover">
      {images.previous && <img key={images.previous} className="mascot-image mascot-image-outgoing" src={images.previous} width="512" height="512" alt="" draggable="false" />}
      <img key={images.active} className="mascot-image mascot-image-current" src={images.active} width="512" height="512" alt="" draggable="false" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </span></span></span>
  </span>;
}
