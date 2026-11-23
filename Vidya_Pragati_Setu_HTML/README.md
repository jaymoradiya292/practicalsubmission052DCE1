# Vidya Pragati Setu — HTML / CSS / JavaScript version

No Python, no server, no installation. Only HTML, CSS and JavaScript.

## How to run
1. Open the folder in VS Code.
2. Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.
   (Double-clicking `index.html` also works in Chrome/Edge, but Live Server is more reliable.)

## Files
| File | What it is |
|---|---|
| `index.html` | Homepage: scheme list, search, eligibility guide |
| `auth.html` | Student sign-in / create account |
| `portal.html` | Student dashboard: profile + apply + my applications |
| `admin-login.html` | Admin sign-in / create admin |
| `admin.html` | Admin dashboard: all applications, track, update status |
| `css/styles.css` | All styling (same as before) |
| `js/schemes-data.js` | The 15 scholarship records (was the `schemes` table in SQLite) |
| `js/db.js` | **Replaces `main.py`** – all backend logic, saves data in `localStorage` |
| `js/app.js` | Homepage logic |
| `js/auth.js`, `js/portal.js`, `js/admin-auth.js`, `js/admin.js` | One script per page |
| `js/site.js` | Dark mode + English/Gujarati toggle for inner pages |

## Python → JavaScript map
| Python (main.py) | JavaScript (db.js) |
|---|---|
| SQLite tables | one object saved in `localStorage` under key `vps-db` |
| `@app.get('/api/schemes')` | `DB.getSchemes()` |
| `/api/eligibility` | `DB.checkEligibility()` |
| `/api/auth/captcha`, `request-otp`, `create-account`, `sign-in` | `DB.newCaptcha()`, `DB.requestOtp()`, `DB.createAccount()`, `DB.signIn()` |
| `/api/student/profile`, `/api/student/applications` | `DB.saveProfile()`, `DB.getProfile()`, `DB.createApplication()`, `DB.myApplications()` |
| `/api/admin/...` | `DB.adminCreate()`, `DB.adminSignIn()`, `DB.adminApplications()`, `DB.adminTrack()`, `DB.adminUpdateStatus()` |
| `raise HTTPException(...)` | `throw new Error(...)` |

## Important limits
- Data is stored **only in the current browser**. A student account made in Chrome will not exist in Firefox, and an admin on another computer cannot see your applications. To reset everything, clear site data (or run `localStorage.clear()` in the browser console).
- Passwords use a simple demo hash and the OTP is shown on screen. This is fine for learning, but a real website needs a real backend for login security.
- This is a demo; applications are not sent to any scholarship provider.
