// client/src/AuthApp.jsx
// Urban Eye auth + role-based UI for react-router-dom. Everything is in this one file:
// AuthProvider, useAuth, ProtectedRoute, LoginPage, RegisterPage, and the three dashboards
// (CitizenDashboard, OfficerDashboard, AdminDashboard), with their own styles. Needs React 18+.
//
// NOTE: the role checks here only hide pages. The server enforces the real rules (requireRole).

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import WardSelect from './components/WardSelect';

// ---------------------------------------------------------------- config
const API = 'http://localhost:5000/api/auth'; // change for deployment
const STORE_KEY = 'urban_eye_session';
const EXPIRED_MSG = 'Your session has expired. Please log in again.';

const ROLE_LABEL = {
  citizen: 'Citizen',
  field_officer: 'Field Officer',
  supervisor: 'Supervisor',
  admin: 'Admin',
};
const OFFICER_ROLES = ['Field Officer', 'Supervisor', 'Admin']; // matches OFFICER.ROLE enum

// Where each role lands after login (matches the routes in App.jsx)
const ROLE_HOME = { citizen: '/dashboard', field_officer: '/officer', supervisor: '/officer', admin: '/admin' };

// Which roles may open which page. The sidebar is built from this.
const PAGES = {
  home: { label: 'Dashboard', roles: ['citizen', 'field_officer', 'supervisor', 'admin'] },
  report: { label: 'Report an issue', roles: ['citizen'] },
  mine: { label: 'My reports', roles: ['citizen'] },
  assigned: { label: 'My assigned issues', roles: ['field_officer'] },
  issues: { label: 'Ward issues', roles: ['supervisor', 'admin'] },
  verify: { label: 'Verification queue', roles: ['supervisor', 'admin'] },
  addOfficer: { label: 'Add officer', roles: ['admin'] },
};
const canOpen = (role, page) => !!PAGES[page] && PAGES[page].roles.includes(role);

// ---------------------------------------------------------------- api + session helpers
async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Check that it is running.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Something went wrong'), { status: res.status });
  return data;
}

const loadSession = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
};
const saveSession = (s) => {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
};

// ---------------------------------------------------------------- auth context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession); // { token, user }
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(() => !!loadSession());

  const clear = useCallback((message = '') => {
    saveSession(null);
    setSession(null);
    setNotice(message);
  }, []);

  const signIn = useCallback((s) => {
    saveSession(s);
    setSession(s);
    setNotice('');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await request('/logout', { method: 'POST', token: session?.token });
    } catch {
      /* logout is stateless: always clear locally */
    }
    clear();
  }, [session, clear]);

  // Calls that need the token. A 401 means it expired, so go back to login.
  const authed = useCallback(
    async (path, opts = {}) => {
      try {
        return await request(path, { ...opts, token: session?.token });
      } catch (e) {
        if (e.status === 401) clear(EXPIRED_MSG);
        throw e;
      }
    },
    [session, clear]
  );

  // On first load, check that a stored token is still valid
  useEffect(() => {
    if (!session) {
      setChecking(false);
      return;
    }
    request('/me', { token: session.token })
      .then(({ user }) => {
        const s = { token: session.token, user };
        saveSession(s);
        setSession(s);
      })
      .catch(() => clear(EXPIRED_MSG))
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user, notice, checking, signIn, signOut, authed }),
    [session, notice, checking, signIn, signOut, authed]
  );
  return (
    <AuthContext.Provider value={value}>
      <style>{CSS}</style>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------- small UI pieces
function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Urban Eye logo">
      <path
        d="M4 32C12 16 22 10 32 10C42 10 52 16 60 32C52 48 42 54 32 54C22 54 12 48 4 32Z"
        fill="#fff" stroke="#17324D" strokeWidth="4" strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="14" fill="#23845B" />
      <path d="M32 23.5c-4.4 0-7.5 3.2-7.5 7.3 0 5.2 7.5 12.2 7.5 12.2s7.5-7 7.5-12.2c0-4.1-3.1-7.3-7.5-7.3z" fill="#fff" />
      <circle cx="32" cy="30.8" r="2.8" fill="#23845B" />
      <circle cx="55" cy="10" r="5.5" fill="#D92D20" stroke="#F5F7FA" strokeWidth="2" />
    </svg>
  );
}

function Field({ label, error, hint, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} {...props} />
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function PasswordField({ label, error, hint, ...props }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} {...props} />
        <button type="button" className="link-btn" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Select({ label, error, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={!!error} {...props}>
        {children}
      </select>
      {error && <span className="err">{error}</span>}
    </div>
  );
}

const Alert = ({ kind = 'error', children }) =>
  children ? (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  ) : null;

const RoleBadge = ({ role }) => <span className={`badge ${role}`}>{ROLE_LABEL[role] || role}</span>;

// ---------------------------------------------------------------- signed-out screens
function SplitLayout({ children }) {
  return (
    <div className="split">
      <aside className="panel">
        <div className="brand">
          <LogoMark />
          <span>Urban Eye</span>
        </div>
        <div>
          <h2>Report. Verify. Resolve.</h2>
          <p>A civic issue triage and verification system for your Municipal Council.</p>
          <ul>
            <li><i style={{ background: '#D92D20' }} />Emergency alerts and community voting, in two tracks</li>
            <li><i style={{ background: '#23845B' }} />Fixes confirmed with officer photo proof</li>
            <li><i style={{ background: '#B3C3D6' }} />Announcements for your ward</li>
          </ul>
        </div>
        <small>Municipal Council service portal</small>
      </aside>
      <main className="stage">{children}</main>
    </div>
  );
}

export function LoginPage() {
  const { session } = useAuth();
  if (session) return <Navigate to={ROLE_HOME[session.user.role] || '/'} replace />;
  return (
    <SplitLayout>
      <LoginCard />
    </SplitLayout>
  );
}

export function RegisterPage() {
  const { session } = useAuth();
  if (session) return <Navigate to={ROLE_HOME[session.user.role] || '/'} replace />;
  return (
    <SplitLayout>
      <RegisterCard />
    </SplitLayout>
  );
}

function LoginCard() {
  const { signIn, notice } = useAuth();
  const [kind, setKind] = useState('citizen'); // citizen | officer
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError(kind === 'citizen' ? 'Enter your email or NIC number and your password.' : 'Enter your email or employee ID and your password.');
      return;
    }
    setBusy(true);
    try {
      const data = await request(kind === 'citizen' ? '/login' : '/officer/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password },
      });
      signIn({ token: data.token, user: data.user });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchKind = (k) => {
    setKind(k);
    setIdentifier('');
    setError('');
  };

  return (
    <form className="card narrow" onSubmit={submit} noValidate>
      <div>
        <h1>{kind === 'citizen' ? 'Welcome back' : 'Officer sign in'}</h1>
        <p className="sub">
          {kind === 'citizen' ? 'Log in to report and track issues in your ward.' : 'Use your council email or employee ID.'}
        </p>
      </div>
      <div className="seg" role="group" aria-label="Account type">
        <button type="button" aria-pressed={kind === 'citizen'} onClick={() => switchKind('citizen')}>Citizen</button>
        <button type="button" aria-pressed={kind === 'officer'} onClick={() => switchKind('officer')}>Officer</button>
      </div>
      <Alert kind="warn">{notice}</Alert>
      <Alert>{error}</Alert>
      <Field
        label={kind === 'citizen' ? 'Email or NIC number' : 'Email or Employee ID'}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder={kind === 'citizen' ? 'you@example.com or NIC' : 'e.g. ADMIN001'}
        autoComplete="username"
      />
      <PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      {kind === 'citizen' ? (
        <p className="foot">
          New here? <Link className="link-btn" to="/register">Create an account</Link>
        </p>
      ) : (
        <p className="foot">Officer accounts are created by an administrator.</p>
      )}
    </form>
  );
}

function RegisterCard() {
  const [f, setF] = useState({ full_name: '', nic: '', mobile_number: '', email: '', ward_id: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!f.full_name.trim()) e.full_name = 'Enter your full name';
    if (!f.nic.trim()) e.nic = 'Enter your NIC number';
    if (!/^(?:\+94|0)7\d{8}$/.test(f.mobile_number.trim())) e.mobile_number = 'Enter a valid mobile number, e.g. 0771234567';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
    if (!f.ward_id) e.ward_id = 'Select your ward';
    if (f.password.length < 8 || new TextEncoder().encode(f.password).length > 72) e.password = 'Password must be 8 to 72 characters';
    if (f.confirm !== f.password) e.confirm = 'Passwords do not match';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await request('/register', {
        method: 'POST',
        body: {
          full_name: f.full_name.trim(),
          nic: f.nic.trim(),
          mobile_number: f.mobile_number.trim(),
          email: f.email.trim() || undefined,
          ward_id: Number(f.ward_id),
          password: f.password,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card narrow">
        <h1>Account created</h1>
        <p className="sub">You can now log in with your email or NIC number.</p>
        <Link className="btn" to="/login">Go to login</Link>
      </div>
    );
  }

  return (
    <form className="card wide" onSubmit={submit} noValidate>
      <div>
        <h1>Create your account</h1>
        <p className="sub">Your NIC is verified and stored only as a secure hash.</p>
      </div>
      <Alert>{error}</Alert>
      <div className="grid2">
        <Field label="Full name" value={f.full_name} onChange={set('full_name')} error={errors.full_name} placeholder="As on your NIC" autoComplete="name" />
        <Field label="NIC number" value={f.nic} onChange={set('nic')} error={errors.nic} placeholder="Old or new format" />
        <Field label="Mobile number" value={f.mobile_number} onChange={set('mobile_number')} error={errors.mobile_number} placeholder="07X XXX XXXX" autoComplete="tel" />
        <Field label="Email (optional)" value={f.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" autoComplete="email" />
      </div>
      <WardSelect
  value={f.ward_id}
  onChange={(id) => setF((p) => ({ ...p, ward_id: id }))}
  error={errors.ward_id}
/>
      <div className="grid2">
        <PasswordField label="Password" value={f.password} onChange={set('password')} error={errors.password} placeholder="8 to 72 characters" autoComplete="new-password" />
        <PasswordField label="Confirm password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} placeholder="Repeat password" autoComplete="new-password" />
      </div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      <p className="foot">
        Already registered? <Link className="link-btn" to="/login">Log in</Link>
      </p>
    </form>
  );
}

// ---------------------------------------------------------------- signed-in shell (role-based)
function Dashboard({ keys }) {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState('home');
  const role = user.role;
  const nav = keys.filter((p) => canOpen(role, p));

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand dark"><LogoMark /><span>Urban Eye</span></div>
        <div className="who">
          <RoleBadge role={role} />
          <span>{user.full_name}</span>
          <button className="link-btn" onClick={signOut}>Log out</button>
        </div>
      </header>
      <div className="body">
        <nav className="side" aria-label="Main">
          {nav.map((p) => (
            <button key={p} className={page === p ? 'on' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
              {PAGES[p].label}
            </button>
          ))}
        </nav>
        <main className="content">
          {!canOpen(role, page) ? <Forbidden /> : page === 'home' ? <Home role={role} go={setPage} /> : page === 'addOfficer' ? <AddOfficer /> : <Placeholder title={PAGES[page].label} />}
        </main>
      </div>
    </div>
  );
}

const Forbidden = () => (
  <div>
    <h1>You don't have access to this page</h1>
    <p className="sub">Your role cannot open it. Ask an administrator if you think this is a mistake.</p>
  </div>
);

const Placeholder = ({ title }) => (
  <div>
    <h1>{title}</h1>
    <p className="sub">This page will be built in a later sprint.</p>
  </div>
);

const HOME_TILES = {
  citizen: [['report', 'Report an issue', 'Tell your council about a problem in your ward.'], ['mine', 'My reports', 'Track the issues you reported.']],
  field_officer: [['assigned', 'My assigned issues', 'Issues assigned to you.']],
  supervisor: [['issues', 'Ward issues', 'All open issues in your ward.'], ['verify', 'Verification queue', 'Closures waiting for verification.']],
  admin: [['issues', 'Ward issues', 'All open issues.'], ['verify', 'Verification queue', 'Closures waiting for verification.'], ['addOfficer', 'Add officer', 'Create an officer account.']],
};

function Home({ role, go }) {
  const { user } = useAuth();
  return (
    <div>
      <h1>Hello, {user.full_name}</h1>
      <p className="sub">Signed in as {ROLE_LABEL[role]}.</p>
      <div className="tiles">
        {(HOME_TILES[role] || []).map(([key, title, text]) => (
          <button key={key} className="tile" onClick={() => go(key)}>
            <strong>{title}</strong>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Admin only: POST /officers
function AddOfficer() {
  const { authed } = useAuth();
  const empty = { employee_id: '', full_name: '', email: '', password: '', role: 'Field Officer', council_id: '', ward_id: '', department: '' };
  const [f, setF] = useState(empty);
  const [wards, setWards] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request('/wards').then((d) => setWards(d.wards)).catch(() => {});
  }, []);

  const councils = [...new Set(wards.map((w) => w.council_id))];
  const wardsInCouncil = wards.filter((w) => String(w.council_id) === String(f.council_id));
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value, ...(k === 'council_id' ? { ward_id: '' } : {}) }));

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    setOk('');
    const e = {};
    if (!f.employee_id.trim()) e.employee_id = 'Enter the employee ID';
    if (!f.full_name.trim()) e.full_name = 'Enter the full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
    if (f.password.length < 8 || new TextEncoder().encode(f.password).length > 72) e.password = 'Password must be 8 to 72 characters';
    if (!f.council_id) e.council_id = 'Select a council';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const d = await authed('/officers', {
        method: 'POST',
        body: {
          employee_id: f.employee_id.trim(),
          full_name: f.full_name.trim(),
          email: f.email.trim(),
          password: f.password,
          role: f.role,
          council_id: Number(f.council_id),
          ward_id: f.ward_id ? Number(f.ward_id) : undefined,
          department: f.department.trim() || undefined,
        },
      });
      setOk(`Officer created: ${d.officer.full_name} (${ROLE_LABEL[d.officer.role]}).`);
      setF(empty);
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-page" onSubmit={submit} noValidate>
      <div>
        <h1>Add officer</h1>
        <p className="sub">Only administrators can create officer accounts.</p>
      </div>
      <Alert kind="success">{ok}</Alert>
      <Alert>{error}</Alert>
      <div className="grid2">
        <Field label="Employee ID" value={f.employee_id} onChange={set('employee_id')} error={errors.employee_id} placeholder="e.g. OFF014" />
        <Field label="Full name" value={f.full_name} onChange={set('full_name')} error={errors.full_name} placeholder="Officer name" />
        <Field label="Email" value={f.email} onChange={set('email')} error={errors.email} placeholder="name@council.lk" />
        <PasswordField label="Temporary password" value={f.password} onChange={set('password')} error={errors.password} placeholder="8 to 72 characters" autoComplete="new-password" />
        <Select label="Role" value={f.role} onChange={set('role')}>
          {OFFICER_ROLES.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Select label="Council" value={f.council_id} onChange={set('council_id')} error={errors.council_id}>
          <option value="">Select council</option>
          {councils.map((c) => <option key={c} value={c}>Council {c}</option>)}
        </Select>
        <Select label="Ward (optional)" value={f.ward_id} onChange={set('ward_id')} disabled={!f.council_id}>
          <option value="">All wards</option>
          {wardsInCouncil.map((w) => <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>)}
        </Select>
        <Field label="Department (optional)" value={f.department} onChange={set('department')} placeholder="e.g. Sanitation" />
      </div>
      <button className="btn fit" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create officer'}</button>
    </form>
  );
}

// ---------------------------------------------------------------- route guard + dashboards
// <ProtectedRoute>                    any logged-in user
// <ProtectedRoute roles={['admin']}>  only these roles (others go to their own home)
export function ProtectedRoute({ roles, children }) {
  const { session, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="boot">Loading…</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(session.user.role)) {
    return <Navigate to={ROLE_HOME[session.user.role] || '/'} replace />;
  }
  return children;
}

export const CitizenDashboard = () => <Dashboard keys={['home', 'report', 'mine']} />;

export function OfficerDashboard() {
  const { user } = useAuth();
  const keys = user.role === 'supervisor' ? ['home', 'issues', 'verify'] : ['home', 'assigned'];
  return <Dashboard keys={keys} />;
}

export const AdminDashboard = () => <Dashboard keys={['home', 'issues', 'verify', 'addOfficer']} />;

// ---------------------------------------------------------------- styles
const CSS = `
:root{--primary:#17324D;--secondary:#23845B;--bg:#F5F7FA;--emergency:#D92D20;--text:#0F1F2E;--muted:#4B5B70;
--tint:#E4E9F0;--nav-tint:#E7EDF3;--panel-text:#D6E0EC;--panel-muted:#B3C3D6;--border-input:#8393A7;--border:#D8DFE8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
h1{margin:0 0 6px;font-size:28px}
button{font-family:inherit}
.boot{display:grid;place-items:center;min-height:100vh;color:var(--muted)}
.sub{margin:0;font-size:15px;line-height:1.45;color:var(--muted)}
.foot{margin:0;text-align:center;font-size:15px;color:var(--muted)}

.split{display:flex;min-height:100vh}
.panel{flex:0 0 44%;padding:64px;background:var(--primary);color:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:32px}
.panel h2{margin:0 0 16px;font-size:44px;line-height:1.1}
.panel p{margin:0 0 32px;font-size:18px;line-height:1.5;color:var(--panel-text);max-width:460px}
.panel ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.panel li{display:flex;align-items:center}
.panel li i{width:10px;height:10px;border-radius:50%;margin-right:12px;flex:none}
.panel small{font-size:14px;color:var(--panel-muted)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px}
.brand.dark{color:var(--text);font-size:18px}
.stage{flex:1;display:flex;align-items:center;justify-content:center;padding:48px}
.card{width:100%;padding:40px;background:#fff;border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;gap:18px}
.card.narrow{max-width:440px}
.card.wide{max-width:600px}

.field{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500}
.field input,.field select{height:48px;padding:0 14px;border:1px solid var(--border-input);border-radius:8px;font:400 16px inherit;font-family:inherit;background:#fff;color:var(--text);width:100%}
.field [aria-invalid="true"]{border-color:var(--emergency)}
.field .err{color:#B42318;font-weight:400}
.field .hint{color:var(--muted);font-weight:400}
.pw{position:relative}
.pw input{padding-right:64px}
.pw .link-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}

.btn{height:48px;border:0;border-radius:8px;background:var(--primary);color:#fff;font:600 16px inherit;font-family:inherit;cursor:pointer;padding:0 24px}
.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.btn.fit{align-self:flex-start;min-width:200px}
.btn:disabled{opacity:.6;cursor:default}
.link-btn{background:none;border:0;padding:0;color:var(--secondary);font-weight:600;font-size:15px;cursor:pointer}
.link-btn{text-decoration:none}
.link-btn:hover{text-decoration:underline}
:where(button,input,select):focus-visible{outline:3px solid #7FA6D1;outline-offset:2px}

.seg{display:flex;padding:4px;background:var(--tint);border-radius:10px;gap:4px}
.seg button{flex:1;height:40px;border:0;border-radius:8px;background:transparent;color:var(--text);font:600 15px inherit;font-family:inherit;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--primary);color:#fff}

.alert{padding:12px 14px;border-radius:8px;font-size:14px;line-height:1.4;border:1px solid}
.alert.error{background:#FEF3F2;border-color:#F4B8B2;color:#B42318}
.alert.success{background:#E8F5EE;border-color:#A8D5BC;color:#1B6B49}
.alert.warn{background:#FFFAEB;border-color:#F0D49A;color:#B54708}

.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;background:var(--nav-tint);color:var(--primary)}
.badge.field_officer{background:#E3F4EC;color:#1B6B49}
.badge.supervisor{background:#FFF1D6;color:#B54708}
.badge.admin{background:var(--primary);color:#fff}

.shell{min-height:100vh;display:flex;flex-direction:column}
.topbar{height:64px;padding:0 32px;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid var(--border)}
.who{display:flex;align-items:center;gap:16px;font-size:15px}
.body{flex:1;display:flex}
.side{width:240px;padding:24px 16px;background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:6px}
.side button{text-align:left;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:var(--muted);font-size:15px;cursor:pointer}
.side button:hover{background:var(--nav-tint)}
.side button.on{background:var(--nav-tint);color:var(--primary);font-weight:600}
.content{flex:1;padding:40px 48px;max-width:960px}
.form-page{display:flex;flex-direction:column;gap:24px;max-width:760px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:24px}
.tile{display:flex;flex-direction:column;gap:6px;text-align:left;padding:20px;background:#fff;border:1px solid var(--border);border-radius:12px;cursor:pointer;color:var(--text);font-size:15px}
.tile span{color:var(--muted)}
.tile:hover{border-color:var(--secondary)}

@media (max-width:900px){
  .panel{display:none}
  .stage{padding:24px 16px}
  .card{padding:28px 20px}
  .grid2{grid-template-columns:1fr}
  .side{display:none}
  .content{padding:24px 20px}
  .topbar{padding:0 16px}
}
`;