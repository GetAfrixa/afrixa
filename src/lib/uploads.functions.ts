import { createServerFn } from "@tanstack/react-start";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";

const inputSchema = z.object({
  bucket: z.enum(["avatars", "portfolio", "chat-attachments", "verifications"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(255).optional(),
  dataBase64: z.string().min(1),
});

function safeExt(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return ext;
}

export const uploadUserFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ext = safeExt(data.fileName);
    const name = `${crypto.randomUUID()}.${ext}`;
    const relDir = path.join("uploads", data.bucket, context.userId);
    const absDir = path.join(process.cwd(), "public", relDir);
    await mkdir(absDir, { recursive: true });
    const absPath = path.join(absDir, name);
    const buf = Buffer.from(data.dataBase64, "base64");
    await writeFile(absPath, buf);
    const publicPath = `/${relDir.replace(/\\/g, "/")}/${name}`;
    return { path: publicPath, url: publicPath };
  });
