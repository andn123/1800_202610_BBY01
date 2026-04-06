// Kelly - added pagination to user's crowd reports on the personalized page
import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

const MY_REPORTS_PER_PAGE = 9;
let myReports = [];
let currentPage = 1;

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

function renderMyReports(reportsToShow) {
  const container = document.getElementById("my-crowd-reports");
  const template = document.getElementById("myCrowdCardTemplate");
  if (!container || !template) return;
  container.innerHTML = "";

  if (reportsToShow.length === 0) {
    container.innerHTML = `<p class="text-muted">You haven't submitted any crowd reports yet.</p>`;
    return;
  }

  reportsToShow.forEach((data) => {
    const clone = template.content.cloneNode(true);
    const cardTitle = clone.querySelector(".card-title");
    const cardImage = clone.querySelector(".card-img-top");
    const cardAddress = clone.querySelector(".report-address");
    const cardCrowdLevel = clone.querySelector(".report-crowd");
    const cardCreatedAt = clone.querySelector(".report-created-at");
    const cardCreatedBy = clone.querySelector(".report-created-by");

    cardTitle.textContent = data.location || "Unnamed report";
    cardAddress.textContent = `Monitor Point ID: ${data.monitorPointId || "N/A"}`;

    const levelLower = (data.crowdLevel || "").toLowerCase();
    const badgeClass =
      levelLower === "busy"
        ? "badge bg-danger"
        : levelLower === "normal"
          ? "badge bg-warning text-dark"
          : "badge bg-success";
    cardCrowdLevel.innerHTML = `Crowd level: <span class="${badgeClass}">${data.crowdLevel || "N/A"}</span>`;

    const jsDate = data.createdAt?.toDate();
    if (jsDate) {
      cardCreatedAt.textContent = `Created on: ${jsDate.toLocaleString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        },
      )}`;
    } else {
      cardCreatedAt.textContent = "Created on: unknown";
    }

    cardCreatedBy.textContent = `Submitted by: ${data.name || "Anonymous"}`;
    if (data.image) {
      cardImage.src = `data:image/jpeg;base64,${data.image}`;
    } else {
      cardImage.src = "../images/info-background.jpg";
      cardImage.alt = "No report image";
    }

    container.appendChild(clone);
  });
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / MY_REPORTS_PER_PAGE);
  const container = document.getElementById("myReportsPaginationContainer");
  if (!container) return;
  container.innerHTML = "";
  if (totalPages <= 1) return;

  const nav = document.createElement("nav");
  const ul = document.createElement("ul");
  ul.className = "pagination justify-content-center flex-wrap";

  const prevLi = document.createElement("li");
  prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prevLi.innerHTML = `<button class="page-link">&#8249; Prev</button>`;
  prevLi.querySelector("button").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      applyPaginationAndRender();
    }
  });
  ul.appendChild(prevLi);

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    li.innerHTML = `<button class="page-link">${i}</button>`;
    li.querySelector("button").addEventListener("click", () => {
      currentPage = i;
      applyPaginationAndRender();
    });
    ul.appendChild(li);
  }

  const nextLi = document.createElement("li");
  nextLi.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  nextLi.innerHTML = `<button class="page-link">Next &#8250;</button>`;
  nextLi.querySelector("button").addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      applyPaginationAndRender();
    }
  });
  ul.appendChild(nextLi);

  nav.appendChild(ul);
  container.appendChild(nav);
}

function renderPageInfo(total) {
  const infoEl = document.getElementById("myReportsPageInfo");
  if (!infoEl) return;
  if (total === 0) {
    infoEl.textContent = "";
    return;
  }
  const start = (currentPage - 1) * MY_REPORTS_PER_PAGE + 1;
  const end = Math.min(currentPage * MY_REPORTS_PER_PAGE, total);
  infoEl.textContent = `Showing ${start}–${end} of ${total} report${total !== 1 ? "s" : ""}`;
}

function applyPaginationAndRender() {
  const startIndex = (currentPage - 1) * MY_REPORTS_PER_PAGE;
  const paginated = myReports.slice(
    startIndex,
    startIndex + MY_REPORTS_PER_PAGE,
  );
  renderMyReports(paginated);
  renderPagination(myReports.length);
  renderPageInfo(myReports.length);
}

async function displayPreviousSearches(user) {
  const searchesContainer = document.getElementById("my-previous-searches");
  if (!searchesContainer) return;
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
      emptyItem.className = "list-group-item text-muted";
      emptyItem.textContent = "No previous searches yet.";
      searchesContainer.appendChild(emptyItem);
    }
  } catch (error) {
    console.error("Error loading previous searches:", error);
  }
}

async function displayMyReports(user) {
  const container = document.getElementById("my-crowd-reports");
  if (!container) return;
  container.innerHTML = `<p class="text-muted">Loading your reports...</p>`;

  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    myReports = snapshot.docs
      .map((doc) => doc.data())
      .filter((d) => d.userId === user.uid);
    currentPage = 1;
    applyPaginationAndRender();
  } catch (error) {
    console.error("Error loading reports:", error);
    container.innerHTML = `<p class="text-danger">Failed to load your reports. Please try again.</p>`;
  }
}

onAuthReady((user) => {
  if (!user) return;
  displayPreviousSearches(user);
  displayMyReports(user);
});
