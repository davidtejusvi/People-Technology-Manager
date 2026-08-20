function PersonTable({
    people,
    onEdit,
    onDelete
}) {
    return (
        <div>

            <h2>People</h2>

            <table>

                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>technology</th>
                        <th>Experience</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>

                    {people.map((person) => (

                        <tr key={person.id}>

                            <td>{person.id}</td>

                            <td>{person.name}</td>

                            <td>{person.email}</td>

                            <td>
                                {person.technology}
                            </td>

                            <td>
                                {person.experience} years
                            </td>

                            <td>

                                <button
                                    onClick={() => onEdit(person)}
                                >
                                    Edit
                                </button>

                                <button
                                    onClick={() => onDelete(person.id)}
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>
    );
}

export default PersonTable;