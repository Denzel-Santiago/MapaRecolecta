import { useState, type FormEvent } from "react";
import { canAccessDesigner, login, type AuthSession } from "../services/authService";
import "./login.css";

export default function Login({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await login(email.trim(), password);

      if (!canAccessDesigner(session.roleId)) {
        setError("No tienes permisos para acceder al diseñador de rutas.");
        return;
      }

      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Inicio de sesion">
        <div className="login-copy">
          <p className="login-kicker">Recolecta</p>
          <h1>Diseñador de rutas</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <p className="login-error">{error}</p>}

          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@recolecta.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "CARGANDO..." : "ACEPTAR"}
          </button>
        </form>
      </section>
    </main>
  );
}
