import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractJson, parseSpeaking, parseWriting } from "@/lib/ai/parse";
import { speakingPrompt, writingPrompt } from "@/lib/ai/prompts";
import { ProviderError, safeBaseUrl } from "@/lib/ai/providers";
import type { SpeakingTask, WritingTask } from "@/lib/content/schema";

const task: WritingTask = {
  id: "w",
  kind: "writing_task",
  module: "academic",
  task: 1,
  taskType: "bar_chart",
  title: "t",
  difficulty: 1,
  unlisted: false,
  prompt: "The chart shows...",
  charts: [{ type: "bar", title: "c", categories: ["A"], series: [{ name: "s", values: [1] }] }],
  steps: ["one"],
  minWords: 150,
  minutes: 20,
  tips: [],
  samples: [],
};

describe("AI prompts", () => {
  it("includes the task, chart data and the essay with its word count", () => {
    const p = writingPrompt(task, "My essay", 2);
    expect(p.user).toContain("Writing Task 1");
    expect(p.user).toContain('"categories":["A"]');
    expect(p.user).toContain("1. one");
    expect(p.user).toContain("(2 words)");
    expect(p.system).toContain("ONLY a JSON object");
  });

  it("describes a cue card or question list for speaking", () => {
    const base: SpeakingTask = { id: "s", kind: "speaking_task", part: 2, topic: "A trip", difficulty: 1, unlisted: false, questions: ["Q?"], tips: [], usefulPhrases: [], samples: [] };
    const card = speakingPrompt({ ...base, cueCard: { prompt: "Describe a trip", bullets: ["where", "when"], closing: "and why" } }, "I went", 95);
    expect(card.user).toContain("- where");
    expect(card.user).toContain("95 seconds");
    expect(speakingPrompt({ ...base, part: 1 }, "x", 10).user).toContain("- Q?");
  });
});

describe("AI response parsing", () => {
  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":2} hope it helps')).toEqual({ a: 2 });
    expect(() => extractJson("no json here")).toThrow(/JSON/);
  });

  it("clamps and rounds criteria to half bands and fills defaults", () => {
    const r = parseWriting('{"criteria":{"ta":6.3,"cc":"7","lr":10,"gra":-1}}');
    expect(r.criteria).toEqual({ ta: 6.5, cc: 7, lr: 9, gra: 0 });
    expect(r.strengths).toEqual([]);
  });

  it("rejects replies missing criteria", () => {
    expect(() => parseSpeaking('{"summary":"hi"}')).toThrow();
    expect(parseSpeaking('{"criteria":{"fc":6,"lr":6,"gra":5.5,"p":6}}').criteria.gra).toBe(5.5);
  });
});

describe("safeBaseUrl", () => {
  it("accepts public https endpoints and strips the trailing slash", () => {
    expect(safeBaseUrl("https://openrouter.ai/api/v1/", false)).toBe("https://openrouter.ai/api/v1");
    expect(safeBaseUrl(null, false)).toBe("https://api.openai.com/v1");
  });

  it("blocks private hosts unless allowed, plain http to public hosts, and credentials", () => {
    expect(() => safeBaseUrl("http://localhost:11434/v1", false)).toThrow(ProviderError);
    expect(() => safeBaseUrl("https://10.0.0.5/v1", false)).toThrow(/Private/);
    expect(() => safeBaseUrl("https://169.254.169.254/latest", false)).toThrow(/Private/);
    expect(safeBaseUrl("http://localhost:11434/v1", true)).toBe("http://localhost:11434/v1");
    expect(() => safeBaseUrl("http://api.example.com/v1", false)).toThrow(/https/);
    expect(() => safeBaseUrl("https://u:p@api.example.com", false)).toThrow(/credentials/);
    expect(() => safeBaseUrl("not a url", false)).toThrow(/valid/);
  });
});

import { isPrivateAddress } from "@/lib/ai/providers";

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local, CGNAT and IPv4-mapped IPv6", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "not-an-ip"]) {
      expect(isPrivateAddress(a), a).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const a of ["8.8.8.8", "104.18.0.1", "2606:4700::1111"]) expect(isPrivateAddress(a), a).toBe(false);
  });
});

describe("safeBaseUrl hardening", () => {
  it("catches trailing dots, bracketed IPv6 and mapped addresses", () => {
    expect(() => safeBaseUrl("https://localhost./v1", false)).toThrow(/Private/);
    expect(() => safeBaseUrl("https://[::ffff:7f00:1]/v1", false)).toThrow(/Private/);
    expect(() => safeBaseUrl("https://[fe80::1]/v1", false)).toThrow(/Private/);
    expect(() => safeBaseUrl("https://100.64.1.1/v1", false)).toThrow(/Private/);
  });
});
