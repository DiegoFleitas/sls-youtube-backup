import { formatJSONResponse } from "./apiGateway";

describe("formatJSONResponse", () => {
  it("returns statusCode 200 by default", () => {
    const result = formatJSONResponse({ message: "ok" });
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(JSON.stringify({ message: "ok" }));
  });

  it("uses provided statusCode for error responses", () => {
    const result = formatJSONResponse(
      { message: "No playlist ID provided" },
      400
    );
    expect(result.statusCode).toBe(400);
    expect(result.body).toBe(
      JSON.stringify({ message: "No playlist ID provided" })
    );
  });

  it("uses statusCode 500 when passed", () => {
    const result = formatJSONResponse(
      { message: "Internal server error" },
      500
    );
    expect(result.statusCode).toBe(500);
    expect(result.body).toBe(
      JSON.stringify({ message: "Internal server error" })
    );
  });
});
