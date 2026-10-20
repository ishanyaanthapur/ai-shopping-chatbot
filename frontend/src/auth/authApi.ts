// Auth API calls for the Campus Customs FastAPI backend (see backend/main.py).
// All requests use credentials: 'include' so the httponly session cookie is
// sent/stored across the :5173 <-> :8000 origins.
import { API_BASE_URL } from "../api";

export interface AuthUser {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface RegisterFields {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // ignore JSON parse errors and fall back below
  }
  return fallback;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to load current user (status ${res.status})`);
  }
  return res.json();
}

export async function loginRequest(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Invalid email or password"));
  }
  return res.json();
}

export async function registerRequest(fields: RegisterFields): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Could not create account"));
  }
  return res.json();
}

export async function logoutRequest(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
