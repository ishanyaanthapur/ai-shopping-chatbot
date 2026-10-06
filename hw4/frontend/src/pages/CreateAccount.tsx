import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AuthForm.css";
import { useAuth } from "../auth/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateAccount() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!firstName.trim()) newErrors.push("First name is required.");
    if (!lastName.trim()) newErrors.push("Last name is required.");
    if (!email.trim()) newErrors.push("Email is required.");
    else if (!EMAIL_PATTERN.test(email.trim())) newErrors.push("Please enter a valid email address.");
    if (!password) newErrors.push("Password is required.");
    else if (password.length < 8) newErrors.push("Password must be at least 8 characters.");
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.push("Passwords do not match.");
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      navigate("/");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Could not create account"]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="ca-first-name">First name</label>
          <input
            id="ca-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Eli"
          />

          <label htmlFor="ca-last-name">Last name</label>
          <input
            id="ca-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Yale"
          />

          <label htmlFor="ca-email">Email</label>
          <input
            id="ca-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yale.edu"
          />

          <label htmlFor="ca-password">Password</label>
          <input
            id="ca-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <label htmlFor="ca-confirm-password">Confirm password</label>
          <input
            id="ca-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
