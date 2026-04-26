const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const express = require("express");
const path = require("path");
const db = require("./services/db");

const app = express();
const uploadPath = path.join(__dirname, "../static/uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// If your .pug files are inside /static, keep this.
// If you move them to /views later, change "../static" to "../views"
app.set("views", path.join(__dirname, "../static"));
app.set("view engine", "pug");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../static")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Make logged-in user available in all templates
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// Community users can add exchange/reuse items
function requireCommunity(req, res, next) {
  if (!req.session.user || req.session.user.role !== "community") {
    return res.status(403).send("Community users only");
  }
  next();
}

// Experts can access expert-only pages
function requireExpert(req, res, next) {
  if (!req.session.user || req.session.user.role !== "expert") {
    return res.status(403).send("Alteration experts only");
  }
  next();
}

// SHOW PAGES
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register", {
    error: null,
    formData: {}
  });
});

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// REGISTER
app.post("/register", async (req, res) => {
  const {
    full_name,
    email,
    phone,
    username,
    password,
    role,
    skills,
    service_description
  } = req.body;

  try {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username already exists
    const existingUsername = await db.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [cleanUsername]
    );

    if (existingUsername.length > 0) {
      return res.status(400).render("register", {
        error: "Username already taken",
        formData: {
          full_name,
          email,
          phone,
          username: cleanUsername,
          role,
          skills,
          service_description
        }
      });
    }

    // Check if email already exists
    const existingEmail = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [cleanEmail]
    );

    if (existingEmail.length > 0) {
      return res.status(400).render("register", {
        error: "Email already registered",
        formData: {
          full_name,
          email,
          phone,
          username: cleanUsername,
          role,
          skills,
          service_description
        }
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users 
      (full_name, email, phone, username, password, location, bio, member_since, rating, role, skills, service_description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        cleanEmail,
        phone,
        cleanUsername,
        hashedPassword,
        "Unknown",
        "New user",
        2026,
        0,
        role || "community",
        skills || null,
        service_description || null
      ]
    );

    res.redirect("/login");
  } catch (err) {
    // If DB unique constraint catches duplicate
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).render("register", {
        error: "Username or email already exists",
        formData: {
          full_name,
          email,
          phone,
          username,
          role,
          skills,
          service_description
        }
      });
    }

    console.error(err);
    res.status(500).send("Registration error");
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).send("Incorrect password");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    };

    req.session.save((err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Session error");
      }
      res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
  }
});

// FORGOT PASSWORD - generate reset token
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    // Do not reveal too much information in real systems
    if (rows.length === 0) {
      return res.send("If that email exists, a reset link has been generated.");
    }

    const user = rows[0];

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set token expiry: 15 minutes from now
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetToken, expiry, user.id]
    );

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

    // For coursework/demo: print link in terminal
    console.log("Password reset link:", resetLink);

    // For demo: also show link in browser
    res.send(`
      <h2>Reset link generated</h2>
      <p>For demo purposes, use this link:</p>
      <a href="${resetLink}">${resetLink}</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating reset link");
  }
});

// SHOW RESET PASSWORD PAGE
app.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).send("Invalid or expired reset link");
    }

    res.render("reset-password", { token });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading reset page");
  }
});

// SAVE NEW PASSWORD
app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).send("Invalid or expired reset link");
    }

    const user = rows[0];

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE users 
       SET password = ?, reset_token = NULL, reset_token_expiry = NULL 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    res.render("reset-success");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error resetting password");
  }
});

// DB TEST
app.get("/db_test", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM users");
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// USERS PAGE
app.get("/users", async (req, res) => {
  try {
    const users = await db.query("SELECT * FROM users");
    res.render("users", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// USER PROFILE PAGE
app.get("/users/:id", async (req, res) => {
  try {
    const userRows = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.params.id]
    );

    const itemRows = await db.query(
      `SELECT items.*, categories.name AS category_name
       FROM items
       LEFT JOIN categories ON items.category_id = categories.id
       WHERE items.user_id = ?`,
      [req.params.id]
    );

    if (userRows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("user-profile", {
      profileUser: userRows[0],
      items: itemRows,
      totalListings: itemRows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// =====================================
// EDIT PROFILE PAGE
// =====================================

// Show edit profile form for logged in user
app.get("/profile/edit", requireLogin, async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("edit-profile", {
      profileUser: rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading edit profile page");
  }
});

// Save profile changes
app.post("/profile/edit", requireLogin, upload.single("profile_image"), async (req, res) => {
  const { location, bio } = req.body;

  try {
    // Get current user first
    const rows = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const user = rows[0];

    // If user uploaded a new image, use it
    // otherwise keep old image
    const finalProfileImage = req.file
      ? `/uploads/${req.file.filename}`
      : user.profile_image;

    await db.query(
      `UPDATE users
       SET location = ?, bio = ?, profile_image = ?
       WHERE id = ?`,
      [
        location || "Unknown",
        bio || "New user",
        finalProfileImage,
        req.session.user.id
      ]
    );

    // Optional: update session values too
    req.session.user.location = location || "Unknown";
    req.session.user.profile_image = finalProfileImage;

    res.redirect(`/users/${req.session.user.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating profile");
  }
});

// RATE USER
app.post("/users/:id/rate", requireLogin, async (req, res) => {
  const { rating } = req.body;
  const userId = req.params.id;

  try {
    await db.query(
      "UPDATE users SET rating = ? WHERE id = ?",
      [rating, userId]
    );

    res.redirect(`/users/${userId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Rating error");
  }
});

// LIST ALL EXPERTS
app.get("/experts", async (req, res) => {
  try {
    const experts = await db.query(
      "SELECT * FROM users WHERE role = 'expert'"
    );

    res.render("experts", { experts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// SINGLE EXPERT PROFILE
app.get("/experts/:id", async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE id = ? AND role = 'expert'",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).send("Expert not found");
    }

    res.render("expert-profile", {
      expert: rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// COMMUNITY USER REQUESTS AN ITEM
app.post("/items/:id/request", requireCommunity, async (req, res) => {
  const { message } = req.body;
  const itemId = req.params.id;

  try {
    const itemRows = await db.query(
      "SELECT * FROM items WHERE id = ?",
      [itemId]
    );

    if (itemRows.length === 0) {
      return res.status(404).send("Item not found");
    }

    const item = itemRows[0];

    // Do not allow requests for unavailable items
    if (
      item.availability_status &&
      item.availability_status.toLowerCase() !== "available"
    ) {
      return res.status(400).send("This item is no longer available");
    }

    await db.query(
      `INSERT INTO requests (request_type, sender_id, recipient_id, item_id, message)
       VALUES (?, ?, ?, ?, ?)`,
      ["exchange", req.session.user.id, item.user_id, itemId, message || null]
    );

    res.redirect(`/items/${itemId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Request error");
  }
});

// COMMUNITY USER REQUESTS REPAIR FROM AN EXPERT
app.post("/experts/:id/request", requireCommunity, async (req, res) => {
  const { message } = req.body;
  const expertId = req.params.id;

  try {
    const expertRows = await db.query(
      "SELECT * FROM users WHERE id = ? AND role = 'expert'",
      [expertId]
    );

    if (expertRows.length === 0) {
      return res.status(404).send("Expert not found");
    }

    await db.query(
      `INSERT INTO requests (request_type, sender_id, recipient_id, message)
       VALUES (?, ?, ?, ?)`,
      ["repair", req.session.user.id, expertId, message || null]
    );

    res.redirect(`/experts/${expertId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Request error");
  }
});

// VIEW ALL REQUESTS FOR CURRENT USER
app.get("/requests", requireLogin, async (req, res) => {
  try {
    const requests = await db.query(
      `SELECT requests.*, 
              sender.username AS sender_name,
              recipient.username AS recipient_name,
              items.title AS item_title
       FROM requests
       JOIN users AS sender ON requests.sender_id = sender.id
       JOIN users AS recipient ON requests.recipient_id = recipient.id
       LEFT JOIN items ON requests.item_id = items.id
       WHERE requests.sender_id = ? OR requests.recipient_id = ?
       ORDER BY requests.created_at DESC`,
      [req.session.user.id, req.session.user.id]
    );

    res.render("requests", { requests });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ACCEPT / REJECT A REQUEST
app.post("/requests/:id/status", requireLogin, async (req, res) => {
  const { status } = req.body;
  const requestId = req.params.id;

  try {
    const rows = await db.query(
      "SELECT * FROM requests WHERE id = ?",
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).send("Request not found");
    }

    const request = rows[0];

    // Only the recipient can update the request
    if (request.recipient_id !== req.session.user.id) {
      return res.status(403).send("Not allowed");
    }

    // Allow only valid statuses
    if (!["accepted", "rejected", "completed"].includes(status)) {
      return res.status(400).send("Invalid status");
    }

    // Update the request status
    await db.query(
      "UPDATE requests SET status = ? WHERE id = ?",
      [status, requestId]
    );

    // IMPORTANT:
    // If an exchange request is accepted, mark the item as Not Available
    if (
      status === "accepted" &&
      request.request_type === "exchange" &&
      request.item_id
    ) {
      await db.query(
        "UPDATE items SET availability_status = ? WHERE id = ?",
        ["Not Available", request.item_id]
      );
    }

    // If accepted, open chat
    if (status === "accepted") {
      return res.redirect(`/requests/${requestId}/chat`);
    }

    res.redirect("/requests");
  } catch (err) {
    console.error(err);
    res.status(500).send("Update error");
  }
});

// =====================================
// CHAT FOR ACCEPTED REQUESTS ONLY
// =====================================

// View chat page for a request
app.get("/requests/:id/chat", requireLogin, async (req, res) => {
  const requestId = req.params.id;
  const currentUserId = req.session.user.id;

  try {
    // Get the request first
    const requestRows = await db.query(
      "SELECT * FROM requests WHERE id = ?",
      [requestId]
    );

    if (requestRows.length === 0) {
      return res.status(404).send("Request not found");
    }

    const request = requestRows[0];

    // Only sender or recipient can view the chat
    const isParticipant =
      request.sender_id === currentUserId || request.recipient_id === currentUserId;

    if (!isParticipant) {
      return res.status(403).send("Not allowed");
    }

    // Chat should only open after request is accepted
    if (request.status !== "accepted") {
      return res.status(403).send("Chat opens only after request is accepted");
    }

    // Load all messages for this request
    const messages = await db.query(
      `SELECT messages.*, users.username
       FROM messages
       JOIN users ON messages.sender_id = users.id
       WHERE messages.request_id = ?
       ORDER BY messages.created_at ASC`,
      [requestId]
    );

    // Optional: get item title for display
    const itemRows = request.item_id
      ? await db.query("SELECT title FROM items WHERE id = ?", [request.item_id])
      : [];

    res.render("chat", {
      request,
      messages,
      itemTitle: itemRows.length ? itemRows[0].title : null
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// Send a new message inside chat
app.post("/requests/:id/chat", requireLogin, async (req, res) => {
  const requestId = req.params.id;
  const currentUserId = req.session.user.id;
  const { message } = req.body;

  try {
    if (!message || !message.trim()) {
      return res.redirect(`/requests/${requestId}/chat`);
    }

    const requestRows = await db.query(
      "SELECT * FROM requests WHERE id = ?",
      [requestId]
    );

    if (requestRows.length === 0) {
      return res.status(404).send("Request not found");
    }

    const request = requestRows[0];

    const isParticipant =
      request.sender_id === currentUserId || request.recipient_id === currentUserId;

    if (!isParticipant) {
      return res.status(403).send("Not allowed");
    }

    if (request.status !== "accepted") {
      return res.status(403).send("Chat opens only after request is accepted");
    }

    // Decide who receives the message
    const receiverId =
      request.sender_id === currentUserId
        ? request.recipient_id
        : request.sender_id;

    await db.query(
      `INSERT INTO messages (request_id, sender_id, receiver_id, message)
       VALUES (?, ?, ?, ?)`,
      [requestId, currentUserId, receiverId, message.trim()]
    );

    res.redirect(`/requests/${requestId}/chat`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Message send error");
  }
});

// SHOW ADD ITEM FORM
app.get("/items/new", requireCommunity, async (req, res) => {
  try {
    const categories = await db.query("SELECT id, name FROM categories ORDER BY name");
    res.render("add_item", { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading add item page");
  }
});

app.post("/items", requireCommunity, upload.single("image_file"), async (req, res) => {
  const {
    title,
    category_id,
    condition,
    description,
    size,
    city,
    image_url
  } = req.body;

  try {
    const categoryRows = await db.query(
      "SELECT id FROM categories WHERE id = ?",
      [category_id]
    );

    if (categoryRows.length === 0) {
      return res.status(400).send("Invalid category");
    }

    const finalImage =
      req.file
        ? `/uploads/${req.file.filename}`
        : image_url && image_url.trim() !== ""
        ? image_url.trim()
        : null;

    await db.query(
      `INSERT INTO items
      (title, description, size, city, \`condition\`, category_id, user_id, availability_status, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        size,
        city,
        condition,
        category_id,
        req.session.user.id,
        "Available",
        finalImage
      ]
    );

    res.redirect("/items");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving item");
  }
});

// ALL ITEMS + SEARCH
app.get("/items", async (req, res) => {
  try {
    const searchQuery = (req.query.q || "").trim();

    let sql = `
      SELECT items.*, users.username, categories.name AS category_name
      FROM items
      JOIN users ON items.user_id = users.id
      JOIN categories ON items.category_id = categories.id
    `;

    const params = [];

    // Case-insensitive multi-word search
    // Example:
    // "denim jacket" will match items containing both words
    if (searchQuery) {
      const tokens = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const tokenClauses = tokens.map(() => `
        (
          LOWER(items.title) LIKE ?
          OR LOWER(COALESCE(items.description, '')) LIKE ?
          OR LOWER(categories.name) LIKE ?
          OR LOWER(users.username) LIKE ?
          OR LOWER(COALESCE(items.city, '')) LIKE ?
          OR LOWER(COALESCE(items.condition, '')) LIKE ?
        )
      `).join(" AND ");

      sql += ` WHERE ${tokenClauses}`;

      tokens.forEach((token) => {
        const like = `%${token}%`;
        params.push(like, like, like, like, like, like);
      });
    }

    sql += ` ORDER BY items.id DESC`;

    const items = await db.query(sql, params);

    res.render("items", {
      items,
      searchQuery
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ITEM SEARCH SUGGESTIONS
app.get("/items/suggestions", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();

    if (!q) {
      return res.json([]);
    }

    const suggestions = await db.query(
      `
      SELECT DISTINCT items.title
      FROM items
      WHERE LOWER(items.title) LIKE ?
      ORDER BY
        CASE
          WHEN LOWER(items.title) LIKE ? THEN 0
          ELSE 1
        END,
        items.title ASC
      LIMIT 8
      `,
      [`%${q}%`, `${q}%`]
    );

    res.json(suggestions.map(item => item.title));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ITEM DETAIL
app.get("/items/:id", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT items.*, users.username, categories.name AS category_name
       FROM items
       JOIN users ON items.user_id = users.id
       JOIN categories ON items.category_id = categories.id
       WHERE items.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).send("Item not found");
    }

    const tags = await db.query(
      `SELECT tags.name
       FROM item_tags
       JOIN tags ON item_tags.tag_id = tags.id
       WHERE item_tags.item_id = ?`,
      [req.params.id]
    );

    res.render("item-detail", {
      item: rows[0],
      tags,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

module.exports = app;