import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import { db } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// Global map instance
let map = null;
let reportPoints = [];

const appState = {
  userLngLat: null,
  travelMode: "foot-walking",
  pendingDestination: null, // stores destination if searched before location ready
};

// Map init
function showMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

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
    addSearchControl();
  });
}

// User location pin
function addUserPin() {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      appState.userLngLat = [pos.coords.longitude, pos.coords.latitude];

      // If user already searched a destination, route to it now
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
  event.target.classList.remove("btn-outline-secondary");
  event.target.classList.add("btn-primary");

  // Re-route with new mode if destination already selected
  if (appState.pendingDestination) {
    const [lng, lat] = appState.pendingDestination;
    routeToPoint(lng, lat);
  }
};

// Search control (Nominatim geocoder)
function addSearchControl() {
  const geocoderApi = {
    forwardGeocode: async (config) => {
      const features = [];
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
          properties: feature.properties,
          center,
        });
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

  document.getElementById("search-container").appendChild(geocoder.onAdd(map));

  geocoder.on("result", (e) => {
    const [lng, lat] = e.result.center;
    routeToPoint(lng, lat);
  });
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
  // Always save destination in case location isn't ready yet
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

  // Transit - direct to Google Maps
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

    document.getElementById("directions").innerHTML = `
      <div class="transit-box">
        <span>🚌 Transit directions open in Google Maps.</span>
        <a href="${gmUrl}" target="_blank" class="btn btn-sm btn-primary">Open in Google Maps</a>
      </div>
    `;

    window.open(gmUrl, "_blank");
    return;
  }

  // Walk / Drive - ORS routing
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

    // Draw or update the route line
    if (map.getSource("route")) {
      map
        .getSource("route")
        .setData({ type: "Feature", geometry: feature.geometry });
    } else {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: feature.geometry },
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

    // Build styled directions panel
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

    document.getElementById("directions").innerHTML = `
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

function buildPopupHtml(data) {
  const imageHtml = data.image
    ? `<img src="data:image/jpeg;base64,${data.image}" alt="Report image" style="width:100%;max-width:180px;border-radius:8px;margin-top:8px;" />`
    : "";

  return `
    <div style="min-width:180px;">
      <strong>${data.name || "Anonymous"}</strong><br>
      Crowd level: ${data.crowdLevel || "N/A"}<br>
      ${data.location || ""}<br>
      ${imageHtml}
    </div>
  `;
}

async function addReportMarkers() {
  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;

      // Save for later crowd detection
      reportPoints.push({
        lat: data.lat,
        lng: data.lng,
        crowdLevel: data.crowdLevel,
      });

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 18,
      }).setHTML(buildPopupHtml(data));

      new maplibregl.Marker({ color: getMarkerColor(data.crowdLevel) })
        .setLngLat([data.lng, data.lat])
        .setPopup(popup)
        .addTo(map);
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
