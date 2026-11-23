/* portal.js - student dashboard: profile, apply, my applications */
const $ = s => document.querySelector(s);
const token = localStorage.getItem('vps-token');
const params = new URLSearchParams(location.search);

// Not signed in? Go to the sign-in page.
if (!token) location.replace('auth.html' + (params.get('scheme') ? '?scheme=' + params.get('scheme') : ''));

// Escape text before putting it inside HTML (stops users injecting HTML)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function status(id, text, ok) {
  const e = $(id);
  e.textContent = text;
  e.className = 'portal-status ' + (ok ? 'ok' : 'err');
}

function load() {
  try {
    const me = DB.currentUser(token);
    const profile = DB.getProfile(token);
    const schemes = DB.getSchemes();
    const apps = DB.myApplications(token);

    $('#welcome').textContent = 'Welcome, ' + me.full_name;

    // fill the profile form with saved values
    const f = $('#profileForm');
    Object.keys(profile).forEach(k => { if (f.elements[k]) f.elements[k].value = profile[k] ?? ''; });

    // scholarship drop-down
    $('#schemeSelect').innerHTML = '<option value="">Choose a scholarship</option>' +
      schemes.map(s => `<option value="${s.id}">${esc(s.name)} · ${esc(s.scheme_type)}</option>`).join('');
    const chosen = params.get('scheme');
    if (chosen) $('#schemeSelect').value = chosen;

    // my applications list
    $('#myApps').innerHTML = apps.length
      ? apps.map(a => `<div class="application-item"><b>${esc(a.application_code)}</b><p>${esc(a.scheme)} · ${esc(a.status)}</p><small>${esc(a.application_date)}</small></div>`).join('')
      : 'No applications submitted yet.';
  } catch (e) {
    alert(e.message);
    localStorage.removeItem('vps-token');
    location.href = 'auth.html';
  }
}

// Save profile
$('#profileForm').onsubmit = e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  ['annual_income', 'percentage'].forEach(k => { if (d[k] === '') delete d[k]; else d[k] = Number(d[k]); });
  try {
    const r = DB.saveProfile(token, d);
    status('#profileMsg', r.message, true);
  } catch (x) { status('#profileMsg', x.message, false); }
};

// Apply for a scholarship
$('#applyForm').onsubmit = e => {
  e.preventDefault();
  const schemeId = Number(new FormData(e.target).get('scheme_id'));
  try {
    const r = DB.createApplication(token, schemeId);
    load(); // refresh the list first, then show the message
    status('#applyMsg', `Application ID: ${r.application_code}. ${r.notice}`, true);
  } catch (x) { status('#applyMsg', x.message, false); }
};

// Sign out
$('#logout').onclick = () => {
  localStorage.removeItem('vps-token');
  localStorage.removeItem('vps-user');
  location.href = 'index.html';
};

load();
