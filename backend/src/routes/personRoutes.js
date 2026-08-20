const express = require("express");

const {
    getPeople,
    getPerson,
    createPerson,
    updatePerson,
    deletePerson
} = require("../controller/personController");

const router = express.Router();

router.get("/", getPeople);

router.get("/:id", getPerson);

router.post("/", createPerson);

router.put("/:id", updatePerson);

router.delete("/:id", deletePerson);

module.exports = router;