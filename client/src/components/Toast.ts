type ToastType = "info" | "success" | "error" | "warn";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  timer: number;
}

let container: HTMLElement | null = null;
let toasts: Toast[] = [];
let nextId = 0;

function ensureContainer(): HTMLElement {
  if (container) return container;
  container = document.createElement("div");
  container.className =
    "fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none";
  document.body.appendChild(container);
  return container;
}

function render(): void {
  const c = ensureContainer();
  c.innerHTML = "";

  toasts.forEach((t) => {
    const el = document.createElement("div");
    const colors: Record<ToastType, string> = {
      info: "border-border text-accent",
      success: "border-live/30 text-live",
      error: "border-red-500/30 text-red-400",
      warn: "border-yellow-500/30 text-yellow-400",
    };
    el.className = `pointer-events-auto bg-surface border ${colors[t.type]} rounded-lg px-4 py-3 text-sm shadow-xl animate-slide-up`;
    el.textContent = t.message;
    c.appendChild(el);
  });
}

export function toast(message: string, type: ToastType = "info", ms = 3500): void {
  const id = nextId++;
  const timer = window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    render();
  }, ms);

  toasts.push({ id, message, type, timer });
  render();
}
