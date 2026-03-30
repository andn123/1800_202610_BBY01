import maplibregl from "maplibre-gl";
import { db } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const appState = {
  userLngLat: null,
  reportMarkers: [],
  markersVisible: true,
};

function showMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  injectMapControls(mapContainer);

  const map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    center: [-123.00163752324765, 49.25324576104826],
    zoom: 10,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", async () => {
    addUserPin(map);
    await addLatestReportMarkers(map);
  });
}

function injectMapControls(mapContainer) {
  if (document.getElementById("map-top-controls")) return;

  const controlsWrapper = document.createElement("div");
  controlsWrapper.id = "map-top-controls";
  controlsWrapper.style.display = "flex";
  controlsWrapper.style.flexWrap = "wrap";
  controlsWrapper.style.gap = "12px";
  controlsWrapper.style.alignItems = "center";
  controlsWrapper.style.marginBottom = "12px";

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "Hide Markers";
  toggleBtn.style.padding = "8px 14px";
  toggleBtn.style.border = "none";
  toggleBtn.style.borderRadius = "8px";
  toggleBtn.style.backgroundColor = "#0d6efd";
  toggleBtn.style.color = "white";
  toggleBtn.style.cursor = "pointer";

  toggleBtn.addEventListener("click", () => {
    appState.markersVisible = !appState.markersVisible;

    appState.reportMarkers.forEach((marker) => {
      if (appState.markersVisible) {
        marker.addTo(marker.__mapInstance);
      } else {
        marker.remove();
      }
    });

    toggleBtn.textContent = appState.markersVisible ? "Hide Markers" : "Show Markers";
  });

  const legend = document.createElement("div");
  legend.style.display = "flex";
  legend.style.flexWrap = "wrap";
  legend.style.gap = "12px";
  legend.style.alignItems = "center";
  legend.style.padding = "10px 14px";
  legend.style.backgroundColor = "#f8f9fa";
  legend.style.border = "1px solid #dee2e6";
  legend.style.borderRadius = "10px";
  legend.style.fontSize = "14px";

  const title = document.createElement("span");
  title.textContent = "Marker Legend:";
  title.style.fontWeight = "700";
  legend.appendChild(title);

  legend.appendChild(makeLegendItem("green", "Quiet"));
  legend.appendChild(makeLegendItem("orange", "Normal"));
  legend.appendChild(makeLegendItem("red", "Busy"));
  legend.appendChild(makeLegendItem("gray", "Unknown"));

  controlsWrapper.appendChild(toggleBtn);
  controlsWrapper.appendChild(legend);

  mapContainer.parentNode.insertBefore(controlsWrapper, mapContainer);
}

function makeLegendItem(color, label) {
  const item = document.createElement("div");
  item.style.display = "flex";
  item.style.alignItems = "center";
  item.style.gap = "6px";

  const dot = document.createElement("span");
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "50%";
  dot.style.backgroundColor = color;
  dot.style.border = "2px solid white";
  dot.style.boxShadow = "0 0 0 1px #999";

  const text = document.createElement("span");
  text.textContent = label;

  item.appendChild(dot);
  item.appendChild(text);

  return item;
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

function formatCreatedAt(createdAt) {
  if (!createdAt) return "Unknown date";

  let jsDate = null;
  if (typeof createdAt.toDate === "function") jsDate = createdAt.toDate();
  else if (createdAt instanceof Date) jsDate = createdAt;

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
    ? `<img src="data:image/jpeg;base64,${data.image}" alt="Report image" style="width:100%;max-width:220px;border-radius:10px;margin-bottom:10px;display:block;" />`
    : "";

  return `
    <div style="min-width:220px;max-width:240px;font-family:Arial,sans-serif;">
      ${imageHtml}
      <div style="font-weight:700;margin-bottom:6px;">${data.location || "Unknown location"}</div>
      <div style="margin-bottom:4px;"><strong>Crowd level:</strong> ${data.crowdLevel || "N/A"}</div>
      <div style="margin-bottom:4px;"><strong>Created:</strong> ${formatCreatedAt(data.createdAt)}</div>
      <div><strong>Submitted by:</strong> ${data.name || "Anonymous"}</div>
    </div>
  `;
}

function getLatestReportsPerLocation(docs) {
  const latestByLocation = new Map();

  docs.forEach((doc) => {
    const data = doc.data();
    const key = (data.location || data.address || "unknown").trim().toLowerCase();

    if (!latestByLocation.has(key)) {
      latestByLocation.set(key, data);
    }
  });

  return Array.from(latestByLocation.values());
}

async function addLatestReportMarkers(map) {
  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const latestReports = getLatestReportsPerLocation(snapshot.docs);

    latestReports.forEach((data) => {
      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;

      const marker = new maplibregl.Marker({
        color: getMarkerColor(data.crowdLevel),
      })
        .setLngLat([data.lng, data.lat])
        .setPopup(
          new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 18,
          }).setHTML(buildPopupHtml(data))
        )
        .addTo(map);

      marker.__mapInstance = map;
      appState.reportMarkers.push(marker);
    });
  } catch (error) {
    console.error("Error loading report markers:", error);
  }
}

showMap();

 