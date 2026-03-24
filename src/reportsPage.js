import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

let allReports = [];

function showLoadingMessage() {
  document.getElementById("loadingMessage").style.display = "block";
  document.getElementById("errorMessage").style.display = "none";
  document.getElementById("noResultsMessage").style.display = "none";
}

function hideLoadingMessage() {
  document.getElementById("loadingMessage").style.display = "none";
}

function showErrorMessage(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  document.getElementById("loadingMessage").style.display = "none";
}

function showNoResultsMessage() {
  document.getElementById("noResultsMessage").style.display = "block";
}

function hideNoResultsMessage() {
  document.getElementById("noResultsMessage").style.display = "none";
}

function renderReports(reports) {
  const reportsContainer = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");

  if (!reportsContainer || !template) return;

  reportsContainer.innerHTML = "";

  if (reports.length === 0) {
    showNoResultsMessage();
    return;
  }

  hideNoResultsMessage();

  reports.forEach((data) => {
    const clone = template.content.cloneNode(true);

    const cardTitle = clone.querySelector(".card-title");
    const cardImage = clone.querySelector(".card-img-top");
    const cardAddress = clone.querySelector(".report-address");
    const cardCrowdLevel = clone.querySelector(".report-crowd");
    const cardCreatedAt = clone.querySelector(".report-created-at");
    const cardCreatedBy = clone.querySelector(".report-created-by");

    cardTitle.textContent = data.location;
    cardAddress.textContent = `Location ID: ${data.monitorPointId || "N/A"}`;
    cardCrowdLevel.textContent = `Crowd level: ${data.crowdLevel}`;

    const jsDate = data.createdAt?.toDate();
    if (jsDate) {
      const formattedDate = jsDate.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      cardCreatedAt.textContent = `Created on: ${formattedDate}`;
    } else {
      cardCreatedAt.textContent = "Created on: unknown";
    }

    cardCreatedBy.textContent = `Submitted by: ${data.name}`;

    if (data.image) {
      cardImage.src = `data:image/jpeg;base64,${data.image}`;
    } else {
      cardImage.src = "...";
    }

    reportsContainer.appendChild(clone);
  });
}

function filterAndSortReports() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const sortOption = document.getElementById("sortSelect").value;

  let filtered = allReports.filter((report) =>
    report.location.toLowerCase().includes(searchTerm)
  );

  if (sortOption === "crowded") {
    filtered.sort((a, b) => parseInt(b.crowdLevel) - parseInt(a.crowdLevel));
  } else {
    // Default: most recent
    filtered.sort((a, b) => {
      const timeA = a.createdAt?.toDate()?.getTime() || 0;
      const timeB = b.createdAt?.toDate()?.getTime() || 0;
      return timeB - timeA;
    });
  }

  renderReports(filtered);
}

async function displayReports() {
  showLoadingMessage();

  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allReports = snapshot.docs.map((doc) => doc.data());
    hideLoadingMessage();
    filterAndSortReports();
  } catch (error) {
    console.error("Error loading reports:", error);
    showErrorMessage("Failed to load reports. Please try again later.");
  }
}

// Setup search and sort listeners
function setupSearchAndSort() {
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  if (searchInput) {
    searchInput.addEventListener("input", filterAndSortReports);
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", filterAndSortReports);
  }
}

// Ensure auth is ready
onAuthReady(() => {
  setupSearchAndSort();
  displayReports();
});
