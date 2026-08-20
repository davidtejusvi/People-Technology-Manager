CREATE DATABASE IF NOT EXISTS peopledb;

USE peopledb;

CREATE TABLE IF NOT EXISTS people (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    technologies VARCHAR(500) NOT NULL,
    experience INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO people (name, email, technologies, experience)
VALUES
(
    'David',
    'david@test.com',
    'AWS, Kubernetes, React',
    8
),
(
    'John',
    'john@test.com',
    'Java, AWS, Docker',
    5
);