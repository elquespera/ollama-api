import express from "express";
import { Readable } from "stream";
import "dotenv/config";
import { createHash, createHmac } from "crypto";

const ollamaURL = "http://localhost:11434/api";
const hmacSecret = process.env.API_HMAC_SECRET;

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

app.get("/api/status", (request, response) => {
  response.send({ status: "Running" });
});

app.post("/api/ollama/:route", async (request, response) => {
  const { route } = request.params;
  console.log("ollama:", route);

  const isAuth = checkHMAC(
    request.headers.authorization,
    `/api/ollama/${route}`,
    "POST",
    request.body
  );

  console.log(isAuth);

  if (!isAuth) {
    response.status(401);
    response.send("Unauthorized request.");
  }

  try {
    const ollamaResponse = await fetch(`${ollamaURL}/${route}`, {
      method: "POST",
      body: JSON.stringify(request.body),
      headers: {
        "content-type": "application/json",
      },
    });

    console.log(`${ollamaResponse.status}: ${ollamaResponse.statusText}`);

    if (!ollamaResponse.ok) {
      response.status(ollamaResponse.status);
      response.send({
        status: ollamaResponse.status,
        statusText: ollamaResponse.statusText,
      });
      return;
    }

    Readable.fromWeb(ollamaResponse.body).pipe(response);
  } catch (error) {
    response.status(500);
    console.error(String(error));
    throw error;
  }
});

app.listen(port, () => {
  console.log("Server Listening on PORT:", port);
});

function checkHMAC(authorization, url, method, body) {
  if (!authorization) return false;
  const [name, rest] = authorization.split(" ");
  if (name !== "HMAC") return false;

  const [time, ...restDigest] = rest.split(":");

  const digest = restDigest.join(":");

  const hmac = createHmac("sha256", hmacSecret);

  hmac.update(time);
  hmac.update(method);
  hmac.update(url);

  if (body) {
    const contentHash = createHash("md5");
    contentHash.update(JSON.stringify(body));
    hmac.update(contentHash.digest("hex"));
  }

  return digest === hmac.digest("hex");
}
