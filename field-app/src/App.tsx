import { AuthProvider, RequireAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./screens/LoginScreen";
import { EquipamentosScreen } from "./screens/EquipamentosScreen";

export function App() {
  return (
    <AuthProvider>
      <RequireAuth fallback={<LoginScreen />}>
        <EquipamentosScreen />
      </RequireAuth>
    </AuthProvider>
  );
}
