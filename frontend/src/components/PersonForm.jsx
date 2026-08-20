import { useEffect, useState } from "react";

const emptyForm = {
    name: "",
    email: "",
    technology: "",
    experience: ""
};

function PersonForm({ selectedPerson, onSave, onCancel }) {
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (selectedPerson) {
            setForm({
                name: selectedPerson.name,
                email: selectedPerson.email,
                technology: selectedPerson.technology,
                experience: selectedPerson.experience
            });
        } else {
            setForm(emptyForm);
        }
    }, [selectedPerson]);

    const handleChange = (event) => {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        await onSave({
            ...form,
            experience: Number(form.experience)
        });

        if (!selectedPerson) {
            setForm(emptyForm);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="person-form">

            <h2>
                {selectedPerson ? "Update Person" : "Add Person"}
            </h2>

            <input
                name="name"
                placeholder="Name"
                value={form.name}
                onChange={handleChange}
                required
            />

            <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
            />

            <input
                name="technology"
                placeholder="AWS, Kubernetes, React"
                value={form.technology}
                onChange={handleChange}
                required
            />

            <input
                name="experience"
                type="number"
                placeholder="Experience"
                value={form.experience}
                onChange={handleChange}
                min="0"
                required
            />

            <button type="submit">
                {selectedPerson ? "Update Person" : "Add Person"}
            </button>

            {selectedPerson && (
                <button
                    type="button"
                    onClick={onCancel}
                >
                    Cancel
                </button>
            )}

        </form>
    );
}

export default PersonForm;