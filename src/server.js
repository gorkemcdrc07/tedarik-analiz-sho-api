import express from "express";
import cors from "cors";
import "dotenv/config";
import printsRouter from "./routes/prints.js";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://irsaliye-fatura.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());

app.get("/", (req, res) => {
    res.json({ ok: true, service: "tedarik-analiz-sho-api" });
});

app.use("/prints", printsRouter);

async function odakProxy(req, res, endpoint) {
    try {
        const token = process.env.ODAK_TOKEN;
        const authHeader = process.env.ODAK_AUTH_HEADER || "Authorization";
        const authPrefix = process.env.ODAK_AUTH_PREFIX || "Bearer";

        const apiRes = await fetch(`${process.env.ODAK_BASE}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [authHeader]: `${authPrefix} ${token}`,
            },
            body: JSON.stringify(req.body),
        });

        const text = await apiRes.text();
        const contentType = apiRes.headers.get("content-type") || "application/json";

        res.status(apiRes.status).type(contentType).send(text);
    } catch (error) {
        console.error("ODAK PROXY ERROR:", error);
        res.status(500).json({
            message: "Odak API isteği başarısız.",
            error: error.message,
        });
    }
}

app.post("/odak-api/api/tmsdespatchdocuments/getall", (req, res) => {
    return odakProxy(req, res, "/odak-api/api/tmsdespatchdocuments/getall");
});

app.post("/odak-api/api/tmsdespatchdocuments/documentgetbyid", (req, res) => {
    return odakProxy(req, res, "/odak-api/api/tmsdespatchdocuments/documentgetbyid");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log("🚀 tedarik-analiz-sho-api running on port", port);
});