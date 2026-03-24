console.log("REPORTS PAGE LOADED");
import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";

let reports = [];

async function loadReports() {
  try {
    const snapshot = await getDocs(collection(db, "reports"));
    reports = snapshot.docs.map((doc) => doc.data());
    updateUI();
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

function updateUI() {
  const container = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");
  const noResults = document.getElementById("noResultsMessage");
  if (!container || !template) return;

  let filtered = [...reports];

  // SEARCH
  const search =
    document.getElementById("searchInput")?.value.toLowerCase() || "";
  filtered = filtered.filter(
    (r) =>
      (r.address || "").toLowerCase().includes(search) ||
      (r.location || "").toLowerCase().includes(search),
  );

  // SORT
  const sort = document.getElementById("sortSelect")?.value;

  if (sort === "recent") {
    filtered.sort((a, b) => {
      const aTime = a.createdAt?.toDate()?.getTime() || 0;
      const bTime = b.createdAt?.toDate()?.getTime() || 0;

      console.log("Comparing (recent):");
      console.log("A time:", aTime);
      console.log("B time:", bTime);

      return bTime - aTime;
    });
  } else if (sort === "crowded") {
    const rank = {
      busy: 3,
      normal: 2,
      quiet: 1,
    };

    filtered.sort((a, b) => {
      console.log("Comparing (crowded):");
      console.log("A:", a);
      console.log("B:", b);

      const aLevel = (a.crowdLevel || "").toLowerCase();
      const bLevel = (b.crowdLevel || "").toLowerCase();

      console.log("A level:", aLevel);
      console.log("B level:", bLevel);

      const result = (rank[bLevel] || 0) - (rank[aLevel] || 0);
      console.log("Result:", result);

      return result;
    });
  }

  // CLEAR
  container.innerHTML = "";

  // NO RESULTS
  if (filtered.length === 0) {
    if (noResults) noResults.style.display = "block";
    return;
  } else {
    if (noResults) noResults.style.display = "none";
  }

  // DISPLAY
  filtered.forEach((data) => {
    const clone = template.content.cloneNode(true);

    const cardTitle = clone.querySelector(".card-title");
    const cardImage = clone.querySelector(".card-img-top");
    const cardAddress = clone.querySelector(".report-address");
    const cardCrowdLevel = clone.querySelector(".report-crowd");
    const cardCreatedAt = clone.querySelector(".report-created-at");
    const cardCreatedBy = clone.querySelector(".report-created-by");

    cardTitle.textContent = data.location || "No location";
    cardAddress.textContent = `Address: ${data.address || "N/A"}`;
    cardCrowdLevel.textContent = `Crowd level: ${data.crowdLevel || "N/A"}`;

    const jsDate = data.createdAt?.toDate();
    cardCreatedAt.textContent = jsDate
      ? `Created on: ${jsDate.toLocaleString()}`
      : "Created on: unknown";

    cardCreatedBy.textContent = `Submitted by: ${data.name || "Anonymous"}`;
    cardImage.src = `data:image/jpeg;base64,${data.image}`;

    container.appendChild(clone);
  });
}

// EVENT LISTENERS
function setupListeners() {
  document.getElementById("searchInput")?.addEventListener("input", updateUI);
  document.getElementById("sortSelect")?.addEventListener("change", updateUI);
}

// INIT
document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadReports();
});
