/* auth.js - student sign-in and sign-up page (uses db.js instead of the Python server) */
const $ = s => document.querySelector(s);
let captchaId = '';
const params = new URLSearchParams(location.search);
const selected = params.get('scheme') || ''; // scholarship chosen on the homepage

function msg(id, text, ok = false) {
  const e = $(id);
  e.textContent = text;
  e.className = 'form-msg ' + (ok ? 'ok' : 'error');
}

function refreshCaptcha() {
  const d = DB.newCaptcha();
  captchaId = d.captcha_id;
  $('#captchaQuestion').textContent = d.question;
  $('#loginForm [name=captcha_answer]').value = '';
}
$('#refreshCaptcha').onclick = refreshCaptcha;

// ---- Sign in ----
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const d = DB.signIn({ email: f.email, password: f.password, captcha_id: captchaId, captcha_answer: f.captcha_answer });
    localStorage.setItem('vps-token', d.token);
    localStorage.setItem('vps-user', JSON.stringify(d.user));
    location.href = 'portal.html' + (selected ? '?scheme=' + encodeURIComponent(selected) : '');
  } catch (x) {
    msg('#loginMsg', x.message);
    refreshCaptcha();
  }
};

// ---- Get OTP ----
$('#sendOtp').onclick = () => {
  const phone = $('#signupForm [name=phone]').value.trim();
  if (!phone) { msg('#signupMsg', 'Enter your phone number first.'); return; }
  try {
    const d = DB.requestOtp(phone);
    msg('#signupMsg', d.message + ' Demo OTP: ' + d.demo_otp, true);
  } catch (x) { msg('#signupMsg', x.message); }
};

// ---- Create account ----
$('#signupForm').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const d = DB.createAccount(f);
    msg('#signupMsg', d.message + ' Please use the sign-in form.', true);
    $('#loginForm [name=email]').value = f.email;
    $('#loginForm [name=password]').value = '';
    $('#loginForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    refreshCaptcha();
  } catch (x) { msg('#signupMsg', x.message); }
};

refreshCaptcha();
