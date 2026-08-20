const pool = require("../db/connection");

// GET all people
const getPeople = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM people ORDER BY id DESC"
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch people"
        });
    }
};

// GET one person
const getPerson = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM people WHERE id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Person not found"
            });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch person"
        });
    }
};

// CREATE person
const createPerson = async (req, res) => {
    try {
        const {
            name,
            email,
            technologies,
            experience
        } = req.body;

        if (!name || !email || !technologies || experience === undefined) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO people
       (name, email, technologies, experience)
       VALUES (?, ?, ?, ?)`,
            [
                name,
                email,
                technologies,
                experience
            ]
        );

        const [rows] = await pool.query(
            "SELECT * FROM people WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json(rows[0]);

    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        res.status(500).json({
            message: "Failed to create person"
        });
    }
};

// UPDATE person
const updatePerson = async (req, res) => {
    try {
        const {
            name,
            email,
            technologies,
            experience
        } = req.body;

        const [result] = await pool.query(
            `UPDATE people
       SET name = ?,
           email = ?,
           technologies = ?,
           experience = ?
       WHERE id = ?`,
            [
                name,
                email,
                technologies,
                experience,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Person not found"
            });
        }

        const [rows] = await pool.query(
            "SELECT * FROM people WHERE id = ?",
            [req.params.id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update person"
        });
    }
};

// DELETE person
const deletePerson = async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM people WHERE id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Person not found"
            });
        }

        res.json({
            message: "Person deleted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete person"
        });
    }
};

module.exports = {
    getPeople,
    getPerson,
    createPerson,
    updatePerson,
    deletePerson
};