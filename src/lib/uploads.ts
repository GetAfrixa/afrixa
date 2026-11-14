import { uploadUserFile as uploadUserFileFn } from "@/lib/uploads.functions";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Uploads a file into the user's own folder and returns a served URL/path. */
export async function uploadUserFile(
  bucket: "avatars" | "portfolio" | "chat-attachments" | "verifications",
  userId: string,
  file: File,
): Promise<string> {
  // userId kept for API compatibility; server enforces auth identity.
  void userId;
  const dataBase64 = await fileToBase64(file);
  const res = await uploadUserFileFn({
    data: { bucket, fileName: file.name, contentType: file.type, dataBase64 },
  });
  return res.url;
}
