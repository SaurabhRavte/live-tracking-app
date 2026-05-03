import "./assets/main.css";
import { initRouter, navigate } from "./lib/router";
import { initAuth, getUser, clerk } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { AppPage } from "./pages/AppPage";

async function main() {
  const app = document.getElementById("app")!;

  // Load Clerk and restore auth state
  await initAuth();

  initRouter({
    container: app,
    routes: [
      {
        path: "/",
        render: () => {
          if (clerk.session) {
            navigate("/app");
          } else {
            navigate("/login");
          }
          return document.createElement("div");
        },
      },
      {
        path: "/login",
        render: () => {
          if (clerk.session) {
            navigate("/app");
            return document.createElement("div");
          }
          return LoginPage();
        },
      },
      {
        path: "/app",
        render: () => {
          if (!clerk.session) {
            navigate("/login");
            return document.createElement("div");
          }
          return AppPage();
        },
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

  // Redirect to /login automatically when user signs out via Clerk
  clerk.addListener(({ session }) => {
    if (!session && window.location.pathname === "/app") {
      navigate("/login");
    }
  });
}

main().catch(console.error);
