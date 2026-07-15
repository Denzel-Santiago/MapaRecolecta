import { useState } from "react";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/Login/LoginPage";
import MapaPage from "./pages/Mapa/MapaPage";
import { getAuthSession, type AuthSession } from "./services/authService";

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  return (
    <ProtectedRoute session={session} fallback={<LoginPage onAuthenticated={setSession} />}>
      <MapaPage onLogout={() => setSession(null)} />
    </ProtectedRoute>
  );
}
export default App;
