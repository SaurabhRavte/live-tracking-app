import { LiveUser } from "../types";
import { panToUser } from "../lib/map";

interface SidebarOptions {
  currentUserId: string;
  isSharing: boolean;
  isConnected: boolean;
  onToggleShare: () => void;
  onLogout: () => void;
  onPanToMe: () => void;
}

export class UserSidebar {
  private el: HTMLElement;
  private users: Map<string, LiveUser> = new Map();
  private opts: SidebarOptions;

  constructor(opts: SidebarOptions) {
    this.opts = opts;
    this.el = document.createElement("div");
    this.el.className =
      "w-72 h-full bg-surface border-r border-border flex flex-col shrink-0";
    this.render();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  setUsers(users: LiveUser[]): void {
    this.users.clear();
    users.forEach((u) => this.users.set(u.userId, u));
    this.renderUserList();
  }

  updateUser(user: LiveUser): void {
    this.users.set(user.userId, user);
    this.renderUserList();
  }

  removeUser(userId: string): void {
    this.users.delete(userId);
    this.renderUserList();
  }

  setSharing(isSharing: boolean): void {
    this.opts.isSharing = isSharing;
    this.renderShareButton();
  }

  setConnected(isConnected: boolean): void {
    this.opts.isConnected = isConnected;
    this.renderStatus();
  }

  private render(): void {
    this.el.innerHTML = `
      <!-- Header -->
      <div class="p-4 border-b border-border">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="#0a0a0a"/>
              <circle cx="8" cy="8" r="6.5" stroke="#0a0a0a" stroke-width="1.5"/>
            </svg>
          </div>
          <span class="font-semibold text-sm tracking-tight">LiveTrack</span>
        </div>
        <div id="status-indicator" class="text-xs text-dim flex items-center gap-1.5"></div>
      </div>

      <!-- Share controls -->
      <div class="p-4 border-b border-border space-y-2">
        <div id="share-btn-container"></div>
        <button id="pan-me-btn" class="btn-ghost w-full text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
          Pan to my location
        </button>
      </div>

      <!-- Users list -->
      <div class="flex-1 overflow-y-auto">
        <div class="px-4 pt-3 pb-1">
          <span class="text-xs font-medium text-dim uppercase tracking-wider">Online now</span>
        </div>
        <div id="user-list" class="p-2 space-y-1"></div>
      </div>

      <!-- Footer / Logout -->
      <div class="p-4 border-t border-border">
        <button id="logout-btn" class="btn-danger w-full text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Sign out
        </button>
      </div>
    `;

    this.el.querySelector("#logout-btn")?.addEventListener("click", () => {
      this.opts.onLogout();
    });

    this.el.querySelector("#pan-me-btn")?.addEventListener("click", () => {
      this.opts.onPanToMe();
    });

    this.renderStatus();
    this.renderShareButton();
    this.renderUserList();
  }

  private renderStatus(): void {
    const el = this.el.querySelector("#status-indicator");
    if (!el) return;
    const dot = this.opts.isConnected ? "bg-live" : "bg-red-500";
    const text = this.opts.isConnected ? "Connected" : "Disconnected";
    el.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full ${dot} animate-pulse-dot inline-block"></span>
      <span>${text}</span>
    `;
  }

  private renderShareButton(): void {
    const container = this.el.querySelector("#share-btn-container");
    if (!container) return;

    if (this.opts.isSharing) {
      container.innerHTML = `
        <button id="share-toggle" class="btn-danger w-full text-xs">
          <span class="w-2 h-2 rounded-full bg-red-400 animate-pulse-dot inline-block"></span>
          Stop sharing location
        </button>
      `;
    } else {
      container.innerHTML = `
        <button id="share-toggle" class="btn-primary w-full text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Share my location
        </button>
      `;
    }

    container.querySelector("#share-toggle")?.addEventListener("click", () => {
      this.opts.onToggleShare();
    });
  }

  private renderUserList(): void {
    const list = this.el.querySelector("#user-list");
    if (!list) return;

    if (this.users.size === 0) {
      list.innerHTML = `
        <div class="text-center py-6 text-dim text-xs">
          No one else is online
        </div>
      `;
      return;
    }

    list.innerHTML = "";
    this.users.forEach((user) => {
      const isMe = user.userId === this.opts.currentUserId;
      const item = document.createElement("button");
      item.className =
        "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left";
      item.innerHTML = `
        <div class="relative shrink-0">
          <div class="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-accent">
            ${user.userName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-live border border-surface"></span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-accent truncate">${user.userName}${isMe ? " (you)" : ""}</div>
          <div class="text-xs text-dim font-mono">
            ${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}
          </div>
        </div>
      `;
      item.addEventListener("click", () => {
        panToUser(user.userId);
      });
      list.appendChild(item);
    });
  }
}
