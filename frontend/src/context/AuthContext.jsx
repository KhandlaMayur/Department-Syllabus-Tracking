import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { jwtDecode } from 'jwt-decode';
import authApi from '../api/authApi';

const AuthContext = createContext(null);

const TOKEN_KEY = 'st_token';
const USER_KEY  = 'st_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    return !exp || Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const {
    getIdTokenClaims,
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: auth0Loading,
    loginWithRedirect,
    logout: auth0LogoutSession,
  } = useAuth0();

  const logout = useCallback(async ({ callServer = true, auth0Logout = false } = {}) => {
    if (callServer) {
      try { await authApi.logout(); } catch { /* ignore */ }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);

    if (auth0Logout && isAuthenticated) {
      auth0LogoutSession({ logoutParams: { returnTo: window.location.origin } });
    }
  }, [isAuthenticated, auth0LogoutSession]);

  // Exchange Auth0 token with backend
  const completeAuth0Exchange = useCallback(async (rawToken) => {
    const res = await authApi.loginWithAuth0(rawToken);
    const { token, user: profile } = res.data.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
    return profile;
  }, []);

  // Helper to extract raw ID token or access token
  const extractToken = useCallback(async () => {
    try {
      const claims = await getIdTokenClaims();
      if (claims && (claims.__raw || claims.id_token)) {
        return claims.__raw || claims.id_token;
      }
    } catch { /* continue */ }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { scope: 'openid profile email' },
      });
      if (token) return token;
    } catch { /* continue */ }

    try {
      const token = await getAccessTokenSilently();
      if (token) return token;
    } catch { /* continue */ }

    return null;
  }, [getIdTokenClaims, getAccessTokenSilently]);

  // Check existing session or handle Auth0 redirect callback
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setAuthError(null);

      // 1. Check existing app JWT in localStorage
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && !isTokenExpired(token)) {
        try {
          const res = await authApi.getCurrentUser();
          if (isMounted) {
            setUser(res.data.data);
            localStorage.setItem(USER_KEY, JSON.stringify(res.data.data));
            setIsLoading(false);
          }
          return;
        } catch {
          logout({ callServer: false });
        }
      }

      // 2. If Auth0 returned from redirect and is authenticated
      if (!auth0Loading && isAuthenticated) {
        try {
          const rawToken = await extractToken();
          if (rawToken) {
            const profile = await completeAuth0Exchange(rawToken);
            if (isMounted) {
              setUser(profile);
            }
          }
        } catch (err) {
          console.error('[auth] Failed to exchange Auth0 token:', err);
          if (isMounted) {
            setAuthError(err);
          }
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    if (!auth0Loading) {
      initAuth();
    }

    const handleUnauthorized = () => logout({ callServer: false });
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [auth0Loading, isAuthenticated, extractToken, completeAuth0Exchange, logout]);

  // Trigger Google sign-in using Auth0 Redirect (100% reliable across all browsers)
  const loginWithGoogle = useCallback(async () => {
    await loginWithRedirect({
      authorizationParams: {
        connection: 'google-oauth2',
        scope: 'openid profile email',
      },
      appState: { returnTo: window.location.pathname },
    });
  }, [loginWithRedirect]);

  // Direct email login for testing/demo across university domains
  const loginWithEmail = useCallback(async (email) => {
    const res = await authApi.devLogin(email);
    const { token, user: profile } = res.data.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
    return profile;
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user && user.role ? user.role : null,
      isAuthenticated: Boolean(user),
      isLoading: isLoading || auth0Loading,
      authError,
      loginWithGoogle,
      loginWithEmail,
      logout,
    }),
    [user, isLoading, auth0Loading, authError, loginWithGoogle, loginWithEmail, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}