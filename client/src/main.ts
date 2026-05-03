import "./assets/main.css";
import { initRouter, navigate } from "./lib/router";
import { initAuth, getUser, getToken } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { AppPage } from "./pages/AppPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";

async function main() {
  const app = document.getElementById("app")!;

  // Restore auth state from localStorage
  await initAuth();

  initRouter({
    container: app,
    routes: [
      {
        path: "/",
        render: () => {
          if (getUser() && getToken()) {
            navigate("/app");
            return document.createElement("div");
          }
          navigate("/login");
          return document.createElement("div");
        },
      },
      {
        path: "/login",
        render: () => {
          if (getUser() && getToken()) {
            navigate("/app");
            return document.createElement("div");
          }
          return LoginPage();
        },
      },
      {
        path: "/app",
        render: () => {
          if (!getUser() || !getToken()) {
            navigate("/login");
            return document.createElement("div");
          }
          return AppPage();
        },
      },
      {
        path: "/auth/callback",
        render: () => AuthCallbackPage(),
      },
      {
        path: "*",
        render: () => {
          navigate("/");
          return document.createElement("div");
        },
      },
    ],
  });
}

main().catch(console.error);
