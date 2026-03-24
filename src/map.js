import maplibregl from "maplibre-gl";
import { db } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const appState = {
  userLngLat: null,
};

function showMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  const map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    center: [-123.00163752324765, 49.25324576104826],
    zoom: 10,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", async () => {
    addUserPin(map);
    await addReportMarkers(map);
  });
}

function addUserPin(map) {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      appState.userLngLat = [pos.coords.longitude, pos.coords.latitude];

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
    () => {},
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
      ${data.location || ""}<br>
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

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 18,
      }).setHTML(buildPopupHtml(data));

      new maplibregl.Marker({
        color: getMarkerColor(data.crowdLevel),
      })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);
    });
  } catch (error) {
    console.error("Error loading report markers:", error);
  }
}

showMap();