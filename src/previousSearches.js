import { db, auth } from "./firebaseConfig.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

async function loadPreviousSearches() {
  const container = document.getElementById("my-previous-searches");
  if (!container) return;

  const user = auth.currentUser;

  if (!user) {
    container.innerHTML = "<p>Please log in to view your previous searches.</p>";
    return;
  }

  try {
    const q = query(
      collection(db, "routes"),
      where("userId", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = "<p>No previous searches found.</p>";
      return;
    }

    const searches = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      searches.push(data);
    });

    searches.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    container.innerHTML = "";

    searches.forEach((data) => {
      const item = document.createElement("div");
      item.className = "list-group-item";

      const createdAtText =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toLocaleString()
          : "";

      item.innerHTML = `
        <strong>${data.destination || "Unknown location"}</strong><br>
        <small>${createdAtText}</small>
      `;

      container.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading previous searches:", error);
    container.innerHTML = "<p>Failed to load previous searches.</p>";
  }
}

auth.onAuthStateChanged(() => {
  loadPreviousSearches();
});