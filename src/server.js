import express from "express";
import cors from "cors";
import "dotenv/config";
import printsRouter from "./routes/prints.js";

const app = express();

let cachedOdakToken = "";
let cachedOdakTokenTime = 0;

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
console.log("INVOICE ROUTE ACTIVE");

function tokenBul(data) {
    return (
        data?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.jwtToken ||
        data?.jwt ||
        data?.bearerToken ||
        data?.data?.token ||
        data?.data?.accessToken ||
        data?.data?.access_token ||
        data?.data?.jwtToken ||
        data?.data?.jwt ||
        data?.data?.bearerToken ||
        data?.result?.token ||
        data?.result?.accessToken ||
        data?.result?.access_token ||
        data?.result?.jwtToken ||
        data?.result?.jwt ||
        data?.result?.bearerToken
    );
}

async function getOdakToken() {
    const now = Date.now();

    if (cachedOdakToken && now - cachedOdakTokenTime < 4 * 60 * 1000) {
        return cachedOdakToken;
    }

    const loginRes = await fetch(`${process.env.ODAK_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userName: process.env.ODAK_USERNAME,
            password: process.env.ODAK_PASSWORD,
        }),
    });

    const text = await loginRes.text();
    const data = text ? JSON.parse(text) : null;

    if (!loginRes.ok) {
        throw new Error(`Odak login başarısız: ${loginRes.status} ${text}`);
    }

    const token = tokenBul(data);

    if (!token) {
        throw new Error(`Odak token bulunamadı: ${text}`);
    }

    cachedOdakToken = token;
    cachedOdakTokenTime = now;

    return cachedOdakToken;
}

async function odakProxy(req, res, endpoint, retry = true) {
    try {
        const odakBase = process.env.ODAK_BASE;

        if (!odakBase) {
            return res.status(500).json({ message: "ODAK_BASE eksik." });
        }

        const token = await getOdakToken();
        const targetUrl = `${odakBase}${endpoint}`;

        const apiRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(req.body),
        });

        const text = await apiRes.text();
        const contentType =
            apiRes.headers.get("content-type") || "application/json";

        if (apiRes.status === 401 && retry) {
            cachedOdakToken = "";
            cachedOdakTokenTime = 0;
            return odakProxy(req, res, endpoint, false);
        }

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
    return odakProxy(req, res, "/api/tmsdespatchdocuments/documentgetbyid");
});
app.post("/api/tmsdespatchincomeexpenses/getall", (req, res) => {
    console.log("INVOICE ROUTE HIT", req.body);

    return odakProxy(req, res, "/api/tmsdespatchincomeexpenses/getall");
});
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log("🚀 tedarik-analiz-sho-api running on port", port);
});