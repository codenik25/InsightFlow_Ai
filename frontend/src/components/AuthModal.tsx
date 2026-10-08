import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isOpen, isRegisterMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (isRegisterMode && !fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegisterMode) {
        await register(trimmedEmail, password, fullName.trim());
        setSuccessMessage('Account created successfully!');
      } else {
        await login(trimmedEmail, password);
        setSuccessMessage('Welcome back!');
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Dark backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#02050A]/75 backdrop-blur-md"
      />

      {/* Centered Glass Panel */}
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[420px] bg-[rgba(6,12,24,0.92)] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(34,211,238,0.08)] p-7 sm:p-8 overflow-hidden select-none"
      >
        {/* Subtle top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-purple-500/50" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with IF Monogram */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[rgba(10,16,30,0.85)] border border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center mb-3.5">
            <span className="font-sans font-black text-white text-[20px] tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">
              IF
            </span>
          </div>

          <h2 className="text-[22px] font-sans font-bold text-white tracking-tight">
            {isRegisterMode ? 'Create an InsightFlow Account' : 'Sign in to InsightFlow'}
          </h2>
          <p className="text-[13px] text-slate-400 font-sans mt-1">
            Access your datasets, models, and decision intelligence.
          </p>
        </div>

        {/* Error / Success Feedback */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[12px] font-sans flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[12px] font-sans flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-[12px] font-sans font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nikunj Rathi"
                className="w-full h-10 px-3.5 rounded-xl bg-[rgba(15,23,42,0.6)] border border-white/10 hover:border-white/20 focus:border-cyan-500/60 focus:bg-[rgba(15,23,42,0.85)] focus:shadow-[0_0_15px_rgba(34,211,238,0.15)] text-[13px] font-sans text-white placeholder-slate-500 outline-none transition-all"
                disabled={isLoading}
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-sans font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nikunj@insightflow.ai"
              className="w-full h-10 px-3.5 rounded-xl bg-[rgba(15,23,42,0.6)] border border-white/10 hover:border-white/20 focus:border-cyan-500/60 focus:bg-[rgba(15,23,42,0.85)] focus:shadow-[0_0_15px_rgba(34,211,238,0.15)] text-[13px] font-sans text-white placeholder-slate-500 outline-none transition-all"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-[12px] font-sans font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-[rgba(15,23,42,0.6)] border border-white/10 hover:border-white/20 focus:border-cyan-500/60 focus:bg-[rgba(15,23,42,0.85)] focus:shadow-[0_0_15px_rgba(34,211,238,0.15)] text-[13px] font-sans text-white placeholder-slate-500 outline-none transition-all"
                disabled={isLoading}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 mt-2 rounded-xl font-sans font-semibold text-[14px] text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isRegisterMode ? 'Creating Account...' : 'Authenticating...'}</span>
              </>
            ) : (
              <>
                <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch between Login / Register */}
        <div className="mt-5 pt-4 border-t border-white/5 text-center">
          {isRegisterMode ? (
            <p className="text-[12px] font-sans text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMessage(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p className="text-[12px] font-sans text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setErrorMessage(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Register
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
