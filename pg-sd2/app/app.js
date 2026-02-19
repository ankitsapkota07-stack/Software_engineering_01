// Circular Fashion Backend Server

const express = require("express");
const app = express();

// Serve static files (HTML, CSS, JS)
app.use(express.static("static"));

// Database (if you have it)
const db = require('./services/db');

// Root route
app.get("/", function(req, res) {
    res.sendFile(__dirname + "/static/index.html");
});

// API route for frontend
app.get("/api/message", function(req, res) {
    res.json({
        message: "Welcome to Circular Fashion – Re-make & Mend"
    });
});

// Database test route
app.get("/db_test", function(req, res) {
    const sql = 'SELECT * FROM test_table';
    db.query(sql).then(results => {
        res.json(results);
    }).catch(err => {
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

// Start server
app.listen(3000, function(){
    console.log("Server running at http://127.0.0.1:3000");
});
