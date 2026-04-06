import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import { db, auth } from "./firebaseConfig.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// Global map instance
let map = null;
let reportPoints = [];
let reportMarkers = [];
let currentPopup = null;

const appState = {
  userLngLat: null,
  travelMode: "foot-walking",
  pendingDestination: null,
  markersVisible: true,
};

let locations = [];

async function loadLocations() {
  const snapshot = await getDocs(collection(db, "monitor_points"));

  locations = snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    lat: doc.data().lat,
    lng: doc.data().lng,
  }));
}

// Map init
function showMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  injectMapExtras();

  map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    center: [-123.00163752324765, 49.25324576104826],
    zoom: 10,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.once("load", async () => {
    addUserPin();
    await addReportMarkers();
    await loadLocations();
    addSearchControl();
  });

  map.on("click", () => {
    closeCurrentPopup();
  });
}

// Add legend + toggle around map
function injectMapExtras() {
  if (document.getElementById("map-extras")) return;

  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  const wrapper = document.createElement("div");
  wrapper.id = "map-extras";
  wrapper.style.display = "flex";
  wrapper.style.flexWrap = "wrap";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "12px";
  wrapper.style.marginBottom = "12px";

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-markers-btn";
  toggleBtn.textContent = "Hide Markers";
  toggleBtn.className = "btn btn-outline-primary btn-sm";

  toggleBtn.addEventListener("click", () => {
    appState.markersVisible = !appState.markersVisible;

    reportMarkers.forEach((marker) => {
      if (appState.markersVisible) {
        marker.addTo(map);
      } else {
        marker.remove();
      }
    });

    if (!appState.markersVisible) {
      closeCurrentPopup();
    }

    toggleBtn.textContent = appState.markersVisible
      ? "Hide Markers"
      : "Show Markers";
  });

  const legend = document.createElement("div");
  legend.style.display = "flex";
  legend.style.flexWrap = "wrap";
  legend.style.alignItems = "center";
  legend.style.gap = "10px";
  legend.style.padding = "8px 12px";
  legend.style.border = "1px solid #ddd";
  legend.style.borderRadius = "10px";
  legend.style.backgroundColor = "#f8f9fa";
  legend.style.fontSize = "14px";

  const legendTitle = document.createElement("strong");
  legendTitle.textContent = "Legend:";
  legend.appendChild(legendTitle);

  legend.appendChild(makeLegendItem("green", "Quiet"));
  legend.appendChild(makeLegendItem("orange", "Normal"));
  legend.appendChild(makeLegendItem("red", "Busy"));
  legend.appendChild(makeLegendItem("gray", "Unknown"));

  wrapper.appendChild(toggleBtn);
  wrapper.appendChild(legend);

  mapContainer.parentNode.insertBefore(wrapper, mapContainer);
}

function makeLegendItem(color, text) {
  const item = document.createElement("div");
  item.style.display = "flex";
  item.style.alignItems = "center";
  item.style.gap = "6px";

  const dot = document.createElement("span");
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "50%";
  dot.style.backgroundColor = color;
  dot.style.display = "inline-block";
  dot.style.border = "1px solid #999";

  const label = document.createElement("span");
  label.textContent = text;

  item.appendChild(dot);
  item.appendChild(label);
  return item;
}

// User location pin
function addUserPin() {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      appState.userLngLat = [pos.coords.longitude, pos.coords.latitude];

      if (appState.pendingDestination) {
        const [lng, lat] = appState.pendingDestination;
        routeToPoint(lng, lat);
      }

      if (map.getSource("userLngLat")) return;

      map.addSource("userLngLat", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: appState.userLngLat,
              },
              properties: { description: "Your location" },
            },
          ],
        },
      });

      map.addLayer({
        id: "userLngLat",
        type: "circle",
        source: "userLngLat",
        paint: {
          "circle-color": "#1E90FF",
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    },
    () => {},
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

// Travel mode toggle
window.setMode = function (mode) {
  appState.travelMode = mode;

  document.querySelectorAll("#mode-toggle button").forEach((btn) => {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-outline-secondary");
  });

  if (typeof event !== "undefined" && event.target) {
    event.target.classList.remove("btn-outline-secondary");
    event.target.classList.add("btn-primary");
  }

  if (appState.pendingDestination) {
    const [lng, lat] = appState.pendingDestination;
    routeToPoint(lng, lat);
  }
};

// Search control (Nominatim geocoder)
function addSearchControl() {
  const searchContainer = document.getElementById("search-container");
  if (!searchContainer) return;

  const geocoderApi = {
    forwardGeocode: async (config) => {
      const features = [];
      const query = config.query.toLowerCase();

      // Get Firestore matches first
      const localMatches = locations.filter((loc) =>
        loc.name.toLowerCase().includes(query),
      );

      localMatches.slice(0, 5).forEach((loc) => {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [loc.lng, loc.lat],
          },
          place_name: loc.name,
          text: loc.name,
          place_type: ["place"],
          properties: {
            source: "firestore",
            id: loc.id,
          },
          center: [loc.lng, loc.lat],
        });
      });

      // Show OpenStreetMap results after
      try {
        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(config.query)}` +
          `&format=geojson&limit=5`;

        const response = await fetch(url);
        const geojson = await response.json();

        for (const feature of geojson.features) {
          const [minX, minY, maxX, maxY] = feature.bbox;
          const center = [minX + (maxX - minX) / 2, minY + (maxY - minY) / 2];

          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            place_name: feature.properties.display_name,
            text: feature.properties.display_name,
            place_type: ["place"],
            properties: {
              source: "osm",
            },
            center,
          });
        }
      } catch (err) {
        console.error("Nominatim error:", err);
      }

      return { features };
    },
  };

  const geocoder = new MaplibreGeocoder(geocoderApi, {
    maplibregl,
    placeholder: "Search for a place",
    minLength: 2,
    showResultsWhileTyping: true,
    debounceSearch: 300,
  });

  searchContainer.innerHTML = "";
  searchContainer.appendChild(geocoder.onAdd(map));

  geocoder.on("result", async (e) => {
    const [lng, lat] = e.result.center;
    const placeName =
      e.result.place_name || e.result.text || "Unknown location";

    await saveSearchToRoutes(placeName);
    routeToPoint(lng, lat);
  });
}

async function saveSearchToRoutes(placeName) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "routes"), {
      userId: user.uid,
      destination: placeName,
      route: placeName,
      name: user.displayName || user.email || "Anonymous",
      createdAt: serverTimestamp(),
    });

    console.log("Search saved to routes collection");
  } catch (error) {
    console.error("Error saving search to routes:", error);
  }
}

// Step icon helper
function stepIcon(type) {
  const icons = {
    "turn-left": "↰",
    "turn-right": "↱",
    "turn-sharp-left": "↰",
    "turn-sharp-right": "↱",
    "turn-slight-left": "↖",
    "turn-slight-right": "↗",
    straight: "↑",
    roundabout: "🔄",
    "roundabout-exit": "🔄",
    "uturn-left": "↩",
    "uturn-right": "↪",
    depart: "📍",
    arrive: "🏁",
  };
  return icons[type] || "•";
}

// Routing
async function routeToPoint(destLng, destLat) {
  appState.pendingDestination = [destLng, destLat];

  if (!appState.userLngLat) {
    alert(
      "Getting your location... directions will load automatically once ready.",
    );
    return;
  }

  const [userLng, userLat] = appState.userLngLat;
  const crowded = isDestinationCrowded(destLng, destLat);
  const profile = appState.travelMode;

  if (profile === "transit") {
    const origin = `${userLat},${userLng}`;
    const destination = `${destLat},${destLng}`;
    const gmUrl =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${origin}` +
      `&destination=${destination}` +
      `&travelmode=transit`;

    if (map.getSource("route")) {
      map.getSource("route").setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [] },
      });
    }

    const directions = document.getElementById("directions");
    if (directions) {
      directions.innerHTML = `
        <div class="transit-box">
          <span>🚌 Transit directions open in Google Maps.</span>
          <a href="${gmUrl}" target="_blank" class="btn btn-sm btn-primary">Open in Google Maps</a>
        </div>
      `;
    }

    window.open(gmUrl, "_blank");
    return;
  }

  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: import.meta.env.VITE_ORS_KEY,
      },
      body: JSON.stringify({
        coordinates: [
          [userLng, userLat],
          [destLng, destLat],
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.features?.length) {
      console.error("ORS error:", data);
      alert("No route found.");
      return;
    }

    const feature = data.features[0];

    if (map.getSource("route")) {
      map.getSource("route").setData({
        type: "Feature",
        geometry: feature.geometry,
      });
    } else {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: feature.geometry,
        },
      });

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#007cbf",
          "line-width": 5,
        },
      });
    }

    const segments = feature.properties.segments;
    const totalDistance = (feature.properties.summary.distance / 1000).toFixed(
      2,
    );
    const totalDuration = Math.round(feature.properties.summary.duration / 60);
    const modeIcon = profile === "foot-walking" ? "🚶" : "🚗";
    const modeLabel = profile === "foot-walking" ? "Walking" : "Driving";

    let stepsHtml = "";
    for (const segment of segments) {
      for (const step of segment.steps) {
        const dist =
          step.distance < 1000
            ? `${Math.round(step.distance)} m`
            : `${(step.distance / 1000).toFixed(1)} km`;
        const icon = stepIcon(step.type);

        stepsHtml += `
          <div class="direction-step">
            <span class="step-icon">${icon}</span>
            <span class="step-text">${step.instruction}</span>
            <span class="step-dist">${dist}</span>
          </div>
        `;
      }
    }

    const directions = document.getElementById("directions");
    if (directions) {
      directions.innerHTML = `
        ${
          crowded
            ? `
          <div class="alert alert-danger mb-2">
            ⚠️ This destination has recent reports of being <strong>busy</strong>.
          </div>
        `
            : ""
        }
        <div class="directions-header">
          <span class="summary-icon">${modeIcon}</span>
          <div class="summary-text">
            <strong>${totalDistance} km · ${totalDuration} min</strong>
            ${modeLabel} directions
          </div>
        </div>
        <div class="directions-steps">${stepsHtml}</div>
      `;
    }
  } catch (err) {
    console.error("Routing error:", err);
    alert("Failed to load route.");
  }
}

// Report markers
function getMarkerColor(level) {
  const value = (level || "").toLowerCase();
  if (value === "quiet") return "green";
  if (value === "normal") return "orange";
  if (value === "busy") return "red";
  return "gray";
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return "Unknown date";

  let jsDate = null;

  if (typeof createdAt.toDate === "function") {
    jsDate = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    jsDate = createdAt;
  }

  if (!jsDate) return "Unknown date";

  return jsDate.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildPopupHtml(data) {
  const imageHtml = data.image
    ? `<img src="data:image/jpeg;base64,${data.image}" alt="Report image" style="width:100%;max-width:220px;border-radius:8px;margin-bottom:10px;" />`
    : "";

  return `
    <div style="min-width:220px;max-width:240px;">
      ${imageHtml}
      <div style="font-weight:bold;margin-bottom:6px;">${data.location || "Unknown location"}</div>
      <div style="margin-bottom:4px;"><strong>Crowd level:</strong> ${data.crowdLevel || "N/A"}</div>
      <div style="margin-bottom:4px;"><strong>Created:</strong> ${formatCreatedAt(data.createdAt)}</div>
      <div><strong>Submitted by:</strong> ${data.name || "Anonymous"}</div>
    </div>
  `;
}

function closeCurrentPopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
}

async function addReportMarkers() {
  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    reportPoints = [];
    reportMarkers.forEach((marker) => marker.remove());
    reportMarkers = [];

    const latestByLocation = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;

      reportPoints.push({
        lat: data.lat,
        lng: data.lng,
        crowdLevel: data.crowdLevel,
      });

      const key = (data.location || data.address || "unknown")
        .trim()
        .toLowerCase();

      if (!latestByLocation.has(key)) {
        latestByLocation.set(key, data);
      }
    });

    latestByLocation.forEach((data) => {
      const coords = [data.lng, data.lat];

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 18,
      }).setHTML(buildPopupHtml(data));

      popup.on("open", () => {
        currentPopup = popup;
      });

      popup.on("close", () => {
        if (currentPopup === popup) {
          currentPopup = null;
        }
      });

      const marker = new maplibregl.Marker({
        color: getMarkerColor(data.crowdLevel),
      })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      reportMarkers.push(marker);
    });
  } catch (error) {
    console.error("Error loading report markers:", error);
  }
}

function isDestinationCrowded(destLng, destLat) {
  const thresholdMeters = 180;

  for (const r of reportPoints) {
    if (!r.crowdLevel || r.crowdLevel.toLowerCase() !== "busy") continue;

    const dx = (r.lng - destLng) * 111320 * Math.cos((destLat * Math.PI) / 180);
    const dy = (r.lat - destLat) * 110540;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < thresholdMeters) {
      return true;
    }
  }

  return false;
}

showMap();
