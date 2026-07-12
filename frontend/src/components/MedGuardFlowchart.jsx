import { useRef, useEffect, useState, useMemo } from 'react';
import { useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import './MedGuardFlowchart.css';

/* ─── Reuse the same 5 step objects (icon, label, description) ─── */
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

/* ─── Main Flowchart Component ─── */
export default function MedGuardFlowchart() {
  const containerRef = useRef(null);

  // Track global scroll progress for background color transition
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  // State to track which segments are completed
  const [traveledSegments, setTraveledSegments] = useState([false, false, false, false, false]);

  const markSegmentTraveled = (index) => {
    setTraveledSegments((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  };

  // State to track current active step
  const [activeStep, setActiveStep] = useState(0);

  // Smoothly transform background gradient between light teal and pure white based on scroll
  const background = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1.0],
    [
      'radial-gradient(120% 120% at 50% 10%, #ffffff 0%, #f4fbfb 50%, #e6f2f2 100%)',
      'radial-gradient(120% 120% at 50% 10%, #e6f2f2 0%, #f4fbfb 50%, #ffffff 100%)',
      'radial-gradient(120% 120% at 50% 10%, #ffffff 0%, #f0f7f7 50%, #e6f2f2 100%)',
      'radial-gradient(120% 120% at 50% 10%, #e6f2f2 0%, #ffffff 50%, #f4fbfb 100%)',
      'radial-gradient(120% 120% at 50% 10%, #f4fbfb 0%, #f0f7f7 50%, #ffffff 100%)'
    ]
  );

  return (
    <div
      ref={containerRef}
      className="mg-flow-v"
      style={{ background }}
    >
      <div className="mg-flow-v__timeline">
        {FLOW_STEPS.map((step, idx) => (
          <StepSection
            key={step.id}
            step={step}
            index={idx}
            isLast={idx === FLOW_STEPS.length - 1}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            isCompleted={traveledSegments[idx]}
            onComplete={markSegmentTraveled}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Individual Step Section Component ─── */
function StepSection({ step, index, isLast, activeStep, setActiveStep, isCompleted, onComplete }) {
  const sectionRef = useRef(null);
  const pathRef = useRef(null);
  const [pathLen, setPathLen] = useState(0);

  // States driven by local scroll to control carousel card and travel marker
  const [cardOpacity, setCardOpacity] = useState(0);
  const [cardTranslateY, setCardTranslateY] = useState(40);
  const [markerPos, setMarkerPos] = useState({ x: 0, y: 0 });
  const [showMarker, setShowMarker] = useState(false);

  // Measure SVG path length on mount
  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, []);

  // Track scroll of this step section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start center', 'end center'],
  });

  // Handle local scroll progress updates
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const p = Math.max(0, Math.min(1, v));

    // 1. Mark segment traveled when scrolled past 90%
    if (p > 0.9 && !isCompleted) {
      onComplete(index);
    }

    // 2. Set current active step based on scroll focus
    if (p > 0.15 && p < 0.85) {
      setActiveStep(index);
    } else if (p >= 0.85 && !isLast) {
      setActiveStep(index + 1);
    }

    // 3. Drive fast carousel text animations (slide up from 40px, exit up to -40px)
    if (p < 0.15) {
      const t = p / 0.15;
      setCardOpacity(t);
      setCardTranslateY(40 * (1 - t));
    } else if (p >= 0.15 && p <= 0.8) {
      setCardOpacity(1);
      setCardTranslateY(0);
    } else {
      const t = (p - 0.8) / 0.2;
      setCardOpacity(1 - t);
      setCardTranslateY(-40 * t);
    }

    // 4. Animate short traveling marker flourish between nodes (hide at endpoints)
    if (pathRef.current && pathLen > 0 && p > 0.05 && p < 0.95 && !isCompleted) {
      const pt = pathRef.current.getPointAtLength(p * pathLen);
      setMarkerPos({ x: pt.x, y: pt.y });
      setShowMarker(true);
    } else {
      setShowMarker(false);
    }
  });

  // Calculate coordinates based on strictly alternating side layout:
  // Node coordinates inside the 960x500 viewBox
  const isLeft = index % 2 === 0;
  const nodeX = isLeft ? 120 : 840;
  const nodeY = 60;

  // Next node coordinates (opposite side, top of next section / bottom of current section)
  const nextX = isLeft ? 840 : 120;
  const nextY = 500;

  // Large, dramatic sweeping curve: S-curve using cubic bezier control points
  const pathD = isLast
    ? `M ${nodeX} ${nodeY} L ${nodeX} 200` // Final step path ends shortly
    : `M ${nodeX} ${nodeY} C ${nodeX} 280, ${nextX} 220, ${nextX} ${nextY}`;

  // active path trace driven by scroll progress
  const dashOffset = isCompleted ? 0 : (1 - scrollYProgress.get()) * pathLen;

  return (
    <section ref={sectionRef} className="mg-flow-v__step">
      {/* SVG Path & Node Layer */}
      <div className="mg-flow-v__svg-layer">
        <svg
          viewBox="0 0 960 500"
          className="mg-flow-v__step-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background winding path (faint) */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(226, 232, 240, 0.7)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Active path trail (colored, stays filled if completed) */}
          <path
            ref={pathRef}
            d={pathD}
            fill="none"
            stroke="var(--mg-accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={pathLen || 1}
            strokeDashoffset={isCompleted ? 0 : dashOffset}
            className="mg-flow-v__path-active"
          />

          {/* Node SVG Group (anchored perfectly at start coordinates) */}
          <g>
            {/* Glowing ring if active */}
            {activeStep >= index && (
              <circle
                cx={nodeX}
                cy={nodeY}
                r="30"
                fill="none"
                stroke="var(--mg-accent)"
                strokeWidth="1.5"
                className="mg-flow-v__node-pulse"
              />
            )}
            {/* Base Circle */}
            <circle
              cx={nodeX}
              cy={nodeY}
              r="24"
              fill="var(--mg-white)"
              stroke={activeStep >= index ? 'var(--mg-accent)' : 'rgba(226, 232, 240, 0.8)'}
              strokeWidth="2.5"
              className="mg-flow-v__node-circle"
            />
            {/* Embedded step icon */}
            <g
              transform={`translate(${nodeX - 10}, ${nodeY - 10})`}
              className={`mg-flow-v__node-icon ${activeStep >= index ? 'mg-flow-v__node-icon--active' : ''}`}
            >
              {step.icon}
            </g>
          </g>

          {/* Travel Marker (drawn inside SVG coordinate space - 100% sync guaranteed) */}
          {showMarker && !isCompleted && (
            <g transform={`translate(${markerPos.x}, ${markerPos.y})`}>
              <circle
                cx="0"
                cy="0"
                r="10"
                fill="var(--mg-accent)"
                stroke="var(--mg-white)"
                strokeWidth="2.5"
                className="mg-flow-v__travel-dot"
              />
              <circle
                cx="0"
                cy="0"
                r="3"
                fill="var(--mg-white)"
              />
            </g>
          )}

          {/* Continuation chevron cue before path exits section */}
          {!isLast && (
            <g transform={`translate(${nextX}, ${nextY - 40})`} className="mg-flow-v__cue">
              <path
                d="M -6 -4 L 0 2 L 6 -4"
                fill="none"
                stroke="var(--mg-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mg-flow-v__cue-chevron"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Description Card Layer (Top-anchored next to node) */}
      <div
        className={`mg-flow-v__card-wrapper ${isLeft ? 'mg-flow-v__card-wrapper--right' : 'mg-flow-v__card-wrapper--left'}`}
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardTranslateY}px)`,
          visibility: cardOpacity > 0.01 ? 'visible' : 'hidden'
        }}
      >
        <div className="mg-flow-v__card-inner">
          <div className="mg-flow-v__card-badge">
            Step {index + 1} of 5
          </div>
          <h3 className="mg-flow-v__card-title">{step.title}</h3>
          <p className="mg-flow-v__card-desc">{step.desc}</p>
          <span className="mg-flow-v__card-label">{step.label}</span>
        </div>
      </div>
    </section>
  );
}
