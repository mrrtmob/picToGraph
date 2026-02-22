var pixels;
let thresh = 20; // Raised default threshold (was 10) — reduces noise lines

const MAX_LINES = 20000;   // Raised from 5000
const MAX_DIM = 300;     // Auto-downscale images larger than this

function processImg() {
    var uploader = document.querySelector('input[type=file]').files[0];
    if (!uploader) return;

    var canvas = document.getElementById("cnvs");
    var ctx = canvas.getContext("2d");
    var reader = new FileReader();
    var img = new Image();

    // Allow threshold to be controlled by a slider if present
    var sliderEl = document.getElementById("threshSlider");
    if (sliderEl) thresh = parseInt(sliderEl.value) || thresh;

    reader.addEventListener("load", () => { img.src = reader.result; });
    reader.readAsDataURL(uploader);

    img.onload = () => {
        document.getElementById('filename').innerText = uploader.name;

        // --- Auto-downscale large images ---
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
            let scale = Math.min(MAX_DIM / w, MAX_DIM / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            console.log(`Downscaled to ${w}x${h}`);
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        console.log("Image drawing complete.");

        pixels = ctx.getImageData(0, 0, w, h);
        console.log(`Processing ${pixels.width}x${pixels.height} image, threshold=${thresh}`);

        let lines = [];
        let tooComplex = false;

        // --- Horizontal lines ---
        outer_h:
        for (let y = 0; y < pixels.height - 1; y++) {
            let hasLine = false;
            let lineStart = -1;
            for (let x = 0; x < pixels.width; x++) {
                let pixLine = false;
                for (let k = 0; k < 3; k++) { // skip alpha channel (k<3)
                    if (Math.abs(getPixel(x, y, k) - getPixel(x, y + 1, k)) >= thresh) {
                        pixLine = true;
                        break;
                    }
                }

                if (pixLine) {
                    if (!hasLine) {
                        hasLine = true;
                        lineStart = getX(x);
                    }
                } else {
                    if (hasLine) {
                        lines.push({ dir: 1, offset: getY(y) - 0.5, start: lineStart, end: getX(x) });
                        hasLine = false;
                        if (lines.length >= MAX_LINES) { tooComplex = true; break outer_h; }
                    }
                }
            }
            if (hasLine) {
                lines.push({ dir: 1, offset: getY(y) - 0.5, start: lineStart, end: getX(pixels.width) });
            }
        }

        // --- Vertical lines ---
        if (!tooComplex) {
            outer_v:
            for (let x = 0; x < pixels.width - 1; x++) {
                let hasLine = false;
                let lineStart = -1;
                for (let y = pixels.height - 1; y >= 0; y--) {
                    let pixLine = false;
                    for (let k = 0; k < 3; k++) {
                        if (Math.abs(getPixel(x, y, k) - getPixel(x + 1, y, k)) >= thresh) {
                            pixLine = true;
                            break;
                        }
                    }

                    if (pixLine) {
                        if (!hasLine) {
                            hasLine = true;
                            lineStart = getY(y);
                        }
                    } else {
                        if (hasLine) {
                            lines.push({ dir: 0, offset: getX(x) + 0.5, start: lineStart - 1, end: getY(y) - 1 });
                            hasLine = false;
                            if (lines.length >= MAX_LINES) { tooComplex = true; break outer_v; }
                        }
                    }
                }
                if (hasLine) {
                    lines.push({ dir: 0, offset: getX(x) + 0.5, start: lineStart - 1, end: getY(pixels.height) - 1 });
                }
            }
        }

        let statusEl = document.getElementById('filename');
        if (tooComplex) {
            statusEl.innerText = `Still too complex (${lines.length} lines)! Try increasing threshold or using a simpler image.`;
        } else {
            statusEl.innerText = `${uploader.name} — ${lines.length} lines generated`;
        }

        console.log(`Done! Created ${lines.length} lines.`);

        let output = document.querySelector("#output");
        output.innerHTML = "";
        lines.forEach(line => { output.innerHTML += getLineEquation(line); });

        output.select();
        document.execCommand("copy");
    };
}

function getLineEquation(line) {
    if (line.dir === 0) {
        return `x = ${line.offset}\\left\\{${line.start}\\le y \\le${line.end}\\right\\}\n`;
    } else {
        return `y = ${line.offset}\\left\\{${line.start}\\le x \\le${line.end}\\right\\}\n`;
    }
}

function getPixel(i, j, c) {
    return pixels.data[j * 4 * pixels.width + 4 * i + c];
}

function getX(x) { return x - pixels.width / 2; }
function getY(y) { return -y + pixels.height / 2; }