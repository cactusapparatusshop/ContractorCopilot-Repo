import "server-only";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export function isJobsiteImage(type: string) {
  return IMAGE_TYPES.has(type);
}

export function imageDataUrl(type: string, bytes: Uint8Array) {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function proposalPhoto(src: string, caption?: string | null) {
  return src.startsWith("data:image/jpeg;base64,") || src.startsWith("data:image/png;base64,")
    ? { src, caption: caption?.trim().slice(0, 360) || "Jobsite photo" }
    : null;
}

export async function captionJobsitePhoto(dataUrl: string, fileName: string) {
  if (!process.env.OPENAI_API_KEY?.trim()) return `Jobsite photo: ${fileName}`;
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_ESTIMATE_MODEL ?? "gpt-4.1-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: "Write one neutral, factual caption (maximum 35 words) describing only visible jobsite conditions for a contractor proposal. Do not infer hidden damage, measurements, or safety conclusions." }, { type: "input_image", image_url: dataUrl, detail: "low" }] } as never],
    });
    return response.output_text.replace(/\s+/g, " ").trim().slice(0, 360) || `Jobsite photo: ${fileName}`;
  } catch {
    return `Jobsite photo: ${fileName}`;
  }
}
