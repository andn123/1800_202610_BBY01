import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

const appState = {
  userLngLat: null,
};

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

    console.log("Map loaded");
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
    },
  );
}

showMap();
