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
  res.render("register");
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
    // Hash password before saving to DB
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save both normal users and experts in the same users table
    await db.query(
      `INSERT INTO users 
      (full_name, email, phone, username, password, location, bio, member_since, rating, role, skills, service_description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        phone,
        username,
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

// FORGOT PASSWORD
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length > 0) {
      res.send("Password reset link not implemented yet");
    } else {
      res.send("Email not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
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

    // Only the person receiving the request can update it
    if (request.recipient_id !== req.session.user.id) {
      return res.status(403).send("Not allowed");
    }

    await db.query(
      "UPDATE requests SET status = ? WHERE id = ?",
      [status, requestId]
    );

    res.redirect("/requests");
  } catch (err) {
    console.error(err);
    res.status(500).send("Update error");
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
// ALL ITEMS
app.get("/items", async (req, res) => {
  try {
    const items = await db.query(
      `SELECT items.*, users.username, categories.name AS category_name
       FROM items
       JOIN users ON items.user_id = users.id
       JOIN categories ON items.category_id = categories.id`
    );

    res.render("items", { items });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
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