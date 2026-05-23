import React, { useState } from "react";
import axios from "axios";

const API_URL = "https://intellitasker.onrender.com/api";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempUserId, setTempUserId] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_URL}/login`, {
        email,
        password,
      });

      if (res.data.requires2FA) {
        setRequires2FA(true);
        setTempUserId(res.data.userId);
        setLoading(false);
        return;
      }

      localStorage.setItem("user", JSON.stringify(res.data));
      onLogin(res.data);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_URL}/login/2fa`, {
        userId: tempUserId,
        token: twoFactorCode
      });
      localStorage.setItem("user", JSON.stringify(res.data));
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid 2FA code");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");

    try {
      const res = await axios.post(`${API_URL}/users/forgot-password`, {
        email: forgotEmail
      });
      setForgotMessage(res.data.message || "Temporary password sent to your email.");
    } catch (err) {
      setForgotMessage(err.response?.data?.message || "Error: Could not reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e10] p-4 font-sans text-[#eeeeee]">
      <div className="w-full max-w-[400px]">
        <div className="mb-10 text-center">
           <div className="w-10 h-10 mx-auto rounded-lg bg-white flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
               <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
           </div>
           <h1 className="text-xl font-medium tracking-tight text-[#eeeeee]">Log in to IntelliTasker</h1>
           <p className="text-sm text-[#8a8f98] mt-2">Enter your email and password to continue</p>
        </div>

        {!requires2FA ? (
        <form onSubmit={handleLogin} className="space-y-4">
           {error && (
             <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-lg text-center border border-red-500/20">
               {error}
             </div>
           )}

           <div>
             <input
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               className="w-full bg-[#151516] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors placeholder:text-[#8a8f98]"
               placeholder="Enter your email"
               required
             />
           </div>

           <div>
             <input
               type="password"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full bg-[#151516] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors placeholder:text-[#8a8f98]"
               placeholder="Password"
               required
             />
           </div>

           <button
             type="submit"
             disabled={loading}
             className="w-full bg-white text-black font-medium py-2.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm mt-2"
           >
             Continue
           </button>
        </form>
        ) : (
        <form onSubmit={handle2FASubmit} className="space-y-4">
           {error && (
             <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-lg text-center border border-red-500/20">
               {error}
             </div>
           )}
           <div className="text-center mb-4 text-[#8a8f98] text-sm">
              Please enter the 6-digit code from your authenticator app.
           </div>
           <div>
             <input
               type="text"
               value={twoFactorCode}
               onChange={(e) => setTwoFactorCode(e.target.value)}
               className="w-full bg-[#151516] border border-[#27272a] rounded-lg px-4 py-2.5 text-center tracking-widest text-lg text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors placeholder:text-[#8a8f98]/50"
               placeholder="000000"
               maxLength={6}
               required
             />
           </div>

           <button
             type="submit"
             disabled={loading}
             className="w-full bg-white text-black font-medium py-2.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm mt-2"
           >
             {loading ? "Signing in..." : "Continue"}
           </button>
        </form>
        )}

        <div className="mt-8 flex justify-between text-xs text-[#8a8f98]">
           <button onClick={() => setShowForgotModal(true)} className="hover:text-white transition-colors">Forgot password?</button>
           <button onClick={() => alert("Please ask an admin to create an account for you.")} className="hover:text-white transition-colors">Contact admin</button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#151516] border border-[#27272a] rounded-xl overflow-hidden p-6 shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-2">Reset Password</h3>
            <p className="text-[#8a8f98] text-sm mb-6">Enter your email address to receive a temporary password.</p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#0e0e10] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors"
                  placeholder="name@company.com"
                  required
                />
              </div>

              {forgotMessage && (
                <div className={`p-3 rounded-lg text-sm text-center border ${forgotMessage.includes('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {forgotMessage}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending...' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 rounded-lg bg-transparent text-[#8a8f98] text-sm font-medium hover:text-[#eeeeee] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
