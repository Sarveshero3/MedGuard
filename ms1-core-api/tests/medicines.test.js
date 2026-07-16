const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockQuery = jest.fn();
const mockConnect = jest.fn();
jest.mock('../src/config/db', () => ({
  query: mockQuery,
  pool: {
    connect: mockConnect,
  },
}));

jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
}));

// Mock rateLimiter and security middlewares to bypass in tests
jest.mock('../src/middleware/rateLimiter', () => ({
  uploadLimiter: (req, res, next) => next(),
}));

// Mock auth middleware to automatically authenticate a test user
jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'patient-uuid', role: 'patient', name: 'John Doe', email: 'john@example.com' };
    next();
  },
  enforcePatientAccess: () => (req, res, next) => next(),
  verifyPatientAccess: () => Promise.resolve(true),
  enforceEmailVerified: (req, res, next) => next(),
}));

// Mock consent middleware
jest.mock('../src/middleware/consent', () => ({
  enforceConsent: () => (req, res, next) => next(),
}));

// Mock the interaction check engine
const mockCheckInteractions = jest.fn();
jest.mock('../src/utils/interactionEngine', () => ({
  checkInteractions: mockCheckInteractions,
}));

// Mock email utils
const mockSendEmail = jest.fn();
jest.mock('../src/utils/email', () => ({
  sendEmail: mockSendEmail,
}));

const medicinesRouter = require('../src/routes/medicines');
const app = express();
app.use(express.json());
app.use('/api', medicinesRouter);

describe('Medicines Safety & Transactional Integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should run medicine addition in transaction, lock rows, and send emails ONLY after successful commit', async () => {
    const patientId = 'patient-uuid';
    const newMedicine = {
      patient_id: patientId,
      brand_name: 'Dolo 650',
      generic_name: 'Paracetamol',
      dosage: '650mg',
      frequency: 'Three times daily',
    };

    mockCheckInteractions.mockResolvedValueOnce([
      {
        id: 'flag-1',
        generic_a: 'Paracetamol',
        generic_b: 'Ibuprofen',
        severity: 'monitor_closely',
        explanation: 'Do not double up',
      },
    ]);

    const executionOrder = [];

    const mockClient = {
      query: jest.fn().mockImplementation((sql, params) => {
        if (sql === 'BEGIN') {
          executionOrder.push('BEGIN');
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
          executionOrder.push('SELECT_LOCK');
          return Promise.resolve({ rows: [{ id: 'med-existing-1', generic_name: 'Ibuprofen' }] });
        }
        if (sql.includes('INSERT INTO medicines')) {
          executionOrder.push('INSERT_MED');
          return Promise.resolve({
            rows: [{ id: 'med-new-uuid', patient_id: patientId, brand_name: 'Dolo 650', generic_name: 'Paracetamol' }],
          });
        }
        if (sql.includes('INSERT INTO interaction_flags')) {
          executionOrder.push('INSERT_FLAG');
          return Promise.resolve({ rows: [] });
        }
        if (sql === 'COMMIT') {
          executionOrder.push('COMMIT');
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };

    mockConnect.mockResolvedValueOnce(mockClient);

    // Mock global database queries for side-effects (executed outside transaction)
    mockQuery.mockImplementation((sql, params) => {
      if (sql.includes('SELECT email, name FROM users')) {
        executionOrder.push('QUERY_USER');
        return Promise.resolve({ rows: [{ email: 'john@example.com', name: 'John Doe' }] });
      }
      if (sql.includes('SELECT u.email, u.name FROM caregiver_links cl')) {
        executionOrder.push('QUERY_CAREGIVERS');
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    mockSendEmail.mockImplementation(() => {
      executionOrder.push('EMAIL_SEND');
      return Promise.resolve(true);
    });

    const res = await request(app)
      .post('/api/medicines')
      .send(newMedicine);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify correct order of operation: transaction queries must execute before email dispatch
    expect(executionOrder.indexOf('BEGIN')).toBeLessThan(executionOrder.indexOf('SELECT_LOCK'));
    expect(executionOrder.indexOf('SELECT_LOCK')).toBeLessThan(executionOrder.indexOf('INSERT_MED'));
    expect(executionOrder.indexOf('INSERT_MED')).toBeLessThan(executionOrder.indexOf('COMMIT'));
    expect(executionOrder.indexOf('COMMIT')).toBeLessThan(executionOrder.indexOf('QUERY_USER'));
    expect(executionOrder.indexOf('QUERY_USER')).toBeLessThan(executionOrder.indexOf('EMAIL_SEND'));

    expect(mockClient.release).toHaveBeenCalled();
  });
});
