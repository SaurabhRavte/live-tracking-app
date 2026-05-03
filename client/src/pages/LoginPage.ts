import { clerk } from "../lib/auth";

export function LoginPage(): HTMLElement {
  const page = document.createElement("div");
  page.className =
    "min-h-screen bg-canvas flex items-center justify-center p-4";

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

      <!-- Clerk mounts the sign-in UI here -->
      <div id="clerk-signin"></div>

      <p class="text-center text-xs text-dim mt-6">
        Location data is shared only while you're connected
      </p>
    </div>
  `;

  // Mount Clerk's pre-built SignIn component — handles email/password + Google
  const mountPoint = page.querySelector<HTMLElement>("#clerk-signin")!;

  // Use a tiny delay to ensure the element is in the DOM before mounting
  requestAnimationFrame(() => {
    clerk.mountSignIn(mountPoint, {
      // After sign-in / sign-up Clerk redirects to this path
      afterSignInUrl: "/app",
      afterSignUpUrl: "/app",
      // Show sign-up link inside the sign-in form so users can register
      signUpUrl: "/login",
    });
  });

  return page;
}
