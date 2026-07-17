const { enforceConsent } = require('../src/middleware/consent');
const { checkInteractions } = require('../src/utils/interactionEngine');
const db = require('../src/config/db');

// Mock the DB module
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

// Mock the Redis module to prevent connection hangs in tests
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  isMock: true,
}));

describe('Milestone 2 — Consent & Interaction Safety Engine Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Consent Verification Middleware (enforceConsent)', () => {
    it('should block requests if target user has no consent record (403 INSUFFICIENT_CONSENT)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const req = {
        user: { id: 'patient-uuid' },
        query: { patient_id: 'patient-uuid' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = enforceConsent('health_data_processing');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INSUFFICIENT_CONSENT',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests if target user has active consent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ consent_given_at: new Date() }],
      });

      const req = {
        user: { id: 'patient-uuid' },
        query: { patient_id: 'patient-uuid' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = enforceConsent('health_data_processing');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Deterministic Interaction Check Engine (checkInteractions)', () => {
    it('should return empty list if no active generics are provided', async () => {
      const results = await checkInteractions('Metformin', []);
      expect(results).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should query interaction_kb and return flagged drug-drug interactions', async () => {
      const mockFlags = [
        {
          id: 'flag-uuid',
          generic_a: 'Warfarin',
          generic_b: 'Aspirin',
          severity: 'avoid_combination',
          explanation: 'Severe bleeding risk',
        },
      ];
      db.query.mockResolvedValueOnce({ rows: mockFlags });

      const results = await checkInteractions('Aspirin', ['Warfarin']);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(results).toEqual(mockFlags);
    });
  });

  describe('Deterministic Lab Trend Calculation (calculateTrend)', () => {
    const { calculateTrend } = require('../src/utils/trendCalculator');

    it('should flag absolute HbA1c increase >= 0.3 as meaningful change', () => {
      const history = [{ value: 6.8, recorded_at: new Date() }];
      const result = calculateTrend('HbA1c', 7.2, history);
      expect(result.isMeaningfulChange).toBe(true);
      expect(result.message).toContain('rose from 6.8% to 7.2%');
    });

    it('should not flag absolute HbA1c increase < 0.3', () => {
      const history = [{ value: 6.8, recorded_at: new Date() }];
      const result = calculateTrend('HbA1c', 7.0, history);
      expect(result.isMeaningfulChange).toBe(false);
    });

    it('should flag relative increase >= 10% for other tests', () => {
      const history = [{ value: 100, recorded_at: new Date() }];
      const result = calculateTrend('TSH', 112, history);
      expect(result.isMeaningfulChange).toBe(true);
      expect(result.message).toContain('increased significantly');
    });

    it('should not flag relative increase < 10% for other tests', () => {
      const history = [{ value: 100, recorded_at: new Date() }];
      const result = calculateTrend('TSH', 105, history);
      expect(result.isMeaningfulChange).toBe(false);
    });
  });

  describe('Test Type Normalization Helper (getCanonicalTestType)', () => {
    const { getCanonicalTestType } = require('../src/utils/testNormalizer');

    it('should map test name variants to canonical type using database', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ canonical_type: 'HbA1c' }] });
      const canonical = await getCanonicalTestType('Hb A1c');
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(canonical).toBe('HbA1c');
    });

    it('should fallback to variant name if not found in database', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const canonical = await getCanonicalTestType('Random Test');
      expect(canonical).toBe('Random Test');
    });
  });
});
