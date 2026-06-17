import React, { useState, useEffect, useRef } from 'react';
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

  const [step, setStep] = useState<'credentials' | 'otp-verify' | 'forgot-email' | 'forgot-otp' | 'forgot-reset'>('credentials');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [forgotMobile, setForgotMobile] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EMAIL_RELAY_URL = import.meta.env.VITE_EMAIL_RELAY_URL || 'http://127.0.0.1:8092';

  const clearCooldown = () => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
    setResendCooldown(0);
  };

  const startResendCooldown = () => {
    clearCooldown();
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearCooldown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => clearCooldown();
  }, []);

  const sendOtpEmail = async (targetEmail: string): Promise<boolean> => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: storeErr } = await supabase.from('otps').insert([{
      email: targetEmail,
      otp: otpCode,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used: false,
    }]);

    if (storeErr) {
      console.error('Failed to store OTP:', storeErr);
      return false;
    }

    try {
      const res = await fetch(`${EMAIL_RELAY_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject: 'Excell ERP - Your OTP Code',
          text: `Your OTP code is: ${otpCode}\n\nThis code expires in 5 minutes.\n\n\u2013 Excell Packaging ERP`,
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
<tr><td style="background:#0176d3;padding:32px;text-align:center">
<h1 style="color:#fff;font-size:22px;margin:0;font-weight:700">Excell Packaging ERP</h1>
</td></tr>
<tr><td style="padding:32px;text-align:center">
<p style="color:#333;font-size:15px;margin:0 0 24px">Your OTP verification code</p>
<div style="background:#f0f7ff;border-radius:12px;padding:20px;margin:0 0 24px;letter-spacing:10px;font-size:36px;font-weight:800;color:#0176d3;font-family:monospace">${otpCode}</div>
<p style="color:#666;font-size:13px;margin:0">This code expires in <strong>5 minutes</strong>.</p>
<p style="color:#999;font-size:12px;margin:24px 0 0">If you didn't request this, please ignore this email.</p>
</td></tr>
<tr><td style="background:#f8f9fb;padding:16px;text-align:center;border-top:1px solid #eee">
<p style="color:#999;font-size:11px;margin:0">&copy; 2026 Excell Packaging. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        }),
      });
      if (!res.ok) console.warn('Email relay returned non-OK:', await res.text());
    } catch (sendErr) {
      console.warn('Email relay unavailable.', sendErr);
    }

    return true;
  };

  const verifyOtpFromDb = async (targetEmail: string, otpCode: string): Promise<boolean> => {
    const { data, error: fetchErr } = await supabase
      .from('otps')
      .select('*')
      .eq('email', targetEmail)
      .eq('otp', otpCode)
      .eq('used', false)
      .order('id', { ascending: false })
      .limit(1);

    if (fetchErr || !data || data.length === 0) return false;

    const record = data[0];
    const expiresAt = new Date(record.expires_at).getTime();
    if (Date.now() > expiresAt) return false;

    await supabase.from('otps').update({ used: true }).eq('id', record.id);
    return true;
  };

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
      setPendingUser(user);
      setOtpMessage('Sending OTP...');
      setOtpError('');
      setStep('otp-verify');
      setOtp('');
      startResendCooldown();

      const sent = await sendOtpEmail(userEmail);
      setOtpMessage(sent ? `Code sent to ${userEmail}` : 'Failed to send OTP. Try resend.');
      if (!sent) setOtpError('Email relay unavailable. Try resend or contact admin.');
    } catch (err: any) {
      setError(err?.message || 'Invalid mobile number or passkey.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setOtpError('Enter a valid 6-digit OTP.');
      return;
    }
    setOtpSending(true);
    setOtpError('');

    const valid = await verifyOtpFromDb(email, otp.trim());
    if (!valid) {
      setOtpError('Invalid or expired OTP. Request a new one.');
      setOtpSending(false);
      return;
    }

    if (pendingUser) {
      clearCooldown();
      onLogin(pendingUser);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    setOtpMessage('Resending...');
    startResendCooldown();
    const sent = await sendOtpEmail(email);
    setOtpMessage(sent ? `Code resent to ${email}` : 'Failed to send OTP.');
    if (!sent) setOtpError('Failed to resend OTP.');
  };

  const handleForgotSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setOtpError('Enter your email address.');
      return;
    }

    setOtpSending(true);
    setOtpError('');
    setOtpMessage('');

    const { data: userData, error: userErr } = await supabase
      .from('erp_users')
      .select('*')
      .eq('email', trimmedEmail)
      .limit(1);

    if (userErr || !userData || userData.length === 0) {
      setOtpError('No account found with this email.');
      setOtpSending(false);
      return;
    }

    const userRecord = userData[0];
    setEmail(trimmedEmail);
    setForgotMobile(userRecord.mobile || userRecord.username || '');
    startResendCooldown();

    const sent = await sendOtpEmail(trimmedEmail);
    setOtpSending(false);

    if (sent) {
      setOtpMessage(`Code sent to ${trimmedEmail}`);
      setStep('forgot-otp');
    } else {
      setOtpError('Failed to send OTP. Try again.');
    }
  };

  const handleForgotVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setOtpError('Enter a valid 6-digit OTP.');
      return;
    }
    setOtpSending(true);
    setOtpError('');

    const valid = await verifyOtpFromDb(email, otp.trim());
    if (!valid) {
      setOtpError('Invalid or expired OTP.');
      setOtpSending(false);
      return;
    }

    clearCooldown();
    setStep('forgot-reset');
    setOtpSending(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setOtpError('Passkey must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setOtpError('Passkeys do not match.');
      return;
    }

    setOtpSending(true);
    setOtpError('');

    try {
      await pb.admins.authWithPassword(
        import.meta.env.VITE_POCKETBASE_ADMIN_EMAIL || 'finix8421@gmail.com',
        import.meta.env.VITE_POCKETBASE_ADMIN_PASSWORD || '9822334020'
      );
      const userRecord = await pb.collection('erp_users').getFirstListItem(
        `email = "${email}"`,
        { requestKey: null }
      );
      await pb.collection('erp_users').update(userRecord.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      }, { requestKey: null });
      pb.authStore.clear();
    } catch {
      pb.authStore.clear();
      setOtpError('Failed to reset passkey. Try again.');
      setOtpSending(false);
      return;
    }

    try {
      const user = await loginWithMobilePassword(forgotMobile, newPassword);
      clearCooldown();
      onLogin(user);
    } catch {
      setOtpError('Passkey reset successful. Please log in manually.');
      setStep('credentials');
      setOtpSending(false);
    }
  };

  const resetToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setOtpError('');
    setOtpMessage('');
    setEmail('');
    setPendingUser(null);
    setForgotMobile('');
    clearCooldown();
  };

  const showForgotPasskey = () => {
    setStep('forgot-email');
    setEmail('');
    setOtpError('');
    setOtpMessage('');
  };

  const cardContent = () => {
    switch (step) {
      case 'credentials':
        return (
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
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Log In <LogIn size={17} /></>}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={showForgotPasskey}
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

      case 'otp-verify':
        return (
          <>
            <div className="px-8 pb-8 pt-14 sm:px-10">
              <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
                <ShieldCheck size={38} strokeWidth={2.2} />
              </div>
              <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Verify Your Identity</h1>
              <p className="mt-2 text-center text-sm font-medium text-slate-500">
                Code sent to <span className="font-bold text-slate-700">{email}</span>
              </p>

              <div className="mt-8 space-y-5">
                {otpError && (
                  <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
                    <AlertCircle size={18} />
                    {otpError}
                  </div>
                )}
                {otpMessage && !otpError && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 animate-in fade-in">
                    {otpMessage}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Enter 6-Digit OTP</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    className="w-full rounded-md border border-slate-400 bg-white py-2.5 px-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={otpSending || otp.trim().length !== 6}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSending ? <Loader2 className="animate-spin" size={18} /> : 'Verify'}
                </button>

                <div className="text-center">
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || otpSending}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <button
                  onClick={resetToCredentials}
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

      case 'forgot-email':
        return (
          <>
            <div className="px-8 pb-8 pt-14 sm:px-10">
              <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
                <Lock size={38} strokeWidth={2.2} />
              </div>
              <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Forgot Passkey</h1>
              <p className="mt-2 text-center text-sm font-medium text-slate-500">
                Enter your registered email to receive an OTP.
              </p>

              <div className="mt-8 space-y-5">
                {otpError && (
                  <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
                    <AlertCircle size={18} />
                    {otpError}
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
                      onChange={e => { setEmail(e.target.value); setOtpError(''); }}
                      className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <button
                  onClick={handleForgotSendOtp}
                  disabled={otpSending || !email.trim()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSending ? <Loader2 className="animate-spin" size={18} /> : 'Send OTP'}
                </button>

                <button
                  onClick={resetToCredentials}
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

      case 'forgot-otp':
        return (
          <>
            <div className="px-8 pb-8 pt-14 sm:px-10">
              <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
                <ShieldCheck size={38} strokeWidth={2.2} />
              </div>
              <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Verify Email</h1>
              <p className="mt-2 text-center text-sm font-medium text-slate-500">
                Code sent to <span className="font-bold text-slate-700">{email}</span>
              </p>

              <div className="mt-8 space-y-5">
                {otpError && (
                  <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
                    <AlertCircle size={18} />
                    {otpError}
                  </div>
                )}
                {otpMessage && !otpError && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 animate-in fade-in">
                    {otpMessage}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Enter 6-Digit OTP</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    className="w-full rounded-md border border-slate-400 bg-white py-2.5 px-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  onClick={handleForgotVerifyOtp}
                  disabled={otpSending || otp.trim().length !== 6}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSending ? <Loader2 className="animate-spin" size={18} /> : 'Verify'}
                </button>

                <div className="text-center">
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || otpSending}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <button
                  onClick={() => { setStep('forgot-email'); setOtp(''); setOtpError(''); }}
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

      case 'forgot-reset':
        return (
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
                {otpError && (
                  <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in">
                    <AlertCircle size={18} />
                    {otpError}
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
                      onChange={e => { setNewPassword(e.target.value); setOtpError(''); }}
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
                      onChange={e => { setConfirmNewPassword(e.target.value); setOtpError(''); }}
                      className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={otpSending || !newPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSending ? <Loader2 className="animate-spin" size={18} /> : 'Reset & Login'}
                </button>

                <button
                  onClick={() => { setStep('forgot-otp'); setOtpError(''); }}
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
              : 'Every login is verified with an email OTP for enhanced security.'}
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
