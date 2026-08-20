import { useEffect, useState } from "react";

import PersonForm from "./components/PersonForm";
import PersonTable from "./components/PersonTable";

import {
  getPeople,
  createPerson,
  updatePerson,
  deletePerson
} from "./services/personApi";

function App() {

  const [people, setPeople] = useState([]);

  const [selectedPerson, setSelectedPerson] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadPeople = async () => {

    try {

      setLoading(true);

      const response = await getPeople();

      setPeople(response.data);

    } catch (error) {

      console.error(error);

      setError("Unable to load people");

    } finally {

      setLoading(false);

    }
  };

  useEffect(() => {

    loadPeople();

  }, []);

  const handleSave = async (person) => {

    try {

      if (selectedPerson) {

        await updatePerson(
          selectedPerson.id,
          person
        );

        setSelectedPerson(null);

      } else {

        await createPerson(person);

      }

      await loadPeople();

    } catch (error) {

      console.error(error);

      alert(
        error.response?.data?.message ||
        "Operation failed"
      );
    }
  };

  const handleDelete = async (id) => {

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this person?"
      );

    if (!confirmed) {
      return;
    }

    try {

      await deletePerson(id);

      await loadPeople();

    } catch (error) {

      console.error(error);

      alert("Delete failed");

    }
  };

  return (

    <div className="container">

      <h1>
        People Technology Manager
      </h1>

      <PersonForm
        selectedPerson={selectedPerson}
        onSave={handleSave}
        onCancel={() => setSelectedPerson(null)}
      />

      {loading && (
        <p>Loading...</p>
      )}

      {error && (
        <p>{error}</p>
      )}

      {!loading && !error && (

        <PersonTable
          people={people}
          onEdit={setSelectedPerson}
          onDelete={handleDelete}
        />

      )}

    </div>
  );
}

export default App;