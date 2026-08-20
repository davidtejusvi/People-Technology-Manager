const express = require("express");
const cors = require("cors");

const personRoutes = require("./routes/personRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "UP",
        message: "People API is running"
    });
});

app.use("/api/people", personRoutes);

module.exports = app;