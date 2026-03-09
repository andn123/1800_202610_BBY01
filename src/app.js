import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";

import { db } from "./firebaseConfig.js";
import { doc, setDoc, GeoPoint, collection, getDocs } from "firebase/firestore";

// ======================================================
// Example function to read a CSV file and import data into Firestore.
// Run this ONLY one time from the browser console.
// ======================================================
async function getCSVdata() {
  // Fetch the CSV file from the public directory
  const response = await fetch("/monitor_points.csv");

  // Read the response as text
  const text = await response.text();

  // Split the CSV text into rows and skip the header row
  const rows = text.split("\n").slice(1);

  for (const row of rows) {
    // skip empty rows
    if (!row.trim()) continue;

    // split the row into columns
    const columns = row.split(",");

    // Extract the relevant data from the columns
    const id = columns[0]?.trim();
    const name = columns[1]?.trim();
    const category = columns[2]?.trim();
    const lat = parseFloat(columns[3]);
    const lng = parseFloat(columns[4]);

    // Create a Firestore document for each monitor point
    await setDoc(doc(db, "monitor_points", id), {
      name,
      category,
      location: new GeoPoint(lat, lng),
      lat,
      lng
    });

    console.log("Imported:", name);
  }

  console.log("Seeding complete");
}

// Expose the function to the global scope so it can be called from console
window.getCSVdata = getCSVdata;

// ======================================================
// Search logic
// ======================================================
function normalizeText(text) {
  return text.trim().toLowerCase();
}

async function findMatchingMonitorPoint(searchText) {
  const snapshot = await getDocs(collection(db, "monitor_points"));
  const searchValue = normalizeText(searchText);

  let exactMatch = null;
  let partialMatch = null;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const pointName = normalizeText(data.name || "");

    if (pointName === searchValue) {
      exactMatch = { id: docSnap.id, ...data };
    } else if (!partialMatch && pointName.includes(searchValue)) {
      partialMatch = { id: docSnap.id, ...data };
    }
  });

  return exactMatch || partialMatch;
}

function setupSearchButton() {
  const searchBtn = document.getElementById("searchRouteBtn");
  const destinationInput = document.getElementById("destinationInput");

  // only run on search page
  if (!searchBtn || !destinationInput) return;

  searchBtn.addEventListener("click", async () => {
    const destination = destinationInput.value.trim();

    if (!destination) {
      alert("Please enter a destination.");
      return;
    }

    try {
      const match = await findMatchingMonitorPoint(destination);

      if (!match) {
        alert("No matching destination found.");
        return;
      }

      // redirect user to the selected location on the map page
      window.location.href = `/pages/map.html?id=${encodeURIComponent(match.id)}`;
    } catch (error) {
      console.error("Search failed:", error);
      alert("Something went wrong while searching.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearchButton();
});