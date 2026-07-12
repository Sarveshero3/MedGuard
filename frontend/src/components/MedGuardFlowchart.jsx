import { useRef, useEffect, useState, useMemo } from 'react';
import { useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import './MedGuardFlowchart.css';

/* ─── Same 5 step objects, unchanged ─── */
const FLOW_STEPS = [
  {
    id: 'scan',
    label: '1. Photograph',
    title: 'Prescription Scan',
    desc: 'Extract handwritten or printed text directly from prescription images.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
];

/* ─── SVG Winding Path ─── */
// ViewBox: 400 wide × 1000 tall. Nodes at y=60,280,500,720,940.
// Path curves left-right between each node.
const WINDING_PATH_D =
  'M 200 60 C 200 120, 320 160, 320 200 C 320 240, 80 240, 80 280 ' +
  'C 80 320, 320 360, 320 400 C 320 440, 80 440, 80 500 ' +
  'C 80 540, 320 560, 320 600 C 320 640, 80 660, 80 720 ' +
  'C 80 760, 320 780, 320 840 C 320 880, 200 920, 200 940';

// Fractional positions along path length where each node sits
// Node 0 = top (0.0), Node 4 = bottom (1.0)
const NODE_FRACTIONS = [0.0, 0.25, 0.5, 0.75, 1.0];

export default function MedGuardFlowchart() {
  const sectionRef = useRef(null);
  const pathRef = useRef(null);
  const markerRef = useRef(null);
  const [pathLen, setPathLen] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Measure path length after mount
  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, []);

  // Scroll-linked progress (0 → 1) through the section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start center', 'end center'],
  });

  // Move the marker along the path via CSS transform
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!pathRef.current || !markerRef.current || pathLen === 0) return;
    const clampedV = Math.max(0, Math.min(1, v));
    const pt = pathRef.current.getPointAtLength(clampedV * pathLen);
    markerRef.current.style.transform = `translate(${pt.x - 14}px, ${pt.y - 14}px)`;

    // Determine active step based on scroll thresholds (midpoint between nodes)
    let step = 0;
    for (let i = 1; i < NODE_FRACTIONS.length; i++) {
      const mid = (NODE_FRACTIONS[i - 1] + NODE_FRACTIONS[i]) / 2;
      if (clampedV >= mid) step = i;
    }
    setActiveStep(step);
  });

  // Compute node positions on the path (static, recalc on pathLen)
  const nodePositions = useMemo(() => {
    if (!pathRef.current || pathLen === 0) return FLOW_STEPS.map(() => ({ x: 200, y: 60 }));
    return NODE_FRACTIONS.map((f) => {
      const pt = pathRef.current.getPointAtLength(f * pathLen);
      return { x: pt.x, y: pt.y };
    });
  }, [pathLen]);

  // Animated dash for the "traveled" portion of the path
  const dashOffset = useTransform(scrollYProgress, [0, 1], [pathLen || 1, 0]);

  return (
    <div ref={sectionRef} className="mg-flow-v">
      <div className="mg-flow-v__container">
        {/* SVG and Marker Wrapper (guarantees 1:1 translation coordinates) */}
        <div className="mg-flow-v__wrapper">
          {/* SVG Layer */}
          <svg
            viewBox="0 0 400 1000"
            className="mg-flow-v__svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Background path (faint) */}
            <path
              d={WINDING_PATH_D}
              fill="none"
              stroke="rgba(226, 232, 240, 0.6)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Traveled path (accent colored, revealed by scroll) */}
            <path
              ref={pathRef}
              d={WINDING_PATH_D}
              fill="none"
              stroke="var(--mg-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={pathLen || 1}
              strokeDashoffset={dashOffset.get ? dashOffset.get() : pathLen || 1}
              className="mg-flow-v__path-active"
            />

            {/* Node circles */}
            {nodePositions.map((pos, idx) => {
              const isActive = idx <= activeStep;
              const isCurrent = idx === activeStep;
              return (
                <g key={FLOW_STEPS[idx].id}>
                  {/* Pulse ring for current */}
                  {isCurrent && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="28"
                      fill="none"
                      stroke="var(--mg-accent)"
                      strokeWidth="1.5"
                      className="mg-flow-v__pulse"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="22"
                    fill="var(--mg-white)"
                    stroke={isActive ? 'var(--mg-accent)' : 'rgba(226, 232, 240, 0.8)'}
                    strokeWidth="2.5"
                    className="mg-flow-v__node-circle"
                  />
                  {/* Icon inside node */}
                  <g
                    transform={`translate(${pos.x - 10}, ${pos.y - 10})`}
                    className={`mg-flow-v__node-icon ${isActive ? 'mg-flow-v__node-icon--active' : ''}`}
                  >
                    {FLOW_STEPS[idx].icon}
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Traveling marker (follows the path exactly within the same wrapper coords) */}
          <div ref={markerRef} className="mg-flow-v__marker" aria-hidden="true">
            <div className="mg-flow-v__marker-dot" />
          </div>
        </div>

        {/* Description cards positioned near each node */}
        {FLOW_STEPS.map((step, idx) => {
          const pos = nodePositions[idx];
          const isLeft = idx % 2 === 0; // alternate sides
          const isVisible = idx === activeStep;

          return (
            <div
              key={step.id}
              className={`mg-flow-v__card ${isLeft ? 'mg-flow-v__card--left' : 'mg-flow-v__card--right'} ${isVisible ? 'mg-flow-v__card--visible' : ''}`}
              style={{
                top: `${(pos.y / 1000) * 100}%`,
                [isLeft ? 'right' : 'left']: '52%',
              }}
            >
              <div className="mg-flow-v__card-badge">
                Step {idx + 1} of 5
              </div>
              <h3 className="mg-flow-v__card-title">{step.title}</h3>
              <p className="mg-flow-v__card-desc">{step.desc}</p>
              <span className="mg-flow-v__card-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
