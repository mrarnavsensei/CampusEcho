'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLogin() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json<any>();
      
      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#080808] p-4 font-sans">
      <div className="w-full max-w-md bg-[#111111] border border-[#2A2A2A] rounded-lg p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            CampusCrate Echo <span className="text-[#E50914]">Admin</span>
          </h1>
          <p className="text-[#A3A3A3] text-sm">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              disabled={!ready || loading}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#181818] border-[#2A2A2A] text-white focus:border-[#E50914] focus:ring-[#E50914]"
              placeholder="admin@campuscrate.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={!ready || loading}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#181818] border-[#2A2A2A] text-white focus:border-[#E50914] focus:ring-[#E50914] pr-10"
                placeholder="••••••••"
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                type="button"
                disabled={!ready || loading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-[#E50914]/10 border border-[#E50914]/20 rounded text-[#ff8a91] text-sm text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={!ready || loading}
            className="w-full bg-[#E50914] hover:bg-[#ff0a16] text-white py-2 h-10 transition-colors"
          >
            {loading ? <><Loader2 aria-hidden="true" className="animate-spin" size={16} /> Signing in…</> : 'Sign in to Admin'}
          </Button>
        </form>

        <div className="mt-8 text-center text-xs text-[#A3A3A3]">
          Access restricted to authorized personnel only.
        </div>
      </div>
    </div>
  );
}
