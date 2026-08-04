import { useState, type FormEvent } from "react";
import { canAccessDesigner, login, loginOffline, type AuthSession } from "../../services/authService";
import { OFFLINE_CREDENCIALES, estaModoOfflineActivo } from "../../services/offlineMode";
import "./LoginPage.css";

export default function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const offlineInicial = estaModoOfflineActivo();
  const [email, setEmail] = useState(offlineInicial ? OFFLINE_CREDENCIALES.email : "");
  const [password, setPassword] = useState(offlineInicial ? OFFLINE_CREDENCIALES.password : "");
  const [offlineActivo, setOfflineActivo] = useState(offlineInicial);
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

  const entrarOffline = () => {
    setError(null);
    setLoading(true);

    try {
      const session = loginOffline();
      setOfflineActivo(true);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar en modo offline.");
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
          {offlineActivo && (
            <p className="login-offline-aviso" role="status">
              Modo offline activo: no se usa el backend. Credencial de prueba precargada
              ({OFFLINE_CREDENCIALES.email} / {OFFLINE_CREDENCIALES.password}).
            </p>
          )}
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

          <button className="login-button login-button-secondary" type="button" onClick={entrarOffline} disabled={loading}>
            Entrar en modo offline
          </button>
        </form>
      </section>
    </main>
  );
}
