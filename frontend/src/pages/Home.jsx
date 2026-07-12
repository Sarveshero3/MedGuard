import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MedGuardScrollScene from '@/components/MedGuardScrollScene';
import MedGuardFlowchart from '@/components/MedGuardFlowchart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import './Home.css';

const sectionReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function Home() {
  // Custom cursor follower tracking
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('.card') ||
        target.closest('.mg-copy')
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <div className="mg-home">
      {/* Skip to Content */}
      <a href="#how-it-works" className="mg-skip-link">
        Skip animation
      </a>

      {/* Custom Medical Cursor Followers */}
      <div 
        className="mg-cursor-dot"
        style={{ left: mousePos.x, top: mousePos.y }}
      />
      <div 
        className={`mg-cursor-ring ${isHovering ? 'mg-cursor-ring--hover' : ''}`}
        style={{ left: mousePos.x, top: mousePos.y }}
      />

      {/* Main Scrollytelling Scroll Sequence Area */}
      <MedGuardScrollScene />

      {/* Static Opaque Main Site Sections (slid up over the sequence) */}
      <main className="mg-main-content">
        
        {/* How MedGuard Helps */}
        <section id="how-it-works" className="mg-section mg-section__centered mg-section--opaque">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="mg-section__eyebrow">How it works</p>
            <h1 className="mg-section__title">How MedGuard helps</h1>
            <p className="mg-section__subtitle">
              A clearer path from prescription to informed conversation.
            </p>
          </motion.div>

          {/* Animated Clinical SVG Flowchart */}
          <MedGuardFlowchart />

          <div className="mg-cards">
            <motion.div
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <Card>
                <CardHeader>
                  <div className="mg-card__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                  <CardTitle>Capture the prescription</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mg-audience__text">
                    Photograph a prescription and let MedGuard extract the medicine name,
                    dosage, and frequency — resolving Indian brand names to their generic equivalents.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <Card>
                <CardHeader>
                  <div className="mg-card__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="M9 14h6" />
                      <path d="M9 18h6" />
                      <path d="M9 10h6" />
                    </svg>
                  </div>
                  <CardTitle>Bring medication information together</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mg-audience__text">
                    All your medicines in one running list — checked against a versioned
                    safety knowledge base so potential interactions surface in plain language.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <Card>
                <CardHeader>
                  <div className="mg-card__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M3 10h18" />
                      <path d="m9 16 2 2 4-4" />
                    </svg>
                  </div>
                  <CardTitle>Prepare for the next clinician visit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mg-audience__text">
                    Walk into every appointment knowing what has changed — with a brief
                    and questions to discuss, always framed as preparation, never diagnosis.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* CTA divider between How it works and Patients/Families */}
        <section className="mg-cta-divider mg-section--opaque">
          <div className="mg-cta-divider__inner">
            <h2 className="mg-cta-divider__title">
              Securing medication safety is a simple process.
            </h2>
            <p className="mg-cta-divider__desc">
              Create an account to start structure brand translations, check deterministic interactions, and prepare clinician visit briefs.
            </p>
            <div className="mg-cta-divider__actions">
              <a href="/login" className="mg-btn-primary mg-btn-lg">Create Free Account</a>
              <a href="/login" className="mg-btn-outline mg-btn-lg">Sign In</a>
            </div>
          </div>
        </section>

        <Separator />

        {/* Built for patients and families */}
        <section className="mg-section mg-section--surface mg-section--opaque">
          <motion.div
            className="mg-section__inner"
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="mg-section__eyebrow">For patients &amp; families</p>
            <h2 className="mg-section__title">Built for patients and families</h2>
            <p className="mg-section__subtitle">
              Whether you manage your own prescriptions or keep watch from across the country,
              MedGuard keeps medication context visible and connected.
            </p>

            <div className="mg-audience">
              <div className="mg-audience__block">
                <Badge variant="secondary">For patients</Badge>
                <h3 className="mg-audience__title">Managing multiple prescribers</h3>
                <p className="mg-audience__text">
                  Each doctor prescribes with confidence in their own medicine but no visibility into
                  what the others have already prescribed. MedGuard brings the full picture together
                  so you can ask better questions at every visit.
                </p>
              </div>
              <div className="mg-audience__block">
                <Badge variant="secondary">For caregivers</Badge>
                <h3 className="mg-audience__title">Visibility from a distance</h3>
                <p className="mg-audience__text">
                  An adult child living elsewhere has no reliable way to know whether a parent's
                  new prescription conflicts with an existing one. MedGuard gives linked caregivers
                  visibility into flagged risks — without depending on memory alone.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        <Separator />

        {/* Safety needs context */}
        <section id="principles" className="mg-section mg-section__centered mg-section--opaque">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="mg-section__eyebrow">Principles</p>
            <h2 className="mg-section__title">Safety needs context</h2>
            <p className="mg-section__subtitle">
              How MedGuard approaches medication safety — with discipline, not shortcuts.
            </p>
          </motion.div>

          <div className="mg-principles">
            <motion.div
              className="mg-principle"
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <h3 className="mg-principle__title">Deterministic safety checks</h3>
              <p className="mg-principle__text">
                Every critical medical determination — whether a drug combination is flagged
                or a lab value has changed — runs as deterministic, versioned code.
                Never an LLM judgment call.
              </p>
            </motion.div>

            <motion.div
              className="mg-principle"
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <h3 className="mg-principle__title">Plain-language clarity</h3>
              <p className="mg-principle__text">
                Alerts and interaction flags are surfaced in language a patient and caregiver
                can understand — not medical codes or probability scores.
              </p>
            </motion.div>

            <motion.div
              className="mg-principle"
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              <h3 className="mg-principle__title">Discuss with your clinician</h3>
              <p className="mg-principle__text">
                MedGuard is a preparation tool, not a diagnostic tool.
                Every output is framed as context for a clinician conversation,
                never as a medical verdict.
              </p>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* Team */}
        <section className="mg-section mg-section--surface mg-section--opaque">
          <motion.div
            className="mg-section__inner mg-section__centered"
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="mg-section__eyebrow">Team</p>
            <h2 className="mg-section__title">Built with care</h2>
            <p className="mg-section__subtitle">
              A small team building a safer medication experience.
            </p>

            <div className="mg-team">
              {[
                { name: 'Sarvesh Chandran', initials: 'SC', role: 'Lead' },
                { name: 'Sahil', initials: 'S', role: null },
                { name: 'Nyasha Das', initials: 'ND', role: null },
              ].map((member) => (
                <Card key={member.name}>
                  <CardContent className="flex flex-col items-center pt-6">
                    <div className="mg-team-card__monogram">{member.initials}</div>
                    <p className="mg-team-card__name">{member.name}</p>
                    {member.role && (
                      <p className="mg-team-card__role">{member.role}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className="mg-final-cta mg-section--opaque">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <h2 className="mg-final-cta__title">
              Clearer medication information starts here.
            </h2>
            <p className="mg-final-cta__text">
              Prepare for your next clinician conversation with confidence.
            </p>
            <Button
              variant="default"
              size="lg"
              asChild
            >
              <a href="#how-it-works">See how MedGuard works</a>
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mg-footer mg-section--opaque">
        <p className="mg-footer__text">
          MedGuard — Medication safety and visit preparation.
        </p>
        <p className="mg-footer__disclaimer">
          MedGuard is a preparation tool. It does not provide medical diagnoses.
          Always discuss medication decisions with your clinician.
        </p>
      </footer>
    </div>
  );
}
