const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

let pool;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
  });
}

// Simple In-memory Database Store
const users = [];
const consents = [];
const medicines = [];
const caregiverLinks = [];
const visits = [];
const interactionFlags = [];

// Seed default user for testing/login
const seedUser = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  password_hash: bcrypt.hashSync('password123', 8),
  role: 'patient',
  verified: true,
  is_email_verified: true,
  consent_given_at: new Date()
};
users.push(seedUser);

const mockClient = {
  query: async (text, params = []) => {
    return mockQuery(text, params);
  },
  release: () => {}
};

const mockPool = {
  connect: async () => {
    return mockClient;
  },
  query: async (text, params = []) => {
    return mockQuery(text, params);
  },
  end: async () => {},
  on: () => {}
};

const logger = require('../utils/logger');

async function testConnection() {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT NOW()');
        logger.info('DB_CONNECTED', 'Successfully connected to PostgreSQL database');
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.warn('DB_CONNECTION_FAILED', `Failed to connect to PostgreSQL database: ${err.message}. Falling back to in-memory mock store.`);
      pool = null; // Disable pool so all future queries use mockQuery
      module.exports.pool = mockPool; // Update exported pool reference dynamically
      return true;
    }
  }
  return true; // Succeeds immediately for mock
}

async function query(text, params = []) {
  if (pool) {
    return pool.query(text, params);
  }
  return mockQuery(text, params);
}

async function mockQuery(text, params = []) {
  const sql = text.trim().replace(/\s+/g, ' ');

  // Auth: Match any query retrieving a user by email
  if (sql.includes('FROM users WHERE email = $1') || sql.includes('FROM users WHERE email=$1')) {
    const user = users.find(u => u.email.toLowerCase() === String(params[0]).toLowerCase());
    return { 
      rows: user ? [{ 
        ...user, 
        is_email_verified: true 
      }] : [] 
    };
  }

  // Auth: Match any query retrieving a user by id
  if (sql.includes('FROM users WHERE id = $1') || sql.includes('FROM users WHERE id=$1')) {
    const user = users.find(u => String(u.id) === String(params[0]));
    return { 
      rows: user ? [{ 
        ...user, 
        is_email_verified: true 
      }] : [] 
    };
  }

  // Auth: Insert new user
  if (sql.includes('INSERT INTO users')) {
    const id = String(users.length + 1);
    const newUser = {
      id,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      role: params[3],
      verification_token: params[4],
      verified: true,
      is_email_verified: true,
      consent_given_at: new Date()
    };
    users.push(newUser);
    return { rows: [newUser] };
  }

  // Consent: Insert consent
  if (sql.includes('INSERT INTO consent_records') || sql.includes('INSERT INTO consent_records (user_id')) {
    const newConsent = {
      id: String(consents.length + 1),
      user_id: params[0],
      consent_type: params[1] || 'health_data_processing',
      granted: true,
      granted_at: new Date()
    };
    consents.push(newConsent);
    return { rows: [newConsent] };
  }

  // Consent: Fetch consent
  if (sql.includes('SELECT * FROM consent_records WHERE user_id = $1')) {
    const userConsent = consents.filter(c => c.user_id === params[0]);
    return { rows: userConsent };
  }

  // Medicines: Fetch medicines list
  if (sql.includes('FROM medicines WHERE patient_id = $1') || sql.includes('FROM medicines WHERE patient_id=$1') || sql.includes('SELECT m.*, u.name')) {
    const patientMeds = medicines.filter(m => m.patient_id === params[0]);
    return { rows: patientMeds };
  }

  // Medicines: Insert new medicine
  if (sql.includes('INSERT INTO medicines')) {
    const newMed = {
      id: String(medicines.length + 1),
      patient_id: params[0],
      brand_name: params[1],
      generic_name: params[2],
      dosage: params[3],
      frequency: params[4],
      duration_text: params[5],
      course_end_date: params[6],
      resolution_status: params[7],
      status: 'active',
      visit_id: params[8],
      added_at: new Date()
    };
    medicines.push(newMed);
    return { rows: [newMed] };
  }

  // Alerts: Fetch alerts list
  if (sql.includes('FROM interaction_flags WHERE patient_id = $1') || sql.includes('FROM interaction_flags WHERE patient_id=$1') || sql.includes('SELECT f.*')) {
    const patientFlags = interactionFlags.filter(f => f.patient_id === params[0]);
    return { rows: patientFlags };
  }

  // Calendar: Fetch visits list
  if (sql.includes('FROM visits WHERE patient_id = $1') || sql.includes('FROM visits WHERE patient_id=$1') || sql.includes('SELECT v.*')) {
    const patientVisits = visits.filter(v => v.patient_id === params[0]);
    return { rows: patientVisits };
  }

  // Caregivers: Fetch link
  if (sql.includes('FROM caregiver_links WHERE')) {
    const links = caregiverLinks.filter(l => l.caregiver_id === params[0] || l.patient_id === params[0]);
    return { rows: links };
  }

  // Default mock success response
  return { rows: [] };
}

module.exports = { 
  pool: pool || mockPool, 
  query, 
  testConnection 
};
