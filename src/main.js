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

async function loadLocations() {
  const select = document.getElementById("locationSelect");

  if (!select) return;

  const snapshot = await getDocs(collection(db, "monitor_points"));

  snapshot.forEach((doc) => {
    const data = doc.data();

    const option = document.createElement("option");
    option.value = doc.id;

    option.textContent = data.name;

    // store coordinates if available
    option.dataset.lat = data.lat;
    option.dataset.lng = data.lng;

    select.appendChild(option);
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

    const select = document.getElementById("locationSelect");

    if (!select.value) {
      alert("Please select a location.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
      return;
    }

    const selectedOption = select.options[select.selectedIndex];

    const location = selectedOption.textContent;
    const lat = parseFloat(selectedOption.dataset.lat);
    const lng = parseFloat(selectedOption.dataset.lng);
    const monitorPointId = select.value;

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
    } catch (error) {
      console.error(error);
      alert("Error submitting report");
    }

    submitButton.disabled = false;
    submitButton.textContent = "Submit";
  });
}

showName();
setupImageUpload();
setupForm();
loadLocations();
