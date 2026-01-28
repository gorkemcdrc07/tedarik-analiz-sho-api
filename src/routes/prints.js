import { Router } from "express";

const router = Router();

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

  // Authorization: Bearer <token>  (prefix varsa)
  const value = prefix ? `${prefix} ${token}` : token;
  return { headerName, value };
}

/**
 * POST /prints/search
 * Bu endpoint: Odak API'ye istek atıp sonucu normalize ederek geri döner.
 * Şimdilik Odak'ta verdiğin endpoint:
 *   POST https://api.odaklojistik.com.tr/api/tmsdespatches/getall
 */
router.post("/search", async (req, res) => {
  try {
    const base = process.env.ODAK_BASE || "https://api.odaklojistik.com.tr";
    const url = `${base}/api/tmsdespatches/getall`;

    const auth = buildAuthHeader();
    if (!auth) {
      return res.status(500).json({ ok: false, message: "ODAK_TOKEN eksik (.env)" });
    }

    // Timeout (15sn)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    const headers = {
      "Content-Type": "application/json",
      [auth.headerName]: auth.value
    };

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body || {}),
      signal: controller.signal
    }).finally(() => clearTimeout(t));

    const text = await resp.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        status: resp.status,
        message: "Odak API error",
        odak: payload
      });
    }

    const items = extractItems(payload);

    return res.json({
      ok: true,
      count: items.length,
      data: items
    });
  } catch (err) {
    const isAbort = String(err?.name || "").toLowerCase().includes("abort");
    return res.status(500).json({
      ok: false,
      message: isAbort ? "Odak API timeout" : "Server error",
      error: String(err?.message || err)
    });
  }
});

export default router;
