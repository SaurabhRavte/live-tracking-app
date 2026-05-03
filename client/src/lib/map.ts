import L from "leaflet";
import { LiveUser } from "../types";

// Fix Leaflet default icon path issue with bundlers
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
});

type MarkerStore = Map<string, { marker: L.Marker; circle?: L.Circle }>;

let map: L.Map | null = null;
const markers: MarkerStore = new Map();

function createUserIcon(name: string, isCurrentUser = false): L.DivIcon {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const bg = isCurrentUser ? "#f5f5f5" : "#1e1e1e";
  const color = isCurrentUser ? "#0a0a0a" : "#f5f5f5";
  const border = isCurrentUser ? "2px solid #22c55e" : "2px solid #3a3a3a";
  const size = isCurrentUser ? 40 : 36;

  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${bg};
        color:${color};
        border:${border};
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        position:relative;
      ">
        ${initials}
        ${
          isCurrentUser
            ? `<span style="
            position:absolute;bottom:-2px;right:-2px;
            width:10px;height:10px;
            border-radius:50%;
            background:#22c55e;
            border:2px solid #0a0a0a;
          "></span>`
            : ""
        }
      </div>
    `,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

export function initMap(containerId: string): L.Map {
  if (map) return map;

  map = L.map(containerId, {
    center: [20, 0],
    zoom: 3,
    zoomControl: false,
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  ).addTo(map);

  // Custom zoom control (bottom right)
  L.control.zoom({ position: "bottomright" }).addTo(map);

  return map;
}

export function getMap(): L.Map | null {
  return map;
}

export function updateUserMarker(user: LiveUser, currentUserId: string): void {
  if (!map) return;

  const isCurrentUser = user.userId === currentUserId;
  const existing = markers.get(user.userId);

  if (existing) {
    // Smooth position update
    existing.marker.setLatLng([user.latitude, user.longitude]);
    existing.marker.setIcon(createUserIcon(user.userName, isCurrentUser));

    // Update accuracy circle
    if (user.accuracy) {
      if (existing.circle) {
        existing.circle.setLatLng([user.latitude, user.longitude]);
        existing.circle.setRadius(user.accuracy);
      } else {
        const circle = L.circle([user.latitude, user.longitude], {
          radius: user.accuracy,
          color: isCurrentUser ? "#22c55e" : "#f5f5f5",
          fillColor: isCurrentUser ? "#22c55e" : "#f5f5f5",
          fillOpacity: 0.05,
          weight: 1,
          opacity: 0.3,
        }).addTo(map);
        markers.set(user.userId, { ...existing, circle });
      }
    }
  } else {
    // Create new marker
    const marker = L.marker([user.latitude, user.longitude], {
      icon: createUserIcon(user.userName, isCurrentUser),
    }).addTo(map);

    marker.bindPopup(
      `<div style="font-family:'DM Sans',sans-serif;color:#f5f5f5;background:#111;padding:4px 0;min-width:120px">
        <div style="font-weight:600;font-size:13px">${user.userName}</div>
        <div style="font-size:11px;color:#6b6b6b;margin-top:2px">${
          isCurrentUser ? "You" : "Live"
        }</div>
      </div>`,
      {
        className: "tracker-popup",
      }
    );

    let circle: L.Circle | undefined;
    if (user.accuracy) {
      circle = L.circle([user.latitude, user.longitude], {
        radius: user.accuracy,
        color: isCurrentUser ? "#22c55e" : "#f5f5f5",
        fillColor: isCurrentUser ? "#22c55e" : "#f5f5f5",
        fillOpacity: 0.05,
        weight: 1,
        opacity: 0.3,
      }).addTo(map);
    }

    markers.set(user.userId, { marker, circle });
  }
}

export function removeUserMarker(userId: string): void {
  const existing = markers.get(userId);
  if (!existing) return;

  existing.marker.remove();
  existing.circle?.remove();
  markers.delete(userId);
}

export function panToUser(userId: string): void {
  const existing = markers.get(userId);
  if (!existing || !map) return;
  map.panTo(existing.marker.getLatLng(), { animate: true });
}

export function panToCurrentUser(lat: number, lng: number): void {
  if (!map) return;
  map.setView([lat, lng], 15, { animate: true });
}

export function destroyMap(): void {
  if (map) {
    map.remove();
    map = null;
    markers.clear();
  }
}
