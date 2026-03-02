class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
            <!-- Footer: single source of truth -->
            <footer>
            <div class="footer-links" href="/">
                <a href="/pages/about.html">About Us</a>
            </div>
            <div class="copyright">
                <p>&copy; 2026 Team BBY01</p>
            </div>
            </footer>
        `;
  }
}

customElements.define("site-footer", SiteFooter);
