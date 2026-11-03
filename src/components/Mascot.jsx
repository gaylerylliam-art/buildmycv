import React, { useEffect, useState } from 'react';

export const mascotMoods = ['welcoming', 'thoughtful', 'focused', 'confident', 'excited', 'reassuring'];
export const cardMascotPositions = ['top', 'middle-right', 'bottom-left', 'bottom-right'];
export const cardMascotImages = ['character-top', 'character-side', 'character-bottom', 'character-wave'].map(name => `/assets/mascots/${name}.webp`);

export default function Mascot({ mood = 'welcoming', size = 'medium', placement = 'inline', animation = 'auto', image, sprite, spriteDelay = 0, eager = false }) {
  const safeMood = mascotMoods.includes(mood) ? mood : 'welcoming';
  const source = image || `/assets/mascots/${safeMood}.webp?v=cutout`;
  const [images, setImages] = useState({ active: source, previous: null });
  const [loadedSprite, setLoadedSprite] = useState(null);
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
  return <span className={`site-mascot mascot-size-${size} mascot-placement-${placement}${sprite ? ' mascot-has-sprite' : ''}`} style={sprite ? { '--mascot-sprite-delay': `${spriteDelay}s` } : undefined} data-mascot="" data-mood={safeMood} data-mascot-static={animation === 'none' ? 'true' : undefined} data-mascot-swapping={images.previous ? 'true' : undefined} data-mascot-sprite-ready={sprite && loadedSprite === sprite ? 'true' : undefined} aria-hidden="true" data-html2canvas-ignore="true">
    <span className="mascot-reveal"><span className="mascot-life"><span className="mascot-hover">
      {images.previous && <img key={images.previous} className="mascot-image mascot-image-outgoing" src={images.previous} width="512" height="512" alt="" draggable="false" />}
      <img key={images.active} className="mascot-image mascot-image-current" src={images.active} width="512" height="512" alt="" draggable="false" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      {sprite && <img key={sprite} className="mascot-sprite" src={sprite} width="1024" height="256" alt="" draggable="false" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoadedSprite(sprite)} onError={() => setLoadedSprite(null)} />}
    </span></span></span>
  </span>;
}
