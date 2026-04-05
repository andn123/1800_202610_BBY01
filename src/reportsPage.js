// added sorting, search, and pagination to reports page
import { db } from "./firebaseConfig.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthReady } from "./authentication.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const REPORTS_PER_PAGE = 12;
const CROWD_RANK = { busy: 3, normal: 2, quiet: 1 };

// ─── State ────────────────────────────────────────────────────────────────────
let allReports = [];
let currentPage = 1;

// ─── UI Helpers ───────────────────────────────────────────────────────────────
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

// ─── Render ───────────────────────────────────────────────────────────────────
function renderReports(reportsToShow) {
  const reportsContainer = document.getElementById("crowd-reports");
  const template = document.getElementById("crowdCardTemplate");

  if (!reportsContainer || !template) return;

  reportsContainer.innerHTML = "";

  if (reportsToShow.length === 0) {
    showNoResultsMessage();
    return;
  }

  hideNoResultsMessage();

  reportsToShow.forEach((data) => {
    const clone = template.content.cloneNode(true);

    const cardTitle = clone.querySelector(".card-title");
    const cardImage = clone.querySelector(".card-img-top");
    const cardAddress = clone.querySelector(".report-address");
    const cardCrowdLevel = clone.querySelector(".report-crowd");
    const cardCreatedAt = clone.querySelector(".report-created-at");
    const cardCreatedBy = clone.querySelector(".report-created-by");

    cardTitle.textContent = data.location;
    cardAddress.textContent = data.address
      ? `Address: ${data.address}`
      : `Location ID: ${data.monitorPointId || "N/A"}`;

    // Crowd level badge
    const levelLower = (data.crowdLevel || "").toLowerCase();
    const badgeClass =
      levelLower === "busy"
        ? "badge bg-danger"
        : levelLower === "normal"
          ? "badge bg-warning text-dark"
          : "badge bg-success";
    cardCrowdLevel.innerHTML = `Crowd level: <span class="${badgeClass}">${data.crowdLevel}</span>`;

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
      cardImage.src = "../images/info-background.jpg";
    }

    reportsContainer.appendChild(clone);
  });
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function renderPagination(totalReports) {
  const totalPages = Math.ceil(totalReports / REPORTS_PER_PAGE);
  const container = document.getElementById("paginationContainer");
  if (!container) return;

  container.innerHTML = "";

  if (totalPages <= 1) return;

  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Reports pagination");
  const ul = document.createElement("ul");
  ul.className = "pagination justify-content-center flex-wrap";

  // Previous button
  const prevLi = document.createElement("li");
  prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prevLi.innerHTML = `<button class="page-link" aria-label="Previous">&#8249; Prev</button>`;
  prevLi.querySelector("button").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      applyFiltersAndRender();
    }
  });
  ul.appendChild(prevLi);

  // Page number buttons
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    li.innerHTML = `<button class="page-link">${i}</button>`;
    li.querySelector("button").addEventListener("click", () => {
      currentPage = i;
      applyFiltersAndRender();
    });
    ul.appendChild(li);
  }

  // Next button
  const nextLi = document.createElement("li");
  nextLi.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  nextLi.innerHTML = `<button class="page-link" aria-label="Next">Next &#8250;</button>`;
  nextLi.querySelector("button").addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      applyFiltersAndRender();
    }
  });
  ul.appendChild(nextLi);

  nav.appendChild(ul);
  container.appendChild(nav);
}

function renderPageInfo(filtered) {
  const infoEl = document.getElementById("pageInfo");
  if (!infoEl) return;
  const start =
    filtered.length === 0 ? 0 : (currentPage - 1) * REPORTS_PER_PAGE + 1;
  const end = Math.min(currentPage * REPORTS_PER_PAGE, filtered.length);
  infoEl.textContent =
    filtered.length === 0
      ? ""
      : `Showing ${start}–${end} of ${filtered.length} report${filtered.length !== 1 ? "s" : ""}`;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

/**
 * Compute how many posts each (location + crowdLevel) pair has.
 * Used as a tie-breaker when two "busy" reports are from the same location.
 */
function buildPostCountMap(reports) {
  const map = {};
  reports.forEach((r) => {
    const key = `${(r.location || "").toLowerCase()}|${(r.crowdLevel || "").toLowerCase()}`;
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function sortReports(reports, sortOption) {
  const sorted = [...reports];

  if (sortOption === "crowded") {
    const postCountMap = buildPostCountMap(reports);

    sorted.sort((a, b) => {
      const aLevel = (a.crowdLevel || "").trim().toLowerCase();
      const bLevel = (b.crowdLevel || "").trim().toLowerCase();

      const rankDiff = (CROWD_RANK[bLevel] || 0) - (CROWD_RANK[aLevel] || 0);
      if (rankDiff !== 0) return rankDiff;

      // Same crowd level — use post count as tie-breaker (only meaningful for "busy")
      const aKey = `${(a.location || "").toLowerCase()}|${aLevel}`;
      const bKey = `${(b.location || "").toLowerCase()}|${bLevel}`;
      const countDiff = (postCountMap[bKey] || 0) - (postCountMap[aKey] || 0);
      if (countDiff !== 0) return countDiff;

      // Final fallback: most recent
      const timeA = a.createdAt?.toDate()?.getTime() || 0;
      const timeB = b.createdAt?.toDate()?.getTime() || 0;
      return timeB - timeA;
    });
  } else {
    // Most recent
    sorted.sort((a, b) => {
      const timeA = a.createdAt?.toDate()?.getTime() || 0;
      const timeB = b.createdAt?.toDate()?.getTime() || 0;
      return timeB - timeA;
    });
  }

  return sorted;
}

// ─── Filter + Sort + Paginate + Render ────────────────────────────────────────
function applyFiltersAndRender() {
  const searchTerm = (
    document.getElementById("searchInput")?.value || ""
  ).toLowerCase();
  const sortOption = document.getElementById("sortSelect")?.value || "recent";

  // 1. Filter by search term (name or address)
  const filtered = allReports.filter((report) => {
    const nameMatch = (report.location || "")
      .toLowerCase()
      .includes(searchTerm);
    const addressMatch = (report.address || "")
      .toLowerCase()
      .includes(searchTerm);
    return nameMatch || addressMatch;
  });

  // 2. Sort
  const sorted = sortReports(filtered, sortOption);

  // 3. Paginate
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginated = sorted.slice(startIndex, startIndex + REPORTS_PER_PAGE);

  // 4. Render
  renderReports(paginated);
  renderPagination(sorted.length);
  renderPageInfo(sorted);

  // Scroll to top of list on page change
  document
    .getElementById("crowd-reports")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Data Fetch ───────────────────────────────────────────────────────────────
async function displayReports() {
  showLoadingMessage();

  try {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allReports = snapshot.docs.map((doc) => doc.data());
    hideLoadingMessage();
    applyFiltersAndRender();
  } catch (error) {
    console.error("Error loading reports:", error);
    showErrorMessage("Failed to load reports. Please try again later.");
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupControls() {
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1; // reset to first page on new search
      applyFiltersAndRender();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentPage = 1; // reset to first page on sort change
      applyFiltersAndRender();
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onAuthReady(() => {
  setupControls();
  displayReports();
});
