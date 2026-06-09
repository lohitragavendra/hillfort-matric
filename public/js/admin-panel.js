const statusText = document.querySelector("[data-admin-status]");
const refreshButton = document.querySelector("[data-refresh]");
const logoutButton = document.querySelector("[data-logout]");
const tabButtons = document.querySelectorAll(".admin-tab-button");
const tabContents = document.querySelectorAll("[data-tab-content]");

const pendingTestimonialsList = document.querySelector("[data-pending-testimonials]");
const historyTestimonialsList = document.querySelector("[data-history-testimonials]");
const contactFormsList = document.querySelector("[data-contact-forms]");
const admissionFormsList = document.querySelector("[data-admission-forms]");
const publishedNewsList = document.querySelector("[data-published-news]");
const draftNewsList = document.querySelector("[data-draft-news]");
const newsForm = document.querySelector("[data-news-form]");
const statsContainer = document.querySelector("[data-stats-container]");

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

async function fetchJson(url, options = {}) {
  const fetchOptions = {
    headers: {
      Accept: "application/json",
      ...options.headers
    },
    // Ensure cookies (session) are sent for same-origin admin APIs
    credentials: (options.credentials !== undefined) ? options.credentials : "same-origin",
    ...options
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function createBadge(label, status) {
  const badge = document.createElement("span");
  badge.className = `admin-badge is-${status}`;
  badge.textContent = label;
  return badge;
}

function createEmptyState(message) {
  const empty = document.createElement("p");
  empty.className = "admin-empty";
  empty.textContent = message;
  return empty;
}

function createTestimonialCard(testimonial, includeActions) {
  const card = document.createElement("article");
  card.className = "admin-testimonial-card";

  const topRow = document.createElement("div");
  topRow.className = "admin-testimonial-top";

  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = testimonial.name;
  const role = document.createElement("span");
  role.textContent = testimonial.role;
  identity.append(name, role);

  topRow.append(identity, createBadge(testimonial.status, testimonial.status));

  const quote = document.createElement("p");
  quote.className = "admin-quote";
  quote.textContent = testimonial.quote;

  const meta = document.createElement("p");
  meta.className = "admin-meta";
  meta.textContent = `${new Date(testimonial.createdAt).toLocaleString()}${testimonial.email ? ` · ${testimonial.email}` : ""}`;

  card.append(topRow, quote, meta);

  const actions = document.createElement("div");
  actions.className = "admin-actions-row";

  if (includeActions) {
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "button button-primary";
    approveButton.textContent = "Approve";
    approveButton.addEventListener("click", () => moderateTestimonial(testimonial.id, "approve"));

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "button button-secondary";
    rejectButton.textContent = "Reject";
    rejectButton.addEventListener("click", () => moderateTestimonial(testimonial.id, "reject"));

    actions.append(approveButton, rejectButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button button-secondary";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteTestimonial(testimonial.id));

  actions.append(deleteButton);
  card.append(actions);

  return card;
}

function createFormCard(form, type) {
  const card = document.createElement("article");
  card.className = "admin-form-card";

  const topRow = document.createElement("div");
  topRow.className = "admin-form-top";

  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = form.name;
  const email = document.createElement("span");
  email.textContent = form.email;
  identity.append(name, email);

  topRow.append(identity, createBadge(form.status, form.status));

  const content = document.createElement("p");
  content.className = "admin-form-content";
  
  if (type === "contact") {
    content.textContent = form.message;
  } else if (type === "admissions") {
    content.textContent = `Grade: ${form.grade} | ${form.message}`;
  }

  const meta = document.createElement("p");
  meta.className = "admin-meta";
  meta.textContent = `Phone: ${form.phone} | Submitted: ${new Date(form.createdAt).toLocaleString()}`;

  card.append(topRow, content, meta);

  const actions = document.createElement("div");
  actions.className = "admin-actions-row";

  const reviewButton = document.createElement("button");
  reviewButton.type = "button";
  reviewButton.className = "button button-primary";
  reviewButton.textContent = form.status === "new" ? "Mark as Reviewed" : "Reviewed";
  reviewButton.disabled = form.status === "reviewed";
  reviewButton.addEventListener("click", () => markFormReviewed(form.id, type));

  actions.append(reviewButton);
  card.append(actions);

  return card;
}

function createNewsCard(newsEvent) {
  const card = document.createElement("article");
  card.className = "admin-news-card";

  const header = document.createElement("div");
  header.className = "admin-news-card-header";

  const titleDiv = document.createElement("div");
  titleDiv.className = "admin-news-card-title";
  const title = document.createElement("strong");
  title.textContent = newsEvent.title;
  const date = document.createElement("span");
  date.className = "admin-news-card-date";
  date.textContent = newsEvent.eventDate
    ? new Date(newsEvent.eventDate).toLocaleDateString("en-IN")
    : "No date";
  titleDiv.append(title, date);

  header.append(titleDiv, createBadge(newsEvent.published ? "Published" : "Draft", newsEvent.published ? "approved" : "pending"));

  const description = document.createElement("p");
  description.className = "admin-news-card-description";
  description.textContent = newsEvent.description;

  const actions = document.createElement("div");
  actions.className = "admin-news-card-actions";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "button " + (newsEvent.published ? "button-secondary" : "button-primary");
  toggleButton.textContent = newsEvent.published ? "Unpublish" : "Publish";
  toggleButton.addEventListener("click", () => togglePublishNews(newsEvent.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button button-secondary";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteNews(newsEvent.id));

  actions.append(toggleButton, deleteButton);
  card.append(header, description, actions);

  return card;
}

async function addNews(event) {
  event.preventDefault();
  try {
    setStatus("Adding news/event...");
    
    const title = document.getElementById("news-title")?.value?.trim();
    const description = document.getElementById("news-description")?.value?.trim();
    const eventDate = document.getElementById("news-date")?.value || null;

    if (!title || !description) {
      setStatus("Title and description are required.");
      return;
    }

    const newsEvent = await fetchJson("/api/admin/news-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        eventDate
      })
    });

    newsForm.reset();
    await loadAdminDashboard();
    setStatus("News/Event added successfully.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function togglePublishNews(id) {
  try {
    setStatus("Updating publication status...");
    await fetchJson(`/api/admin/news-events/${id}/publish`, { method: "POST" });
    await loadAdminDashboard();
    setStatus("Publication status updated.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteNews(id) {
  if (!confirm("Are you sure you want to delete this news/event?")) {
    return;
  }

  try {
    setStatus("Deleting news/event...");
    await fetchJson(`/api/admin/news-events/${id}`, { method: "DELETE" });
    await loadAdminDashboard();
    setStatus("News/Event deleted.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function moderateTestimonial(id, action) {
  try {
    setStatus(action === "approve" ? "Approving testimonial..." : "Rejecting testimonial...");
    await fetchJson(`/api/admin/testimonials/${id}/${action}`, { method: "POST" });
    await loadAdminDashboard();
    setStatus(action === "approve" ? "Testimonial approved." : "Testimonial rejected.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteTestimonial(id) {
  if (!confirm("Are you sure you want to delete this testimonial?")) {
    return;
  }

  try {
    setStatus("Deleting testimonial...");
    await fetchJson(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    await loadAdminDashboard();
    setStatus("Testimonial deleted.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function markFormReviewed(id, type) {
  try {
    const endpoint = type === "contact" ? `/api/admin/forms/contact/${id}/review` : `/api/admin/forms/admissions/${id}/review`;
    await fetchJson(endpoint, { method: "POST" });
    await loadAdminDashboard();
    setStatus("Form marked as reviewed.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadAdminDashboard() {
  try {
    const testimonialData = await fetchJson("/api/admin/testimonials");
    const contactData = await fetchJson("/api/admin/forms/contact");
    const admissionData = await fetchJson("/api/admin/forms/admissions");
    const newsData = await fetchJson("/api/admin/news-events");

    if (!testimonialData || !contactData || !admissionData || !newsData) {
      return;
    }

    // Update stats
    if (statsContainer) {
      statsContainer.innerHTML = `
        <article class="admin-stat">
          <strong>${testimonialData.summary.pending}</strong>
          <span>Pending Testimonials</span>
        </article>
        <article class="admin-stat">
          <strong>${testimonialData.summary.approved}</strong>
          <span>Approved</span>
        </article>
        <article class="admin-stat">
          <strong>${contactData.summary.new}</strong>
          <span>New Contact Forms</span>
        </article>
        <article class="admin-stat">
          <strong>${admissionData.summary.new}</strong>
          <span>New Admissions</span>
        </article>
        <article class="admin-stat">
          <strong>${newsData.summary.published}</strong>
          <span>Published News/Events</span>
        </article>
      `;
    }

    // Update testimonials
    const sortedTestimonials = [...testimonialData.testimonials].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const pendingTestimonials = sortedTestimonials.filter((testimonial) => testimonial.status === "pending");
    const reviewedTestimonials = sortedTestimonials.filter((testimonial) => testimonial.status !== "pending");

    if (pendingTestimonialsList) {
      pendingTestimonialsList.replaceChildren(
        ...(pendingTestimonials.length
          ? pendingTestimonials.map((testimonial) => createTestimonialCard(testimonial, true))
          : [createEmptyState("No pending testimonials.")])
      );
    }

    if (historyTestimonialsList) {
      historyTestimonialsList.replaceChildren(
        ...(reviewedTestimonials.length
          ? reviewedTestimonials.map((testimonial) => createTestimonialCard(testimonial, false))
          : [createEmptyState("No reviewed testimonials yet.")])
      );
    }

    // Update contact forms
    if (contactFormsList) {
      const sortedContactForms = [...contactData.forms].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      contactFormsList.replaceChildren(
        ...(sortedContactForms.length
          ? sortedContactForms.map((form) => createFormCard(form, "contact"))
          : [createEmptyState("No contact forms yet.")])
      );
    }

    // Update admission forms
    if (admissionFormsList) {
      const sortedAdmissionForms = [...admissionData.forms].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      admissionFormsList.replaceChildren(
        ...(sortedAdmissionForms.length
          ? sortedAdmissionForms.map((form) => createFormCard(form, "admissions"))
          : [createEmptyState("No admission enquiries yet.")])
      );
    }

    // Update news and events
    if (publishedNewsList && draftNewsList) {
      const publishedNews = newsData.newsEvents.filter(n => n.published);
      const draftNews = newsData.newsEvents.filter(n => !n.published);

      publishedNewsList.replaceChildren(
        ...(publishedNews.length
          ? publishedNews.map((item) => createNewsCard(item))
          : [createEmptyState("No published news/events yet.")])
      );

      draftNewsList.replaceChildren(
        ...(draftNews.length
          ? draftNews.map((item) => createNewsCard(item))
          : [createEmptyState("No draft news/events.")])
      );
    }
  } catch (error) {
    setStatus(error.message);
  }
}

// Tab switching
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.getAttribute("data-tab");

    tabButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");

    tabContents.forEach((content) => {
      const contentTab = content.getAttribute("data-tab-content");
      if (contentTab === tabName) {
        content.classList.add("is-active");
      } else {
        content.classList.remove("is-active");
      }
    });
  });
});

logoutButton?.addEventListener("click", async () => {
  try {
    await fetchJson("/api/admin/logout", { method: "POST" });
    // Navigate to login page after successful logout
    window.location.href = "/admin/login";
  } catch (error) {
    setStatus(error.message);
  }
});

refreshButton?.addEventListener("click", () => {
  loadAdminDashboard().catch((error) => setStatus(error.message));
});

newsForm?.addEventListener("submit", addNews);

loadAdminDashboard().catch((error) => setStatus(error.message));