import React, { useState, useEffect } from 'react';
import {
  Package, Lock, Eye, EyeOff, AlertCircle, Loader2, LogIn,
  ChevronLeft, Phone, Mail, ShieldCheck
} from 'lucide-react';
import { User } from './types';
import { supabase, pb, loginWithMobilePassword } from './supabase';

const Login: React.FC<{ onLogin: (user: User) => void; onNavigate?: (v: string) => void }> = ({ onLogin, onNavigate }) => {
  const [mobile, setMobile] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<'credentials' | 'check-email' | 'forgot-email' | 'forgot-reset'>('credentials');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotMobile, setForgotMobile] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [polling, setPolling] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await loginWithMobilePassword(mobile, passkey);
      const userEmail = user.email?.trim() || '';
      if (!userEmail) {
        setError('No email address found for this user. Contact your admin.');
        setLoading(false);
        return;
      }

      setEmail(userEmail);
      setVerifyMessage('Sending verification email...');
      setVerifyError('');
      setStep('check-email');

      // Set verified to false so the poll genuinely waits for the link click
      try {
        const adminEmail = import.meta.env.VITE_POCKETBASE_ADMIN_EMAIL || 'finix8421@gmail.com';
        const adminPass = import.meta.env.VITE_POCKETBASE_ADMIN_PASSWORD || '9822334020';
        await pb.admins.authWithPassword(adminEmail, adminPass);
        const record = await pb.collection('erp_users').getFirstListItem(
          `email = "${userEmail}"`,
          { requestKey: null } as any
        );
        await pb.collection('erp_users').update(record.id, { verified: false }, { requestKey: null } as any);
      } catch {
        // proceed even if admin auth or reset fails
      }

      // Re-auth the user (admin auth replaced the store)
      await loginWithMobilePassword(mobile, passkey);

      await pb.collection('erp_users').requestVerification(userEmail);
      setVerifyMessage(`Verification email sent to ${userEmail}`);
      setPolling(true);
    } catch (err: any) {
      setError(err?.message || 'Invalid mobile number or passkey.');
    } finally {
      setLoading(false);
    }
  };

  const authUserRef = React.useRef<User | null>(null);

  const handleLoginAfterVerify = async () => {
    if (!authUserRef.current) {
      authUserRef.current = await loginWithMobilePassword(mobile, passkey).catch(() => null);
    }
    if (authUserRef.current) {
      onLogin(authUserRef.current);
    }
  };

  useEffect(() => {
    if (!polling) return;
    setVerifyMessage('Waiting for verification...');
    const recordId = pb.authStore.record?.id;
    if (!recordId) {
      setVerifyError('Authentication error. Please go back and try again.');
      setPolling(false);
      return;
    }

    const timer = setInterval(async () => {
      try {
        const record = await pb.collection('erp_users').getOne(recordId, { requestKey: null } as any);
        if (record.verified) {
          clearInterval(timer);
          setPolling(false);
          setVerifyMessage('Email verified! Logging you in...');
          await handleLoginAfterVerify();
        }
      } catch {
        // retry on next tick
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [polling]);

  const handleForgotSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setVerifyError('Enter your email address.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');

    const { data: userData, error: userErr } = await (supabase as any).from('erp_users')
      .select('*')
      .eq('email', trimmedEmail)
      .limit(1);

    if (userErr || !userData || userData.length === 0) {
      setVerifyError('No account found with this email.');
      setVerifyLoading(false);
      return;
    }

    const userRecord = userData[0];
    setEmail(trimmedEmail);
    setForgotMobile(userRecord.mobile || userRecord.username || '');
    setVerifyLoading(false);
    setStep('forgot-reset');
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setVerifyError('Passkey must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setVerifyError('Passkeys do not match.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');

    try {
      await pb.admins.authWithPassword(
        import.meta.env.VITE_POCKETBASE_ADMIN_EMAIL || 'finix8421@gmail.com',
        import.meta.env.VITE_POCKETBASE_ADMIN_PASSWORD || '9822334020'
      );
      const record = await pb.collection('erp_users').getFirstListItem(
        `email = "${email}"`,
        { requestKey: null } as any
      );
      await pb.collection('erp_users').update(record.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      }, { requestKey: null } as any);
      pb.authStore.clear();
    } catch {
      pb.authStore.clear();
      setVerifyError('Failed to reset passkey. Try again.');
      setVerifyLoading(false);
      return;
    }

    try {
      const user = await loginWithMobilePassword(forgotMobile, newPassword);
      onLogin(user);
    } catch {
      setVerifyError('Passkey reset successful. Please log in manually.');
      setStep('credentials');
      setVerifyLoading(false);
    }
  };

  const credentialContent = () => (
    <>
      <div className="px-8 pb-8 pt-14 sm:px-10">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
          <Package size={38} strokeWidth={2.2} />
        </div>
        <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Enter your Passkey</h1>
        <div className="mt-8 flex items-center gap-3 text-sm font-medium text-slate-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#032d60] via-[#0176d3] to-emerald-400 text-white">
            <Package size={20} />
          </div>
          <span>{mobile || 'Registered mobile user'}</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Registered Mobile</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                required
                type="text"
                inputMode="tel"
                placeholder="98XXXXXXXX"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 font-mono text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                required
                type={showPasskey ? 'text' : 'password'}
                placeholder="Enter passkey"
                value={passkey}
                onChange={e => setPasskey(e.target.value)}
                className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPasskey(prev => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label={showPasskey ? 'Hide passkey' : 'Show passkey'}
              >
                {showPasskey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><LogIn size={17} /> Log In</>}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setStep('forgot-email'); setEmail(''); setVerifyError(''); }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Forgot Passkey?
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-center sm:px-10">
        <div className="text-xs font-medium text-slate-500">Authorized Excell Packaging users only</div>
        {onNavigate && (
          <button onClick={() => onNavigate('client-login')} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Client Portal &rarr;
          </button>
        )}
      </div>
    </>
  );

  const checkEmailContent = () => (
    <>
      <div className="px-8 pb-8 pt-14 sm:px-10">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
          <ShieldCheck size={38} strokeWidth={2.2} />
        </div>
        <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Check Your Email</h1>
        <p className="mt-2 text-center text-sm font-medium text-slate-500">
          A verification link was sent to <span className="font-bold text-slate-700">{email}</span>
        </p>

        <div className="mt-8 space-y-5">
          {verifyError && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
              <AlertCircle size={18} />
              {verifyError}
            </div>
          )}

          {polling && (
            <div className="flex items-center justify-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-4 text-sm font-medium text-blue-700 animate-in fade-in">
              <Loader2 className="animate-spin" size={20} />
              Waiting for you to click the link in the email...
            </div>
          )}

          {!polling && verifyMessage && !verifyError && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 animate-in fade-in">{verifyMessage}</div>
          )}

          <button
            onClick={() => { setStep('credentials'); setPolling(false); setVerifyError(''); }}
            className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mx-auto"
          >
            <ChevronLeft size={16} /> Back to Login
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-center sm:px-10">
        <div className="text-xs font-medium text-slate-500">Authorized Excell Packaging users only</div>
      </div>
    </>
  );

  const forgotEmailContent = () => (
    <>
      <div className="px-8 pb-8 pt-14 sm:px-10">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
          <Lock size={38} strokeWidth={2.2} />
        </div>
        <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Forgot Passkey</h1>
        <p className="mt-2 text-center text-sm font-medium text-slate-500">
          Enter your registered email to reset your passkey.
        </p>

        <div className="mt-8 space-y-5">
          {verifyError && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
              <AlertCircle size={18} />
              {verifyError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Registered Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                required
                type="email"
                placeholder="user@excellpackaging.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setVerifyError(''); }}
                className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            onClick={handleForgotSubmit}
            disabled={verifyLoading || !email.trim()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifyLoading ? <Loader2 className="animate-spin" size={18} /> : 'Continue'}
          </button>

          <button
            onClick={() => { setStep('credentials'); setVerifyError(''); }}
            className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mx-auto"
          >
            <ChevronLeft size={16} /> Back to Login
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-center sm:px-10">
        <div className="text-xs font-medium text-slate-500">Authorized Excell Packaging users only</div>
      </div>
    </>
  );

  const forgotResetContent = () => (
    <>
      <div className="px-8 pb-8 pt-14 sm:px-10">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
          <Lock size={38} strokeWidth={2.2} />
        </div>
        <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Reset Passkey</h1>
        <p className="mt-2 text-center text-sm font-medium text-slate-500">
          Enter your new passkey.
        </p>

        <div className="mt-8 space-y-5">
          {verifyError && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
              <AlertCircle size={18} />
              {verifyError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                required
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setVerifyError(''); }}
                className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                required
                type="password"
                placeholder="Re-enter passkey"
                value={confirmNewPassword}
                onChange={e => { setConfirmNewPassword(e.target.value); setVerifyError(''); }}
                className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            onClick={handleResetPassword}
            disabled={verifyLoading || !newPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifyLoading ? <Loader2 className="animate-spin" size={18} /> : 'Reset & Login'}
          </button>

          <button
            onClick={() => { setStep('forgot-email'); setVerifyError(''); }}
            className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mx-auto"
          >
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-center sm:px-10">
        <div className="text-xs font-medium text-slate-500">Authorized Excell Packaging users only</div>
      </div>
    </>
  );

  const cardContent = () => {
    switch (step) {
      case 'credentials': return credentialContent();
      case 'check-email': return checkEmailContent();
      case 'forgot-email': return forgotEmailContent();
      case 'forgot-reset': return forgotResetContent();
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f4f4] text-slate-900 lg:grid lg:grid-cols-2">
      <style>{`
        @keyframes loginFloat { 0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); } 50% { transform: translate3d(0, -18px, 0) rotate(4deg); } }
        @keyframes loginDrift { 0% { transform: translateX(-8%) rotate(-4deg); } 100% { transform: translateX(8%) rotate(4deg); } }
        @keyframes loginPulse { 0%, 100% { opacity: .35; transform: scale(.95); } 50% { opacity: .9; transform: scale(1.05); } }
        @media (prefers-reduced-motion: reduce) { .login-animate { animation: none !important; } }
      `}</style>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 lg:px-8">
        <div className="w-full max-w-[430px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.14)]">
          {cardContent()}
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#0b2ee8] via-[#123ec5] to-[#0622a8] px-10 py-9 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.55),transparent_30%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative z-10 max-w-4xl">
          <p className="text-sm font-bold tracking-wide text-blue-100">Cloud ERP | Excell Packaging</p>
          <h2 className="mt-5 max-w-3xl text-[52px] font-black leading-[1.05] tracking-tight xl:text-[64px]">
            {step === 'credentials' ? 'Control every order from planning to dispatch.' : 'Secure two-factor authentication.'}
          </h2>
          <p className="mt-7 max-w-3xl text-xl font-medium leading-8 text-blue-50/90">
            {step === 'credentials'
              ? 'Real-time production visibility, department queues, QC approvals, alerts, and dispatch tracking in one secure workspace.'
              : 'Every login is verified with a secure email link for enhanced security.'}
          </p>
        </div>

        <div className="relative z-10 mt-12 h-[430px] max-w-4xl overflow-hidden rounded-[34px] border border-white/20 bg-white/10 shadow-2xl shadow-blue-950/40 backdrop-blur-sm">
          <div className="absolute left-10 top-10 h-24 w-24 rounded-[28px] border border-white/20 bg-white/15 login-animate" style={{ animation: 'loginFloat 5.5s ease-in-out infinite' }}>
            {step === 'credentials' ? <Package className="m-7 text-white" size={40} /> : <ShieldCheck className="m-7 text-white" size={40} />}
          </div>
          <div className="absolute right-12 top-16 h-28 w-28 rounded-full bg-cyan-300/80 blur-sm login-animate" style={{ animation: 'loginPulse 4.5s ease-in-out infinite' }} />
          <div className="absolute left-32 top-36 h-56 w-[38rem] rounded-[999px] bg-gradient-to-r from-cyan-300 via-yellow-300 to-red-400 opacity-90 login-animate" style={{ animation: 'loginDrift 7s ease-in-out infinite alternate' }} />
          <div className="absolute bottom-[-74px] right-[-42px] h-72 w-[42rem] rotate-[-7deg] rounded-[44px] border-[10px] border-white/30 bg-slate-950/80 shadow-2xl">
            <div className="grid h-full grid-cols-3 gap-4 p-8">
              {step === 'credentials'
                ? ['Planning', 'QC', 'Dispatch'].map((label, index) => (
                    <div key={label} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                      <div className="h-3 w-16 rounded-full bg-blue-300" />
                      <div className="mt-5 h-20 rounded-2xl bg-white/15" />
                      <div className="mt-4 text-sm font-black text-white">{label}</div>
                      <div className="mt-2 h-2 rounded-full bg-white/15">
                        <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${55 + index * 14}%` }} />
                      </div>
                    </div>
                  ))
                : ['Verify', 'Secure', 'Access'].map((label, index) => (
                    <div key={label} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                      <div className="h-3 w-16 rounded-full bg-blue-300" />
                      <div className="mt-5 h-20 rounded-2xl bg-white/15" />
                      <div className="mt-4 text-sm font-black text-white">{label}</div>
                      <div className="mt-2 h-2 rounded-full bg-white/15">
                        <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${55 + index * 14}%` }} />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
          <div className="absolute left-[40%] top-24 text-6xl font-light text-white/80 login-animate" style={{ animation: 'loginFloat 4s ease-in-out infinite' }}>+</div>
          <div className="absolute right-[33%] top-36 h-10 w-10 rotate-45 rounded-lg bg-cyan-200 login-animate" style={{ animation: 'loginPulse 3.8s ease-in-out infinite' }} />
        </div>
      </section>
    </div>
  );
};

export default Login;
