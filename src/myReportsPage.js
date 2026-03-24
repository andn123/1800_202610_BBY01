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
      .filter(data => data.userId === user.uid); // only your reports

    updateUI();
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

// 🔥 MAIN FUNCTION (search + sort)
function updateUI() {
  const container = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");

  if (!container || !template) return;

  let filtered = [...reports];

  // SEARCH
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  filtered = filtered.filter(r =>
    r.address?.toLowerCase().includes(search) ||
    r.location?.toLowerCase().includes(search)
  );

  // SORT
  const sort = document.getElementById("sortSelect")?.value;

  if (sort === "recent") {
    filtered.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
  } else if (sort === "crowded") {
    filtered.sort((a, b) => b.crowdLevel - a.crowdLevel);
  }

  // CLEAR before re-render
  container.innerHTML = "";

  // DISPLAY
  filtered.forEach((data) => {
    const clone = template.content.cloneNode(true);

    const cardTitle = clone.querySelector(".card-title");
    const cardImage = clone.querySelector(".card-img-top");
    const cardAddress = clone.querySelector(".report-address");
    const cardCrowdLevel = clone.querySelector(".report-crowd");
    const cardCreatedAt = clone.querySelector(".report-created-at");
    const cardCreatedBy = clone.querySelector(".report-created-by");

    cardTitle.textContent = data.location;
    cardAddress.textContent = `Address: ${data.address}`;
    cardCrowdLevel.textContent = `Crowd level: ${data.crowdLevel}`;

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

// 🎯 EVENT LISTENERS
function setupListeners() {
  document.getElementById("searchInput")?.addEventListener("input", updateUI);
  document.getElementById("sortSelect")?.addEventListener("change", updateUI);
}

// WAIT FOR AUTH
onAuthReady(() => {
  setupListeners();
  loadReports();
});