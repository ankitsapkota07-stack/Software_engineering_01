const express = require("express");
const path = require("path");
const db = require("./services/db");

const app = express();

app.set("views", path.join(__dirname, "../static"));
app.set("view engine", "pug");

app.use(express.static(path.join(__dirname, "../static")));

app.get("/", (req, res) => {
  res.render("index");
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

module.exports = app;