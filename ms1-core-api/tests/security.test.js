const { sanitizeInput, validateUUID } = require('../src/middleware/security');
const { enforceEmailVerified } = require('../src/middleware/auth');

describe('Security Middlewares', () => {
  describe('Input Sanitization Middleware', () => {
    it('should strip/escape HTML tags to prevent XSS script injection', () => {
      const req = {
        body: { name: '<script>alert("XSS")</script> Ramesh' },
        query: { q: '<h1>hello</h1>' },
        params: { id: 'safe-id-123' },
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.name).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt; Ramesh');
      expect(req.query.q).toBe('&lt;h1&gt;hello&lt;&#x2F;h1&gt;');
      expect(req.params.id).toBe('safe-id-123');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('UUID Format Validation Middleware', () => {
    it('should allow valid UUID v4 formats', () => {
      const req = {
        params: { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      validateUUID('id')(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block and reject invalid ID formats with a 400 status code', () => {
      const req = {
        params: { id: 'invalid-id-format-123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      validateUUID('id')(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        })
      );
    });
  });

  describe('Email Verification Enforcement Middleware', () => {
    it('should allow verified users to proceed', () => {
      const req = {
        user: { id: 'user-123', email: 'user@example.com', isEmailVerified: true }
      };
      const res = {};
      const next = jest.fn();

      enforceEmailVerified(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block unverified users with a 403 Forbidden status', () => {
      const req = {
        user: { id: 'user-123', email: 'user@example.com', isEmailVerified: false }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      enforceEmailVerified(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'EMAIL_UNVERIFIED'
          })
        })
      );
    });
  });
});
