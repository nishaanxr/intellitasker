import React, { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Login API
      const res = await axios.post(`${API_URL}/users/login`, {
        email,
        password,
      });

      // Store user including role (IMPORTANT)
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Send to App component
      onLogin(res.data.user);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
          TaskSync Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Error message */}
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@company.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default Login;
