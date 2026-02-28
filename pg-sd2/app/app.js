// Circular Fashion Backend Server

const express = require("express");
const path = require("path");
const app = express();

// Database (if you have it)
const db = require('./services/db');

// -----------------------------
// Pug setup
// -----------------------------
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../static")); 
// because this file is inside /app and static is outside

// -----------------------------
// Static files (CSS, JS)
// -----------------------------
app.use(express.static(path.join(__dirname, "../static")));

// -----------------------------
// Routes
// -----------------------------

// Root route (render Pug)
app.get("/", function(req, res) {
    res.render("index");   // renders static/index.pug
});

// API route for frontend
app.get("/api/message", function(req, res) {
    res.json({
        message: "Welcome to Circular Fashion – Re-make & Mend"
    });
});

// Database test route
app.get("/db_test", function(req, res) {
    const sql = "SELECT * FROM test_table";
    db.query(sql)
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Database error");
        });
});

// Other example routes
app.get("/goodbye", function(req, res) {
    res.send("Goodbye from Circular Fashion!");
});

app.get("/hello/:name", function(req, res) {
    res.send("Hello " + req.params.name);
});

// -----------------------------
// Start server
// -----------------------------
app.listen(3000, function(){
    console.log("Server running at http://127.0.0.1:3000");
});