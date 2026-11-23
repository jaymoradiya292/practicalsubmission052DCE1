/* admin.js - admin dashboard: see applications, track one, update its status */
const $ = s => document.querySelector(s);
const token = localStorage.getItem('vps-admin-token');
if (!token) location.href = 'admin-login.html';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sessionExpired() {
  localStorage.removeItem('vps-admin-token');
  location.href = 'admin-login.html';
}

function init() {
  try {
    $('#adminIdentity').textContent = DB.adminMe(token).admin_code;
    loadRecords();
  } catch (e) { sessionExpired(); }
}

// Table of all applications (so the admin can find the record ID)
function loadRecords() {
  const rows = DB.adminApplications(token);
  $('#recordsBody').innerHTML = rows.length
    ? rows.map(a => `<tr><td>${a.id}</td><td>${esc(a.application_code)}</td><td>${esc(a.student_name)}</td><td>${esc(a.scheme)}</td><td>${esc(a.status)}</td><td>${esc(a.application_date)}</td></tr>`).join('')
    : '<tr><td colspan="6">No applications yet.</td></tr>';
}

$('#adminLogout').addEventListener('click', sessionExpired);

// Track one application by its code
$('#trackSearch').addEventListener('submit', e => {
  e.preventDefault();
  const box = $('#trackResult');
  box.hidden = false;
  try {
    const code = new FormData(e.target).get('application_code');
    const d = DB.adminTrack(token, code);
    box.innerHTML = `<b>${esc(d.application.application_code)}</b> · ${esc(d.application.student_name)}<br>${esc(d.application.scheme)}<br>` +
      d.history.map(h => `<div class="history"><b>${esc(h.status)}</b> — ${esc(h.document_status)}<br>${esc(h.remarks || '')}<br><small>${esc(h.updated_at)}</small></div>`).join('');
  } catch (x) { box.textContent = x.message; }
});

// Update status
$('#updateForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const id = f.app_id;
  delete f.app_id;
  try {
    const d = DB.adminUpdateStatus(token, id, f);
    $('#updateMsg').textContent = d.notice;
    loadRecords();
  } catch (x) { $('#updateMsg').textContent = x.message; }
});

init();
