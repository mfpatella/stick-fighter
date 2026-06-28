import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const outputDir = path.join(root, "qa-output", "sprite-audit");
const alphaThreshold = 12;
const hardIssueTypes = new Set(["dimensionMismatch", "frameOutOfRange", "emptyFrame", "edgeTouch"]);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function scanObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing ${marker}`);
  }

  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(brace + 1, index);
      }
    }
  }

  throw new Error(`Unclosed object for ${marker}`);
}

function splitTopLevelEntries(body) {
  const entries = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
    } else if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      const entry = body.slice(start, index).trim();
      if (entry) {
        entries.push(entry);
      }
      start = index + 1;
    }
  }

  const tail = body.slice(start).trim();
  if (tail) {
    entries.push(tail);
  }

  return entries;
}

function parseNumbers(text) {
  return text
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
}

function parseFrames(rowBody) {
  const explicitFrames = rowBody.match(/frames:\s*\[([^\]]*)\]/s);
  if (explicitFrames) {
    return parseNumbers(explicitFrames[1]);
  }

  const start = Number(rowBody.match(/start:\s*(\d+)/)?.[1]);
  const count = Number(rowBody.match(/count:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(start) || !Number.isFinite(count)) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => start + index);
}

function getFrameConfig(body) {
  const padded = body.match(/\.\.\.paddedRuntimeFrame\(([^)]*)\)/);
  if (padded) {
    const [contentFrameWidth, contentFrameHeight, contentPadX, contentPadTop, contentPadBottom = 0] = parseNumbers(
      padded[1]
    );
    return {
      frameWidth: contentFrameWidth + contentPadX * 2,
      frameHeight: contentFrameHeight + contentPadTop + contentPadBottom
    };
  }

  if (/\.\.\.standardRuntimeFrame\(\)/.test(body)) {
    return {
      frameWidth: 253,
      frameHeight: 235
    };
  }

  const frameWidth = Number(body.match(/frameWidth:\s*(\d+)/)?.[1]);
  const frameHeight = Number(body.match(/frameHeight:\s*(\d+)/)?.[1]);
  return Number.isFinite(frameWidth) && Number.isFinite(frameHeight) ? { frameWidth, frameHeight } : null;
}

function parseSpriteConfigs() {
  const trainingSource = readText("src/game/TrainingScene.ts");
  const assetsSource = readText("src/game/artAssets.ts");
  const assetMap = new Map();

  for (const match of assetsSource.matchAll(/(\w+RuntimeActions):\s*characterAsset\("([^"]+)"\)/g)) {
    assetMap.set(match[1], match[2]);
  }

  const configBody = scanObjectLiteral(trainingSource, "const characterSheetConfigs");
  return splitTopLevelEntries(configBody)
    .map((entry) => {
      const key = entry.match(/^(\w+):\s*{/)?.[1];
      const body = entry.slice(entry.indexOf("{") + 1, entry.lastIndexOf("}"));
      const assetKey = body.match(/asset:\s*characterAssets\.(\w+)/)?.[1];
      const frameConfig = getFrameConfig(body);
      const blockedText = body.match(/blockedFrames:\s*\[([^\]]*)\]/s)?.[1];
      const blockedFrames = new Set(blockedText ? parseNumbers(blockedText) : []);
      const rows = {};

      for (const row of [
        "idle",
        "run",
        "light",
        "heavy",
        "low",
        "high",
        "kick",
        "spinKick",
        "chomp",
        "tailStrike",
        "clawSwipe"
      ]) {
        const rowMatch = body.match(new RegExp(`${row}:\\s*{([^}]*)}`, "s"));
        if (rowMatch) {
          rows[row] = parseFrames(rowMatch[1]).filter((frame) => !blockedFrames.has(frame));
        }
      }

      const allFrames = [...new Set(Object.values(rows).flat())].sort((left, right) => left - right);
      return {
        key,
        assetKey,
        assetPath: assetMap.get(assetKey),
        frameWidth: frameConfig?.frameWidth,
        frameHeight: frameConfig?.frameHeight,
        rows,
        allFrames,
        blockedFrames: [...blockedFrames].sort((left, right) => left - right)
      };
    })
    .filter((config) => config.key && config.assetPath && config.frameWidth && config.frameHeight);
}

function decodePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG`);
  }

  let position = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let transparency = null;
  const idatChunks = [];

  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position);
    position += 4;
    const type = buffer.toString("ascii", position, position + 4);
    position += 4;
    const data = buffer.subarray(position, position + length);
    position += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth} in ${filePath}`);
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : colorType === 3 ? 1 : 0;
  if (!channels) {
    throw new Error(`Unsupported PNG color type ${colorType} in ${filePath}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let inputPosition = 0;
  let previous = Buffer.alloc(stride);
  let current = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputPosition];
    inputPosition += 1;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[inputPosition];
      inputPosition += 1;
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let output;

      if (filter === 0) {
        output = value;
      } else if (filter === 1) {
        output = (value + left) & 255;
      } else if (filter === 2) {
        output = (value + up) & 255;
      } else if (filter === 3) {
        output = (value + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        const estimate = left + up - upLeft;
        const leftDistance = Math.abs(estimate - left);
        const upDistance = Math.abs(estimate - up);
        const upLeftDistance = Math.abs(estimate - upLeft);
        const predictor = leftDistance <= upDistance && leftDistance <= upLeftDistance ? left : upDistance <= upLeftDistance ? up : upLeft;
        output = (value + predictor) & 255;
      } else {
        throw new Error(`Unsupported PNG filter ${filter} in ${filePath}`);
      }

      current[x] = output;
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      if (colorType === 6) {
        pixels[target] = current[source];
        pixels[target + 1] = current[source + 1];
        pixels[target + 2] = current[source + 2];
        pixels[target + 3] = current[source + 3];
      } else if (colorType === 2) {
        pixels[target] = current[source];
        pixels[target + 1] = current[source + 1];
        pixels[target + 2] = current[source + 2];
        pixels[target + 3] = 255;
      } else if (colorType === 4) {
        pixels[target] = current[source];
        pixels[target + 1] = current[source];
        pixels[target + 2] = current[source];
        pixels[target + 3] = current[source + 1];
      } else if (colorType === 0) {
        pixels[target] = current[source];
        pixels[target + 1] = current[source];
        pixels[target + 2] = current[source];
        pixels[target + 3] = 255;
      } else if (colorType === 3) {
        const index = current[source];
        pixels[target] = palette?.[index * 3] ?? 0;
        pixels[target + 1] = palette?.[index * 3 + 1] ?? 0;
        pixels[target + 2] = palette?.[index * 3 + 2] ?? 0;
        pixels[target + 3] = transparency?.[index] ?? 255;
      }
    }

    [previous, current] = [current, previous];
  }

  return { width, height, pixels };
}

function makeCrcTable() {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function getFrameMetrics(image, config, frame) {
  const columns = Math.floor(image.width / config.frameWidth);
  const frameX = (frame % columns) * config.frameWidth;
  const frameY = Math.floor(frame / columns) * config.frameHeight;
  let count = 0;
  let minX = config.frameWidth;
  let minY = config.frameHeight;
  let maxX = -1;
  let maxY = -1;
  let edgeCount = 0;
  let nearEdgeCount = 0;
  let edgeDarkPixels = 0;

  for (let y = 0; y < config.frameHeight; y += 1) {
    for (let x = 0; x < config.frameWidth; x += 1) {
      const source = ((frameY + y) * image.width + frameX + x) * 4;
      const alpha = image.pixels[source + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (x === 0 || y === 0 || x === config.frameWidth - 1 || y === config.frameHeight - 1) {
        edgeCount += 1;
      }
      if (x <= 2 || y <= 2 || x >= config.frameWidth - 3 || y >= config.frameHeight - 3) {
        nearEdgeCount += 1;
      }

      const red = image.pixels[source];
      const green = image.pixels[source + 1];
      const blue = image.pixels[source + 2];
      if (red < 12 && green < 12 && blue < 12 && alpha > 180 && (x <= 5 || y <= 5 || x >= config.frameWidth - 6 || y >= config.frameHeight - 6)) {
        edgeDarkPixels += 1;
      }
    }
  }

  return {
    frame,
    count,
    bounds: count
      ? {
          minX,
          minY,
          maxX,
          maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        }
      : null,
    edgeCount,
    nearEdgeCount,
    edgeDarkPixels
  };
}

function copyFrameToContactSheet(targetPixels, targetWidth, sourceImage, config, frame, targetX, targetY, cellWidth, cellHeight) {
  const columns = Math.floor(sourceImage.width / config.frameWidth);
  const frameX = (frame % columns) * config.frameWidth;
  const frameY = Math.floor(frame / columns) * config.frameHeight;
  const scale = Math.min((cellWidth - 12) / config.frameWidth, (cellHeight - 18) / config.frameHeight, 1);
  const drawWidth = Math.max(1, Math.floor(config.frameWidth * scale));
  const drawHeight = Math.max(1, Math.floor(config.frameHeight * scale));
  const offsetX = targetX + Math.floor((cellWidth - drawWidth) / 2);
  const offsetY = targetY + 10 + Math.floor((cellHeight - drawHeight - 10) / 2);

  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const target = ((targetY + y) * targetWidth + targetX + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 229 : 244;
      targetPixels[target] = checker;
      targetPixels[target + 1] = checker;
      targetPixels[target + 2] = checker;
      targetPixels[target + 3] = 255;
    }
  }

  for (let y = 0; y < drawHeight; y += 1) {
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = frameX + Math.min(config.frameWidth - 1, Math.floor(x / scale));
      const sourceY = frameY + Math.min(config.frameHeight - 1, Math.floor(y / scale));
      const source = (sourceY * sourceImage.width + sourceX) * 4;
      const alpha = sourceImage.pixels[source + 3] / 255;
      if (alpha <= 0) {
        continue;
      }

      const target = ((offsetY + y) * targetWidth + offsetX + x) * 4;
      targetPixels[target] = Math.round(sourceImage.pixels[source] * alpha + targetPixels[target] * (1 - alpha));
      targetPixels[target + 1] = Math.round(sourceImage.pixels[source + 1] * alpha + targetPixels[target + 1] * (1 - alpha));
      targetPixels[target + 2] = Math.round(sourceImage.pixels[source + 2] * alpha + targetPixels[target + 2] * (1 - alpha));
      targetPixels[target + 3] = 255;
    }
  }
}

function buildContactSheet(contactFrames) {
  const cellWidth = 104;
  const cellHeight = 104;
  const columns = 10;
  const rows = Math.max(1, Math.ceil(contactFrames.length / columns));
  const width = columns * cellWidth;
  const height = rows * cellHeight;
  const pixels = Buffer.alloc(width * height * 4);
  pixels.fill(255);

  contactFrames.forEach((entry, index) => {
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    copyFrameToContactSheet(pixels, width, entry.image, entry.config, entry.frame, x, y, cellWidth, cellHeight);
  });

  return encodePng(width, height, pixels);
}

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function run() {
  ensureOutputDir();
  const configs = parseSpriteConfigs();
  const sheetReports = [];
  const issues = [];
  const contactFrames = [];

  for (const config of configs) {
    const imagePath = path.join(root, "public", config.assetPath.replace(/^\//, "").replace(/\?.*$/, ""));
    const image = decodePng(imagePath);
    const columns = Math.floor(image.width / config.frameWidth);
    const rows = Math.floor(image.height / config.frameHeight);
    const maxFrame = columns * rows - 1;
    const sheetIssues = [];
    const frameReports = [];

    if (image.width % config.frameWidth !== 0 || image.height % config.frameHeight !== 0) {
      sheetIssues.push({
        type: "dimensionMismatch",
        image: [image.width, image.height],
        frame: [config.frameWidth, config.frameHeight]
      });
    }

    for (const frame of config.allFrames) {
      if (frame > maxFrame) {
        sheetIssues.push({ type: "frameOutOfRange", frame, maxFrame });
        continue;
      }

      const metrics = getFrameMetrics(image, config, frame);
      frameReports.push(metrics);
      if (metrics.count === 0) {
        sheetIssues.push({ type: "emptyFrame", frame });
      }
      if (metrics.edgeCount > 0) {
        sheetIssues.push({ type: "edgeTouch", frame, edgeCount: metrics.edgeCount, bounds: metrics.bounds });
      }
      if (metrics.nearEdgeCount > 60) {
        sheetIssues.push({ type: "nearEdgeHeavy", frame, nearEdgeCount: metrics.nearEdgeCount, bounds: metrics.bounds });
      }
      if (metrics.edgeDarkPixels > 16) {
        sheetIssues.push({ type: "edgeDarkPixels", frame, edgeDarkPixels: metrics.edgeDarkPixels });
      }
    }

    for (const frame of config.allFrames.slice(0, 24)) {
      contactFrames.push({ config, image, frame });
    }

    if (sheetIssues.length) {
      issues.push({
        key: config.key,
        asset: config.assetPath,
        issues: sheetIssues
      });
    }

    sheetReports.push({
      key: config.key,
      asset: config.assetPath,
      image: `${image.width}x${image.height}`,
      frame: `${config.frameWidth}x${config.frameHeight}`,
      referencedFrames: config.allFrames.length,
      blockedFrames: config.blockedFrames.length,
      issues: sheetIssues,
      frames: frameReports
    });
  }

  const hardIssues = issues.flatMap((sheet) => sheet.issues.filter((issue) => hardIssueTypes.has(issue.type)));
  const report = {
    generatedAt: new Date().toISOString(),
    sheetCount: configs.length,
    referencedFrames: sheetReports.reduce((sum, sheet) => sum + sheet.referencedFrames, 0),
    hardIssueCount: hardIssues.length,
    issueSheetCount: issues.length,
    issues,
    sheetReports: sheetReports.map(({ frames, ...sheet }) => sheet)
  };

  const reportPath = path.join(outputDir, "sprite-audit.json");
  const contactSheetPath = path.join(outputDir, "sprite-contact-sheet.png");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(contactSheetPath, buildContactSheet(contactFrames));

  console.log(`Sprite audit: ${report.sheetCount} sheets, ${report.referencedFrames} referenced frames, ${report.hardIssueCount} hard issues.`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  console.log(`Contact sheet: ${path.relative(root, contactSheetPath)}`);

  if (hardIssues.length > 0) {
    process.exitCode = 1;
  }
}

run();
