import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Briefcase, User, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, loginWithGoogle } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function LoginPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
      // Navigation is handled by onAuthStateChanged
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login popup was closed. Please try again.");
      } else {
        setError("Failed to login with Google. Please check your connection.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#CDE0CD] opacity-40 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#D2BCA1] opacity-40 rounded-full blur-[100px]"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#FFFFFF] rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 text-center border border-[#D2BCA1] relative z-10"
      >
        <div className="w-20 h-20 bg-[#E8F3E8] rounded-full flex items-center justify-center mx-auto mb-8 border border-[#CDE0CD]">
          <Briefcase className="w-8 h-8 text-[#6F481C]" />
        </div>
        <h1 className="text-4xl font-serif font-semibold text-[#6F481C] mb-4">CVfiy</h1>
        <p className="text-[#7F715F] mb-10 leading-relaxed font-light">
          Sign in or create an account to save your job profiles and screening results securely.
        </p>
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 bg-[#6F481C] text-white py-4 rounded-full font-medium hover:bg-[#5A3A16] transition-all shadow-md shadow-[#6F481C]/20 disabled:opacity-70"
        >
          {isLoggingIn ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <User className="w-5 h-5" />
          )}
          {isLoggingIn ? "Connecting..." : "Continue with Google"}
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full mt-4 flex items-center justify-center gap-3 bg-[#FFFFFF] text-[#7F715F] py-4 rounded-full font-medium hover:bg-[#F5F2ED] border border-[#D2BCA1] transition-all"
        >
          Continue as Guest
        </button>
        {error && (
          <div className="mt-6 flex items-center gap-3 text-[#A76825] text-sm bg-[#F6EFE9] p-4 rounded-2xl border border-[#E6D2C0]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-left">{error}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
