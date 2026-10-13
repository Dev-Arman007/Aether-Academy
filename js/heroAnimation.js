export function initHero(onComplete) {
  const sequence = document.querySelector('.scroll-sequence');
  const canvas = document.querySelector('#hero-canvas');
  if (!sequence || !canvas) return undefined;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;

  const frames = Array.from({ length: 240 });
  const requestedFrames = new Set();
  let target = 0;
  let current = 0;
  let width = 0;
  let height = 0;
  let running = false;
  let completed = false;
  let animationFrame = 0;

  function draw(index) {
    const image = frames[index] || frames[0];
    if (!image?.naturalWidth || !width || !height) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const viewport = width / height;
    let w = width;
    let h = height;
    let x = 0;
    let y = 0;
    if (ratio > viewport) { h = width / ratio; y = (height - h) / 2; }
    else { w = height * ratio; x = (width - w) / 2; }

    context.fillStyle = '#030813';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, x, y, w, h);
    // Fade the Gemini and Veo marks burned into the source frames into the hero background.
    const mask = context.createLinearGradient(x + w * 0.82, y + h * 0.8, x + w, y + h);
    mask.addColorStop(0, 'rgba(3, 8, 19, 0)');
    mask.addColorStop(0.36, 'rgba(3, 8, 19, .58)');
    mask.addColorStop(1, '#030813');
    context.fillStyle = mask;
    context.fillRect(x + w * 0.82, y + h * 0.8, w * 0.18, h * 0.2);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(Math.round(current));
  }

  function render() {
    current += (target - current) * 0.16;
    if (Math.abs(target - current) < 0.03) current = target;
    draw(Math.round(current));
    canvas.style.transform = 'translateZ(0) rotateX(' + ((current / 239 - 0.5) * -1.8) + 'deg)';
    running = Math.abs(target - current) >= 0.03;
    if (running) animationFrame = requestAnimationFrame(render);
  }

  function scroll() {
    const range = Math.max(1, sequence.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, -sequence.getBoundingClientRect().top / range));
    target = progress * 239;
    const center = Math.round(target);
    for (let index = Math.max(0, center - 4); index <= Math.min(239, center + 20); index += 1) loadFrame(index);
    if (!running) { running = true; animationFrame = requestAnimationFrame(render); }
    if (!completed && progress >= 0.96) { completed = true; onComplete?.(); }
  }

  function loadFrame(index) {
    if (requestedFrames.has(index)) return;
    requestedFrames.add(index);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      frames[index] = image;
      if (index === 0 || index === Math.round(current)) draw(Math.round(current));
    };
    image.onerror = () => requestedFrames.delete(index);
    image.src = './image-frames/ezgif-frame-' + String(index + 1).padStart(3, '0') + '.jpg';
  }

  function onResize() { resize(); scroll(); }
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', scroll, { passive: true });
  resize();
  scroll();

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', scroll);
    cancelAnimationFrame(animationFrame);
  };
}
