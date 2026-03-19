import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";

import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  console.log("Current user:", user);
});

function setupAutocomplete() {
  const input = document.getElementById("destinationInput");
  const suggestions = document.getElementById("suggestions");

  if (!input || !suggestions) return;

  let timeout;

  input.addEventListener("input", () => {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {
      const query = input.value.trim();

      if (query.length < 3) {
        suggestions.innerHTML = "";
        return;
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

      try {
        const res = await fetch(url);
        const data = await res.json();

        suggestions.innerHTML = "";

        data.slice(0, 5).forEach((place) => {
          const li = document.createElement("li");
          li.className = "list-group-item list-group-item-action";
          li.textContent = place.display_name;

          li.addEventListener("click", () => {
            input.value = place.display_name;
            suggestions.innerHTML = "";
          });

          suggestions.appendChild(li);
        });
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }, 300); // debounce delay
  });
}

function setupSearchButton() {
  const searchBtn = document.getElementById("searchRouteBtn");
  const destinationInput = document.getElementById("destinationInput");

  if (!searchBtn || !destinationInput) return;

  searchBtn.addEventListener("click", async () => {
    const destination = destinationInput.value.trim();

    if (!destination) {
      alert("Please enter a destination.");
      return;
    }

    const defaultRoute = `Your location -> Bus 145 -> Bus 344 -> ${destination}`;

    const userName =
      currentUser?.displayName || currentUser?.email || "Anonymous User";

    try {
      // Save to Firestore
      await addDoc(collection(db, "routes"), {
        destination: destination,
        route: defaultRoute,
        userId: currentUser?.uid || null,
        name: userName,
        createdAt: serverTimestamp(),
      });

      console.log("Route saved successfully");

      // Get current location
      let origin = "";

      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              origin = `${pos.coords.latitude},${pos.coords.longitude}`;
              resolve();
            },
            () => resolve(),
          );
        });
      }

      const encodedDest = encodeURIComponent(destination);

      let url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}`;

      if (origin) {
        url += `&origin=${origin}`;
      }

      // Open Google Maps
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error saving route:", error);
      alert("Failed to save route.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearchButton();
  setupAutocomplete();
});
