import { describe, expect, it } from "vitest";
import { getProjectDetail, knowledgeBase, projects } from "./knowledge";
import { displayNoteBody } from "./note-display";

describe("displayNoteBody", () => {
  it("drops a 'This project does not use …' sentence", () => {
    const body =
      "It is built on Supabase. Tests are written in Playwright. This project does not use FastAPI, Redis or Celery.";
    expect(displayNoteBody(body)).toEqual({
      text: "It is built on Supabase. Tests are written in Playwright.",
      trimmed: true,
    });
  });

  it("drops a '… is not listed on his resume' sentence wherever it sits", () => {
    const body =
      "He has used TensorFlow and Keras. PyTorch is not listed on his resume. He used OpenCV at Aura AI.";
    expect(displayNoteBody(body).text).toBe(
      "He has used TensorFlow and Keras. He used OpenCV at Aura AI.",
    );
    expect(displayNoteBody("Kubernetes and Terraform are not listed on his resume.").text).toBe("");
  });

  it("still drops the sentence when it is written with the accented spelling", () => {
    expect(displayNoteBody("PyTorch is not listed on his résumé.").text).toBe("");
  });

  it("keeps limitations and honest notes a reader should see", () => {
    const body =
      "ResNet50 reached 85% accuracy. Limitation: this is not a controlled comparison. The code belongs to Testneo and there is no public repository.";
    expect(displayNoteBody(body)).toEqual({ text: body, trimmed: false });
  });

  it("does not split inside names like Next.js or numbers like 0.85", () => {
    const body = "Stack: Next.js 16 and React 19. It reached 0.85 F1.";
    expect(displayNoteBody(body)).toEqual({ text: body, trimmed: false });
  });

  it("returns an empty body unchanged", () => {
    expect(displayNoteBody("")).toEqual({ text: "", trimmed: false });
  });

  it("removes the model-facing sentences from every project page's note", () => {
    for (const project of projects) {
      const body = getProjectDetail(project)?.body ?? "";
      const { text } = displayNoteBody(body);
      expect(text, project.slug).not.toMatch(/This project does not/i);
      expect(text, project.slug).not.toMatch(/not listed on his r[eé]sum[eé]/i);
    }
  });

  it("leaves the copilot's notes whole (display only)", () => {
    const before = knowledgeBase.map((item) => item.body);
    for (const item of knowledgeBase) displayNoteBody(item.body);
    expect(knowledgeBase.map((item) => item.body)).toEqual(before);
  });
});
