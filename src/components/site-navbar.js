// Import specific functions from the Firebase Auth SDK
import { onAuthStateChanged } from "firebase/auth"; //Detect login state
import { auth } from "/src/firebaseConfig.js"; //Firebase authentication connection
import { logoutUser } from "/src/authentication.js"; //Perform logout action

class SiteNavbar extends HTMLElement {
  constructor() {
    super();
    this.renderNavbar();
    this.renderAuthControls();
  }

  renderNavbar() {
    this.innerHTML = `
            <!-- Navbar: single source of truth -->
            <nav class="navbar navbar-expand-lg navbar-light" style="background-color: white;">
                <div class="container-fluid">
                    <a class="navbar-brand" href="/">
                        <img src="/images/ir-logo.png" height="36">
                        IntelliRoute
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent"
                        aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarSupportedContent">
                        <ul class="navbar-nav me-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/">Home</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/pages/search.html">Search</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/">Arrivals</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/">Help</a>
                            </li>
                        </ul>
                        <div class="d-flex align-items-center gap-2 ms-lg-2" id="rightControls">
                            <div id="authControls" class="auth-controls d-flex align-items-center gap-2 my-2 my-lg-0">
                                <!-- populated by JS -->
                            </div>
                        </div>

                    </div>
                </div>
            </nav>
        `;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");

    // Initialize with invisible placeholder to maintain layout space
    authControls.innerHTML = `<div class="btn btn-outline-light" style="visibility: hidden; min-width: 80px;">Log out</div>`;

    onAuthStateChanged(auth, (user) => {
      let updatedAuthControl;
      if (user) {
        updatedAuthControl = `<button class="btn btn-outline-secondary" id="signOutBtn" type="button" style="min-width: 80px; color: black;">Log out</button>`;
        authControls.innerHTML = updatedAuthControl;
        const signOutBtn = authControls.querySelector("#signOutBtn");
        signOutBtn?.addEventListener("click", logoutUser);
      } else {
        updatedAuthControl = `<a class="btn btn-outline-secondary" id="loginBtn" href="/pages/login.html" style="min-width: 80px; color: black;">Log in</a>`;
        authControls.innerHTML = updatedAuthControl;
      }
    });
  }
}

customElements.define("site-navbar", SiteNavbar);
