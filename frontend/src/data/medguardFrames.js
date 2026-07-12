/**
 * MedGuard scroll-sequence frame manifest.
 * 286 JPG frames: prescription → binary → neural network.
 */

export const FRAME_COUNT = 286;

/** Build the public URL for a 1-indexed frame number. */
export function getFramePath(index) {
  const base = import.meta.env.BASE_URL || '/';
  const num = String(index).padStart(3, '0');
  return `${base}medguard-sequence/ezgif-frame-${num}.jpg`;
}

/**
 * Copy beats — scroll-range → text.
 * Each beat fades in over first 10% of range, holds, fades out over last 10%.
 */
export const COPY_BEATS = [
  {
    start: 0,
    end: 0.22,
    headline: 'Every prescription deserves a second look.',
    body: 'MedGuard turns a prescription photo into a clearer medication-safety conversation.',
  },
  {
    start: 0.23,
    end: 0.48,
    headline: 'From paper to structured clarity.',
    body: 'Details that are easy to miss become information you can carry between appointments.',
  },
  {
    start: 0.49,
    end: 0.75,
    headline: 'Connected signals. Safer next steps.',
    body: 'Medications, changes, and caregiver context\u2014kept together.',
  },
  {
    start: 0.76,
    end: 1.0,
    headline: 'Designed to help you prepare, not diagnose.',
    body: 'Clearer information for more informed conversations with your clinician.',
    cta: { label: 'See how MedGuard works', href: '#how-it-works' },
  },
];
