import axios from "axios";

const API_URL =
    import.meta.env.VITE_API_URL || "http:/api/people";

export const getPeople = () =>
    axios.get(`${API_URL}/people`);

export const createPerson = (person) =>
    axios.post(`${API_URL}/people`, person);

export const updatePerson = (id, person) =>
    axios.put(`${API_URL}/people/${id}`, person);

export const deletePerson = (id) =>
    axios.delete(`${API_URL}/people/${id}`);