/* =====================================================================
   db.js  —  replaces main.py (Python + FastAPI + SQLite)

   In the old project:  browser  --fetch()-->  Python server  -->  SQLite file
   In this project:     browser  --function call-->  db.js  -->  localStorage

   All data (accounts, profiles, applications, admin accounts) is saved
   inside YOUR browser using localStorage. That means:
     * No server and no Python are needed.
     * Data stays only in this browser on this computer.
     * Clearing browser data deletes everything.

   Every function below matches one API route of the old main.py.
   When something goes wrong, the function does  throw new Error("message")
   (the same job HTTPException did in Python).

   SECURITY NOTE: this is a learning prototype. Real password checking
   and real OTP/SMS must be done on a server, never in browser JavaScript.
   ===================================================================== */

const DB = (() => {
  const STORE_KEY = 'vps-db';
  const SESSION_SECONDS = 12 * 60 * 60; // 12 hours, same as the Python code

  /* ---------- low-level helpers ---------- */

  // Read the whole "database" from localStorage (or start with an empty one)
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved) return saved;
    } catch (e) { /* ignore broken data */ }
    return {
      users: [],          // table: users
      profiles: {},       // table: student_profiles  (key = user id)
      applications: [],   // table: applications
      tracking: [],       // table: tracking_records
      admins: [],         // table: admins
      sessions: {},       // table: sessions        (token -> {userId, expires})
      adminSessions: {},  // table: admin_sessions  (token -> {adminId, expires})
      otps: {},           // table: otp_codes       (phone -> {code, expires})
      captchas: {},       // table: captcha_challenges
      nextId: { user: 1, application: 1, tracking: 1, admin: 1 }
    };
  }

  function save(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  const nowSeconds = () => Math.floor(Date.now() / 1000);

  // "2026-11-23 10:30:00"  (same look as SQLite CURRENT_TIMESTAMP)
  const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

  // random text such as "a3f9c1d2..."
  function randomToken(bytes = 18) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  function randomInt(min, max) { // min and max both included
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Very simple hash so we never store the plain password.
  // (NOT secure like the Python PBKDF2 one - fine for a demo only.)
  function hashText(text) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = (h1 * 33) ^ c;
      h2 = (h2 * 33) ^ c;
    }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  function makePasswordHash(password) {
    const salt = randomToken(8);
    return salt + ':' + hashText(salt + password);
  }
  function checkPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    return hashText(salt + password) === hash;
  }

  // Throw an error unless the text length is inside [min, max]
  function needLength(value, min, max, label) {
    const len = String(value ?? '').trim().length;
    if (len < min || len > max) {
      throw new Error(`${label} must be between ${min} and ${max} characters.`);
    }
  }

  /* ---------- who is signed in? ---------- */

  function currentUser(token) {
    const data = load();
    const s = data.sessions[token];
    if (!token || !s) throw new Error('Please sign in to continue');
    if (s.expires < nowSeconds()) throw new Error('Your session expired. Please sign in again.');
    const u = data.users.find(x => x.id === s.userId);
    if (!u) throw new Error('Please sign in to continue');
    return { id: u.id, email: u.email, phone: u.phone, full_name: u.full_name, student_id: u.student_id };
  }

  function currentAdmin(token) {
    const data = load();
    const s = data.adminSessions[token];
    if (!token || !s) throw new Error('Admin sign-in required');
    if (s.expires < nowSeconds()) throw new Error('Admin session expired. Please sign in again.');
    const a = data.admins.find(x => x.id === s.adminId);
    if (!a) throw new Error('Admin sign-in required');
    return { id: a.id, admin_code: a.admin_code, email: a.email };
  }

  /* ---------- scholarships (GET /api/schemes, /api/stats) ---------- */

  function getSchemes({ q = '', type = 'All', category = 'All' } = {}) {
    const text = q.trim().toLowerCase();
    return (window.VPS_SCHEMES || [])
      .filter(s => type === 'All' || s.scheme_type === type)
      .filter(s => category === 'All' || s.category === category)
      .filter(s => !text || [s.name, s.summary, s.eligibility, s.classes].join(' ').toLowerCase().includes(text))
      .sort((a, b) => a.scheme_type.localeCompare(b.scheme_type) || a.name.localeCompare(b.name));
  }

  function getStats() {
    const list = window.VPS_SCHEMES || [];
    const data = load();
    return {
      schemes: list.length,
      government: list.filter(s => s.scheme_type === 'Government').length,
      private: list.filter(s => s.scheme_type === 'Private').length,
      applications: data.applications.length
    };
  }

  /* ---------- eligibility guide (POST /api/eligibility) ---------- */

  function checkEligibility(s) {
    // s = { name, grade, annual_income, category, gender, school_type, previous_marks }
    const results = (window.VPS_SCHEMES || []).map(x => {
      const n = x.name.toLowerCase();
      let status = 'Needs official verification';
      let reason = 'Detailed conditions are not encoded in this demo. Check the latest official notification.';

      if (n.includes('nmmss')) {
        const cat = (s.category || '').toUpperCase();
        const school = (s.school_type || '').toLowerCase();
        const minMarks = (cat === 'SC' || cat === 'ST') ? 50 : 55;
        if (s.grade !== 8) {
          status = 'Not fresh-selection grade';
          reason = 'Fresh selection is generally at Class VIII; renewal rules differ.';
        } else if (s.annual_income != null && s.annual_income > 350000) {
          status = 'Likely not eligible';
          reason = 'Reported income is above the ₹3.5 lakh guideline figure; confirm current notice.';
        } else if (school && !['government', 'government-aided', 'local body'].includes(school)) {
          status = 'Likely not eligible';
          reason = 'The cited guidelines specify government, government-aided or local body schools.';
        } else if (s.previous_marks != null && s.previous_marks < minMarks) {
          status = 'Likely not eligible';
          reason = 'Reported marks are below the cited guideline threshold.';
        } else {
          status = 'Potential match';
          reason = 'Check Gujarat current NMMS exam notice and all conditions.';
        }
      } else if (n.includes('sarasvati sadhana')) {
        const gender = (s.gender || '').toLowerCase();
        if (s.grade === 9 && (gender === 'female' || gender === 'girl') && (s.category || '').toUpperCase() === 'SC') {
          status = 'Potential match';
          reason = 'Profile matches key conditions listed on the Gujarat SC Welfare source page; verify income and current rules.';
        } else {
          status = 'Not matched by supplied profile';
          reason = 'Listed for eligible SC girls studying in Standard 9.';
        }
      }
      return { scheme: x.name, status, reason, url: x.url, note: x.note };
    });
    return {
      student: s.name,
      results,
      notice: 'Preliminary guidance only; not an official eligibility decision. Unknown criteria are not treated as a confirmed match.'
    };
  }

  /* ---------- student sign-up and sign-in ---------- */

  // GET /api/auth/captcha
  function newCaptcha() {
    const a = randomInt(2, 9), b = randomInt(1, 9);
    const id = randomToken(12);
    const data = load();
    data.captchas[id] = { answer: String(a + b), expires: nowSeconds() + 300 };
    save(data);
    return { captcha_id: id, question: `${a} + ${b} = ?` };
  }

  // POST /api/auth/request-otp
  function requestOtp(phoneInput) {
    const phone = String(phoneInput).replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) throw new Error('Enter a valid phone number');
    const code = String(randomInt(0, 999999)).padStart(6, '0');
    const data = load();
    data.otps[phone] = { code, expires: nowSeconds() + 300 };
    save(data);
    return {
      ok: true,
      message: 'Demo OTP generated. It expires in 5 minutes.',
      demo_otp: code
    };
  }

  // POST /api/auth/create-account
  function createAccount(f) {
    needLength(f.full_name, 2, 100, 'Name');
    needLength(f.student_id, 2, 40, 'Student ID');
    needLength(f.email, 5, 150, 'Email');
    needLength(f.phone, 10, 15, 'Phone number');
    needLength(f.otp, 4, 8, 'OTP');
    needLength(f.password, 8, 128, 'Password');

    const phone = String(f.phone).replace(/\D/g, '');
    const email = f.email.trim().toLowerCase();
    const data = load();

    const otp = data.otps[phone];
    if (!otp || otp.expires < nowSeconds() || otp.code !== String(f.otp).trim()) {
      throw new Error('OTP is invalid or expired. Request a new OTP.');
    }
    if (data.users.some(u => u.email === email || u.phone === phone)) {
      throw new Error('An account with this email or phone already exists. Please sign in.');
    }

    const id = data.nextId.user++;
    data.users.push({
      id, email, phone,
      full_name: f.full_name.trim(),
      student_id: f.student_id.trim(),
      password_hash: makePasswordHash(f.password),
      created_at: timestamp()
    });
    data.profiles[id] = { user_id: id, student_id: f.student_id.trim(), full_name: f.full_name.trim() };
    delete data.otps[phone];
    save(data);
    return { ok: true, message: 'Account created. Please sign in with your email and password.' };
  }

  // POST /api/auth/sign-in
  function signIn(f) {
    const data = load();
    const cap = data.captchas[f.captcha_id];
    if (!cap || cap.expires < nowSeconds() || cap.answer !== String(f.captcha_answer).trim()) {
      throw new Error('CAPTCHA is incorrect or expired. Refresh and try again.');
    }
    delete data.captchas[f.captcha_id];

    const user = data.users.find(u => u.email === String(f.email).trim().toLowerCase());
    if (!user || !checkPassword(f.password, user.password_hash)) {
      save(data);
      throw new Error('Email or password is incorrect.');
    }
    const token = randomToken(36);
    data.sessions[token] = { userId: user.id, expires: nowSeconds() + SESSION_SECONDS };
    save(data);
    return {
      ok: true, token,
      user: { id: user.id, email: user.email, full_name: user.full_name, student_id: user.student_id }
    };
  }

  /* ---------- student profile and applications ---------- */

  // POST /api/student/profile
  function saveProfile(token, p) {
    const user = currentUser(token);
    needLength(p.student_id, 2, 40, 'Student ID');
    needLength(p.full_name, 2, 100, 'Full name');
    if (p.annual_income != null && p.annual_income < 0) throw new Error('Income cannot be negative.');
    if (p.percentage != null && (p.percentage < 0 || p.percentage > 100)) throw new Error('Marks must be between 0 and 100.');
    const data = load();
    data.profiles[user.id] = { ...p, user_id: user.id, updated_at: timestamp() };
    save(data);
    return { ok: true, message: 'Student information saved.' };
  }

  // GET /api/student/profile
  function getProfile(token) {
    const user = currentUser(token);
    return load().profiles[user.id] || {};
  }

  // POST /api/student/applications
  function createApplication(token, schemeId) {
    const user = currentUser(token);
    const data = load();
    const profile = data.profiles[user.id];
    if (!profile || !profile.course || !profile.college) {
      throw new Error('Complete and save your student registration details before applying.');
    }
    const scheme = (window.VPS_SCHEMES || []).find(s => s.id === Number(schemeId));
    if (!scheme) throw new Error('Scholarship not found');

    const code = 'VPS42-' + randomToken(4).toUpperCase();
    const appId = data.nextId.application++;
    data.applications.push({
      id: appId, application_code: code, user_id: user.id,
      student_id: profile.student_id, student_name: profile.full_name,
      email: user.email, mobile: user.phone,
      course: profile.course, college: profile.college,
      scheme_id: scheme.id, application_date: timestamp(),
      status: 'Submitted (Demo)', remarks: ''
    });
    data.tracking.push({
      id: data.nextId.tracking++, application_id: appId,
      status: 'Submitted (Demo)',
      remarks: 'Created from signed-in student portal. Not submitted to scholarship provider.',
      document_status: 'Checklist pending', updated_at: timestamp()
    });
    save(data);
    return {
      application_code: code, scheme: scheme.name, status: 'Submitted (Demo)',
      notice: 'Saved in this local prototype only; no official scholarship application was submitted.'
    };
  }

  // GET /api/student/applications
  function myApplications(token) {
    const user = currentUser(token);
    const data = load();
    return data.applications
      .filter(a => a.user_id === user.id)
      .map(a => {
        const s = (window.VPS_SCHEMES || []).find(x => x.id === a.scheme_id) || {};
        return { application_code: a.application_code, student_name: a.student_name,
                 application_date: a.application_date, status: a.status,
                 scheme: s.name, scheme_type: s.scheme_type };
      })
      .reverse(); // newest first
  }

  /* ---------- admin ---------- */

  // POST /api/admin/create-account
  function adminCreate(f) {
    needLength(f.admin_code, 3, 40, 'Admin ID');
    needLength(f.email, 5, 150, 'Email');
    needLength(f.password, 10, 128, 'Password');
    const code = f.admin_code.trim().toUpperCase();
    const email = f.email.trim().toLowerCase();
    const data = load();
    if (data.admins.some(a => a.admin_code === code || a.email === email)) {
      throw new Error('Admin ID or email already exists.');
    }
    data.admins.push({
      id: data.nextId.admin++, admin_code: code, email,
      password_hash: makePasswordHash(f.password), created_at: timestamp()
    });
    save(data);
    return { ok: true, message: 'Admin account created. Please sign in.' };
  }

  // POST /api/admin/sign-in
  function adminSignIn(f) {
    const data = load();
    const a = data.admins.find(x => x.admin_code === String(f.admin_code).trim().toUpperCase());
    if (!a || !checkPassword(f.password, a.password_hash)) {
      throw new Error('Admin ID or password is incorrect.');
    }
    const token = randomToken(36);
    data.adminSessions[token] = { adminId: a.id, expires: nowSeconds() + SESSION_SECONDS };
    save(data);
    return { ok: true, token, admin: { admin_code: a.admin_code, email: a.email } };
  }

  // GET /api/admin/me
  const adminMe = token => currentAdmin(token);

  // GET /api/admin/applications
  function adminApplications(token) {
    currentAdmin(token);
    return load().applications.map(a => {
      const s = (window.VPS_SCHEMES || []).find(x => x.id === a.scheme_id) || {};
      return { ...a, scheme: s.name };
    }).reverse();
  }

  // POST /api/admin/track
  function adminTrack(token, codeInput) {
    currentAdmin(token);
    const code = String(codeInput || '').trim().toUpperCase();
    const data = load();
    const a = data.applications.find(x => x.application_code === code);
    if (!a) throw new Error('Application ID not found.');
    const s = (window.VPS_SCHEMES || []).find(x => x.id === a.scheme_id) || {};
    const history = data.tracking.filter(t => t.application_id === a.id);
    return { application: { ...a, scheme: s.name }, history };
  }

  // PATCH /api/admin/applications/{id}/status
  function adminUpdateStatus(token, appId, f) {
    currentAdmin(token);
    needLength(f.status, 2, 80, 'Status');
    const data = load();
    const a = data.applications.find(x => x.id === Number(appId));
    if (!a) throw new Error('Application not found');
    a.status = f.status;
    a.remarks = f.remarks || '';
    data.tracking.push({
      id: data.nextId.tracking++, application_id: a.id,
      status: f.status, remarks: f.remarks || '',
      document_status: f.document_status || 'Pending', updated_at: timestamp()
    });
    save(data);
    return { ok: true, notice: 'Application status and tracking history updated.' };
  }

  // Everything other files are allowed to use:
  return {
    getSchemes, getStats, checkEligibility,
    newCaptcha, requestOtp, createAccount, signIn,
    saveProfile, getProfile, createApplication, myApplications, currentUser,
    adminCreate, adminSignIn, adminMe, adminApplications, adminTrack, adminUpdateStatus
  };
})();
