class SectionManager {
  constructor() {
    this.sections = document.querySelectorAll(".section");
    this.navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link");
    this.mobileMenuBtn = document.querySelector(".mobile-menu-btn");
    this.mobileNav = document.querySelector(".mobile-nav");
    this.currentSection = "about";
    this.isTransitioning = false;
    this.transitionDuration = 200;

    this.init();
  }

  init() {
    const hash = window.location.hash.slice(1);
    if (hash && document.getElementById(hash)) {
      this.currentSection = hash;
    }

    this.showSection(this.currentSection, false);
    this.navLinks.forEach((link) => {
      link.addEventListener("click", (e) => this.handleNavClick(e));
    });

    const logo = document.querySelector(".nav-logo");
    if (logo) {
      logo.addEventListener("click", (e) => this.handleNavClick(e));
    }
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener("click", () =>
        this.toggleMobileMenu(),
      );
    }

    window.addEventListener("popstate", () => this.handlePopState());
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  handleNavClick(e) {
    e.preventDefault();

    const targetSection = e.currentTarget.dataset.section;
    if (
      !targetSection ||
      targetSection === this.currentSection ||
      this.isTransitioning
    ) {
      return;
    }

    this.closeMobileMenu();
    this.navigateToSection(targetSection);
  }

  navigateToSection(sectionId, pushState = true) {
    if (this.isTransitioning || sectionId === this.currentSection) return;

    const targetSection = document.getElementById(sectionId);
    if (!targetSection) return;

    this.isTransitioning = true;
    document.body.classList.add("transitioning");

    if (pushState) {
      history.pushState({ section: sectionId }, "", `#${sectionId}`);
    }

    const currentSectionEl = document.getElementById(this.currentSection);

    if (currentSectionEl) {
      currentSectionEl.classList.add("exiting");
      currentSectionEl.classList.remove("visible");
    }

    setTimeout(() => {
      this.sections.forEach((section) => {
        section.classList.remove("active", "visible", "exiting", "entering");
      });

      // Show target section
      targetSection.classList.add("active", "entering");

      // Trigger reflow for animation
      void targetSection.offsetWidth;

      // Make visible (triggers staggered animations)
      requestAnimationFrame(() => {
        targetSection.classList.add("visible");
        targetSection.classList.remove("entering");
      });

      // Update current section
      this.currentSection = sectionId;

      // Update nav active states
      this.updateNavActiveState(sectionId);

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });

      // End transition
      setTimeout(() => {
        this.isTransitioning = false;
        document.body.classList.remove("transitioning");
      }, this.transitionDuration);
    }, this.transitionDuration / 2);
  }

  showSection(sectionId, animate = true) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    // Hide all sections
    this.sections.forEach((s) => {
      s.classList.remove("active", "visible");
    });

    // Show target section
    section.classList.add("active");

    if (animate) {
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        section.classList.add("visible");
      });
    } else {
      section.classList.add("visible");
    }

    // Update nav
    this.updateNavActiveState(sectionId);

    // Update URL without triggering popstate
    if (window.location.hash.slice(1) !== sectionId) {
      history.replaceState({ section: sectionId }, "", `#${sectionId}`);
    }
  }

  updateNavActiveState(sectionId) {
    this.navLinks.forEach((link) => {
      if (link.dataset.section === sectionId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  handlePopState() {
    const hash = window.location.hash.slice(1);
    const targetSection = hash || "about";

    if (document.getElementById(targetSection)) {
      this.navigateToSection(targetSection, false);
    }
  }

  handleKeyDown(e) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this.navigateToAdjacentSection(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this.navigateToAdjacentSection(-1);
    }
  }

  navigateToAdjacentSection(direction) {
    const sectionIds = Array.from(this.sections).map((s) => s.id);
    const currentIndex = sectionIds.indexOf(this.currentSection);
    const newIndex = Math.max(
      0,
      Math.min(sectionIds.length - 1, currentIndex + direction),
    );

    if (newIndex !== currentIndex) {
      this.navigateToSection(sectionIds[newIndex]);
    }
  }

  toggleMobileMenu() {
    this.mobileMenuBtn.classList.toggle("active");
    this.mobileNav.classList.toggle("active");
  }

  closeMobileMenu() {
    this.mobileMenuBtn.classList.remove("active");
    this.mobileNav.classList.remove("active");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const sectionManager = new SectionManager();
});
