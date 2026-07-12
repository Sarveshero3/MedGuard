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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
];

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
  const [markerPos, setMarkerPos] = useState({ x: 100, y: 160 });

  // Calculate card transforms and tracker position globally to avoid sync lags
  const [cardStates, setCardStates] = useState(
    FLOW_STEPS.map(() => ({ opacity: 0, translateY: 40 }))
  );

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const p = Math.max(0, Math.min(1, v));

    // Determine current active step based on midpoints of 0.25 segment intervals
    // Node 0 at 0.0, Node 1 at 0.25, Node 2 at 0.50, Node 3 at 0.75, Node 4 at 1.00
    let stepIdx = 0;
    if (p < 0.125) stepIdx = 0;
    else if (p >= 0.125 && p < 0.375) stepIdx = 1;
    else if (p >= 0.375 && p < 0.625) stepIdx = 2;
    else if (p >= 0.625 && p < 0.875) stepIdx = 3;
    else stepIdx = 4;
    
    setActiveStep(stepIdx);

    // Update global tracker position along the single continuous track
    if (pathRef.current && pathLen > 0) {
      const pt = pathRef.current.getPointAtLength(p * pathLen);
      setMarkerPos({ x: pt.x, y: pt.y });
    }

    // Update opacity & translations for all text cards based on symmetric midpoint ranges
    setCardStates(
      FLOW_STEPS.map((_, idx) => {
        const centerP = idx * 0.25;
        
        // Boundaries for fading card in/out (span of 0.25 step, centered at centerP)
        const startFadeIn = centerP - 0.125;
        const endFadeIn = centerP - 0.08;
        const startFadeOut = centerP + 0.08;
        const endFadeOut = centerP + 0.125;
        
        if (p < startFadeIn) {
          return { opacity: 0, translateY: 40 };
        } else if (p >= startFadeIn && p < endFadeIn) {
          // Slide in from below
          const t = (p - startFadeIn) / (endFadeIn - startFadeIn);
          return { opacity: t, translateY: 40 * (1 - t) };
        } else if (p >= endFadeIn && p <= startFadeOut) {
          // Fully visible
          return { opacity: 1, translateY: 0 };
        } else if (p > startFadeOut && p <= endFadeOut) {
          // Slide out to above
          const t = (p - startFadeOut) / (endFadeOut - startFadeOut);
          return { opacity: 1 - t, translateY: -40 * t };
        } else {
          return { opacity: 0, translateY: -40 };
        }
      })
    );
  });

  // Calculate nodes positions across the entire 500vh height
  const nodes = useMemo(() => {
    return FLOW_STEPS.map((_, idx) => {
      const isLeft = idx % 2 === 0;
      return {
        x: isLeft ? 100 : dimensions.width - 100,
        y: idx * dimensions.height + 160,
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

  // Transform background color gradually as you scroll
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1.0],
    ['#ffffff', '#f0f9f9', '#e6f4f4', '#f4fbfb', '#ffffff']
  );


  return (
    <div
      ref={containerRef}
      className="mg-flow-v"
      style={{ backgroundColor }}
    >
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

          {/* Active path trail (colored, reveals on scroll) */}
          {continuousPathD && (
            <motion.path
              ref={pathRef}
              d={continuousPathD}
              fill="none"
              stroke="var(--mg-accent)"
              strokeWidth="6"
              strokeLinecap="round"
              style={{ pathLength: scrollYProgress }}
              className="mg-flow-v__path-active"
            />
          )}

          {/* Single continuous tracker marker (never teleport, always on the line, rendered under nodes) */}
          {pathLen > 0 && (
            <g transform={`translate(${markerPos.x}, ${markerPos.y})`}>
              <circle
                cx="0"
                cy="0"
                r="18"
                fill="var(--mg-accent)"
                stroke="var(--mg-white)"
                strokeWidth="3"
                className="mg-flow-v__travel-dot"
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
                    r="64"
                    fill="none"
                    stroke="var(--mg-accent)"
                    strokeWidth="2"
                    className="mg-flow-v__node-pulse"
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="48"
                  fill="var(--mg-white)"
                  stroke={isActive ? 'var(--mg-accent)' : 'rgba(226, 232, 240, 0.8)'}
                  strokeWidth="3.5"
                  className="mg-flow-v__node-circle"
                />
                <g
                  transform={`translate(${node.x - 16}, ${node.y - 16})`}
                  className={`mg-flow-v__node-icon ${isActive ? 'mg-flow-v__node-icon--active' : ''}`}
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
            <section key={step.id} className="mg-flow-v__step">
              <div
                className={`mg-flow-v__card-wrapper ${isLeft ? 'mg-flow-v__card-wrapper--right' : 'mg-flow-v__card-wrapper--left'}`}
                style={{
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  visibility: opacity > 0.01 ? 'visible' : 'hidden'
                }}
              >
                <div className="mg-flow-v__card-inner">
                  <div className="mg-flow-v__card-badge">
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
    </div>
  );
}
