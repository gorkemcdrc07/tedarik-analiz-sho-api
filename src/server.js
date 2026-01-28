import express from "express";
import cors from "cors";
import "dotenv/config";
import printsRouter from "./routes/prints.js";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.json({ ok: true, service: "tedarik-analiz-sho-api" });
});

app.use("/prints", printsRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 tedarik-analiz-sho-api running on port", port);
});
