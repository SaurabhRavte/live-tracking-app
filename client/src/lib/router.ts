type Route = {
  path: string;
  render: () => HTMLElement | Promise<HTMLElement>;
};

type RouterOptions = {
  routes: Route[];
  container: HTMLElement;
};

let routes: Route[] = [];
let container: HTMLElement;

export function initRouter(opts: RouterOptions): void {
  routes = opts.routes;
  container = opts.container;

  window.addEventListener("popstate", () => void renderCurrent());
  renderCurrent();
}

export function navigate(path: string): void {
  window.history.pushState({}, "", path);
  void renderCurrent();
}

async function renderCurrent(): Promise<void> {
  const path = window.location.pathname;

  let route = routes.find((r) => r.path === path);
  if (!route) {
    route = routes.find((r) => r.path === "*");
  }
  if (!route) return;

  const el = await route.render();
  container.innerHTML = "";
  el.classList.add("page-enter");
  container.appendChild(el);
}
