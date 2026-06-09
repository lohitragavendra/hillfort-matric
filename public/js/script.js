const slides = Array.from(document.querySelectorAll("[data-slide]"));
const dotWrap = document.querySelector("[data-dots]");
const prevButton = document.querySelector("[data-prev]");
const nextButton = document.querySelector("[data-next]");
const testimonialHost = document.querySelector("[data-testimonial]");
const testimonialTemplate = document.querySelector("#testimonial-template");
const testPrev = document.querySelector("[data-test-prev]");
const testNext = document.querySelector("[data-test-next]");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const galleryItems = Array.from(document.querySelectorAll("[data-category]"));
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImg = document.querySelector("[data-lightbox-img]");
const lightboxClose = document.querySelector(".lightbox-close");

// Create modal overlay on page load
function createModalOverlay() {
  if (document.querySelector(".modal-overlay")) return;
  
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-icon success">✓</div>
      <h2 data-modal-title>Success</h2>
      <p data-modal-message>Your message has been sent successfully.</p>
      <div class="modal-actions">
        <button class="modal-button modal-button-primary" data-close-modal>Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Add event listener for close button
  overlay.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
}

function showModal(title, message, type = "success") {
  createModalOverlay();
  const overlay = document.querySelector(".modal-overlay");
  const titleEl = overlay.querySelector("[data-modal-title]");
  const messageEl = overlay.querySelector("[data-modal-message]");
  const icon = overlay.querySelector(".modal-icon");
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  icon.className = `modal-icon ${type}`;
  if (type === "success") {
    icon.textContent = "✓";
  } else if (type === "error") {
    icon.textContent = "✕";
  }
  
  overlay.classList.add("is-active");
}

function closeModal() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) {
    overlay.classList.remove("is-active");
  }
}

// Close modal on overlay click
document.addEventListener("click", (e) => {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay && e.target === overlay) {
    closeModal();
  }
});

const fallbackTestimonials = [
  {
    quote: "My child has become more confident, expressive, and eager to learn. The teachers are approachable and the campus feels warm and safe.",
    name: "Mrs. Priya S.",
    role: "Parent of Grade III student"
  },
  {
    quote: "The school balances academics and activities beautifully. We see visible growth in discipline, communication, and social confidence.",
    name: "Mr. Rakesh M.",
    role: "Parent of Grade VII student"
  },
  {
    quote: "The kindergarten environment is joyful and thoughtful. Our daughter settled in quickly and now loves coming to school every day.",
    name: "Mrs. Anitha K.",
    role: "Parent of Pre-KG student"
  }
];

let currentSlide = 0;
let testimonialIndex = 0;
let testimonials = [...fallbackTestimonials];
let slideTimer;
let testimonialTimer;

function showSlide(index) {
  if (!slides.length) return;
  currentSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === currentSlide));
  if (dotWrap) {
    Array.from(dotWrap.children).forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === currentSlide));
  }
}

function buildDots() {
  if (!dotWrap) return;
  dotWrap.innerHTML = slides.map((_, index) => `<button type="button" aria-label="Go to slide ${index + 1}"></button>`).join("");
  Array.from(dotWrap.children).forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      resetSlideTimer();
    });
  });
}

function resetSlideTimer() {
  if (!slides.length) return;
  clearInterval(slideTimer);
  slideTimer = setInterval(() => showSlide(currentSlide + 1), 6500);
}

function renderTestimonial(index) {
  if (!testimonialHost || !testimonialTemplate) return;
  if (!testimonials.length) {
    testimonialHost.innerHTML = `
      <article class="testimonial-content">
        <div class="stars" aria-hidden="true">★★★★★</div>
        <p>Testimonials are waiting for admin approval.</p>
        <div><strong>Hillfort Matriculation Higher Secondary School</strong><span>Be the first to share feedback.</span></div>
      </article>
    `;
    return;
  }

  const testimonial = testimonials[(index + testimonials.length) % testimonials.length];
  const fragment = testimonialTemplate.content.cloneNode(true);
  fragment.querySelector("[data-quote]").textContent = testimonial.quote;
  fragment.querySelector("[data-name]").textContent = testimonial.name;
  fragment.querySelector("[data-role]").textContent = testimonial.role;
  testimonialHost.replaceChildren(fragment);
}

function resetTestimonialTimer() {
  if (!testimonialHost || !testimonialTemplate) return;
  clearInterval(testimonialTimer);
  if (testimonials.length < 2) return;
  testimonialTimer = setInterval(() => {
    testimonialIndex += 1;
    renderTestimonial(testimonialIndex);
  }, 7000);
}

async function loadTestimonials() {
  if (!testimonialHost || !testimonialTemplate) return;

  try {
    const response = await fetch("/api/testimonials", {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Unable to load testimonials right now.");
    }

    const data = await response.json();
    testimonials = Array.isArray(data.testimonials) && data.testimonials.length ? data.testimonials : [...fallbackTestimonials];
  } catch {
    testimonials = [...fallbackTestimonials];
  }

  testimonialIndex = 0;
  renderTestimonial(0);
  resetTestimonialTimer();
}

function openLightbox(src, alt) {
  if (!src || src.startsWith("file:") || !lightbox || !lightboxImg) {
    return;
  }
  lightboxImg.src = src;
  lightboxImg.alt = alt;
  lightbox.hidden = false;
}

function closeLightbox() {
  if (!lightbox || !lightboxImg) return;
  lightbox.hidden = true;
  lightboxImg.src = "";
}

function animateCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.counter);
      const duration = 1300;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.floor(target * progress).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach((counter) => observer.observe(counter));
}

function setupRevealAnimations() {
  const items = document.querySelectorAll(".reveal");

  // Stagger reveal timings inside visual groups so cards animate sequentially.
  const groupedContainers = document.querySelectorAll(
    ".card-grid, .stats-grid, .message-grid, .admission-grid, .news-grid, .timeline, .gallery-grid, .contact-grid, .form-grid, .testimonial-shell"
  );

  groupedContainers.forEach((container) => {
    const groupedItems = container.querySelectorAll(".reveal");
    groupedItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index, 6) * 90}ms`;
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  }, { threshold: 0.14 });

  items.forEach((item) => observer.observe(item));
}

function filterGallery(category) {
  galleryItems.forEach((item) => {
    const matches = category === "all" || item.dataset.category === category;
    item.style.display = matches ? "block" : "none";
  });
}

function setupGallery() {
  if (!filterButtons.length || !galleryItems.length) return;
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      filterGallery(button.dataset.filter);
    });
  });

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => openLightbox(item.dataset.full, item.querySelector("img").alt));
  });
}

function setupMobileNav() {
  if (!navToggle || !navLinks) return;
  navToggle?.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    navLinks.classList.toggle("is-open");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  closeLightbox();

  if (slides.length) {
    buildDots();
    showSlide(0);
    resetSlideTimer();
  }

  if (testimonialHost && testimonialTemplate) {
    loadTestimonials();
  }

  setupMobileNav();
  setupGallery();
  animateCounters();
  setupRevealAnimations();

  prevButton?.addEventListener("click", () => {
    showSlide(currentSlide - 1);
    resetSlideTimer();
  });

  nextButton?.addEventListener("click", () => {
    showSlide(currentSlide + 1);
    resetSlideTimer();
  });

  if (testimonialHost && testimonialTemplate) {
    testPrev?.addEventListener("click", () => {
      testimonialIndex -= 1;
      renderTestimonial(testimonialIndex);
      resetTestimonialTimer();
    });

    testNext?.addEventListener("click", () => {
      testimonialIndex += 1;
      renderTestimonial(testimonialIndex);
      resetTestimonialTimer();
    });
  }

  document.querySelector("#testimonial-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = form.querySelector("[data-testimonial-status]");
    const submitButton = form.querySelector('button[type="submit"]');

    if (status) {
      status.textContent = "Sending your testimonial...";
    }

    submitButton?.setAttribute("disabled", "disabled");

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/testimonials/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to submit your testimonial.");
      }

      form.reset();
      if (status) {
        status.textContent = "Thanks. Your testimonial has been sent.";
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });

  document.querySelector("#contact-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton?.setAttribute("disabled", "disabled");

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/forms/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to submit your message.");
      }

      form.reset();
      showModal("Message Sent", "Thank you! We've received your enquiry. Our team will get back to you soon.", "success");
    } catch (error) {
      showModal("Error", error.message, "error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });

  document.querySelector("#enquiry-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton?.setAttribute("disabled", "disabled");

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/forms/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to submit your enquiry.");
      }

      form.reset();
      showModal("Enquiry Sent", "Thank you for your interest! We'll review your application and contact you shortly.", "success");
    } catch (error) {
      showModal("Error", error.message, "error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });

  document.querySelector("#newsletter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const email = input.value;
    showModal("Subscribed", `Thanks for subscribing, ${email}. We'll keep you updated.`, "success");
    event.currentTarget.reset();
  });

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target === lightboxClose) {
      closeLightbox();
    }
  });

  lightboxClose?.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });

  // NEWS & EVENTS FUNCTIONALITY
  const newsGrid = document.querySelector("[data-news-grid]");
  const calendarGrid = document.querySelector("[data-calendar-grid]");
  const calendarMonth = document.getElementById("calendar-month");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const calendarEventsContainer = document.getElementById("calendar-events");

  if (newsGrid || calendarGrid) {
    let currentDate = new Date();
    let newsEventsData = [];

    async function loadNewsAndEvents() {
      try {
        const response = await fetch("/api/news-events");
        const data = await response.json();
        newsEventsData = data.newsEvents || [];
        renderNewsCards();
        renderCalendar();
      } catch (error) {
        console.error("Failed to load news and events:", error);
      }
    }

    function renderNewsCards() {
      if (!newsGrid) return;
      
      newsGrid.innerHTML = "";
      
      if (newsEventsData.length === 0) {
        newsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">No news or events published yet.</p>';
        return;
      }

      newsEventsData.forEach(item => {
        const date = new Date(item.eventDate || item.createdAt);
        const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        
        const card = document.createElement("article");
        card.className = "news-card reveal";
        card.innerHTML = `
          <span class="news-date">${dateStr}</span>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
        `;
        newsGrid.appendChild(card);
      });

      // Re-apply reveal animations
      setupRevealAnimations();
    }

    function renderCalendar() {
      if (!calendarGrid) return;

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Update month display
      const monthName = currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      if (calendarMonth) calendarMonth.textContent = monthName;
      if (calendarEventsContainer) {
        calendarEventsContainer.innerHTML = "";
      }

      // Get first day and number of days in month
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      calendarGrid.innerHTML = "";

      // Add day headers
      const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      dayHeaders.forEach(day => {
        const header = document.createElement("span");
        header.className = "calendar-day-label";
        header.textContent = day;
        calendarGrid.appendChild(header);
      });

      // Add empty cells for days before month starts
      const adjustedFirstDay = (firstDay + 6) % 7; // Adjust so Monday is 0
      for (let i = 0; i < adjustedFirstDay; i++) {
        const empty = document.createElement("span");
        calendarGrid.appendChild(empty);
      }

      // Add day cells with event highlighting
      for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement("span");
        dayCell.textContent = day;
        dayCell.setAttribute("data-date", day);

        const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const eventsOnDay = newsEventsData.filter(item => {
          const itemDate = new Date(item.eventDate || item.createdAt);
          const itemDateString = itemDate.toISOString().split("T")[0];
          return itemDateString === dateString;
        });

        if (eventsOnDay.length > 0) {
          dayCell.classList.add("has-event");
          dayCell.addEventListener("click", () => showDayEvents(day, month, year, eventsOnDay));
        }

        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
          dayCell.classList.add("is-highlighted");
        }

        calendarGrid.appendChild(dayCell);
      }
    }

    function showDayEvents(day, month, year, events) {
      if (!calendarEventsContainer) return;

      const dateDisplay = new Date(year, month, day).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      let html = `<div class="calendar-events-title">${dateDisplay}</div>`;
      events.forEach(event => {
        html += `<div class="calendar-event-item">📌 ${event.title}</div>`;
      });

      calendarEventsContainer.innerHTML = html;
    }

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
      });
    }

    // Load news and events on page load
    renderCalendar();
    loadNewsAndEvents();
  }
});
