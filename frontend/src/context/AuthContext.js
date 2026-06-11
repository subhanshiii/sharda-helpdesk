import React, { createContext, useContext, useReducer, useEffect, useState, useMemo } from 'react';
import API from '../utils/api';

const AuthContext = createContext();

const initialState = {
  user:    JSON.parse(localStorage.getItem('user')) || null,
  token:   localStorage.getItem('token') || null,
  loading: false,
  error:   null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null };

    case 'AUTH_SUCCESS':
      // Store token in localStorage for Authorization header (backward compat)
      // The real security comes from the httpOnly cookie set by server
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user',  JSON.stringify(action.payload.user));
      return {
        ...state,
        user:    action.payload.user,
        token:   action.payload.token,
        loading: false,
        error:   null,
      };

    case 'UPDATE_USER':
      localStorage.setItem('user', JSON.stringify(action.payload));
      return { ...state, user: action.payload };

    case 'LOGOUT':
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('previewMode');
      return { user: null, token: null, loading: false, error: null };

    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [previewModeState, setPreviewModeState] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('previewMode')) || null;
    } catch {
      return null;
    }
  });

  const setPreviewMode = (mode) => {
    if (mode) {
      sessionStorage.setItem('previewMode', JSON.stringify(mode));
    } else {
      sessionStorage.removeItem('previewMode');
    }
    setPreviewModeState(mode);
    window.location.href = window.location.pathname; // Hard reload to ensure clean cache
  };

  const effectiveUser = useMemo(() => {
    if (!state.user) return null;
    if (previewModeState && state.user.adminTier === 'super_admin') {
      return {
        ...state.user,
        role: previewModeState.role,
        adminTier: previewModeState.adminTier || null,
        isPreviewing: true,
      };
    }
    return state.user;
  }, [state.user, previewModeState]);

  // Verify token on app mount
  useEffect(() => {
    const verifyToken = async () => {
      if (state.token) {
        try {
          const res = await API.get('/auth/me');
          dispatch({ type: 'UPDATE_USER', payload: res.data.data });
        } catch {
          // Token invalid — clear everything
          dispatch({ type: 'LOGOUT' });
        }
      }
    };
    verifyToken();
    // eslint-disable-next-line
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await API.post('/auth/login', { email, password });
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      return { success: false, message: msg };
    }
  };

  const googleLogin = async (credential) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await API.post('/auth/google', { credential });
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
      return { success: true, data: res.data?.user || null };
    } catch (err) {
      const msg = err.response?.data?.message || 'Google sign-in failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      return {
        success: false,
        message: msg,
        data: err.response?.data?.data || null,
      };
    }
  };

  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await API.post('/auth/register', formData);
      dispatch({ type: 'SET_LOADING', payload: false });
      return {
        success: true,
        message: res.data?.message || 'Registration submitted for approval',
        data: res.data?.data || null,
      };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      return { success: false, message: msg };
    }
  };

  // Logout: call server to clear httpOnly cookie, then clear local state
  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch {
      // Even if logout API fails, clear local state
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUser = (user) => dispatch({ type: 'UPDATE_USER', payload: user });

  return (
    <AuthContext.Provider value={{
      ...state,
      user: effectiveUser,
      trueUser: state.user,
      previewMode: previewModeState,
      setPreviewMode,
      login,
      googleLogin,
      register,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
