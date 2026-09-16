import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const ROLE_HOME = {
  student: '/student',
  faculty: '/faculty',
  cc: '/cc',
  hod: '/hod',
};

function parseError(err) {
  const status  = err && err.response ? err.response.status : null;
  const message = (err && err.response && err.response.data && err.response.data.error)
    ? err.response.data.error.message
    : (err && err.message ? err.message : '');

  if (status === 403) {
    if (message.toLowerCase().includes('restricted') || message.toLowerCase().includes('domain')) {
      return {
        title: 'Wrong account domain',
        body: 'Only @marwadiuniversity.ac.in (students), @marwadieducation.edu.in, and @marwadieducation.ed (faculty/HOD) accounts are allowed.',
      };
    }
    if (message.toLowerCase().includes('not registered')) {
      return {
        title: 'Account not registered',
        body: 'Your email is not registered in the Syllabus Tracker system. Contact your department administrator.',
      };
    }
    if (message.toLowerCase().includes('deactivated')) {
      return {
        title: 'Account deactivated',
        body: 'Your account has been deactivated. Contact your department administrator.',
      };
    }
    return { title: 'Access denied', body: message || 'You are not permitted to access this system.' };
  }
  if (status === 401) {
    return { title: 'Sign-in failed', body: message || 'Invalid or expired credentials. Please try again.' };
  }
  if (message.toLowerCase().includes('callback url mismatch') || message.toLowerCase().includes('unauthorized_client')) {
    return {
      title: 'Auth0 Setup Required',
      body: 'Allowed Callback URLs in Auth0 must include http://localhost:5173. Please update Application Settings in your Auth0 dashboard.',
    };
  }
  if (message.toLowerCase().includes('missing required parameter') || message.toLowerCase().includes('client_id')) {
    return {
      title: 'Google OAuth Setup Required',
      body: 'Auth0 requires Google Client ID and Secret configured in Auth0 Dashboard > Authentication > Social > Google.',
    };
  }
  return { title: 'Sign-in notice', body: message || 'Something went wrong. Please try again.' };
}

function BrandPanel() {
  return (
    <aside className="login-brand" aria-label="Marwadi University branding">
      <div className="login-brand__blob login-brand__blob--1" />
      <div className="login-brand__blob login-brand__blob--2" />
      <div className="login-brand__blob login-brand__blob--3" />
      <div className="login-brand__logo" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <rect x="4" y="20" width="32" height="16" rx="3" fill="rgba(255,255,255,0.9)" />
          <polygon points="2,22 20,6 38,22" fill="rgba(255,255,255,0.9)" />
          <rect x="15" y="26" width="10" height="10" rx="1" fill="rgba(0,131,140,0.8)" />
        </svg>
      </div>
      <h2 className="login-brand__uni-name">Marwadi University</h2>
      <p className="login-brand__tagline">Department Syllabus Tracker<br/>Academic Progress Portal</p>
      <div className="login-brand__features">
        <div className="login-brand__feature">
          <div className="login-brand__feature-icon">📚</div>
          <p className="login-brand__feature-text">Track syllabus completion in real time</p>
        </div>
        <div className="login-brand__feature">
          <div className="login-brand__feature-icon">🎓</div>
          <p className="login-brand__feature-text">Role-based access for students, faculty and HOD</p>
        </div>
        <div className="login-brand__feature">
          <div className="login-brand__feature-icon">🔒</div>
          <p className="login-brand__feature-text">Secured with Auth0 Google authentication</p>
        </div>
      </div>
      <span className="login-brand__version">Phase 2 · v2.0</span>
    </aside>
  );
}

function LoadingSpinner() {
  return (
    <div className="login-spinner" role="status" aria-live="polite">
      <div className="login-spinner__ring" aria-hidden="true" />
      <span className="login-spinner__text">Signing you in...</span>
    </div>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="login-error" role="alert" aria-live="assertive">
      <svg className="login-error__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span className="login-error__text">
        <strong>{error.title}:</strong> {error.body}
      </span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="btn-google__icon" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

const SAMPLE_ROLES = [
  {
    role: 'Student',
    icon: '🎓',
    email: 'mayur.khandla122265@marwadiuniversity.ac.in',
    desc: 'Routes to /student',
  },
  {
    role: 'HOD',
    icon: '🏛️',
    email: 'chandrasinh.parmar@marwadieducation.edu.in',
    desc: 'Routes to /hod',
  },
  {
    role: 'Faculty (CC)',
    icon: '⭐',
    email: 'nishith.kotak@marwadieducation.edu.in',
    desc: 'HOD-Assigned CC (/faculty)',
  },
  {
    role: 'Faculty',
    icon: '👨‍🏫',
    email: 'amit.joshi@marwadieducation.edu.in',
    desc: 'Teaching Only (/faculty)',
  },
  {
    role: 'CC (Test)',
    icon: '📋',
    email: 'sara.khan@marwadieducation.edu.in',
    desc: 'Quick Role Test Login (/cc)',
  },
];

export default function Login() {
  const { user, loginWithGoogle, loginWithEmail, isLoading, authError } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  // Navigate directly to role home when user is logged in
  useEffect(() => {
    if (user && user.role) {
      const targetPath = ROLE_HOME[user.role] || '/student';
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(parseError(err));
      setSubmitting(false);
    }
  };

  const handleEmailSignIn = async (emailToUse) => {
    const targetEmail = (emailToUse || customEmail).trim();
    if (!targetEmail) {
      setError({ title: 'Email required', body: 'Please enter a university email address.' });
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const profile = await loginWithEmail(targetEmail);
      const targetPath = ROLE_HOME[profile.role] || '/student';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = error || (authError ? parseError(authError) : null);

  return (
    <div className="login-page">
      <BrandPanel />
      <main className="login-panel">
        <div className="login-card" role="main">
          <div className="login-card__logo" aria-hidden="true">ST</div>
          <h1 className="login-card__heading">Welcome back</h1>
          <p className="login-card__subtitle">
            Sign in with your official Marwadi University account to continue.
          </p>
          <div className="login-domains" aria-label="Allowed email domains">
            <span className="login-domain-badge">
              <span className="login-domain-badge__dot" />
              @marwadiuniversity.ac.in (Students)
            </span>
            <span className="login-domain-badge">
              <span className="login-domain-badge__dot" />
              @marwadieducation.edu.in / .ed (Faculty / HOD)
            </span>
          </div>
          <ErrorBanner error={activeError} />

          {/* Google Sign-in Action */}
          <div className="login-action">
            {submitting || isLoading ? (
              <LoadingSpinner />
            ) : (
              <button
                type="button"
                id="btn-login-google"
                className="btn-google"
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            )}
          </div>

          <div className="login-divider">
            <div className="login-divider__line" />
            <span className="login-divider__text">Or Direct University Sign-In</span>
            <div className="login-divider__line" />
          </div>

          {/* Development / Testing Role Login Form */}
          <div className="login-dev-box">
            <div className="login-dev-box__title">
              <span>Quick Role Test Login</span>
              <span className="login-dev-box__badge">Dev / Testing</span>
            </div>

            {/* Quick-select chips */}
            <div className="login-quick-chips">
              {SAMPLE_ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  className={`quick-chip ${customEmail === r.email ? 'quick-chip--active' : ''}`}
                  title={`${r.email} (${r.desc})`}
                  disabled={submitting || isLoading}
                  onClick={() => {
                    setCustomEmail(r.email);
                    handleEmailSignIn(r.email);
                  }}
                >
                  <span>{r.icon}</span>
                  <span>{r.role}</span>
                </button>
              ))}
            </div>

            {/* Manual Email Input Form */}
            <form
              className="login-email-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleEmailSignIn();
              }}
            >
              <input
                type="email"
                className="login-email-input"
                id="input-dev-email"
                placeholder="Enter any university email..."
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                disabled={submitting || isLoading}
              />
              <button
                type="submit"
                id="btn-dev-login"
                className="btn-email-submit"
                disabled={submitting || isLoading || !customEmail.trim()}
              >
                Sign In
              </button>
            </form>
          </div>

          <p className="login-footnote">
            <strong>Marwadi University Portal:</strong> Students enter @marwadiuniversity.ac.in &bull;
            Faculty/HOD enter @marwadieducation.edu.in or @marwadieducation.ed.
          </p>
        </div>
      </main>
    </div>
  );
}