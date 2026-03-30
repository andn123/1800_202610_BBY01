import { onAuthReady } from "./authentication.js";
import { submitReport, setupImageUpload } from "./reports.js";

import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";

function showName() {
  const nameElement = document.getElementById("name-goes-here");

  onAuthReady((user) => {
    if (!user) {
      location.href = "/pages/login.html";
      return;
    }

    const name = user.displayName || user.email;

    if (nameElement) {
      nameElement.textContent = `${name}!`;
    }
  });
}

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

let selectedLocation = null;

function setupLocationSearch() {
  const input = document.getElementById("locationSearch");
  const dropdown = document.getElementById("locationDropdown");

  if (!input || !dropdown) return;

  input.addEventListener("input", () => {
    const query = input.value.toLowerCase();
    dropdown.innerHTML = "";
    selectedLocation = null;

    if (!query) return;

    const filtered = locations.filter((loc) =>
      loc.name.toLowerCase().includes(query),
    );

    filtered.forEach((loc) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";
      item.textContent = loc.name;

      item.addEventListener("click", () => {
        input.value = loc.name;
        selectedLocation = loc;
        dropdown.innerHTML = "";
      });

      dropdown.appendChild(item);
    });
  });

  // close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.innerHTML = "";
    }
  });
}

function setupForm() {
  const form = document.getElementById("report-form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = form.querySelector("button");
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    // Use the selectedLocation from the search dropdown
    if (!selectedLocation) {
      alert("Please select a valid location from the list.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
      return;
    }

    const location = selectedLocation.name;
    const lat = selectedLocation.lat;
    const lng = selectedLocation.lng;
    const monitorPointId = selectedLocation.id;

    const address = location;

    const crowdLevel = document.querySelector(
      'input[name="crowd_level"]:checked',
    ).value;

    try {
      await submitReport(
        location,
        address,
        crowdLevel,
        lat,
        lng,
        monitorPointId,
      );

      alert("Report submitted!");
      form.reset();
      selectedLocation = null; // reset selection after submit
    } catch (error) {
      console.error(error);
      alert("Error submitting report");
    }

    submitButton.disabled = false;
    submitButton.textContent = "Submit";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  showName();
  setupImageUpload();
  setupForm();

  await loadLocations(); // load data first
  setupLocationSearch(); // then enable search UI
});
