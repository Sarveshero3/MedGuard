const { enforceConsent } = require('../src/middleware/consent');
const { checkInteractions } = require('../src/utils/interactionEngine');
const db = require('../src/config/db');

// Mock the DB module
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
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

    it('should block requests if target user consent is revoked (403 INSUFFICIENT_CONSENT)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ granted_at: null, revoked_at: new Date() }],
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

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests if target user has active consent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ granted_at: new Date(), revoked_at: null }],
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
});
