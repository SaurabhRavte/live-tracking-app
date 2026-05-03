import { getUser, clearToken, setUser } from "../lib/auth";
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
  let isConnected = false;
  let locationInterval: number | null = null;
  let watchId: number | null = null;
  let currentCoords: GeolocationCoordinates | null = null;

  // ─── Layout ──────────────────────────────────────────────────────────────
  const page = document.createElement("div");
  page.className = "h-screen w-screen flex overflow-hidden bg-canvas";

  // Sidebar
  const sidebar = new UserSidebar({
    currentUserId: user.id,
    isSharing: false,
    isConnected: false,
    onToggleShare: handleToggleShare,
    onLogout: handleLogout,
    onPanToMe: handlePanToMe,
  });

  // Map container
  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  mapContainer.className = "flex-1 h-full";

  page.appendChild(sidebar.getElement());
  page.appendChild(mapContainer);

  // ─── Init map after DOM mount ─────────────────────────────────────────
  setTimeout(() => {
    initMap("map");
    initSocket_();
  }, 50);

  function initSocket_() {
    try {
      connectSocket();
    } catch (err) {
      toast("Could not connect to server", "error");
      return;
    }

    onConnect(() => {
      isConnected = true;
      sidebar.setConnected(true);
      toast("Connected to live tracker", "success");
    });

    onDisconnect((reason) => {
      isConnected = false;
      sidebar.setConnected(false);
      toast(`Disconnected: ${reason}`, "warn");
      stopLocationSharing();
    });

    onSocketError((err) => {
      toast(err.message, "error");
    });

    onUsersSnapshot((users: LiveUser[]) => {
      sidebar.setUsers(users);
      users.forEach((u) => updateUserMarker(u, user.id));
    });

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
    });

    onUserLeft(({ userId }) => {
      sidebar.removeUser(userId);
      removeUserMarker(userId);
      toast(`A user went offline`, "info", 2000);
    });
  }

  // ─── Location sharing ─────────────────────────────────────────────────

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

        // Send immediately
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy
        );
        panToCurrentUser(pos.coords.latitude, pos.coords.longitude);

        // Set up continuous watch
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            currentCoords = p.coords;
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        );

        // Send on interval
        locationInterval = window.setInterval(() => {
          if (currentCoords) {
            sendLocation(
              currentCoords.latitude,
              currentCoords.longitude,
              currentCoords.accuracy
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
      { enableHighAccuracy: true, timeout: 15000 }
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
    toast("Location sharing stopped", "info");
  }

  function handlePanToMe() {
    if (!currentCoords) {
      toast("Start sharing your location first", "warn");
      return;
    }
    panToCurrentUser(currentCoords.latitude, currentCoords.longitude);
  }

  function handleLogout() {
    stopLocationSharing();
    disconnectSocket();
    destroyMap();
    clearToken();
    setUser(null);
    navigate("/login");
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    stopLocationSharing();
    disconnectSocket();
  });

  return page;
}
