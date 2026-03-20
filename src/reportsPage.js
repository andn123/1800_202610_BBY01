import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

async function displayReports() {
  const reportsContainer = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");

  if (!reportsContainer || !template) return;

  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const data = doc.data();

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
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

// Ensure auth is ready
onAuthReady(() => {
  displayReports();
});
