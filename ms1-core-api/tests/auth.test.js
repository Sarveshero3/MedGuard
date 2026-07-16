const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Create mock DB helper
const mockQuery = jest.fn();
const mockConnect = jest.fn();
jest.mock('../src/config/db', () => ({
  query: mockQuery,
  pool: {
    connect: mockConnect,
  },
}));

// Mock the Redis module to prevent connection hangs in tests
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
}));

const authRouter = require('../src/routes/auth');
const app = express();
app.use(express.json());
app.use('/api', authRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-random-64-char-string';

describe('Auth Security & Refresh Token Rotation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/refresh', () => {
    it('should rotate valid refresh token successfully', async () => {
      const userId = 'user-uuid-123';
      const refreshToken = jwt.sign({ userId, jti: 'token-jti' }, JWT_SECRET, { expiresIn: '7d' });
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql === 'BEGIN') {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('SELECT id, user_id, revoked_at FROM refresh_tokens')) {
            return Promise.resolve({
              rows: [{ id: 'rt-uuid-1', user_id: userId, revoked_at: null }],
            });
          }
          if (sql.includes('UPDATE refresh_tokens SET revoked_at')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('SELECT id, name, email, role FROM users')) {
            return Promise.resolve({
              rows: [{ id: userId, name: 'John Doe', email: 'john@example.com', role: 'patient' }],
            });
          }
          if (sql.includes('INSERT INTO refresh_tokens')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql === 'COMMIT') {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject refresh token if it is revoked', async () => {
      const userId = 'user-uuid-123';
      const refreshToken = jwt.sign({ userId, jti: 'token-jti' }, JWT_SECRET, { expiresIn: '7d' });

      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql === 'BEGIN') {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('SELECT id, user_id, revoked_at FROM refresh_tokens')) {
            return Promise.resolve({
              rows: [{ id: 'rt-uuid-1', user_id: userId, revoked_at: new Date() }], // Already revoked!
            });
          }
          if (sql === 'ROLLBACK') {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('invalid, expired, or already revoked');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject refresh token if signature is invalid', async () => {
      const refreshToken = jwt.sign({ userId: '123' }, 'wrong-secret', { expiresIn: '7d' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('invalid or expired');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke refresh token by marking it revoked in DB', async () => {
      const refreshToken = 'dummy-refresh-token';
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at = NOW()'),
        [tokenHash]
      );
    });
  });
});
