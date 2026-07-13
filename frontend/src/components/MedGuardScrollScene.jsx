import { useRef, useState, useEffect, useCallback } from 'react';
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion';
import { FRAME_COUNT, getFramePath, COPY_BEATS } from '@/data/medguardFrames';

const MAX_DPR = 2;
const PRELOAD_CONCURRENCY = 6;
const START_SCROLL_THRESHOLD = 0.15; // Stationary background zone for first 15% scroll
const START_CONTENT_THRESHOLD = 0.20; // Copy beats start at 20% scroll progress

// Adjust copy beats to occupy 20% to 100% of scroll progress
const ADJUSTED_COPY_BEATS = COPY_BEATS.map((beat) => {
  const range = 1.0 - START_CONTENT_THRESHOLD;
  return {
    ...beat,
    start: START_CONTENT_THRESHOLD + beat.start * range,
    end: START_CONTENT_THRESHOLD + beat.end * range,
  };
});

/**
 * Scroll-driven canvas with clinical overlay grid, cover-fit,
 * delayed scroll sequence start, and cinematic title card.
 */
export default function MedGuardScrollScene() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef(new Array(FRAME_COUNT).fill(null));
  const currentFrameRef = useRef(0);
  const rafRef = useRef(null);

  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Scroll tracking within the container
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  // Track scroll progress for overlays
  useMotionValueEvent(smoothProgress, 'change', (v) => {
    setScrollProgress(v);
  });

  // --- Frame preloader ---
  useEffect(() => {
    if (prefersReducedMotion) return;

    let cancelled = false;
    let loaded = 0;

    const loadImage = (index) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            imagesRef.current[index] = img;
            loaded++;
            setLoadProgress(loaded / FRAME_COUNT);
          }
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = getFramePath(index + 1);
      });

    async function preloadAll() {
      const firstLoaded = await loadImage(0);
      if (cancelled) return;
      if (!firstLoaded) {
        setLoadError(true);
        return;
      }
      setIsReady(true);

      const remaining = Array.from({ length: FRAME_COUNT - 1 }, (_, i) => i + 1);
      let cursor = 0;

      async function worker() {
        while (cursor < remaining.length && !cancelled) {
          const idx = remaining[cursor++];
          await loadImage(idx);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(PRELOAD_CONCURRENCY, remaining.length) }, () => worker())
      );
    }

    preloadAll();
    return () => { cancelled = true; };
  }, [prefersReducedMotion]);

  // --- Canvas drawing ---
  const drawFrame = useCallback((frameIndex) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[frameIndex];
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const bufW = Math.round(w * dpr);
    const bufH = Math.round(h * dpr);
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = w / h;

    let drawW, drawH, drawX, drawY;
    // COVER FIT: Cover the entire canvas and crop excess
    if (imgAspect > canvasAspect) {
      drawH = bufH;
      drawW = drawH * imgAspect;
      drawX = (bufW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = bufW;
      drawH = drawW / imgAspect;
      drawX = 0;
      drawY = (bufH - drawH) / 2;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, bufW, bufH);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, []);

  // --- RAF draw loop ---
  useEffect(() => {
    if (!isReady || prefersReducedMotion) return;

    const unsubscribe = smoothProgress.on('change', (v) => {
      // Map progress to frames with a threshold dead-zone
      let targetFrame = 0;
      if (v > START_SCROLL_THRESHOLD) {
        const mappedProgress = (v - START_SCROLL_THRESHOLD) / (1 - START_SCROLL_THRESHOLD);
        targetFrame = Math.min(FRAME_COUNT - 1, Math.round(mappedProgress * (FRAME_COUNT - 1)));
      }

      if (targetFrame !== currentFrameRef.current) {
        currentFrameRef.current = targetFrame;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          let frameToShow = targetFrame;
          if (!imagesRef.current[frameToShow]) {
            for (let d = 1; d < FRAME_COUNT; d++) {
              if (imagesRef.current[targetFrame - d]) { frameToShow = targetFrame - d; break; }
              if (imagesRef.current[targetFrame + d]) { frameToShow = targetFrame + d; break; }
            }
          }
          drawFrame(frameToShow);
        });
      }
    });

    drawFrame(0);

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady, smoothProgress, drawFrame, prefersReducedMotion]);

  // --- Resize observer ---
  useEffect(() => {
    if (!canvasRef.current || prefersReducedMotion) return;

    const observer = new ResizeObserver(() => {
      drawFrame(currentFrameRef.current);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [drawFrame, prefersReducedMotion]);

  // Reduced motion: static overview inline
  if (prefersReducedMotion) {
    return (
      <section className="mg-scene-reduced" aria-label="MedGuard overview">
        <div className="mg-scene-reduced__content">
          <img
            src={getFramePath(FRAME_COUNT)}
            alt=""
            className="mg-scene-reduced__image"
            loading="eager"
          />
          {ADJUSTED_COPY_BEATS.map((beat, i) => (
            <div key={i} className="mg-scene-reduced__beat">
              <h2 className="mg-scene-reduced__headline">{beat.headline}</h2>
              <p className="mg-scene-reduced__body">{beat.body}</p>
              {beat.cta && (
                <a href={beat.cta.href} className="mg-scene-reduced__cta">
                  {beat.cta.label}
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Cinematic title animation parameters (persists through threshold)
  let titleOpacity = 1;
  const FADE_START = 0.10;
  const FADE_END = 0.18;

  if (scrollProgress > FADE_START) {
    titleOpacity = Math.max(0, 1 - (scrollProgress - FADE_START) / (FADE_END - FADE_START));
  }

  const titleScale = scrollProgress < FADE_START ? 1 : 1 - (scrollProgress - FADE_START) * 0.9;
  const titleY = scrollProgress < FADE_START ? 0 : -(scrollProgress - FADE_START) * 200;

  return (
    <section
      ref={wrapperRef}
      className="mg-scene"
      aria-label="MedGuard scroll animation"
    >
      <div className="mg-scene__sticky">
        {!isReady ? (
          <div className="mg-loader" role="status" aria-label="Loading animation">
            {loadError ? (
              <div className="mg-loader__error">
                <p>Unable to load the animation experience.</p>
                <p className="mg-loader__error-sub">Please refresh to try again.</p>
              </div>
            ) : (
              <>
                <span className="mg-loader__label">Loading experience</span>
                <div className="mg-loader__track">
                  <div
                    className="mg-loader__fill"
                    style={{ width: `${Math.round(loadProgress * 100)}%` }}
                  />
                </div>
                <span className="mg-loader__pct">{Math.round(loadProgress * 100)}%</span>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Canvas backdrop */}
            <canvas
              ref={canvasRef}
              className="mg-scene__canvas"
              aria-hidden="true"
            />

            {/* Medical clinical grid overlay */}
            <div className="mg-grid-overlay" aria-hidden="true" />

            {/* Lens masking overlay */}
            <div className="mg-scene__lens" aria-hidden="true" />

            {/* Bottom transition blend overlay to merge borders */}
            <div className="mg-scene__fade-bottom" aria-hidden="true" />

            {/* Opaque fade overlay to gradually fade the background to white at the bottom of scroll */}
            <div
              className="mg-scene__opaque-fade"
              style={{ opacity: Math.min(1, Math.max(0, (scrollProgress - 0.85) * 6.67)) }}
              aria-hidden="true"
            />

            {/* Cinematic Center Title Card (Glassmorphic + 3D effects) */}
            {scrollProgress < FADE_END && (
              <div
                className="mg-hero-center-title"
                style={{
                  opacity: titleOpacity,
                  transform: `translate(-50%, -50%) scale(${titleScale}) translateY(${titleY}px)`,
                  pointerEvents: 'auto'
                }}
              >
                <h1 className="mg-hero-logo">MedGuard</h1>
                <p className="mg-hero-tagline">AI-Powered Medication Safety</p>
                <div className="mg-hero-actions">
                  <a href="/login" className="mg-btn-primary">Get Started</a>
                  <a href="/login" className="mg-btn-outline">Sign In</a>
                </div>
              </div>
            )}

            {/* Scroll indicator */}
            {scrollProgress < 0.05 && (
              <div
                className="mg-scene__scroll-hint"
                style={{ opacity: 1 - scrollProgress * 20 }}
              >
                <span>Scroll to explore</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}

            {/* Copy overlays absolute-positioned within the sticky container */}
            {ADJUSTED_COPY_BEATS.map((beat, i) => (
              <CopyOverlay key={i} beat={beat} progress={scrollProgress} index={i} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Single copy beat overlay.
 * Fades in over first 15% of range, holds, fades out over last 15%.
 */
function CopyOverlay({ beat, progress, index }) {
  const range = beat.end - beat.start;
  const fadeInEnd = beat.start + range * 0.15;
  const fadeOutStart = beat.end - range * 0.15;

  let opacity = 0;
  let translateY = 20;

  if (progress >= beat.start && progress <= beat.end) {
    if (progress < fadeInEnd) {
      const t = (progress - beat.start) / (fadeInEnd - beat.start);
      opacity = t;
      translateY = 20 * (1 - t);
    } else if (progress > fadeOutStart) {
      const t = (progress - fadeOutStart) / (beat.end - fadeOutStart);
      opacity = 1 - t;
      translateY = -20 * t;
    } else {
      opacity = 1;
      translateY = 0;
    }
  }

  if (opacity <= 0.01) return null;

  const quadrantClasses = [
    'mg-copy--top-left',
    'mg-copy--right-center',
    'mg-copy--right-top',
    'mg-copy--left-bottom'
  ];
  const posClass = quadrantClasses[index] || 'mg-copy--left';

  return (
    <div
      className={`mg-copy ${posClass}`}
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span className="mg-copy__index">0{index + 1}</span>
      <h2 className="mg-copy__headline">{beat.headline}</h2>
      <p className="mg-copy__body">{beat.body}</p>
      {beat.cta && (
        <a href={beat.cta.href} className="mg-copy__cta">
          {beat.cta.label}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
    </div>
  );
}
