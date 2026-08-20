const request = require("supertest");

const app = require("../src/app");

describe("People API", () => {

    test("GET /api/health should return 200", async () => {

        const response =
            await request(app)
                .get("/api/health");

        expect(response.statusCode)
            .toBe(200);

        expect(response.body.status)
            .toBe("UP");

    });

    test("GET /api/people should return people", async () => {

        const response =
            await request(app)
                .get("/api/people");

        expect(response.statusCode)
            .toBe(200);

        expect(Array.isArray(response.body))
            .toBe(true);

    });

});