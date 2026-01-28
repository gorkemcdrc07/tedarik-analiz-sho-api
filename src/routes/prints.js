import { Router } from "express";

const router = Router();

/* ---------------- helpers ---------------- */

function extractItems(payload) {
    if (!payload) return [];
    const root = payload.items ?? payload.data ?? payload;
    const arr = root?.Data ?? root?.data ?? root?.items ?? root;
    return Array.isArray(arr) ? arr : [];
}

function buildAuthHeader() {
    const headerName = process.env.ODAK_AUTH_HEADER || "Authorization";
    const token = process.env.ODAK_TOKEN || "";
    const prefix = (process.env.ODAK_AUTH_PREFIX || "").trim();

    if (!token) return null;
    const value = prefix ? `${prefix} ${token}` : token;
    return { headerName, value };
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function toISOStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString();
}

function toISOEnd(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x.toISOString();
}

/* ---------------- route ---------------- */

/**
 * POST /prints/search
 * Tarih aralığını gün gün bölerek Odak API'ye çağrı atar
 */
router.post("/search", async (req, res) => {
    try {
        const base = process.env.ODAK_BASE || "https://api.odaklojistik.com.tr";
        const url = `${base}/api/tmsdespatches/getall`;

        const auth = buildAuthHeader();
        if (!auth) {
            return res.status(500).json({ ok: false, message: "ODAK_TOKEN eksik (.env)" });
        }

        const { startDate, endDate, ...rest } = req.body || {};
        if (!startDate || !endDate) {
            return res.status(400).json({ ok: false, message: "startDate / endDate zorunlu" });
        }

        const headers = {
            "Content-Type": "application/json",
            [auth.headerName]: auth.value,
        };

        const start = new Date(startDate);
        const end = new Date(endDate);

        let cursor = new Date(start);
        let allItems = [];

        while (cursor <= end) {
            const dayStart = toISOStart(cursor);
            const dayEnd = toISOEnd(cursor);

            const body = {
                ...rest,
                startDate: dayStart,
                endDate: dayEnd,
            };

            // ⏱️ tek gün = 30sn timeout
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);

            try {
                const resp = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });

                const text = await resp.text();
                let payload;
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = { raw: text };
                }

                if (!resp.ok) {
                    console.error("ODAK ERROR", dayStart, payload);
                    // ❗ tek gün patlarsa tüm süreci öldürmüyoruz
                    cursor = addDays(cursor, 1);
                    continue;
                }

                const items = extractItems(payload);
                allItems = allItems.concat(items);
            } catch (err) {
                console.error("ODAK TIMEOUT", dayStart);
                // ❗ timeout olsa bile devam
            } finally {
                clearTimeout(timer);
            }

            cursor = addDays(cursor, 1);
        }

        return res.json({
            ok: true,
            count: allItems.length,
            data: allItems,
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            message: "Server error",
            error: String(err?.message || err),
        });
    }
});

export default router;
