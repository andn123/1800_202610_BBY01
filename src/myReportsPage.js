import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

function getRouteDestination(data) {
  return (
    data.destination ||
    data.destinations ||
    data.address ||
    data.location ||
    data.search ||
    data.searchTerm ||
    "Unknown destination"
  );
}

async function displayPreviousSearches() {
  const searchesContainer = document.getElementById("my-previous-searches");
  if (!searchesContainer) return;

  const user = auth.currentUser;
  if (!user) return;

  searchesContainer.innerHTML = "";

  try {
    const q = query(collection(db, "routes"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    let hasSearches = false;

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.userId !== user.uid) return;

      hasSearches = true;

      const item = document.createElement("div");
      item.className = "list-group-item";
      item.textContent = getRouteDestination(data);

      searchesContainer.appendChild(item);
    });

    if (!hasSearches) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "list-group-item";
      emptyItem.textContent = "No previous searches yet.";
      searchesContainer.appendChild(emptyItem);
    }
  } catch (error) {
    console.error("Error loading previous searches:", error);
  }
}

async function displayMyReports() {
  const reportsContainer = document.getElementById("my-crowd-reports");
  const template = document.getElementById("myCrowdCardTemplate");

  if (!reportsContainer || !template) return;

  const user = auth.currentUser;
  if (!user) return;

  reportsContainer.innerHTML = "";

  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.userId !== user.uid) return;

      const clone = template.content.cloneNode(true);

      const cardTitle = clone.querySelector(".card-title");
      const cardImage = clone.querySelector(".card-img-top");
      const cardAddress = clone.querySelector(".report-address");
      const cardCrowdLevel = clone.querySelector(".report-crowd");
      const cardCreatedAt = clone.querySelector(".report-created-at");
      const cardCreatedBy = clone.querySelector(".report-created-by");

      cardTitle.textContent = data.location || "Unnamed report";
      cardAddress.textContent = `Monitor Point ID: ${data.monitorPointId || "N/A"}`;
      cardCrowdLevel.textContent = `Crowd level: ${data.crowdLevel || "N/A"}`;

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

      cardCreatedBy.textContent = `Submitted by: ${data.name || "Anonymous"}`;

      if (data.image) {
        cardImage.src = `data:image/jpeg;base64,${data.image}`;
      } else {
        cardImage.src = "";
        cardImage.alt = "No report image";
      }

      reportsContainer.appendChild(clone);
    });
  } catch (error) {
    console.error("Error loading user reports:", error);
  }
}

onAuthReady(() => {
  displayPreviousSearches();
  displayMyReports();
});