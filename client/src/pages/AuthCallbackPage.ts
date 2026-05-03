import { apiGetMe, setToken, setUser } from "../lib/auth";
import { navigate } from "../lib/router";

export function AuthCallbackPage(): HTMLElement {
  const page = document.createElement("div");
  page.className =
    "min-h-screen bg-canvas flex items-center justify-center";
  page.innerHTML = `
    <div class="flex flex-col items-center gap-3">
      <svg class="animate-spin w-6 h-6 text-dim" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span class="text-sm text-dim">Completing sign in...</span>
    </div>
  `;

  // Process token from URL params
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token) {
    setToken(token);
    apiGetMe(token)
      .then((user) => {
        setUser(user);
        navigate("/app");
      })
      .catch(() => {
        navigate("/login?error=callback_failed");
      });
  } else {
    navigate("/login?error=no_token");
  }

  return page;
}
