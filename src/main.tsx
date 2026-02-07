import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { UserRoleProvider } from "./contexts/UserRoleContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <UserRoleProvider>
      <App />
    </UserRoleProvider>
  </AuthProvider>
);
