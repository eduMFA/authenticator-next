// Local test double for the existing client contract in src/services/push-auth.ts.
// It checks the payload shape, not RSA validity; signing is mocked in the test.
const http = require("node:http");

http
  .createServer((request, response) => {
    const path = request.url;
    if (request.method !== "POST" || !["/push", "/fail"].includes(path)) {
      response.writeHead(501).end();
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const valid =
          payload.serial === "serial" &&
          typeof payload.nonce === "string" &&
          payload.nonce.length > 0 &&
          payload.signature === "MY======" &&
          [0, 1].includes(payload.decline);
        response.writeHead(!valid ? 400 : path === "/fail" ? 500 : 200, {
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({ result: { status: valid && path === "/push" } }),
        );
      } catch {
        response.writeHead(400).end();
      }
    });
  })
  .listen(process.env.PORT);
