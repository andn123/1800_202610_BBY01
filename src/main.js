import { onAuthReady } from "./authentication.js";
import { submitReport, setupImageUpload } from "./reports.js";

function showName() {
  const nameElement = document.getElementById("name-goes-here"); // the <h1> element to display "Hello, {name}"

  // Wait for Firebase to determine the current authentication state.
  // onAuthReady() runs the callback once Firebase finishes checking the signed-in user.
  // The user's name is extracted from the Firebase Authentication object
  // You can "go to console" to check out current users.
  onAuthReady((user) => {
    if (!user) {
      // If no user is signed in → redirect back to login page.
      location.href = "/pages/login.html";
      return;
    }

    // If a user is logged in:
    // Use their display name if available, otherwise show their email.
    const name = user.displayName || user.email;

    // Update the welcome message with their name/email.
    if (nameElement) {
      nameElement.textContent = `${name}!`;
    }
  });
}

function setupForm() {
  const form = document.getElementById("report-form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = form.querySelector("button");
    submitButton.disabled = true; // disable button
    submitButton.textContent = "Submitting...";

    const location = document.getElementById("location").value;
    const address = document.getElementById("address").value;

    const crowdLevel = document.querySelector(
      'input[name="crowd_level"]:checked',
    ).value;

    try {
      await submitReport(location, address, crowdLevel);

      alert("Report submitted!");
      form.reset();
    } catch (error) {
      console.error(error);
      alert("Error submitting report");
    }

    submitButton.disabled = false; // re-enable button
    submitButton.textContent = "Submit";
  });
}

showName();
setupImageUpload();
setupForm();
