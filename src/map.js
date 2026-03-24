import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

import { db } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const appState = {
  userLngLat: null,
};

let currentPopup = null;

function showMap() {
  const map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    center: [-123.00163752324765, 49.25324576104826],
    zoom: 10,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", async () => {
    await addUserPin(map);
    await addReportMarkers(map);
  });
}

async function addUserPin(map) {
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation not available");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      appState.userLngLat = [pos.coords.longitude, pos.coords.latitude];

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
              properties: {
                description: "Your location",
              },
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
    (err) => {
      console.error("Geolocation error", err);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

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
      ${data.location || ""}
      ${imageHtml}
    </div>
  `;
}

async function addReportMarkers(map) {
  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (typeof data.lat !== "number" || typeof data.lng !== "number") {
        return;
      }

      const coords = [data.lng, data.lat];

      const markerEl = document.createElement("div");
      markerEl.style.width = "18px";
      markerEl.style.height = "18px";
      markerEl.style.borderRadius = "50%";
      markerEl.style.backgroundColor = getMarkerColor(data.crowdLevel);
      markerEl.style.border = "2px solid white";
      markerEl.style.cursor = "pointer";

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 18,
      }).setHTML(buildPopupHtml(data));

      const marker = new maplibregl.Marker(markerEl)
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      markerEl.addEventListener("click", () => {
        if (currentPopup && currentPopup !== popup) {
          currentPopup.remove();
        }

        if (popup.isOpen()) {
          popup.remove();
          currentPopup = null;
        } else {
          marker.togglePopup();
          currentPopup = popup;
        }
      });
    });
  } catch (error) {
    console.error("Error loading report markers:", error);
  }
}

showMap();