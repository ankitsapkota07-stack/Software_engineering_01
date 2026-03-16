"use strict";

console.log("entrypoint");

const app = require("./app/app.js");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});