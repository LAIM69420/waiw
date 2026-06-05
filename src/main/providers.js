const fs = require("node:fs");
const path = require("node:path");
const { AppError, ERROR_CODES, toAppError } = require("./errors");

function combinedPrompt(settings) {
  return [settings.prompt, settings.style].filter(Boolean).join("\n\nStyle: ");
}

function extensionFromContentType(contentType) {
  if (contentType?.includes("jpeg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  return ".png";
}

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new AppError(ERROR_CODES.GENERATION_FAILED, `Image download failed with HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") || "";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    ext: extensionFromContentType(contentType)
  };
}

async function generateOpenAI(settings, apiKey) {
  if (!apiKey) {
    throw new AppError(ERROR_CODES.MISSING_KEY, "OpenAI API key is required.");
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model: settings.model,
    prompt: combinedPrompt(settings),
    size: settings.resolution,
    n: 1
  });

  const image = result.data?.[0];
  if (image?.b64_json) {
    return { buffer: Buffer.from(image.b64_json, "base64"), ext: ".png" };
  }
  if (image?.url) {
    return downloadImage(image.url);
  }
  throw new AppError(ERROR_CODES.GENERATION_FAILED, "OpenAI returned no image.");
}

async function generateStability(settings, apiKey) {
  if (!apiKey) {
    throw new AppError(ERROR_CODES.MISSING_KEY, "Stability AI API key is required.");
  }

  const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*"
    },
    body: (() => {
      const form = new FormData();
      form.append("prompt", combinedPrompt(settings));
      form.append("aspect_ratio", aspectRatio(settings.resolution));
      form.append("output_format", "png");
      return form;
    })()
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const error = new Error(message || `Stability request failed with HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    ext: extensionFromContentType(response.headers.get("content-type"))
  };
}

async function generateReplicate(settings, apiKey) {
  if (!apiKey) {
    throw new AppError(ERROR_CODES.MISSING_KEY, "Replicate API token is required.");
  }

  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: settings.model.includes(":") ? settings.model.split(":")[1] : undefined,
      model: settings.model.includes(":") ? undefined : settings.model,
      input: {
        prompt: combinedPrompt(settings),
        aspect_ratio: aspectRatio(settings.resolution),
        output_format: "png"
      }
    })
  });

  if (!createResponse.ok) {
    const error = new Error(await createResponse.text().catch(() => ""));
    error.status = createResponse.status;
    throw error;
  }

  let prediction = await createResponse.json();
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) {
    throw new AppError(ERROR_CODES.GENERATION_FAILED, "Replicate did not return a polling URL.");
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollResponse = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!pollResponse.ok) {
      const error = new Error(await pollResponse.text().catch(() => ""));
      error.status = pollResponse.status;
      throw error;
    }

    prediction = await pollResponse.json();
    if (prediction.status === "succeeded") {
      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      if (typeof output === "string") {
        return downloadImage(output);
      }
      throw new AppError(ERROR_CODES.GENERATION_FAILED, "Replicate output did not contain an image URL.");
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new AppError(ERROR_CODES.GENERATION_FAILED, "Replicate generation failed.");
    }
  }

  throw new AppError(ERROR_CODES.GENERATION_FAILED, "Replicate generation timed out.");
}

async function generateLocal(settings) {
  const response = await fetch(settings.localEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: settings.prompt,
      style: settings.style,
      resolution: settings.resolution,
      model: settings.model
    })
  });

  if (!response.ok) {
    const error = new Error(await response.text().catch(() => ""));
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      ext: extensionFromContentType(contentType)
    };
  }

  const json = await response.json();
  if (json.imageBase64) {
    return { buffer: Buffer.from(json.imageBase64, "base64"), ext: ".png" };
  }
  if (json.imageUrl) {
    return downloadImage(json.imageUrl);
  }
  if (json.path) {
    return {
      buffer: fs.readFileSync(json.path),
      ext: path.extname(json.path) || ".png"
    };
  }

  throw new AppError(ERROR_CODES.GENERATION_FAILED, "Local provider returned no image.");
}

function aspectRatio(resolution) {
  const [width, height] = String(resolution).split("x").map(Number);
  if (!width || !height) return "16:9";
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function gcd(a, b) {
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

async function generateImage(settings, apiKey) {
  try {
    if (settings.provider === "openai") return await generateOpenAI(settings, apiKey);
    if (settings.provider === "stability") return await generateStability(settings, apiKey);
    if (settings.provider === "replicate") return await generateReplicate(settings, apiKey);
    if (settings.provider === "local") return await generateLocal(settings);
    throw new AppError(ERROR_CODES.SETTINGS_INVALID, "Unknown provider.");
  } catch (error) {
    throw toAppError(error);
  }
}

module.exports = {
  aspectRatio,
  combinedPrompt,
  generateImage
};
