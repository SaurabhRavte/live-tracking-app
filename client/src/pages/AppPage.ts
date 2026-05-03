import { getUser, signOut } from "../lib/auth";
import { navigate } from "../lib/router";
import {
  initMap,
  updateUserMarker,
  removeUserMarker,
  panToCurrentUser,
  destroyMap,
} from "../lib/map";
import {
  connectSocket,
  disconnectSocket,
  sendLocation,
  stopSharing,
  onUsersSnapshot,
  onLocationUpdate,
  onUserLeft,
  onConnect,
  onDisconnect,
  onSocketError,
} from "../lib/socket";
import { UserSidebar } from "../components/UserSidebar";
import { toast } from "../components/Toast";
import { LiveUser } from "../types";

// How often to send location (ms)
const LOCATION_INTERVAL_MS = 5_000;

export function AppPage(): HTMLElement {
  const user = getUser();
  if (!user) {
    navigate("/login");
    return document.createElement("div");
  }

  let isSharing = false;
  let locationInterval: number | null = null;
  let watchId: number | null = null;
  let currentCoords: GeolocationCoordinates | null = null;

  // Unsubscribe functions collected from socket event helpers — called on cleanup
  const unsubs: Array<() => void> = [];

  // ─── Layout ───────────────────────────────────────────────────────────────
  const page = document.createElement("div");
  page.className = "h-screen w-screen flex overflow-hidden bg-canvas";

  const sidebar = new UserSidebar({
    currentUserId: user.id,
    isSharing: false,
    isConnected: false,
    onToggleShare: handleToggleShare,
    onLogout: handleLogout,
    onPanToMe: handlePanToMe,
  });

  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  mapContainer.className = "flex-1 h-full";

  page.appendChild(sidebar.getElement());
  page.appendChild(mapContainer);

  // ─── Init map + socket after DOM mount ────────────────────────────────────
  setTimeout(() => {
    initMap("map");
    void initSocket_();
  }, 50);

  async function initSocket_() {
    try {
      await connectSocket();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not connect to server",
        "error",
      );
      return;
    }

    // Register listeners and collect unsubscribe fns to prevent re-mount buildup
    unsubs.push(
      onConnect(() => {
        sidebar.setConnected(true);
        toast("Connected to live tracker", "success");
      }),

      onDisconnect((reason) => {
        sidebar.setConnected(false);
        toast(`Disconnected: ${reason}`, "warn");
        stopLocationSharing();
      }),

      onSocketError((err) => {
        toast(err.message, "error");
      }),

      onUsersSnapshot((users: LiveUser[]) => {
        sidebar.setUsers(users);
        users.forEach((u) => updateUserMarker(u, user.id));
      }),

      onLocationUpdate((update) => {
        const liveUser: LiveUser = {
          userId: update.userId,
          userName: update.userName,
          avatarUrl: update.avatarUrl,
          latitude: update.latitude,
          longitude: update.longitude,
          accuracy: update.accuracy,
          lastSeen: update.timestamp,
        };
        sidebar.updateUser(liveUser);
        updateUserMarker(liveUser, user.id);
      }),

      onUserLeft(({ userId }) => {
        sidebar.removeUser(userId);
        removeUserMarker(userId);
        toast("A user went offline", "info", 2000);
      }),
    );
  }

  // ─── Location sharing ──────────────────────────────────────────────────────

  function handleToggleShare() {
    if (isSharing) {
      stopLocationSharing();
    } else {
      startLocationSharing();
    }
  }

  function startLocationSharing() {
    if (!navigator.geolocation) {
      toast("Geolocation is not supported by your browser", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentCoords = pos.coords;
        isSharing = true;
        sidebar.setSharing(true);

        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
        );
        panToCurrentUser(pos.coords.latitude, pos.coords.longitude);

        watchId = navigator.geolocation.watchPosition(
          (p) => {
            currentCoords = p.coords;
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 },
        );

        locationInterval = window.setInterval(() => {
          if (currentCoords) {
            sendLocation(
              currentCoords.latitude,
              currentCoords.longitude,
              currentCoords.accuracy,
            );
          }
        }, LOCATION_INTERVAL_MS);

        toast("Location sharing started", "success");
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied",
          2: "Location unavailable",
          3: "Location request timed out",
        };
        toast(messages[err.code] ?? "Failed to get location", "error");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function stopLocationSharing() {
    isSharing = false;
    sidebar.setSharing(false);

    if (locationInterval) {
      clearInterval(locationInterval);
      locationInterval = null;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    stopSharing();
  }

  function handlePanToMe() {
    if (!currentCoords) {
      toast("Start sharing your location first", "warn");
      return;
    }
    panToCurrentUser(currentCoords.latitude, currentCoords.longitude);
  }

  async function handleLogout() {
    stopLocationSharing();
    // Remove all socket event listeners before disconnecting
    unsubs.forEach((fn) => fn());
    unsubs.length = 0;
    disconnectSocket();
    destroyMap();
    await signOut();
    navigate("/login");
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    stopLocationSharing();
    disconnectSocket();
  });

  return page;
}
