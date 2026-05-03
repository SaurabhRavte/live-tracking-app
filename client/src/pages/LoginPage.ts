import {
  apiLogin,
  apiRegister,
  getGoogleLoginUrl,
  setToken,
  setUser,
} from "../lib/auth";
import { navigate } from "../lib/router";

type Mode = "login" | "register";

export function LoginPage(): HTMLElement {
  let mode: Mode = "login";
  let loading = false;
  let errorMsg = "";

  const page = document.createElement("div");
  page.className =
    "min-h-screen bg-canvas flex items-center justify-center p-4";

  function render() {
    page.innerHTML = `
      <div class="w-full max-w-sm">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" fill="#0a0a0a"/>
                <circle cx="8" cy="8" r="6.5" stroke="#0a0a0a" stroke-width="1.5"/>
              </svg>
            </div>
            <span class="text-lg font-bold tracking-tight text-accent">LiveTrack</span>
          </div>
          <p class="text-sm text-dim">Real-time location sharing</p>
        </div>

        <!-- Card -->
        <div class="card p-6">
          <!-- Tab switcher -->
          <div class="flex mb-6 bg-muted rounded-lg p-1 gap-1">
            <button id="tab-login" class="flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-surface text-accent shadow-sm"
                : "text-dim hover:text-accent"
            }">
              Sign in
            </button>
            <button id="tab-register" class="flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-surface text-accent shadow-sm"
                : "text-dim hover:text-accent"
            }">
              Register
            </button>
          </div>

          <!-- Error -->
          ${
            errorMsg
              ? `<div class="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">${errorMsg}</div>`
              : ""
          }

          <!-- Form -->
          <form id="auth-form" class="space-y-3">
            ${
              mode === "register"
                ? `<div>
                <label class="block text-xs text-dim mb-1.5 font-medium">Name</label>
                <input id="name" type="text" placeholder="Your name" class="input" required />
              </div>`
                : ""
            }
            <div>
              <label class="block text-xs text-dim mb-1.5 font-medium">Email</label>
              <input id="email" type="email" placeholder="you@example.com" class="input" required />
            </div>
            <div>
              <label class="block text-xs text-dim mb-1.5 font-medium">Password</label>
              <input id="password" type="password" placeholder="••••••••" class="input" required minlength="6" />
            </div>

            <button type="submit" id="submit-btn" class="btn-primary w-full mt-1" ${loading ? "disabled" : ""}>
              ${
                loading
                  ? `<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>`
                  : mode === "login"
                  ? "Sign in"
                  : "Create account"
              }
            </button>
          </form>

          <!-- Divider -->
          <div class="flex items-center gap-3 my-4">
            <div class="flex-1 h-px bg-border"></div>
            <span class="text-xs text-dim">or</span>
            <div class="flex-1 h-px bg-border"></div>
          </div>

          <!-- Google -->
          <a href="${getGoogleLoginUrl()}" class="btn-ghost w-full flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>
        </div>

        <p class="text-center text-xs text-dim mt-6">
          Location data is shared only while you're connected
        </p>
      </div>
    `;

    // Tab events
    page.querySelector("#tab-login")?.addEventListener("click", () => {
      mode = "login";
      errorMsg = "";
      render();
    });

    page.querySelector("#tab-register")?.addEventListener("click", () => {
      mode = "register";
      errorMsg = "";
      render();
    });

    // Form submit
    page.querySelector("#auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loading) return;

      const email = (page.querySelector("#email") as HTMLInputElement)?.value;
      const password = (page.querySelector("#password") as HTMLInputElement)
        ?.value;
      const name = (page.querySelector("#name") as HTMLInputElement)?.value;

      loading = true;
      errorMsg = "";
      render();

      try {
        let result: { token: string; user: import("../types").User };

        if (mode === "login") {
          result = await apiLogin(email, password);
        } else {
          result = await apiRegister(email, password, name);
        }

        setToken(result.token);
        setUser(result.user);
        navigate("/app");
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Something went wrong";
        loading = false;
        render();
      }
    });
  }

  render();
  return page;
}
