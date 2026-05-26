import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import { Alert } from '../components/ui';
import API from '../utils/api';

export default function LoginPage() {
  const { login, googleLogin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationLink, setVerificationLink] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefilledEmail = params.get('email');
    const verificationState = params.get('verification');
    const verifiedState = params.get('verified');

    if (prefilledEmail) {
      setForm((current) => ({ ...current, email: prefilledEmail }));
    }

    if (verificationState === 'sent') {
      setError('Verification email sent. Please check your inbox before signing in.');
      setSuccess('');
    } else if (verifiedState === 'success') {
      setSuccess('Email verified successfully. You can sign in after admin approval.');
      setError('');
    }
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;

    const initializeGoogle = async () => {
      try {
        const configResponse = await API.get('/auth/google/config');
        const clientId = configResponse.data?.data?.clientId;
        if (!clientId || !isMounted) return;

        if (!document.getElementById('google-identity-script')) {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.id = 'google-identity-script';
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        if (!isMounted || !window.google?.accounts?.id || !googleButtonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) return;
            setGoogleLoading(true);
            setError('');
            try {
              const result = await googleLogin(response.credential);
              if (result.success) {
                toast.success('Welcome back!');
                navigate('/dashboard');
                return;
              }

              setError(result.message);
            } finally {
              if (isMounted) {
                setGoogleLoading(false);
              }
            }
          },
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: googleButtonRef.current.offsetWidth || 320,
          text: 'continue_with',
        });
      } catch (googleError) {
        console.error('Google Sign-In initialization failed', googleError);
      }
    };

    initializeGoogle();

    return () => {
      isMounted = false;
    };
  }, [googleLogin, navigate]);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); setSuccess(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setSuccess('');
    const result = await login(form.email, form.password);
    if (result.success) { toast.success('Welcome back!'); navigate('/dashboard'); }
    else setError(result.message);
  };

  const handleResendVerification = async () => {
    if (!form.email) {
      setError('Enter your email address to resend verification.');
      return;
    }

    setResendingVerification(true);
    try {
      const res = await API.post('/auth/resend-verification', { email: form.email });
      toast.success(res.data?.message || 'Verification email sent successfully.');
      setError('');
      setVerificationLink(res.data?.data?.verificationLink || '');
    } catch (requestError) {
      console.error('Verification resend failed', {
        status: requestError.response?.status,
        data: requestError.response?.data,
      });
      setError(requestError.response?.data?.message || 'Failed to send verification email');
    } finally {
      setResendingVerification(false);
    }
  };

  const showVerificationHelp = error.toLowerCase().includes('verify');

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0c1654 0%, #1a2d7a 30%, #1e3a8a 60%, #1e40af 100%)' }}>

        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full bg-blue-400/10" />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full bg-cyan-400/10" />
        <div className="absolute top-1/2 right-[-40px] w-48 h-48 rounded-full bg-yellow-400/5" />

        {/* Petal accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #f59e0b, #ec4899, #06b6d4, #10b981)' }} />

        <div className="relative flex flex-col justify-between h-full p-12">
          {/* Top: Logo + name */}
          <div className="flex items-center gap-4">
  {/* FIXED: restore the original Sharda logo on the desktop login hero */}
  <div className="sidebar-logo-tile w-16 h-16 rounded-2xl overflow-hidden p-1.5 shadow-lg">
    <img 
      src="/sharda-logo.png" 
      alt="Sharda University" 
      className="sidebar-logo-image w-full h-full object-contain"
    />
  </div>
  <div>
    <p className="font-display font-black text-white text-xl leading-none">Sharda University</p>
    <p className="text-blue-300 text-sm font-medium mt-0.5">Greater Noida, India</p>
  </div>
</div>
          {/* Middle: Headline */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
              ⚡ Student Support Portal
            </div>
            <h1 className="font-display font-black text-white text-5xl leading-tight mb-5">
              Get Help,<br />
              <span style={{ background: 'linear-gradient(135deg, #fcd34d, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Stay Focused.
              </span>
            </h1>
            <p className="text-blue-200/80 text-base leading-relaxed max-w-sm">
              Raise support tickets, track progress in real-time, and connect with the right department — all from one place.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8">
              {[
                { emoji: '🎯', text: 'Real-time tracking' },
                { emoji: '💬', text: 'Direct chat' },
                { emoji: '📊', text: 'Live dashboard' },
                { emoji: '🔒', text: 'Secure & private' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-blue-100"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>{f.emoji}</span> {f.text}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex gap-8">
            {[['10K+','Students'], ['99%','Uptime'], ['< 2hr','Response']].map(([val, label]) => (
              <div key={label}>
                <p className="font-display font-black text-white text-2xl">{val}</p>
                <p className="text-blue-300/70 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
         {/* FIXED: restore the original Sharda logo on the mobile login header */}
         <div className="flex lg:hidden items-center gap-3 mb-8">
  <div className="sidebar-logo-tile w-10 h-10 rounded-xl overflow-hidden border border-gray-100 p-1 shadow-sm">
    <img 
      src="/sharda-logo.png" 
      alt="Sharda University" 
      className="sidebar-logo-image w-full h-full object-contain"
    />
  </div>
  <p className="font-display font-bold text-gray-900">Sharda University Helpdesk</p>
</div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-black text-gray-900">Welcome back!</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in with your verified and approved university email account</p>
          </div>

          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
          {success && <div className="mb-4"><Alert type="success" message={success} /></div>}
          {showVerificationHelp ? (
            <div className="mb-4">
              <button type="button" onClick={handleResendVerification} disabled={resendingVerification} className="btn-secondary w-full justify-center">
                {resendingVerification ? 'Sending verification...' : 'Resend verification email'}
              </button>
              {verificationLink ? (
                <a href={verificationLink} className="mt-3 block break-all text-sm font-medium text-blue-600 hover:underline">
                  {verificationLink}
                </a>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  className="input pl-10" placeholder="your.email@sharda.ac.in" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                  className="input pl-10 pr-11" placeholder="••••••••" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
              {loading ? 'Signing in...' : <><span>Sign In</span><FiArrowRight size={16} /></>}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-3">
            <div ref={googleButtonRef} className="flex min-h-[44px] w-full justify-center" />
            {googleLoading ? <p className="text-center text-sm text-gray-500">Signing in with Google...</p> : null}
          </div>

          <div className="mt-5 space-y-2 text-center">
            <p className="text-sm text-gray-500">
              Need access?{' '}
              <Link to="/register" className="text-blue-600 font-semibold hover:underline">View onboarding steps</Link>
            </p>
            <p className="text-sm">
              <Link to="/forgot-password" className="text-blue-600 font-semibold hover:underline">Forgot password?</Link>
            </p>
            <p className="text-xs text-gray-400">
              Accounts are provisioned by admin. Google sign-in only works for existing university accounts after verification and approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
