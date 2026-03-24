import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

let reports = [];

async function loadReports() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const snapshot = await getDocs(collection(db, "reports"));
    reports = snapshot.docs
      .map(doc => doc.data())
      .filter(data => data.userId === user.uid);
    updateUI();
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

// MAIN FUNCTION (search + sort + display)
function updateUI() {
  const container = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");
  const noResults = document.getElementById("noResultsMessage");
  if (!container || !template) return;

  let filtered = [...reports];

  // SEARCH
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  filtered = filtered.filter(r =>
    (r.address || "").toLowerCase().includes(search) ||
    (r.location || "").toLowerCase().includes(search)
  );

  // SORT
  const sort = document.getElementById("sortSelect")?.value;
  if (sort === "recent") {
    filtered.sort((a, b) => {
      const aTime = a.createdAt?.toDate()?.getTime() || 0;
      const bTime = b.createdAt?.toDate()?.getTime() || 0;
      return bTime - aTime;
    });
  } else if (sort === "crowded") {
    const crowdOrder = { empty: 0, moderate: 1, busy: 2 };
    filtered.sort((a, b) => {
      const aRank = crowdOrder[a.crowdLevel] ?? -1;
      const bRank = crowdOrder[b.crowdLevel] ?? -1;
      return bRank - aRank;
    });
  }

  // CLEAR
  container.innerHTML = "";

  // NO RESULTS MESSAGE
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
    if (jsDate) {
      cardCreatedAt.textContent = `Created on: ${jsDate.toLocaleString()}`;
    } else {
      cardCreatedAt.textContent = "Created on: unknown";
    }

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
onAuthReady(() => {
  setupListeners();
  loadReports();
});