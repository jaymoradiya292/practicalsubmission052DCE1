/* admin-auth.js - admin sign-in and admin account creation */
const $ = s => document.querySelector(s);

$('#adminLogin').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const d = DB.adminSignIn(f);
    localStorage.setItem('vps-admin-token', d.token);
    location.href = 'admin.html';
  } catch (x) {
    $('#loginMsg').textContent = x.message;
    $('#loginMsg').className = 'admin-msg error';
  }
});

$('#adminSignup').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const d = DB.adminCreate(f);
    $('#signupMsg').textContent = d.message + ' You can now sign in.';
    $('#signupMsg').className = 'admin-msg ok';
    $('#adminLogin [name=admin_code]').value = f.admin_code;
  } catch (x) {
    $('#signupMsg').textContent = x.message;
    $('#signupMsg').className = 'admin-msg error';
  }
});
