import { useAuth } from "./hooks/useAuth";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { OfflineBanner } from "./components/OfflineBanner";
import { AuthScreen } from "./screens/AuthScreen";
import { AuthedApp } from "./screens/AuthedApp";

export default function App() {
  const { token, login, logout } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && <OfflineBanner />}
      {token ? (
        <AuthedApp token={token} onLogout={logout} />
      ) : (
        <AuthScreen onLogin={login} />
      )}
    </>
  );
}
