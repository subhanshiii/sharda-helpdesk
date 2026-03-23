import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import { Alert } from '../components/ui';

const ShardaLogo = () => (
  <svg width="52" height="62" viewBox="0 0 80 95" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="40,8 44,26 36,26" fill="white"/>
    <ellipse cx="40" cy="56" rx="8" ry="22" fill="#f59e0b"/>
    <ellipse cx="40" cy="56" rx="7" ry="19" fill="#ec4899" transform="rotate(35,40,56)"/>
    <ellipse cx="40" cy="56" rx="7" ry="19" fill="#06b6d4" transform="rotate(-35,40,56)"/>
    <ellipse cx="40" cy="56" rx="6" ry="17" fill="#10b981" transform="rotate(65,40,56)"/>
    <ellipse cx="40" cy="56" rx="6" ry="17" fill="#10b981" transform="rotate(-65,40,56)"/>
    <ellipse cx="40" cy="56" rx="5" ry="14" fill="#f97316" transform="rotate(90,40,56)"/>
  </svg>
);

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    const result = await login(form.email, form.password);
    if (result.success) { toast.success('Welcome back!'); navigate('/dashboard'); }
    else setError(result.message);
  };

  const demoLogin = async (email, password) => {
    const result = await login(email, password);
    if (result.success) { toast.success('Logged in!'); navigate('/dashboard'); }
    else toast.error('Demo login failed — make sure the backend is running and seeded.');
  };

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
  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white p-1.5 shadow-lg">
    <img 
      src="/sharda-logo.png" 
      alt="Sharda University" 
      className="w-full h-full object-contain"
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
         <div className="flex lg:hidden items-center gap-3 mb-8">
  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-gray-100 p-1 shadow-sm">
    <img 
      src="/sharda-logo.png" 
      alt="Sharda University" 
      className="w-full h-full object-contain"
    />
  </div>
  <p className="font-display font-bold text-gray-900">Sharda University Helpdesk</p>
</div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your helpdesk account</p>
          </div>

          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

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

          <p className="text-center text-sm text-gray-500 mt-5">
            Don't have an account?{' '}
        
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">Register here</Link> 
            <p>
            <Link to="/forgot-password" className="text-blue-600 font-semibold hover:underline">Forgot password?</Link></p>
          </p>

          {/* Demo accounts */}
          <div className="mt-6 p-4 rounded-2xl border border-gray-100" style={{ background: '#f8faff' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Demo Access</p>
            <div className="space-y-2">
              {[
                { label: 'Admin',   email: 'admin@sharda.ac.in',      pass: 'admin123',   color: 'from-violet-500 to-purple-600' },
                { label: 'Agent',   email: 'it.support@sharda.ac.in', pass: 'agent123',   color: 'from-blue-500 to-cyan-500' },
                { label: 'Student', email: 'student@sharda.ac.in',    pass: 'student123', color: 'from-emerald-500 to-teal-500' },
              ].map((d) => (
                <button key={d.label} type="button" onClick={() => demoLogin(d.email, d.pass)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-sm transition-all text-left">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${d.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {d.label[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{d.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{d.email}</p>
                  </div>
                  <FiArrowRight size={13} className="ml-auto text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
