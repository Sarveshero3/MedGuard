import { useState } from 'react';
import './MedGuardFlowchart.css';

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

export default function MedGuardFlowchart() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="mg-flow">
      {/* Desktop SVG Flowchart */}
      <div className="mg-flow__desktop">
        <svg viewBox="0 0 1000 160" width="100%" height="100%" className="mg-flow__svg">
          {/* Background Connecting Line */}
          <path
            d="M 100 80 L 900 80"
            stroke="rgba(226, 232, 240, 0.8)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Animated Clinical Laser Pulses */}
          <path
            d="M 100 80 L 900 80"
            stroke="var(--mg-accent)"
            strokeWidth="4"
            strokeDasharray="30 150"
            strokeLinecap="round"
            className="mg-flow__path-glow"
          />

          {/* Interactive Flow Nodes */}
          {FLOW_STEPS.map((step, idx) => {
            const cx = 100 + idx * 200;
            const isActive = idx <= activeStep;
            const isCurrent = idx === activeStep;

            return (
              <g
                key={step.id}
                className={`mg-flow__node ${isActive ? 'mg-flow__node--active' : ''} ${isCurrent ? 'mg-flow__node--current' : ''}`}
                onClick={() => setActiveStep(idx)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer pulsing ring for current node */}
                {isCurrent && (
                  <circle
                    cx={cx}
                    cy="80"
                    r="34"
                    fill="none"
                    stroke="var(--mg-accent)"
                    strokeWidth="1.5"
                    className="mg-flow__pulse-circle"
                  />
                )}
                
                {/* Glow ring */}
                <circle
                  cx={cx}
                  cy="80"
                  r="26"
                  fill="var(--mg-white)"
                  stroke={isActive ? 'var(--mg-accent)' : 'rgba(226, 232, 240, 0.8)'}
                  strokeWidth="2.5"
                  className="mg-flow__node-circle"
                />

                {/* Node Monogram Icon Wrapper */}
                <g transform={`translate(${cx - 10}, 70)`} className="mg-flow__node-icon">
                  {step.icon}
                </g>

                {/* Node Label Text */}
                <text
                  x={cx}
                  y="135"
                  textAnchor="middle"
                  className={`mg-flow__node-label ${isActive ? 'mg-flow__node-label--active' : ''}`}
                >
                  {step.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mobile Vertical Flow Blocks */}
      <div className="mg-flow__mobile">
        {FLOW_STEPS.map((step, idx) => {
          const isActive = idx <= activeStep;
          return (
            <div
              key={step.id}
              className={`mg-flow__mobile-card ${isActive ? 'mg-flow__mobile-card--active' : ''}`}
              onClick={() => setActiveStep(idx)}
            >
              <div className="mg-flow__mobile-header">
                <div className="mg-flow__mobile-icon">{step.icon}</div>
                <span className="mg-flow__mobile-label">{step.label}</span>
              </div>
              <p className="mg-flow__mobile-title">{step.title}</p>
            </div>
          );
        })}
      </div>

      {/* Step Info Panel */}
      <div className="mg-flow__info-panel">
        <div className="mg-flow__info-badge">
          Step {activeStep + 1} of 5
        </div>
        <h3 className="mg-flow__info-title">
          {FLOW_STEPS[activeStep].title}
        </h3>
        <p className="mg-flow__info-desc">
          {FLOW_STEPS[activeStep].desc}
        </p>
      </div>
    </div>
  );
}
