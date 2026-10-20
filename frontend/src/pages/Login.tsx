import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AuthForm.css";
import { useAuth } from "../auth/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!email.trim()) newErrors.push("Email is required.");
    else if (!EMAIL_PATTERN.test(email.trim())) newErrors.push("Please enter a valid email address.");

    if (!password) newErrors.push("Password is required.");

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Invalid email or password"]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1>Log In</h1>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yale.edu"
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {errors.length > 0 && (
            <ul className="auth-errors">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}

          <button type="submit" className="btn auth-submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>
        <p className="auth-switch">
          New to Campus Customs? <Link to="/create-account">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
