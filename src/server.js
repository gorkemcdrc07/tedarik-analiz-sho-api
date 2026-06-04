import express from "express";
import cors from "cors";
import "dotenv/config";
import printsRouter from "./routes/prints.js";

const app = express();

console.log("ENV CHECK:", {
    ODAK_BASE: process.env.ODAK_BASE,
    HAS_TOKEN: Boolean(process.env.ODAK_TOKEN),
    ODAK_AUTH_HEADER: process.env.ODAK_AUTH_HEADER,
    ODAK_AUTH_PREFIX: process.env.ODAK_AUTH_PREFIX,
});

app.use(express.json({ limit: "10mb" }));

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://irsaliye-fatura.vercel.app",
        ],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.options("*", cors());

app.get("/", (req, res) => {
    res.json({ ok: true, service: "tedarik-analiz-sho-api" });
});

app.use("/prints", printsRouter);

async function odakProxy(req, res, endpoint) {
    try {
        const odakBase = process.env.ODAK_BASE;
        const token = process.env.ODAK_TOKEN;
        const authHeader = process.env.ODAK_AUTH_HEADER || "Authorization";
        const authPrefix = process.env.ODAK_AUTH_PREFIX || "Bearer";

        if (!odakBase) {
            return res.status(500).json({
                message: "ODAK_BASE environment variable eksik.",
            });
        }

        if (!token) {
            return res.status(500).json({
                message: "ODAK_TOKEN environment variable eksik.",
            });
        }

        const targetUrl = `${odakBase}${endpoint}`;

        console.log("ODAK TARGET URL:", targetUrl);
        console.log("ODAK REQUEST BODY:", req.body);

        const apiRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [authHeader]: `${authPrefix} ${token}`,
            },
            body: JSON.stringify(req.body),
        });

        const text = await apiRes.text();
        const contentType =
            apiRes.headers.get("content-type") || "application/json";

        console.log("ODAK RESPONSE:", {
            status: apiRes.status,
            contentType,
            bodyPreview: text.slice(0, 500),
        });

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
    return odakProxy(req, res, "/api/tmsdespatchdocuments/getall");
});

app.post("/odak-api/api/tmsdespatchdocuments/documentgetbyid", (req, res) => {
    return odakProxy(
        req,
        res,
        "/api/tmsdespatchdocuments/documentgetbyid"
    );
});
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log("🚀 tedarik-analiz-sho-api running on port", port);
});