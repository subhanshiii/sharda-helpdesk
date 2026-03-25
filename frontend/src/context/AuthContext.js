import React, { createContext, useContext, useReducer, useEffect } from 'react';
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
      return { user: null, token: null, loading: false, error: null };

    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

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

  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await API.post('/auth/register', formData);
      dispatch({ type: 'AUTH_SUCCESS', payload: res.data });
      return { success: true };
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
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
