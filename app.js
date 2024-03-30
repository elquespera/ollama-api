import "dotenv/config";
import express from "express";
import { Readable } from "stream";
import { verifyHMAC } from "./hmac.js";

const ollamaURL = "http://localhost:11434/api";

const app = express();
app.use(express.json({ limit: "50mb" }));

const port = process.env.PORT || 3000;

app.get("/api/status", (request, response) => {
  response.send({ status: "Running" });
});

app.post("/api/ollama/:route", async (request, response) => {
  const { route } = request.params;
  console.log("ollama:", route);

  const isAuth = verifyHMAC(
    request.headers.authorization,
    `/api/ollama/${route}`,
    "POST",
    request.body
  );

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
