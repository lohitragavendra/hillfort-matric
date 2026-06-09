require("dotenv").config();

const crypto = require("crypto");
const path = require("path");

const bcrypt = require("bcryptjs");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/hillfort";
const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const sessionSecret = process.env.SESSION_SECRET;

// Needed so secure cookies work correctly behind HTTPS proxies in production.
app.set("trust proxy", 1);

// Validate required auth configuration
if (!adminUsername || !adminPasswordHash || !sessionSecret) {
  console.error("ERROR: Missing required environment variables:");
  if (!adminUsername) console.error("  - ADMIN_USERNAME");
  if (!adminPasswordHash) console.error("  - ADMIN_PASSWORD_HASH");
  if (!sessionSecret) console.error("  - SESSION_SECRET");
  console.error("\nPlease set these variables in your .env file or environment before starting the server.");
  process.exit(1);
}

// MongoDB Connection - fail fast if unavailable
let dbConnected = false;

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    dbConnected = true;
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    console.error("Cannot start application without database connection.");
    process.exit(1);
  });

// MongoDB Schemas
const testimonialSchema = new mongoose.Schema({
  id: { type: String, default: () => crypto.randomUUID(), unique: true },
  name: String,
  role: String,
  quote: String,
  email: String,
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: String
});

const contactFormSchema = new mongoose.Schema({
  id: { type: String, default: () => crypto.randomUUID(), unique: true },
  name: String,
  phone: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: String,
  status: { type: String, enum: ["new", "reviewed"], default: "new" }
});

const admissionFormSchema = new mongoose.Schema({
  id: { type: String, default: () => crypto.randomUUID(), unique: true },
  name: String,
  phone: String,
  email: String,
  grade: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: String,
  status: { type: String, enum: ["new", "reviewed"], default: "new" }
});

const newsEventSchema = new mongoose.Schema({
  id: { type: String, default: () => crypto.randomUUID(), unique: true },
  title: String,
  description: String,
  eventDate: Date,
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String
});

const Testimonial = mongoose.model("Testimonial", testimonialSchema);
const ContactForm = mongoose.model("ContactForm", contactFormSchema);
const AdmissionForm = mongoose.model("AdmissionForm", admissionFormSchema);
const NewsEvent = mongoose.model("NewsEvent", newsEventSchema);

// Seed data function
async function seedData() {
  const existingCount = await Testimonial.countDocuments();
  if (existingCount === 0) {
    const seedTestimonials = [
      {
        name: "Mrs. Priya S.",
        role: "Parent of Grade III student",
        quote: "My child has become more confident, expressive, and eager to learn. The teachers are approachable and the campus feels warm and safe.",
        email: "",
        status: "approved",
        createdAt: new Date("2026-04-01"),
        reviewedAt: new Date("2026-04-01"),
        reviewedBy: "seed"
      },
      {
        name: "Mr. Rakesh M.",
        role: "Parent of Grade VII student",
        quote: "The school balances academics and activities beautifully. We see visible growth in discipline, communication, and social confidence.",
        email: "",
        status: "approved",
        createdAt: new Date("2026-04-02"),
        reviewedAt: new Date("2026-04-02"),
        reviewedBy: "seed"
      },
      {
        name: "Mrs. Anitha K.",
        role: "Parent of Pre-KG student",
        quote: "The kindergarten environment is joyful and thoughtful. Our daughter settled in quickly and now loves coming to school every day.",
        email: "",
        status: "approved",
        createdAt: new Date("2026-04-03"),
        reviewedAt: new Date("2026-04-03"),
        reviewedBy: "seed"
      }
    ];

    await Testimonial.insertMany(seedTestimonials);
    console.log("Seed data inserted");
  }
}

seedData().catch(err => console.error("Seed data error:", err));

// Middleware
// Use Helmet for common security headers. Disable HSTS unless running in production
// to avoid browsers enforcing HTTPS (Strict-Transport-Security) on localhost/dev.
const enableHsts = (process.env.NODE_ENV === 'production' && process.env.ENABLE_HSTS === 'true');

app.use(helmet({
  hsts: enableHsts ? { maxAge: 31536000, includeSubDomains: true } : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'" ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["https://www.google.com"],
      connectSrc: ["'self'"]
    }
  }
}));

// If HSTS is not explicitly enabled, ensure the header is removed so browsers
// don't cache an HTTPS requirement for localhost or development environments.
if (!enableHsts) {
  app.use((req, res, next) => {
    // Some environments or proxies may still add HSTS; explicitly set
    // a zero max-age to ensure browsers will not enforce HTTPS for localhost.
    res.setHeader("Strict-Transport-Security", "max-age=0");
    next();
  });
}
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Determine secure cookie setting: false for localhost/development, "auto" for production with trust proxy
const isLocalhost = process.env.NODE_ENV !== "production";
app.use(
  session({
    secret: sessionSecret,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      touchAfter: 24 * 3600
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isLocalhost ? false : "auto",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// Helper Functions
function sanitizeText(value) {
  return String(value ?? "").trim();
}

function isAdminAuthenticated(req) {
  return Boolean(req.session?.adminUser);
}

function requireAdmin(req, res, next) {
  if (isAdminAuthenticated(req)) {
    return next();
  }
  return res.redirect("/admin/login");
}

function validateAuthConfiguration() {
  if (!adminUsername || !adminPasswordHash) {
    console.warn("Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH before using /admin.");
  }
}

// Routes - Middleware for serving admin pages
app.use((req, res, next) => {
  if (req.path === "/admin" || req.path === "/admin.html") {
    if (!isAdminAuthenticated(req)) {
      return res.redirect("/admin/login");
    }
    return res.sendFile(path.join(rootDir, "public", "admin.html"));
  }

  if (req.path === "/admin/login" || req.path === "/admin-login.html") {
    if (isAdminAuthenticated(req)) {
      return res.redirect("/admin");
    }
    return res.sendFile(path.join(rootDir, "public", "admin-login.html"));
  }

  if (req.path === "/admin-panel.js") {
    return requireAdmin(req, res, () => res.sendFile(path.join(rootDir, "public", "js", "admin-panel.js")));
  }

  next();
});

// Public API - Get approved testimonials
app.get("/api/testimonials", async (_req, res, next) => {
  try {
    const testimonials = await Testimonial.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .select("id name role quote createdAt");

    res.json({ testimonials });
  } catch (error) {
    next(error);
  }
});

// Public API - Submit testimonial
app.post("/api/testimonials/submit", async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name);
    const role = sanitizeText(req.body.role);
    const email = sanitizeText(req.body.email);
    const quote = sanitizeText(req.body.testimonial || req.body.quote || req.body.message);

    if (!name || !role || !quote) {
      return res.status(400).json({ message: "Name, role, and testimonial are required." });
    }

    const testimonial = new Testimonial({
      name,
      role,
      quote,
      email,
      status: "pending"
    });

    await testimonial.save();
    res.status(201).json({ message: "Your testimonial has been sent." });
  } catch (error) {
    next(error);
  }
});

// Public API - Submit contact form
app.post("/api/forms/contact", async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name);
    const phone = sanitizeText(req.body.phone);
    const email = sanitizeText(req.body.email);
    const message = sanitizeText(req.body.message);

    if (!name || !phone || !email || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const contactForm = new ContactForm({
      name,
      phone,
      email,
      message
    });

    await contactForm.save();
    res.status(201).json({ message: "Your message has been received." });
  } catch (error) {
    next(error);
  }
});

// Public API - Submit admission form
app.post("/api/forms/admissions", async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name);
    const phone = sanitizeText(req.body.phone);
    const email = sanitizeText(req.body.email);
    const grade = sanitizeText(req.body.grade);
    const message = sanitizeText(req.body.message);

    if (!name || !phone || !email || !grade || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const admissionForm = new AdmissionForm({
      name,
      phone,
      email,
      grade,
      message
    });

    await admissionForm.save();
    res.status(201).json({ message: "Your enquiry has been received." });
  } catch (error) {
    next(error);
  }
});

// Admin API - Login
app.post("/api/admin/login", async (req, res, next) => {
  try {
    validateAuthConfiguration();

    if (!adminUsername || !adminPasswordHash) {
      return res.status(503).send("Admin login is not configured on this server.");
    }

    const username = sanitizeText(req.body.username);
    const password = sanitizeText(req.body.password);

    const usernameMatches = username === adminUsername;
    const passwordMatches = await bcrypt.compare(password, adminPasswordHash);

    if (!usernameMatches || !passwordMatches) {
      return res.redirect("/admin/login?error=1");
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      req.session.adminUser = { username: adminUsername };
      return res.redirect("/admin");
    });
  } catch (error) {
    next(error);
  }
});

// Admin API - Logout
// Admin API - Logout
app.post("/api/admin/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully." });
  });
});

// Admin API - Get current user
app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ user: req.session.adminUser });
});

// Admin API - Get all testimonials
app.get("/api/admin/testimonials", requireAdmin, async (_req, res, next) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });

    const summary = {
      pending: testimonials.filter(t => t.status === "pending").length,
      approved: testimonials.filter(t => t.status === "approved").length,
      rejected: testimonials.filter(t => t.status === "rejected").length
    };

    res.json({ summary, testimonials });
  } catch (error) {
    next(error);
  }
});

// Admin API - Approve testimonial
app.post("/api/admin/testimonials/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const testimonialId = sanitizeText(req.params.id);
    const testimonial = await Testimonial.findOneAndUpdate(
      { id: testimonialId },
      {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: req.session.adminUser.username
      },
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found." });
    }

    res.json({ message: "Testimonial approved.", testimonial });
  } catch (error) {
    next(error);
  }
});

// Admin API - Reject testimonial
app.post("/api/admin/testimonials/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const testimonialId = sanitizeText(req.params.id);
    const testimonial = await Testimonial.findOneAndUpdate(
      { id: testimonialId },
      {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: req.session.adminUser.username
      },
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found." });
    }

    res.json({ message: "Testimonial rejected.", testimonial });
  } catch (error) {
    next(error);
  }
});

// Admin API - Delete testimonial
app.delete("/api/admin/testimonials/:id", requireAdmin, async (req, res, next) => {
  try {
    const testimonialId = sanitizeText(req.params.id);
    const testimonial = await Testimonial.findOneAndDelete({ id: testimonialId });

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found." });
    }

    res.json({ message: "Testimonial deleted." });
  } catch (error) {
    next(error);
  }
});

// Admin API - Get all contact forms
app.get("/api/admin/forms/contact", requireAdmin, async (_req, res, next) => {
  try {
    const forms = await ContactForm.find().sort({ createdAt: -1 });
    const summary = {
      new: forms.filter(f => f.status === "new").length,
      reviewed: forms.filter(f => f.status === "reviewed").length
    };

    res.json({ summary, forms });
  } catch (error) {
    next(error);
  }
});

// Admin API - Get all admission forms
app.get("/api/admin/forms/admissions", requireAdmin, async (_req, res, next) => {
  try {
    const forms = await AdmissionForm.find().sort({ createdAt: -1 });
    const summary = {
      new: forms.filter(f => f.status === "new").length,
      reviewed: forms.filter(f => f.status === "reviewed").length
    };

    res.json({ summary, forms });
  } catch (error) {
    next(error);
  }
});

// Admin API - Mark contact form as reviewed
app.post("/api/admin/forms/contact/:id/review", requireAdmin, async (req, res, next) => {
  try {
    const formId = sanitizeText(req.params.id);
    const form = await ContactForm.findOneAndUpdate(
      { id: formId },
      {
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedBy: req.session.adminUser.username
      },
      { new: true }
    );

    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    res.json({ message: "Form marked as reviewed.", form });
  } catch (error) {
    next(error);
  }
});

// Admin API - Mark admission form as reviewed
app.post("/api/admin/forms/admissions/:id/review", requireAdmin, async (req, res, next) => {
  try {
    const formId = sanitizeText(req.params.id);
    const form = await AdmissionForm.findOneAndUpdate(
      { id: formId },
      {
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedBy: req.session.adminUser.username
      },
      { new: true }
    );

    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    res.json({ message: "Form marked as reviewed.", form });
  } catch (error) {
    next(error);
  }
});

// Public API - Get published news and events
app.get("/api/news-events", async (_req, res, next) => {
  try {
    const newsEvents = await NewsEvent.find({ published: true })
      .sort({ eventDate: -1 })
      .select("id title description eventDate createdAt");

    res.json({ newsEvents });
  } catch (error) {
    next(error);
  }
});

// Admin API - Get all news and events
app.get("/api/admin/news-events", requireAdmin, async (_req, res, next) => {
  try {
    const newsEvents = await NewsEvent.find().sort({ eventDate: -1 });
    const summary = {
      published: newsEvents.filter(n => n.published).length,
      draft: newsEvents.filter(n => !n.published).length
    };

    res.json({ summary, newsEvents });
  } catch (error) {
    next(error);
  }
});

// Admin API - Create news or event
app.post("/api/admin/news-events", requireAdmin, async (req, res, next) => {
  try {
    const title = sanitizeText(req.body.title);
    const description = sanitizeText(req.body.description);
    const eventDate = new Date(req.body.eventDate);

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }

    const newsEvent = new NewsEvent({
      title,
      description,
      eventDate: isNaN(eventDate) ? new Date() : eventDate,
      published: false,
      createdBy: req.session.adminUser.username
    });

    await newsEvent.save();
    res.status(201).json({ message: "News/Event created.", newsEvent });
  } catch (error) {
    next(error);
  }
});

// Admin API - Update news or event
app.put("/api/admin/news-events/:id", requireAdmin, async (req, res, next) => {
  try {
    const newsEventId = sanitizeText(req.params.id);
    const title = sanitizeText(req.body.title);
    const description = sanitizeText(req.body.description);
    const eventDate = new Date(req.body.eventDate);

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }

    const newsEvent = await NewsEvent.findOneAndUpdate(
      { id: newsEventId },
      {
        title,
        description,
        eventDate: isNaN(eventDate) ? new Date() : eventDate,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!newsEvent) {
      return res.status(404).json({ message: "News/Event not found." });
    }

    res.json({ message: "News/Event updated.", newsEvent });
  } catch (error) {
    next(error);
  }
});

// Admin API - Delete news or event
app.delete("/api/admin/news-events/:id", requireAdmin, async (req, res, next) => {
  try {
    const newsEventId = sanitizeText(req.params.id);
    const newsEvent = await NewsEvent.findOneAndDelete({ id: newsEventId });

    if (!newsEvent) {
      return res.status(404).json({ message: "News/Event not found." });
    }

    res.json({ message: "News/Event deleted." });
  } catch (error) {
    next(error);
  }
});

// Admin API - Publish or unpublish news or event
app.post("/api/admin/news-events/:id/publish", requireAdmin, async (req, res, next) => {
  try {
    const newsEventId = sanitizeText(req.params.id);
    const newsEvent = await NewsEvent.findOne({ id: newsEventId });

    if (!newsEvent) {
      return res.status(404).json({ message: "News/Event not found." });
    }

    newsEvent.published = !newsEvent.published;
    await newsEvent.save();

    res.json({ message: newsEvent.published ? "News/Event published." : "News/Event unpublished.", newsEvent });
  } catch (error) {
    next(error);
  }
});

// Lightweight health check for hosts and uptime monitoring.
app.get("/healthz", (_req, res) => {
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    database: dbConnected ? "connected" : "connecting"
  });
});

// Static files - serve only public folder
app.use(express.static(path.join(rootDir, "public"), { extensions: ["html"] }));

// 404 handler
app.use((_req, res) => {
  res.status(404).send("Page not found.");
});

// Error handler
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

validateAuthConfiguration();

app.listen(port, () => {
  console.log(`Hillfort site running on https://localhost:${port}`);
});