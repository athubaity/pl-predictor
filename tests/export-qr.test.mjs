import http from "http";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function createStaticServer(rootDir) {
    return http.createServer(async (req, res) => {
        try {
            const urlPath = new URL(req.url, "http://localhost").pathname;
            const targetPath = path.join(rootDir, urlPath === "/" ? "/index.html" : urlPath);
            const data = await fs.readFile(targetPath);
            const ext = path.extname(targetPath).toLowerCase();
            const type = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : ext === ".js" ? "application/javascript" : "application/octet-stream";
            res.writeHead(200, { "Content-Type": type });
            res.end(data);
        } catch (error) {
            res.writeHead(404);
            res.end("Not Found");
        }
    });
}

async function run() {
    const server = createStaticServer(projectRoot);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/index.html`;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle0" });

    await page.waitForSelector(".match-row");

    await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll(".match-row"));
        rows.forEach((row, index) => {
            const homeInput = row.querySelector('[data-side="home"]');
            const awayInput = row.querySelector('[data-side="away"]');
            if (homeInput) {
                homeInput.value = String(index);
                homeInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            if (awayInput) {
                awayInput.value = String(index + 1);
                awayInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });
    });

    await page.click("#export-active-week");

    const exportSnapshot = await page.waitForFunction(() => {
        return window.__lastExport && window.__lastExport.imageDataUrl && window.__lastExport.payload ? window.__lastExport : null;
    }).then((handle) => handle.jsonValue());

    const { imageDataUrl, payload } = exportSnapshot;
    if (!imageDataUrl || !payload) {
        throw new Error("Export data not captured");
    }

    const base64 = imageDataUrl.split(",")[1];
    const pngBuffer = Buffer.from(base64, "base64");
    const png = PNG.sync.read(pngBuffer);
    const qrResult = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
    if (!qrResult) {
        throw new Error("QR code decoding failed");
    }

    const qrJson = JSON.parse(qrResult.data);
    if (JSON.stringify(qrJson) !== JSON.stringify(payload)) {
        throw new Error("QR payload does not match exported payload");
    }

    const mismatches = [];
    payload.matches.forEach((match, index) => {
        const expectedHome = index;
        const expectedAway = index + 1;
        if ((match.prediction?.home ?? null) !== expectedHome || (match.prediction?.away ?? null) !== expectedAway) {
            mismatches.push({ fixture: `${match.home} vs ${match.away}`, expected: { home: expectedHome, away: expectedAway }, actual: match.prediction });
        }
    });

    if (mismatches.length > 0) {
        throw new Error(`Prediction mismatch detected: ${JSON.stringify(mismatches, null, 2)}`);
    }

    await browser.close();
    server.close();

    console.log("QR export integration test passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
