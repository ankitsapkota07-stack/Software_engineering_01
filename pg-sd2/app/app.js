const bcrypt = require("bcrypt");
const session = require("express-session");
const express = require("express");
const path = require("path");
const db = require("./services/db");

const app = express();

app.set("views", path.join(__dirname, "../static"));
app.set("view engine", "pug");
app.use(express.urlencoded({ extended: true }));
// Show pages
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/forgot-password", (req, res) => res.render("forgot-password"));
app.use(express.static(path.join(__dirname, "../static")));
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

app.get("/", (req, res) => {
  res.render("index");
});
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (username, email, password, location, bio, member_since, rating) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, email, hashedPassword, "Unknown", "New user", 2026, 0]
    );

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("Registration error");
  }
});

// STEP 7 → LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.send("User not found");
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.send("Incorrect password");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Login error");
  }
});

// STEP 8 → FORGOT PASSWORD
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length > 0) {
      res.send("Password reset link (not implemented)");
    } else {
      res.send("Email not found");
    }
  } catch (err) {
    res.send("Error");
  }
});
module.exports = app;

app.get("/db_test", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM users");
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await db.query("SELECT * FROM users");
    res.render("users", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const userRows = await db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
    const itemRows = await db.query("SELECT * FROM items WHERE user_id = ?", [req.params.id]);

    if (userRows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("user-profile", {
      user: userRows[0],
      items: itemRows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/items", async (req, res) => {
  try {
    const items = await db.query(`
      SELECT items.*, users.username, categories.name AS category_name
      FROM items
      JOIN users ON items.user_id = users.id
      JOIN categories ON items.category_id = categories.id
    `);

    res.render("items", { items });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/items/:id", async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT items.*, users.username, categories.name AS category_name
      FROM items
      JOIN users ON items.user_id = users.id
      JOIN categories ON items.category_id = categories.id
      WHERE items.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).send("Item not found");
    }

    const tags = await db.query(`
      SELECT tags.name
      FROM item_tags
      JOIN tags ON item_tags.tag_id = tags.id
      WHERE item_tags.item_id = ?
    `, [req.params.id]);

    res.render("item-detail", {
      item: rows[0],
      tags
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});
// Ratings Features
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
module.exports = app;