
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";

import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

let currentUser = null;

// Track the currently logged-in user
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  console.log("Current user:", user);
});

function setupSearchButton() {
  const searchBtn = document.getElementById("searchRouteBtn");
  const destinationInput = document.getElementById("destinationInput");

  // Only run on pages where these elements exist
  if (!searchBtn || !destinationInput) return;

  searchBtn.addEventListener("click", async () => {
    const destination = destinationInput.value.trim();

    if (!destination) {
      alert("Please enter a destination.");
      return;
    }

    if (!currentUser) {
      alert("Please log in first.");
      return;
    }

    // Hardcoded route for now, based on your instructor's simplified requirement
    const defaultRoute = `Your location -> Bus 145 -> Bus 344 -> ${destination}`;

    // Use displayName if available, otherwise email
    const userName =
      currentUser.displayName ||
      currentUser.email ||
      "Anonymous User";

    try {
      // Save searched route into Firestore
      await addDoc(collection(db, "routes"), {
        destination: destination,
        route: defaultRoute,
        userId: currentUser.uid,
        name: userName,
        createdAt: serverTimestamp()
      });

      console.log("Route saved successfully");

      // After saving, redirect to map page
      window.location.href = "/pages/map.html";

    } catch (error) {
      console.error("Error saving route:", error);
      alert("Failed to save route.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearchButton();
});