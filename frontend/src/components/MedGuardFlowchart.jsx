import { useRef, useEffect, useState, useMemo } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import './MedGuardFlowchart.css';

/* ─── Reuse the same 5 step objects (icon, label, description) ─── */
const FLOW_STEPS = [
  {
    id: 'scan',
    label: '1. Photograph',
    title: 'Prescription Scan',
    desc: 'Extract handwritten or printed text directly from prescription images.',
    icon: (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: 'extract',
    label: '2. Structure',
    title: 'OCR Extraction',
    desc: 'Parse medicine names, dosages, and frequencies into tabular data.',
    icon: (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </svg>
    ),
  },
  {
    id: 'resolve',
    label: '3. Translate',
    title: 'Generic Resolution',
    desc: 'Map brand names to generic molecule equivalents automatically.',
    icon: (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
  },
  {
    id: 'check',
    label: '4. Analyze',
    title: 'Safety Check',
    desc: 'Verify cross-interactions deterministically using safety logic.',
    icon: (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'prep',
    label: '5. Prepare',
    title: 'Visit Brief',
    desc: 'Generate preparation guides and structured questions for doctor appointments.',
    icon: (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
];

// Fixed header height (matches CSS styling)
const HEADER_H = 240;

export default function MedGuardFlowchart() {
  const containerRef = useRef(null);
  const pathRef = useRef(null);
  const [pathLen, setPathLen] = useState(0);

  // Monitor size changes for dynamic path recalculation
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: window.innerHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Measure path length
  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, [dimensions]);

  // Track global scroll of the entire 500vh container (start to end viewport match)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const [activeStep, setActiveStep] = useState(0);
  const [markerPos, setMarkerPos] = useState({ x: 100, y: HEADER_H + 360 });
  const [trailProgress, setTrailProgress] = useState(0);
  const [currentThemeColor, setCurrentThemeColor] = useState('#0F766E');

  // Calculate dynamic target Ps based on viewport height and header height on resize
  const targetPs = useMemo(() => {
    const scrollRange = HEADER_H + 3.5 * dimensions.height;
    return [
      HEADER_H / scrollRange,
      (HEADER_H + dimensions.height) / scrollRange,
      (HEADER_H + 2 * dimensions.height) / scrollRange,
      (HEADER_H + 3 * dimensions.height) / scrollRange,
      1.0,
    ];
  }, [dimensions]);

  // Transform background color gradually based on step centering
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, targetPs[1], targetPs[2], targetPs[3], 1.0],
    ['#ffffff', '#f0f9ff', '#fefce8', '#faf5ff', '#ffffff']
  );

  // Transform grid color: COMPLEMENTARY to background for pop
  // Blue bg → orange grid, Yellow bg → purple grid, Purple bg → green grid
  const gridColor = useTransform(
    scrollYProgress,
    [0, targetPs[1], targetPs[2], targetPs[3], 1.0],
    [
      'rgba(15, 118, 110, 0.12)',  // Default: teal
      'rgba(234, 88, 12, 0.16)',   // Complementary to blue bg: orange
      'rgba(126, 34, 206, 0.14)',  // Complementary to yellow bg: purple
      'rgba(22, 163, 74, 0.16)',   // Complementary to purple bg: green
      'rgba(15, 118, 110, 0.12)',  // Default: teal
    ]
  );

  // Transform activeColor (nodes, trace, tracker dot) gradually as you scroll
  const activeColor = useTransform(
    scrollYProgress,
    [0, targetPs[1], targetPs[2], targetPs[3], 1.0],
    ['#0F766E', '#0284C7', '#CA8A04', '#9333EA', '#0F766E']
  );

  // Calculate card transforms and tracker position globally to avoid sync lags
  const [cardStates, setCardStates] = useState(
    FLOW_STEPS.map(() => ({ opacity: 0, translateY: 40 }))
  );

  // Scroll piecewise helper mapping scrollProgress to trackProgress
  const getTrackProgress = (p) => {
    // keys map scrollProgress -> trackProgress [0.0, 0.25, 0.50, 0.75, 1.00]
    const keys = [
      [0.0, 0.0],
      [targetPs[0], 0.0],
      [targetPs[1], 0.25],
      [targetPs[2], 0.50],
      [targetPs[3], 0.75],
      [targetPs[4], 1.00],
    ];

    const val = Math.max(0, Math.min(1, p));
    for (let i = 0; i < keys.length - 1; i++) {
      const [s0, pp0] = keys[i];
      const [s1, pp1] = keys[i + 1];
      if (val >= s0 && val <= s1) {
        if (s1 === s0) return pp0;
        const t = (val - s0) / (s1 - s0);
        
        // Easing speed warps:
        // Segment i=2 (Step 2->3) and Segment i=4 (Step 4->5) are warped slower.
        // Others (Step 1->2, Step 3->4) are linear.
        let t_warped = t;
        if (i === 2 || i === 4) {
          t_warped = Math.pow(t, 1.45);
        }
        return pp0 + t_warped * (pp1 - pp0);
      }
    }
    return 1.0;
  };

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const p = Math.max(0, Math.min(1, v));

    // Determine current active step based on scroll focus boundaries
    let stepIdx = 0;
    if (p < (targetPs[0] + targetPs[1]) / 2) stepIdx = 0;
    else if (p < (targetPs[1] + targetPs[2]) / 2) stepIdx = 1;
    else if (p < (targetPs[2] + targetPs[3]) / 2) stepIdx = 2;
    else if (p < (targetPs[3] + 1.0) / 2) stepIdx = 3;
    else stepIdx = 4;
    setActiveStep(stepIdx);

    // Get track progress and sync trail
    const p_warped = getTrackProgress(p);
    setTrailProgress(p_warped);

    if (pathRef.current && pathLen > 0) {
      const pt = pathRef.current.getPointAtLength(p_warped * pathLen);
      setMarkerPos({ x: pt.x, y: pt.y });
    }

    // Get activeColor current value and trigger state update
    setCurrentThemeColor(activeColor.get());

    // Update opacity & translations for all text cards based on center range offsets
    setCardStates(
      FLOW_STEPS.map((_, idx) => {
        const centerP = targetPs[idx];
        const startFadeIn = centerP - 0.12;
        const endFadeIn = centerP - 0.07;
        const startFadeOut = centerP + 0.07;
        const endFadeOut = centerP + 0.12;

        // Step 0 is special: visible immediately on load, only fades out
        if (idx === 0) {
          if (p <= startFadeOut) {
            return { opacity: 1, translateY: 0 };
          } else if (p > startFadeOut && p <= endFadeOut) {
            const t = (p - startFadeOut) / (endFadeOut - startFadeOut);
            return { opacity: 1 - t, translateY: -40 * t };
          } else {
            return { opacity: 0, translateY: -40 };
          }
        }

        // Standard fade in -> active -> fade out
        if (p < startFadeIn) {
          return { opacity: 0, translateY: 40 };
        } else if (p >= startFadeIn && p < endFadeIn) {
          const t = (p - startFadeIn) / (endFadeIn - startFadeIn);
          return { opacity: t, translateY: 40 * (1 - t) };
        } else if (p >= endFadeIn && p <= startFadeOut) {
          return { opacity: 1, translateY: 0 };
        } else if (p > startFadeOut && p <= endFadeOut) {
          const t = (p - startFadeOut) / (endFadeOut - startFadeOut);
          return { opacity: 1 - t, translateY: -40 * t };
        } else {
          return { opacity: 0, translateY: -40 };
        }
      })
    );
  });

  // Calculate nodes positions across the entire height
  const nodes = useMemo(() => {
    // Bring nodes closer to center layout (offsetX scaled to screen width)
    const offsetX = Math.max(220, Math.min(300, dimensions.width * 0.18));
    return FLOW_STEPS.map((_, idx) => {
      const isLeft = idx % 2 === 0;
      const verticalOffset = idx === 4 ? 0.0 : 0.45; // Last step node is centered at 0px inside the 50vh section (which equals 4.0H scroll viewport center)
      return {
        x: isLeft ? offsetX : dimensions.width - offsetX,
        y: idx * dimensions.height + HEADER_H + dimensions.height * verticalOffset,
      };
    });
  }, [dimensions]);

  // Construct a single, unbroken winding path string
  const continuousPathD = useMemo(() => {
    if (nodes.length === 0) return '';
    let d = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 0; i < nodes.length - 1; i++) {
      const curr = nodes[i];
      const next = nodes[i + 1];
      const midY = curr.y + dimensions.height * 0.5;
      d += ` C ${curr.x} ${midY + 80}, ${next.x} ${midY - 80}, ${next.x} ${next.y}`;
    }
    return d;
  }, [nodes, dimensions]);

  return (
    <motion.div
      ref={containerRef}
      className="mg-flow-v"
      style={{
        backgroundColor,
        '--mg-flow-grid': gridColor,
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
      }}
    >
      {/* Title Header area (moved inside container to share background and grid colors) */}
      <div className="mg-flow-v__header" style={{ height: `${HEADER_H}px` }}>
        <p className="mg-section__eyebrow" style={{ color: currentThemeColor, fontSize: '13px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px', transition: 'color 0.3s ease' }}>How it works</p>
        <h1 className="mg-section__title" style={{ fontSize: '42px', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--mg-ink)', margin: '0 0 16px', fontFamily: "'Cormorant Garamond', serif" }}>How MedGuard helps</h1>
        <p className="mg-section__subtitle" style={{ fontSize: '18px', color: 'var(--mg-muted)', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          A clearer path from prescription to informed conversation.
        </p>
      </div>

      {/* Timeline SVG layer covering full height of timeline */}
      <div className="mg-flow-v__svg-layer">
        <svg
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {/* Background winding track (faint) */}
          {continuousPathD && (
            <path
              d={continuousPathD}
              fill="none"
              stroke="rgba(226, 232, 240, 0.8)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          )}

          {/* Active path trail (colored, uses SAME warped progress as tracker) */}
          {continuousPathD && (
            <path
              ref={pathRef}
              d={continuousPathD}
              fill="none"
              stroke={currentThemeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={pathLen || 1}
              strokeDashoffset={(1 - trailProgress) * pathLen}
              className="mg-flow-v__path-active"
              style={{ transition: 'stroke 0.3s ease' }}
            />
          )}

          {/* Single continuous tracker marker (never teleport, always on the line, rendered under nodes) */}
          {pathLen > 0 && (
            <g transform={`translate(${markerPos.x}, ${markerPos.y})`}>
              <circle
                cx="0"
                cy="0"
                r="18"
                fill={currentThemeColor}
                stroke="var(--mg-white)"
                strokeWidth="3"
                className="mg-flow-v__travel-dot"
                style={{ transition: 'fill 0.3s ease' }}
              />
              <circle
                cx="0"
                cy="0"
                r="5"
                fill="var(--mg-white)"
              />
            </g>
          )}

          {/* Render all 5 large nodes inside the same SVG space */}
          {nodes.map((node, idx) => {
            const isActive = activeStep >= idx;
            return (
              <g key={FLOW_STEPS[idx].id}>
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="78"
                    fill="none"
                    stroke={currentThemeColor}
                    strokeWidth="2"
                    className="mg-flow-v__node-pulse"
                    style={{ transition: 'stroke 0.3s ease' }}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="58"
                  fill="var(--mg-white)"
                  stroke={isActive ? currentThemeColor : 'rgba(226, 232, 240, 0.8)'}
                  strokeWidth="3.5"
                  className="mg-flow-v__node-circle"
                  style={{ transition: 'stroke 0.3s ease' }}
                />
                <g
                  transform={`translate(${node.x - 19}, ${node.y - 19})`}
                  style={{ color: isActive ? currentThemeColor : 'var(--mg-muted)', transition: 'color 0.3s ease' }}
                  className="mg-flow-v__node-icon"
                >
                  {FLOW_STEPS[idx].icon}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scrolling step overlays layer */}
      <div className="mg-flow-v__timeline">
        {FLOW_STEPS.map((step, idx) => {
          const isLeft = idx % 2 === 0;
          const { opacity, translateY } = cardStates[idx] || { opacity: 0, translateY: 40 };

          return (
            <section key={step.id} className="mg-flow-v__step" style={idx === 4 ? { height: '50vh', minHeight: '50vh' } : {}}>
              <div
                className={`mg-flow-v__card-wrapper ${isLeft ? 'mg-flow-v__card-wrapper--right' : 'mg-flow-v__card-wrapper--left'}`}
                style={{
                  opacity,
                  top: idx === 4 ? '0%' : '45%',
                  transform: `translateY(calc(-50% + ${translateY}px))`,
                  visibility: opacity > 0.01 ? 'visible' : 'hidden'
                }}
              >
                <div className="mg-flow-v__card-inner">
                  <div className="mg-flow-v__card-badge" style={{ color: currentThemeColor, background: `${currentThemeColor}14`, transition: 'color 0.3s ease, background 0.3s ease' }}>
                    Step {idx + 1} of 5
                  </div>
                  <h3 className="mg-flow-v__card-title">{step.title}</h3>
                  <p className="mg-flow-v__card-desc">{step.desc}</p>
                  <span className="mg-flow-v__card-label">{step.label}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}
