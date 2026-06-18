// Login page — full-screen dark themed login with premium split-pane design
'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { User, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please try again.';
      setError(message);
      toast.error('Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090d14] p-4 font-sans">
      {/* Main Login Container */}
      <div className="relative flex w-full max-w-5xl h-[600px] overflow-hidden rounded-2xl bg-[#121826] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        
        {/* Left Pane - Form */}
        <div className="relative z-10 flex w-full md:w-1/2 flex-col justify-center px-10 md:px-20">
          <h1 className="mb-10 text-4xl font-extrabold tracking-tight text-white">
            Login
          </h1>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Username */}
            <div className="relative border-b border-white/10 pb-2">
              <label htmlFor="username" className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Username
              </label>
              <div className="flex items-center">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  disabled={isSubmitting}
                />
                <User size={16} className="text-slate-500" />
              </div>
            </div>

            {/* Password */}
            <div className="relative border-b border-white/10 pb-2">
              <label htmlFor="password" className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Password
              </label>
              <div className="flex items-center">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <Lock size={16} className="text-slate-500" />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#00c6ff] to-[#0072ff] py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(0,136,255,0.4)] transition-transform hover:-translate-y-0.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Don't have an account? <span className="font-bold text-[#00c6ff] cursor-pointer hover:underline">Sign Up</span>
          </p>
        </div>

        {/* Right Pane - Slanted Blue Area */}
        <div 
          className="absolute bottom-0 right-0 top-0 z-0 hidden w-[55%] flex-col items-center justify-center bg-[#0088ff] md:flex"
          style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
        >
          <div className="pl-20 pr-12 text-center">
            <h2 className="mb-4 text-4xl font-black uppercase tracking-tight text-white drop-shadow-md">
              Welcome Back!
            </h2>
            <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-white/90">
              Enter your credentials to seamlessly access your intelligent dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
