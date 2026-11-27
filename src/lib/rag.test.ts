import { describe, expect, it } from "vitest";
import * as knowledgeModule from "./knowledge";
import { knowledgeBase, starterQuestions } from "./knowledge";
import {
  LONG_INPUT_CHARS,
  LONG_INPUT_K,
  MIN_SCORE,
  RETRIEVAL_K,
  buildGroundingContext,
  localAnswer,
  normalise,
  retrieve,
  retrieveKnowledge,
  scoreKnowledge,
  toSourceRefs,
  tokenize,
} from "./rag";
import { goldenQuestions, offTopicQuestions } from "./retrieval-golden";

const ids = (ranked: { item: { id: string } }[]) => ranked.map(({ item }) => item.id);
const card = (id: string) => knowledgeBase.find((item) => item.id === id)!;

describe("retrieveKnowledge", () => {
  it("ranks the most relevant card first for a project query", () => {
    const results = retrieveKnowledge("How did he build Aura AI?");
    expect(results[0]?.id).toBe("aura-ai");
  });

  it("surfaces RAG projects for a RAG query", () => {
    const found = retrieveKnowledge("show me his strongest RAG projects").map(
      (item) => item.id,
    );
    expect(found).toContain("hindi-semantic-search");
  });

  it("falls back to leading cards when the query has no usable tokens", () => {
    const results = retrieveKnowledge("the a an");
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects the limit argument", () => {
    expect(retrieveKnowledge("AI engineer", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("buildGroundingContext", () => {
  it("includes the full profile index and retrieved evidence", () => {
    const { context, retrieved } = buildGroundingContext("Aura AI", "default");
    expect(context).toContain("FULL PROFILE INDEX");
    expect(context).toContain("RETRIEVED EVIDENCE");
    expect(retrieved.length).toBeGreaterThan(0);
  });

  it("lists every card in the one-line index", () => {
    const { context } = buildGroundingContext("Aura AI", "default");
    for (const item of knowledgeBase) {
      expect(context).toContain(`${item.title}: ${item.summary}`);
    }
  });

  it("numbers the evidence in ranked order with kind, basis, tags and links", () => {
    const { context, retrieved } = buildGroundingContext(
      "How does the Hindi Semantic Search pipeline work, end to end?",
      "default",
    );
    const first = retrieved[0];
    expect(first.id).toBe("hindi-semantic-search");
    expect(context).toContain(
      `[1] ${first.title} (${first.kind}; basis: ${first.basis}; tags: ${first.tags.join(", ")})\n${first.body}\nLinks: Code — ${first.links![0].href}`,
    );
    retrieved.forEach((item, index) => {
      expect(context).toContain(`[${index + 1}] ${item.title} (`);
    });
    expect(context).not.toContain(`[${retrieved.length + 1}] `);
  });

  it("says so, in fixed words, when nothing is retrieved", () => {
    const { context, retrieved } = buildGroundingContext(
      "What is the weather in Paris?",
      "default",
    );
    expect(retrieved).toEqual([]);
    expect(context).toContain(
      "RETRIEVED EVIDENCE\nNo card matched this question. Answer only from the profile index above, or say the profile does not cover it.",
    );
  });

  it("does not let the mode word change what is retrieved", () => {
    for (const { q } of goldenQuestions) {
      const plain = buildGroundingContext(q, "default");
      const architecture = buildGroundingContext(q, "architecture");
      expect(architecture.retrieved.map((item) => item.id)).toEqual(
        plain.retrieved.map((item) => item.id),
      );
      expect(architecture.context).toBe(plain.context);
    }
    // The old bug: "architecture" prepended to every query pulled Aura AI in.
    const offTopic = buildGroundingContext("What is the weather in Paris?", "architecture");
    expect(offTopic.retrieved).toEqual([]);
  });

  it("accepts the whole list of user messages and applies the follow-up rule", () => {
    const { retrieved, retrieval } = buildGroundingContext(
      ["How did he build Aura AI?", "tell me more about that"],
      "default",
    );
    expect(retrieved[0]?.id).toBe("aura-ai");
    expect(retrieval.reusedPrevious).toBe(true);
  });

  it("retrieves exactly what retrieve() ranks, for every golden question", () => {
    for (const { q } of [...goldenQuestions, ...offTopicQuestions.map((text) => ({ q: text }))]) {
      const { retrieved, retrieval } = buildGroundingContext(q, "default");
      const direct = retrieve({ userMessages: [q] });
      expect(retrieved.map((item) => item.id)).toEqual(ids(direct.ranked));
      expect(retrieval).toEqual(direct);
    }
  });
});

describe("toSourceRefs", () => {
  it("keeps only id, title, and summary", () => {
    const [first] = retrieveKnowledge("Aura AI");
    const [ref] = toSourceRefs([first]);
    expect(ref).toEqual({
      id: first.id,
      title: first.title,
      summary: first.summary,
    });
    expect(ref).not.toHaveProperty("body");
    expect(ref).not.toHaveProperty("tags");
  });
});

describe("normalise", () => {
  it("lower-cases, trims and collapses whitespace", () => {
    expect(normalise("  How  did\the\nbuild   Aura AI? ")).toBe("how did he build aura ai?");
  });

  it("composes to NFC and strips zero-width joiners", () => {
    expect(normalise("re\u0301sume\u0301")).toBe("résumé");
    expect(normalise("हि\u200dंदी")).toBe("हिंदी");
    expect(normalise("हि\u200cंदी")).toBe("हिंदी");
  });

  it("caps the length at 6000 characters", () => {
    expect(normalise("a".repeat(7000))).toHaveLength(6000);
  });
});

describe("tokenize", () => {
  it("drops stop words, including the owner's name and question scaffolding", () => {
    expect(tokenize("Why should we hire Bhanu Pratap Rana?")).toEqual(["hire"]);
    expect(tokenize("Please tell me about him, and explain which awards")).toEqual(["awards"]);
    expect(tokenize("the a an")).toEqual([]);
  });

  it("keeps stack tokens with + # and inner dots, and strips outer dots", () => {
    expect(tokenize("C++ and C# on Next.js.")).toEqual(["c++", "c#", "next.js"]);
    expect(tokenize("...Bytical.ai...")).toEqual(["bytical.ai"]);
  });

  it("keeps Devanagari words whole: matras and virama stay attached", () => {
    expect(tokenize("हिंदी प्रोजेक्ट")).toEqual(["हिंदी", "प्रोजेक्ट"]);
    expect(tokenize("पढ़ाई")).toHaveLength(1);
  });

  it("splits on the danda and drops Hindi and Hinglish function words", () => {
    expect(tokenize("अनुभव क्या है। शिक्षा॥")).toEqual(["अनुभव", "शिक्षा"]);
    expect(tokenize("unka anubhav kya hai?")).toEqual(["anubhav"]);
    expect(tokenize("उन्होंने कहाँ पढ़ाई की?")).toEqual(["पढ़ाई"]);
  });

  it("drops one-character tokens", () => {
    expect(tokenize("R x 5 ai")).toEqual(["ai"]);
  });
});

describe("scoreKnowledge", () => {
  it("returns nothing for empty or stop-word-only input", () => {
    expect(scoreKnowledge("")).toEqual([]);
    expect(scoreKnowledge("   ")).toEqual([]);
    expect(scoreKnowledge("the a an")).toEqual([]);
    expect(scoreKnowledge("tell me about him")).toEqual([]);
  });

  it("returns only cards at or above MIN_SCORE, best first, ties in page order", () => {
    const ranked = scoreKnowledge("FastAPI backend with Redis and Celery");
    expect(ranked.length).toBeGreaterThan(1);
    const order = new Map(knowledgeBase.map((item, index) => [item.id, index]));
    ranked.forEach((entry, index) => {
      expect(entry.score).toBeGreaterThanOrEqual(MIN_SCORE);
      const next = ranked[index + 1];
      if (!next) return;
      expect(entry.score).toBeGreaterThanOrEqual(next.score);
      if (entry.score === next.score) {
        expect(order.get(entry.item.id)!).toBeLessThan(order.get(next.item.id)!);
      }
    });
  });

  it("matches whole tokens only: no substring hits", () => {
    // "ai" is inside "explain", "paris" inside "comparison", "art" inside "started".
    expect(scoreKnowledge("explain")).toEqual([]);
    expect(scoreKnowledge("plain rain captain")).toEqual([]);
    expect(scoreKnowledge("What is the weather in Paris?")).toEqual([]);
    expect(scoreKnowledge("art")).toEqual([]);
  });

  it("does not match 'hire' through 'time-to-hire' strongly enough to retrieve", () => {
    const ranked = scoreKnowledge("Why should we hire Bhanu?");
    expect(ranked[0]?.item.id).toBe("profile-summary");
    expect(ids(ranked)).not.toContain("bytical-ai");
    expect(ids(ranked)).not.toContain("smart-hr-tool");
  });

  it("returns nothing for every off-topic question", () => {
    for (const question of offTopicQuestions) {
      expect(scoreKnowledge(question), question).toEqual([]);
    }
  });

  it("ranks the obvious card first for section questions", () => {
    expect(scoreKnowledge("contact email")[0]?.item.id).toBe("contact");
    expect(scoreKnowledge("Where did he study?")[0]?.item.id).toBe("education");
    expect(scoreKnowledge("What is his current job?")[0]?.item.id).toBe("khs-research-assistant");
  });

  it("matches dotted names by their parts and plurals by their singular", () => {
    expect(scoreKnowledge("Bytical")[0]?.item.id).toBe("bytical-ai");
    expect(scoreKnowledge("bytical.ai")[0]?.item.id).toBe("bytical-ai");
    expect(ids(scoreKnowledge("databases"))).toEqual(ids(scoreKnowledge("database")));
    expect(ids(scoreKnowledge("databases")).length).toBeGreaterThan(0);
    expect(ids(scoreKnowledge("certification"))).toContain("certifications");
  });

  it("does not match a word that is one character short or long", () => {
    expect(scoreKnowledge("langchai")).toEqual([]);
    expect(scoreKnowledge("dockers")[0]?.item.id).toBe(scoreKnowledge("docker")[0]?.item.id);
    expect(scoreKnowledge("dockerx")).toEqual([]);
    // "m.tech" is one token: "tech" alone must not find the education card.
    expect(ids(scoreKnowledge("tech"))).not.toContain("education");
    expect(scoreKnowledge("M.Tech")[0]?.item.id).toBe("education");
  });

  it("treats a hyphenated label as one unit, not as loose words", () => {
    expect(scoreKnowledge("open")).toEqual([]);
    expect(scoreKnowledge("What time is it in Tokyo?")).toEqual([]);
    const [top] = scoreKnowledge("Does he have open-source work?");
    expect(top.item.id).toBe("sales-pitch-generator");
    expect(top.matched).toEqual(["open", "source"]);
    expect(scoreKnowledge("open source")[0]?.item.id).toBe("sales-pitch-generator");
  });

  it("finds a group of cards by its kind or section name", () => {
    const projects = scoreKnowledge("projects");
    expect(projects.length).toBeGreaterThan(0);
    for (const { item } of projects) {
      expect(item.kind).toBe("project");
    }
    expect(scoreKnowledge("What is his educational background?")[0]?.item.id).toBe("education");
  });

  it("scores a multi-word tag above its separate words", () => {
    const phrase = scoreKnowledge("computer vision");
    const reversed = scoreKnowledge("vision computer");
    expect(phrase[0].score).toBeGreaterThan(reversed[0].score);
    expect(ids(phrase)).toContain("eye-disease-classification");
  });

  it("answers a Devanagari question with a sensible few cards, not all or none", () => {
    const ranked = scoreKnowledge("उनका अनुभव क्या है?");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThan(knowledgeBase.length / 2);
    for (const { item, matched } of ranked) {
      expect(item.kind).toBe("experience");
      expect(matched).toEqual(["अनुभव"]);
    }
    expect(scoreKnowledge("उनसे संपर्क कैसे करें?")[0]?.item.id).toBe("contact");
    expect(scoreKnowledge("उन्होंने कहाँ पढ़ाई की?")[0]?.item.id).toBe("education");
  });

  it("reports matched terms as the visitor typed them", () => {
    const [top] = scoreKnowledge("Which vector DATABASES has he used?");
    expect(top.matched).toEqual(["vector", "databases"]);
  });

  it("is deterministic", () => {
    for (const { q } of goldenQuestions.slice(0, 12)) {
      expect(JSON.stringify(scoreKnowledge(q))).toBe(JSON.stringify(scoreKnowledge(q)));
    }
  });
});

describe("scoreKnowledge while typing (partial)", () => {
  it("matches the word being typed as a prefix once it has three characters", () => {
    expect(scoreKnowledge("langch")).toEqual([]);
    const typing = scoreKnowledge("langch", { partial: true });
    expect(ids(typing)).toContain("hindi-semantic-search");
    expect(typing[0].matched).toEqual(["langch"]);
  });

  it("does not prefix-match a word of fewer than three characters", () => {
    expect(scoreKnowledge("la", { partial: true })).toEqual([]);
    expect(ids(scoreKnowledge("ai", { partial: true }))).toEqual(ids(scoreKnowledge("ai")));
  });

  it("treats a word followed by whitespace or punctuation as finished", () => {
    expect(scoreKnowledge("langch ", { partial: true })).toEqual([]);
    expect(scoreKnowledge("langch?", { partial: true })).toEqual([]);
  });

  it("scores every word before the last one normally", () => {
    // "langch" is not the last word here, so it must match exactly, and does not.
    const typing = scoreKnowledge("langch dock", { partial: true });
    for (const { matched } of typing) {
      expect(matched).toEqual(["dock"]);
    }
    expect(ids(typing)).toContain("aura-ai");
  });

  it("ignores a stop word even while it is still the last word", () => {
    expect(scoreKnowledge("Aura AI the", { partial: true })).toEqual(scoreKnowledge("Aura AI"));
  });

  it("lights Hindi words as they are typed, through the word list", () => {
    const typing = scoreKnowledge("प्रका", { partial: true });
    expect(typing[0]?.item.id).toBe("publications");
  });

  it("agrees with the finished question once typing stops", () => {
    for (const { q } of goldenQuestions) {
      expect(scoreKnowledge(q, { partial: true })).toEqual(scoreKnowledge(q));
    }
  });
});

describe("retrieve", () => {
  it("returns at most RETRIEVAL_K cards for a normal question", () => {
    const result = retrieve({ userMessages: ["AI projects with Python and FastAPI and RAG"] });
    expect(result.k).toBe(RETRIEVAL_K);
    expect(result.ranked.length).toBeLessThanOrEqual(RETRIEVAL_K);
    expect(result.reusedPrevious).toBe(false);
  });

  it("uses a larger k for a long input such as a pasted job description", () => {
    const jobDescription = `We are hiring an AI engineer. ${"Python FastAPI RAG LangChain Docker AWS computer vision. ".repeat(15)}`;
    expect(jobDescription.length).toBeGreaterThan(LONG_INPUT_CHARS);
    const result = retrieve({ userMessages: [jobDescription] });
    expect(result.k).toBe(LONG_INPUT_K);
    expect(result.ranked.length).toBeLessThanOrEqual(LONG_INPUT_K);
    expect(result.ranked.length).toBeGreaterThan(RETRIEVAL_K);
  });

  it("returns an empty result for no messages or an off-topic one", () => {
    expect(retrieve({ userMessages: [] })).toEqual({
      ranked: [],
      expansions: [],
      reusedPrevious: false,
      k: RETRIEVAL_K,
    });
    expect(retrieve({ userMessages: ["What is the weather in Paris?"] }).ranked).toEqual([]);
  });

  it("keeps the previous question's cards for a follow-up with no keywords", () => {
    const first = retrieve({ userMessages: ["How did he build Aura AI?"] });
    const followUp = retrieve({
      userMessages: ["How did he build Aura AI?", "tell me more about that"],
    });
    expect(followUp.reusedPrevious).toBe(true);
    expect(followUp.ranked[0]?.item.id).toBe("aura-ai");
    expect(ids(followUp.ranked)).toEqual(ids(first.ranked));
  });

  it("looks past earlier follow-ups to the last question that matched", () => {
    const result = retrieve({
      userMessages: ["How did he build Aura AI?", "tell me more about that", "and then?"],
    });
    expect(result.reusedPrevious).toBe(true);
    expect(result.ranked[0]?.item.id).toBe("aura-ai");
  });

  it("keeps a weak new keyword in view when it leans on the previous question", () => {
    const result = retrieve({
      userMessages: ["How did he build Aura AI?", "Does he know PyTorch?"],
    });
    expect(result.reusedPrevious).toBe(true);
    expect(ids(result.ranked).slice(0, 2)).toEqual(["aura-ai", "skills-genai-rag"]);
  });

  it("does not reuse the previous question when the new one stands on its own", () => {
    const result = retrieve({
      userMessages: ["How did he build Aura AI?", "Where did he study?"],
    });
    expect(result.reusedPrevious).toBe(false);
    expect(result.ranked[0]?.item.id).toBe("education");
    expect(ids(result.ranked)).not.toContain("aura-ai");
  });

  it("does not claim reuse when there is nothing to reuse", () => {
    const result = retrieve({ userMessages: ["hello there", "What is the weather in Paris?"] });
    expect(result.reusedPrevious).toBe(false);
    expect(result.ranked).toEqual([]);
  });

  it("lists the word-list expansions it applied, once each, and no identity ones", () => {
    const hindi = retrieve({ userMessages: ["उनका अनुभव क्या है? अनुभव"] });
    expect(hindi.expansions).toEqual([{ from: "अनुभव", to: ["experience"] }]);
    const english = retrieve({ userMessages: ["Where did he study FastAPI?"] });
    expect(english.expansions).toEqual([{ from: "study", to: ["education"] }]);
    const named = retrieve({ userMessages: ["भानु का संपर्क"] });
    expect(named.expansions).toEqual([{ from: "संपर्क", to: ["contact", "email"] }]);
  });

  it("is deterministic and serialisable", () => {
    const input = { userMessages: ["How did he build Aura AI?", "और हिंदी प्रोजेक्ट?"] };
    const once = JSON.stringify(retrieve(input));
    expect(JSON.stringify(retrieve(input))).toBe(once);
    expect(JSON.parse(once).ranked.length).toBeGreaterThan(0);
  });

  it("never lights more than k cards, or every card, at any point while typing", () => {
    const walked = [
      ...starterQuestions.map(({ question }) => question),
      "Show me his strongest RAG projects.",
      "Which vector databases has he used?",
    ];
    expect(walked.length).toBeGreaterThanOrEqual(5);
    for (const question of walked) {
      for (let end = 1; end <= question.length; end += 1) {
        const draft = question.slice(0, end);
        const { ranked, k } = retrieve({ userMessages: [draft], partial: true });
        expect(ranked.length, draft).toBeLessThanOrEqual(k);
        expect(scoreKnowledge(draft, { partial: true }).length, draft).toBeLessThan(
          knowledgeBase.length,
        );
      }
      // Once typed in full, the preview is what the server will retrieve.
      expect(ids(retrieve({ userMessages: [question], partial: true }).ranked)).toEqual(
        ids(retrieve({ userMessages: [question] }).ranked),
      );
    }
  });
});

describe("localAnswer", () => {
  const LEAD_IN =
    "The model is unavailable right now, so here are the matching notes from the index:";

  it("quotes up to three matching cards with their links, and nothing else", () => {
    const sources = retrieveKnowledge("How does the Hindi Semantic Search pipeline work?", 6);
    const answer = localAnswer("How does the Hindi Semantic Search pipeline work?", "default", sources);
    expect(answer.startsWith(LEAD_IN)).toBe(true);
    for (const item of sources.slice(0, 3)) {
      expect(answer).toContain(`**${item.title}** — ${item.summary}`);
      for (const link of item.links ?? []) {
        expect(answer).toContain(`[${link.label}](${link.href})`);
      }
    }
    for (const item of sources.slice(3)) {
      expect(answer).not.toContain(item.title);
    }
  });

  it("adds no words of its own: every line is the lead-in, a card line or its links", () => {
    for (const { q } of goldenQuestions) {
      const sources = retrieve({ userMessages: [q] }).ranked.map(({ item }) => item);
      if (sources.length === 0) continue;
      const allowed = new Set([LEAD_IN]);
      for (const item of sources.slice(0, 3)) {
        allowed.add(`**${item.title}** — ${item.summary}`);
        if (item.links?.length) {
          allowed.add(item.links.map((link) => `[${link.label}](${link.href})`).join(" · "));
        }
      }
      const lines = localAnswer(q, "default", sources).split("\n").filter(Boolean);
      for (const line of lines) {
        expect(allowed.has(line), line).toBe(true);
      }
    }
  });

  it("never names a technology the quoted cards do not", () => {
    // The old fallback described a FastAPI/Redis/Celery architecture for any card.
    const atal = [card("atal-ai")];
    for (const mode of ["default", "architecture"] as const) {
      const answer = localAnswer("Explain the ATAL AI architecture.", mode, atal);
      const quoted = `${atal[0].title} ${atal[0].summary}`;
      for (const word of ["FastAPI", "Redis", "Celery", "PostgreSQL", "vector search", "GPT-4o"]) {
        expect(answer.includes(word)).toBe(quoted.includes(word));
      }
    }
  });

  it("is the same in both modes and for any question wording", () => {
    const sources = [card("aura-ai"), card("contact")];
    expect(localAnswer("Why hire him?", "architecture", sources)).toBe(
      localAnswer("anything else", "default", sources),
    );
  });

  it("says plainly when nothing matched", () => {
    expect(localAnswer("What is the weather in Paris?", "default", [])).toBe(
      "The model is unavailable right now and no note matches that question. Email ranabhanu514@gmail.com or read the résumé.",
    );
  });
});

describe("knowledge base", () => {
  it("has unique ids", () => {
    const all = knowledgeBase.map((item) => item.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps the ids that existing links and answers refer to", () => {
    const all = new Set(knowledgeBase.map((item) => item.id));
    for (const id of [
      "aura-ai",
      "atal-ai",
      "voice-ai-assistant",
      "hindi-semantic-search",
      "smart-hr-tool",
      "custom-document-ai-chatbot",
      "sales-pitch-generator",
    ]) {
      expect(all.has(id), id).toBe(true);
    }
  });

  it("gives every card an anchor and a prompt", () => {
    for (const item of knowledgeBase) {
      expect(item.anchor.trim(), item.id).not.toBe("");
      expect(item.prompt.trim(), item.id).not.toBe("");
    }
  });

  it("contains neither the phone number nor the alternate email, in any export", () => {
    const serialised = JSON.stringify(Object.values(knowledgeModule));
    expect(serialised.length).toBeGreaterThan(1000);
    expect(serialised).not.toMatch(/8979\d{6}/);
    expect(serialised).not.toMatch(/dei\.ac\.in/);
  });
});

describe("questions about the person with no other keyword", () => {
  it("retrieves the profile summary for 'Who is Bhanu?'", () => {
    const { ranked, reusedPrevious } = retrieve({ userMessages: ["Who is Bhanu?"] });
    expect(ranked.map(({ item }) => item.id)).toEqual(["profile-summary"]);
    expect(reusedPrevious).toBe(false);
  });

  it("does the same for 'Tell me about him' and for the Hindi name", () => {
    expect(retrieve({ userMessages: ["Tell me about him"] }).ranked[0]?.item.id).toBe(
      "profile-summary",
    );
    expect(retrieve({ userMessages: ["भानु कौन हैं?"] }).ranked[0]?.item.id).toBe(
      "profile-summary",
    );
  });

  it("still returns nothing for stop words alone or unrelated questions", () => {
    expect(retrieve({ userMessages: ["the a an"] }).ranked).toEqual([]);
    expect(retrieve({ userMessages: ["What is the weather in Paris?"] }).ranked).toEqual([]);
    expect(retrieve({ userMessages: ["Tell me a joke"] }).ranked).toEqual([]);
  });

  it("does not fire while a longer question is still being typed", () => {
    const typing = retrieve({ userMessages: ["Bhanu's publ"], partial: true });
    expect(typing.ranked[0]?.item.id).not.toBe("profile-summary");
  });
});

describe("follow-ups after a question about the person", () => {
  it("keeps the profile summary for 'Tell me more' after 'Who is Bhanu?'", () => {
    const { ranked, reusedPrevious } = retrieve({
      userMessages: ["Who is Bhanu?", "Tell me more"],
    });
    expect(ranked[0]?.item.id).toBe("profile-summary");
    expect(reusedPrevious).toBe(true);
  });
});
