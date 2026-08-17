import { useState } from "react";
import type { FormEvent } from "react";

import { login } from "../api.js";

interface LoginPageProps {
  onAuthenticated: () => void;
}

export const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [email, setEmail] = useState("demo@ghostqa.dev");
  const [password, setPassword] = useState("ghost123");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      await login(email, password);
      onAuthenticated();
    } catch {
      setError("Those demo credentials were not accepted.");
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="eyebrow">Controlled local storefront</div>
        <h1 id="login-heading">Welcome to GhostShop</h1>
        <p className="muted">
          Sign in to continue through the deterministic demo checkout.
        </p>

        <form className="stack" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Email
            <input
              autoComplete="username"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error === undefined ? null : <p className="error-message">{error}</p>}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
};
