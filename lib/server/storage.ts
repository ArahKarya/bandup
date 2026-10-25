import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Learner uploads (speaking recordings). Paths are built from ids only, never user input. */
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./storage");

export function audioPath(userId: string, submissionId: string, ext: string): string {
  return path.join("speaking", userId, `${submissionId}.${ext}`);
}

export async function saveFile(relative: string, data: Buffer): Promise<void> {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, relative);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage path");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function readStored(relative: string): Promise<Buffer> {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, relative);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage path");
  return readFile(full);
}

/** Deletes everything stored for a learner (account deletion). */
export async function removeUserFiles(userId: string): Promise<void> {
  if (!/^[a-z0-9]+$/i.test(userId)) throw new Error("Invalid user id");
  await rm(path.join(/*turbopackIgnore: true*/ ROOT, "speaking", userId), { recursive: true, force: true });
}
