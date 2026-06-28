// app/login/page.tsx
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-8 font-sans">
      <div className="w-full max-w-sm bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 hover:border-[#3a3a3a] transition-colors duration-200">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
          Login
        </h1>
        <p className="text-sm text-[#a1a1aa] mb-6">
          Sign in to manage your Horizon OS account.
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-[#ef4444] bg-[#ef4444]/10 px-4 py-3 text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">
              Username
            </label>
            <div className="relative flex items-center">
              <User size={16} className="absolute left-3 text-[#52525b]" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#0070f3] transition-colors duration-150 disabled:opacity-50"
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3 text-[#52525b]" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#0070f3] transition-colors duration-150 disabled:opacity-50"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full flex items-center justify-center bg-[#0070f3] hover:bg-[#0060d3] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#a1a1aa]">
          Don't have an account? <span className="font-medium text-[#0070f3] cursor-pointer hover:text-[#0060d3] transition-colors">Sign Up</span>
        </p>
      </div>
    </div>
  );
}
