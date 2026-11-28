// Everything in this file is public: it is rendered on the page, shipped to the
// browser for the live index, and given to the model. Private details (phone
// number, personal alternate email) must never be added here.
//
// Source of truth is the resume PDF in /public. Facts that come from a public
// repository README instead are marked with `basis: "repo"`.
//
// Relative imports only: next.config.ts loads this file (for the CSP).

import { withLiveLinks, type ProjectMedia } from "./project-media";

export type { ProjectMedia };

export type KnowledgeKind =
  | "profile"
  | "experience"
  | "project"
  | "skill"
  | "education"
  | "research";

/** Where a card's facts come from, shown beside every citation. */
export type Basis = "resume" | "resume+repo" | "repo" | "publication" | "site";

export const basisLabel: Record<Basis, string> = {
  resume: "From his resume",
  "resume+repo": "From his resume and the public repository",
  repo: "From the public repository",
  publication: "From the published citation",
  site: "About this site",
};

export const kindLabel: Record<KnowledgeKind, string> = {
  profile: "Profile",
  experience: "Experience",
  project: "Project",
  skill: "Skills",
  education: "Background",
  research: "Research",
};

export type KnowledgeLink = { label: string; href: string };

export type KnowledgeItem = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  tags: string[];
  body: string;
  links?: KnowledgeLink[];
  /** id of the element on the home page this card describes. */
  anchor: string;
  /** A natural question a visitor could ask about this card. */
  prompt: string;
  /** Extra words a visitor might use for this card (query synonyms). */
  aliases?: string[];
  basis: Basis;
};

// Minimal shape sent to the client (kept small enough to travel in a header).
export type SourceRef = Pick<KnowledgeItem, "id" | "title" | "summary">;

const GITHUB = "https://github.com/bhanu-pratap-rana";

export const profile = {
  name: "Bhanu Pratap Rana",
  nameHindi: "भानु प्रताप राणा",
  title: "Applied AI Engineer",
  focus: ["GenAI", "RAG", "AI Agents", "Computer Vision", "FastAPI"],
  location: "Agra, Uttar Pradesh, India",
  email: "ranabhanu514@gmail.com",
  linkedin: "https://www.linkedin.com/in/bhanu-pratap-rana/",
  github: GITHUB,
  resumePath: "/bhanu-pratap-rana-resume.pdf",
  // Hero copy. Every number here is on the resume.
  statement:
    "I build AI that works in Indian languages: semantic search over 1,633 Hindi books, and a Hindi and Assamese learning app piloted with 570+ students in six Assam schools.",
  // Not rendered: the hero's role line carries the city, and the rest is in
  // Work and Experience. Kept for the owner's rewrite; nothing reads it.
  status:
    "Based in Agra, working across RAG, AI agents and computer vision. Also co-founder of Aura AI and Media.",
} as const;

/* ------------------------------------------------------------------ */
/* Experience — resume order, resume wording                           */
/* ------------------------------------------------------------------ */

export type ExperienceEntry = {
  id: string;
  title: string;
  org: string;
  period: string;
  /** Full-time / Part-time / Internship */
  type: string;
  place: string;
  context?: string;
  bullets: ExperienceBullet[];
  stack: string[];
  kbId: string;
};

/**
 * One resume bullet. `project` names the Work entry (a project slug) when the
 * bullet describes a listed project: Experience then links to that project
 * instead of telling it a second time. Add it to any bullet that becomes a
 * project; leave it off role facts that belong to no project.
 */
export type ExperienceBullet = { text: string; project?: Project["slug"] };

export const experience: ExperienceEntry[] = [
  {
    id: "experience-khs",
    title: "Research Assistant (Technical) — AI/ML Engineer",
    org: "Kendriya Hindi Sansthan (Ministry of Education)",
    period: "Mar 2025 – Present",
    type: "Full-time",
    place: "Agra, Uttar Pradesh",
    context:
      "ICSSR-funded “AI Based Remedial Education Model” under ATAL AI — Vision Viksit Bharat @2047",
    bullets: [
      { text: "Architected and built ATAL AI 2.0, an offline-first PWA (Next.js 16, React 19, TypeScript, Supabase/pgvector) with Hindi and Assamese curriculum, pre/post assessments, gamification, a voice AI tutor (ai4bharat indic-parler-tts), teacher dashboards with CSV analytics and OTP-based role access.", project: "atal-ai-2-0" },
      { text: "Built a multilingual Hindi Semantic Search engine over 1,633 books: MiniLM-L12-v2 embeddings in ChromaDB (HNSW cosine), LangChain LCEL RAG Q&A with Groq LLaMA, and a CrewAI multi-agent metadata pipeline (description generator, category classifier, quality validator).", project: "hindi-semantic-search" },
      { text: "Led field research across 6 government schools in Assam covering 570+ students, achieving 50–65% student adoption in pilot comparisons against existing digital learning platforms." },
      { text: "Built data pipelines and Power BI dashboards for stakeholder reporting; reviewed 22 research papers and contributed to an edited book on AI-enabled education." },
    ],
    stack: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Supabase",
      "pgvector",
      "ChromaDB",
      "LangChain LCEL",
      "Groq",
      "CrewAI",
      "Power BI",
    ],
    kbId: "khs-research-assistant",
  },
  {
    id: "experience-aura",
    title: "Co-Founder",
    org: "Aura AI and Media",
    period: "Dec 2025 – Present",
    type: "Part-time",
    place: "Remote",
    context:
      "AI-first beauty technology and media venture (production platform in active development)",
    bullets: [
      { text: "Designed the end-to-end architecture of an asynchronous AI beauty platform on FastAPI, PostgreSQL, Redis, Celery, Docker and React Native.", project: "aura-ai" },
      { text: "Built computer vision pipelines with MediaPipe and OpenCV for real-time facial analysis, skin-tone detection and personalized makeup recommendation.", project: "aura-ai" },
      { text: "Integrated GPT-4o as an AI beauty assistant for personalized consultations and product recommendations.", project: "aura-ai" },
      { text: "Implemented containerized async processing (Celery + Redis) for production-scale workloads, and multilingual React Native apps for international markets." },
    ],
    stack: [
      "FastAPI",
      "PostgreSQL",
      "Redis",
      "Celery",
      "Docker",
      "React Native",
      "MediaPipe",
      "OpenCV",
      "GPT-4o",
    ],
    kbId: "aura-ai",
  },
  {
    id: "experience-testneo",
    title: "AI Engineer",
    org: "Testneo",
    period: "Dec 2024 – Feb 2025",
    type: "Part-time",
    place: "Remote",
    bullets: [
      { text: "Built an AI-powered API Test Case Generator using Groq LLMs and ChromaDB RAG that generates functional, security and edge-case tests from PDF, DOCX, OpenAPI (JSON/YAML) and TXT documentation.", project: "api-test-case-generator" },
      { text: "Implemented LangChain RAG workflows for context-aware generation, with export pipelines to JSON, CSV, Markdown and pytest.", project: "api-test-case-generator" },
    ],
    stack: ["Groq", "ChromaDB", "LangChain", "OpenAPI", "pytest"],
    kbId: "testneo-api-generator",
  },
  {
    id: "experience-bytical",
    title: "Machine Learning Intern",
    org: "Bytical.ai",
    period: "Jul 2024 – Dec 2024",
    type: "Internship",
    place: "Gurugram, Haryana (Remote)",
    bullets: [
      { text: "Built an automated document-processing pipeline over 3,482 files with 95%+ OCR accuracy and sub-second query responses (OpenCV denoising, binarization, contour detection + PyTesseract)." },
      { text: "Built an AI Smart HR Tool (FastAPI + Streamlit) generating job letters, job descriptions and onboarding plans — cut HR workload 50%, improved content accuracy 30% and reduced time-to-hire 25%." },
      { text: "Created an Azure OpenAI sentiment-analysis platform processing 100 comments/minute — reduced manual review time 70% and improved accuracy 25%." },
    ],
    stack: ["OpenCV", "PyTesseract", "FastAPI", "Streamlit", "Azure OpenAI"],
    kbId: "bytical-ai",
  },
];

/**
 * The role line the hero and the link-preview card show: the resume title at
 * the current employer (the first role still running, in resume order). The
 * title is the part after the em dash ("Research Assistant (Technical) —
 * AI/ML Engineer" gives "AI/ML Engineer"); the employer drops its trailing
 * parenthetical (the ministry), so the line fits one short sentence.
 */
export const currentRole: { title: string; org: string; line: string; city?: string } = (() => {
  const role =
    experience.find((entry) => entry.period.endsWith("Present")) ?? experience[0];
  const title = role.title.split(" — ").pop()?.trim() || role.title;
  const org = role.org.replace(/\s*\([^)]*\)\s*$/, "");
  // The city only ("Agra, Uttar Pradesh" gives "Agra"); a remote role has none.
  const city = role.place.split(",")[0].trim();
  return {
    title,
    org,
    line: `${title} at ${org}`,
    ...(city && !/^remote\b/i.test(city) ? { city } : {}),
  };
})();

/* ------------------------------------------------------------------ */
/* Work                                                                 */
/* ------------------------------------------------------------------ */

export type PipelineStep = { node: string; detail: string };

export type Project = {
  /** Stable URL segment. Never derive it from the name: URLs are indexed. */
  slug: string;
  kbId: string;
  name: string;
  /** Plain statement of where the work was done. */
  attribution: string;
  summary: string;
  stack: string[];
  featured?: boolean;
  repoUrl?: string;
  demoUrl?: string;
  demoLabel?: string;
  /** A working deployment (distinct from demoUrl, an interface preview). https only. */
  liveUrl?: string;
  /** Label for liveUrl; defaults to "Live app". */
  liveLabel?: string;
  /**
   * Screenshots, demo videos and walkthrough embeds; the first is the cover.
   * Files live in public/projects/<slug>/ (see README, "Adding a project demo").
   */
  media?: ProjectMedia[];
  /** Honest status or caveat, written as a sentence. */
  note?: string;
  pipeline?: PipelineStep[];
  /** Listed on the home page; false keeps the page reachable but unlisted. */
  listed: boolean;
};

export const projects: Project[] = [
  {
    slug: "atal-ai-2-0",
    kbId: "atal-ai",
    name: "ATAL AI 2.0",
    attribution: "Built at Kendriya Hindi Sansthan, since 2025",
    summary:
      "An offline-first learning app for digital and AI literacy, with a Hindi and Assamese curriculum, pre- and post-assessments, a voice tutor and teacher dashboards. Piloted with 570+ students in six government schools in Assam.",
    stack: ["Next.js 16", "React 19", "TypeScript", "Supabase", "pgvector", "indic-parler-tts"],
    featured: true,
    repoUrl: `${GITHUB}/ATAL-AI-2.0`,
    pipeline: [
      { node: "Voice tutor", detail: "ai4bharat indic-parler-tts, with a browser speech fallback" },
      { node: "Next.js 16 PWA", detail: "React 19, TypeScript, Hindi and Assamese lessons" },
      { node: "Offline layer", detail: "IndexedDB, service worker, background sync queue" },
      { node: "Supabase", detail: "PostgreSQL, Auth, Realtime, pgvector" },
      { node: "Teacher dashboard", detail: "Classes, invite codes, CSV analytics" },
    ],
    listed: true,
  },
  {
    slug: "hindi-semantic-search",
    kbId: "hindi-semantic-search",
    name: "Hindi Semantic Search System",
    attribution: "Built at Kendriya Hindi Sansthan, published as an ILA book chapter",
    summary:
      "Cross-lingual search over 1,633 Hindi book records: ask in Hindi or English and get the same book. MiniLM embeddings in ChromaDB beside a TF-IDF baseline, with RAG Q&A and a three-agent CrewAI pipeline that writes and checks metadata.",
    stack: ["ChromaDB", "LangChain", "CrewAI", "Groq", "Streamlit", "MiniLM"],
    featured: true,
    repoUrl: `${GITHUB}/Hindi-Books-Semantic-Search-System`,
    note: "The repository does not yet report measured retrieval scores.",
    pipeline: [
      { node: "Book records", detail: "1,633 titles from Google Books and Open Library" },
      { node: "Embeddings", detail: "paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions" },
      { node: "ChromaDB", detail: "HNSW index, cosine distance, beside a TF-IDF baseline" },
      { node: "RAG Q&A", detail: "LangChain LCEL with a Groq-hosted LLaMA model" },
      { node: "CrewAI agents", detail: "Description writer, category classifier, quality validator" },
    ],
    listed: true,
  },
  {
    slug: "voice-ai-assistant",
    kbId: "voice-ai-assistant",
    name: "Voice AI Assistant",
    attribution: "Key project on his resume",
    summary:
      "A real-time voice assistant. It streams microphone audio to Deepgram for live transcription, then a Groq-hosted LLaMA 3.3 70B either suggests follow-up questions or answers from an uploaded PDF, DOCX or TXT file.",
    stack: ["Deepgram", "Groq LLaMA 3.3 70B", "FastAPI", "React 18", "Vite", "WebSockets"],
    featured: true,
    repoUrl: `${GITHUB}/voice-assistant`,
    demoUrl: "https://bhanu-pratap-rana.github.io/voice-assistant/",
    demoLabel: "Interface preview",
    note: "The hosted link shows the interface only. Full function needs the backend running locally.",
    pipeline: [
      { node: "React + Vite client", detail: "Microphone capture and read-aloud" },
      { node: "Deepgram nova-2", detail: "Streaming speech-to-text over WebSockets" },
      { node: "FastAPI backend", detail: "Parses uploaded PDF, DOCX and TXT" },
      { node: "Document context", detail: "The uploaded text grounds the answer" },
      { node: "Groq LLaMA 3.3 70B", detail: "Answers, or five follow-up questions" },
    ],
    listed: true,
  },
  {
    slug: "aura-ai",
    kbId: "aura-ai",
    name: "Aura AI",
    attribution: "Co-founder, Aura AI and Media, since December 2025",
    summary:
      "An AI beauty platform: facial analysis and skin-tone detection with MediaPipe and OpenCV, makeup recommendations, and a GPT-4o assistant for consultations, on an asynchronous FastAPI backend.",
    stack: ["FastAPI", "PostgreSQL", "Redis", "Celery", "Docker", "React Native", "MediaPipe", "OpenCV", "GPT-4o"],
    note: "In active development. The repository is private.",
    pipeline: [
      { node: "React Native app", detail: "Multilingual mobile client" },
      { node: "FastAPI", detail: "Service and orchestration layer" },
      { node: "OpenCV + MediaPipe", detail: "Facial analysis and skin-tone detection" },
      { node: "Redis + Celery", detail: "Asynchronous processing in containers" },
      { node: "GPT-4o assistant", detail: "Consultations and product recommendations" },
    ],
    listed: true,
  },
  {
    slug: "api-test-case-generator",
    kbId: "testneo-api-generator",
    name: "API Test Case Generator",
    attribution: "Built at Testneo, December 2024 to February 2025",
    summary:
      "Generates functional, security and edge-case API tests from documentation in PDF, DOCX, OpenAPI or TXT, using Groq models with ChromaDB retrieval. Exports to JSON, CSV, Markdown and pytest.",
    stack: ["Groq", "ChromaDB", "LangChain", "OpenAPI", "pytest"],
    note: "Built for Testneo. There is no public repository.",
    listed: true,
  },
  {
    slug: "smart-hr-tool",
    kbId: "smart-hr-tool",
    name: "Smart HR Tool",
    attribution: "Started at Bytical.ai, continued as a public repository",
    summary:
      "Generates HR documents such as job letters, job descriptions and onboarding plans, with a choice of a local Ollama model or a Groq-hosted one, on FastAPI and Streamlit with PDF and DOCX export.",
    stack: ["FastAPI", "SQLModel", "Alembic", "Ollama", "Groq", "Streamlit"],
    repoUrl: `${GITHUB}/Smart-HR-Tool`,
    listed: true,
  },
  {
    slug: "eye-disease-classification",
    kbId: "eye-disease-classification",
    name: "Eye Disease Classification",
    attribution: "Key project on his resume",
    summary:
      "Transfer learning on 5,335 fundus images across 10 classes. ResNet50 reached 85% accuracy and 0.85 F1; the VGG19 baseline reached 55% and 0.55.",
    stack: ["TensorFlow/Keras", "Transfer learning", "Scikit-learn"],
    repoUrl: `${GITHUB}/Eye-Image-Classification-Using-VGG19-and-ResNet50`,
    note: "Not a controlled comparison: the two models were trained with different epochs and batch sizes.",
    listed: true,
  },
  {
    slug: "custom-document-ai-chatbot",
    kbId: "custom-document-ai-chatbot",
    name: "Custom Document AI Chatbot",
    attribution: "Key project on his resume",
    summary:
      "A document pipeline that reads images with Tesseract OCR, extracts entities with spaCy, summarises with BART, and retrieves through Milvus vector search behind a chat interface.",
    stack: ["Tesseract", "spaCy", "BART", "Milvus", "MySQL"],
    repoUrl: `${GITHUB}/Custom-Document-AI-chatbot`,
    listed: true,
  },
  {
    slug: "bolchaal-hindi",
    kbId: "bolchaal-hindi",
    name: "Bolchaal Hindi",
    attribution: "Personal project, started November 2026",
    summary:
      "A 20-day spoken-Hindi course for travellers and international students. Every line of dialogue is voiced, shown in Hindi, Roman and English, and changes with the speaker's gender. Works offline on a phone.",
    stack: ["JavaScript", "Service worker", "Python", "Piper TTS", "Playwright"],
    repoUrl: `${GITHUB}/bolchaal-hindi`,
    demoUrl: "https://bhanu-pratap-rana.github.io/bolchaal-hindi/",
    demoLabel: "Preview",
    note: "The lessons are still under review by students and a Hindi teacher, so this is a preview.",
    listed: true,
  },
  {
    slug: "sales-pitch-generator",
    kbId: "sales-pitch-generator",
    name: "Sales Pitch Generator",
    attribution: "Personal project",
    summary:
      "Turns an uploaded PDF into a tailored sales pitch with LangChain, Groq, HuggingFace embeddings and FAISS retrieval, and shows the passages it used.",
    stack: ["Streamlit", "LangChain", "Groq", "FAISS"],
    repoUrl: `${GITHUB}/Sales-Pitch-generator`,
    listed: false,
  },
];

/** Smaller public repositories, linked as one line under the work list. */
export const moreWork: KnowledgeLink[] = [
  { label: "Sales Pitch Generator", href: "/projects/sales-pitch-generator" },
  { label: "Prompt Perfect Generator", href: `${GITHUB}/prompt-perfect-generator` },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** The Work entries a role's bullets describe, each once, in bullet order. */
export function roleProjects(role: ExperienceEntry): Project[] {
  const found: Project[] = [];
  for (const bullet of role.bullets) {
    const project = bullet.project ? getProjectBySlug(bullet.project) : undefined;
    if (project && !found.includes(project)) found.push(project);
  }
  return found;
}

/**
 * The bullets Experience shows under "What I did": those no Work entry
 * already tells. A bullet naming an unknown slug stays, so a typo never
 * hides the owner's text.
 */
export function roleOwnBullets(role: ExperienceEntry): string[] {
  return role.bullets
    .filter((bullet) => !(bullet.project && getProjectBySlug(bullet.project)))
    .map((bullet) => bullet.text);
}

/* ------------------------------------------------------------------ */
/* Skills — the resume's ten groups, in its order                      */
/* ------------------------------------------------------------------ */

export type SkillGroup = { group: string; items: string[] };

export const skills: SkillGroup[] = [
  {
    group: "GenAI & LLMs",
    items: ["OpenAI API (GPT-4o)", "Azure OpenAI", "Groq (LLaMA 3.3 70B)", "Ollama", "Hugging Face Transformers", "Prompt engineering", "Structured output (Pydantic)"],
  },
  {
    group: "RAG & vector search",
    items: ["LangChain (LCEL)", "ChromaDB", "pgvector", "Milvus", "FAISS", "Sentence-Transformers (MiniLM-L12-v2)", "Semantic search", "TF-IDF"],
  },
  {
    group: "AI agents",
    items: ["CrewAI", "Multi-agent pipelines", "Tool integration", "Retry/backoff (Tenacity)"],
  },
  {
    group: "ML & computer vision",
    items: ["TensorFlow/Keras", "Scikit-learn", "CNN transfer learning (VGG19, ResNet50)", "OpenCV", "MediaPipe", "PyTesseract/OCR", "Facial analysis"],
  },
  {
    group: "Speech & NLP",
    items: ["Deepgram (STT)", "Hugging Face TTS (indic-parler-tts)", "spaCy", "BART"],
  },
  {
    group: "Backend & data",
    items: ["Python", "FastAPI", "SQLModel", "Celery", "Redis", "REST APIs", "WebSockets", "PostgreSQL", "Supabase", "MySQL", "Alembic", "SQL"],
  },
  {
    group: "Cloud & DevOps",
    items: ["Docker", "AWS (ECS/Fargate)", "Vercel", "Git/GitHub", "pytest", "Structured logging"],
  },
  {
    group: "Frontend",
    items: ["TypeScript", "JavaScript", "React 18/19", "Next.js 16 (App Router)", "React Native", "Tailwind CSS", "Streamlit", "Vite"],
  },
  {
    group: "Analytics",
    items: ["Pandas", "NumPy", "Matplotlib", "Plotly", "Power BI"],
  },
  {
    group: "Languages",
    items: ["English (professional proficiency)", "Hindi (native)"],
  },
];

/* ------------------------------------------------------------------ */
/* Publications & presentations — resume order, citations verbatim     */
/* ------------------------------------------------------------------ */

export type Publication = {
  type: "Book chapter" | "Journal article" | "Conference presentation";
  year: string;
  title: string;
  citation: string;
  award?: string;
};

export const publications: Publication[] = [
  {
    type: "Book chapter",
    year: "2026",
    title: "Transforming Hindi Library Automation: Semantic Search and AI-Enhanced Metadata",
    citation:
      "Rana, B. P., & Mandusia, A. K. (2026). 71st Annual ILA International Conference Proceedings, Indian Library Association, New Delhi & Kendriya Hindi Sansthan, Agra, p. 302.",
  },
  {
    type: "Journal article",
    year: "2025",
    title: "Artificial Intelligence and Human Creativity: A Collaborative or Inhibitory Relationship",
    citation:
      "Kumari, S., Rana, B. P., & Tripathi, M. (2025). Shodh Bhumi, ISSN 3048-6203, Vol. 2, Issue 2, pp. 672–690.",
  },
  {
    type: "Conference presentation",
    year: "Aug 2025",
    title: "Emerging AI Applications for Legal Self-Help in India",
    citation:
      "Kumari, S., Kumar, A., & Rana, B. P. National Conference on the Intersection of AI and Law, Amity Law School, Chhattisgarh, Aug 2025.",
    award: "Best Paper Award, Technical Session 8",
  },
  {
    type: "Conference presentation",
    year: "Sep 2025",
    title: "AI, Technology & Sustainability: A Comparative Study of Neuromorphic Computing and the ATAL AI Web App",
    citation:
      "Rana, B. P. 1st International Conference on AI, Law and Sustainability (ICALS), Manipal University Jaipur, with UENP (Brazil) & Nicolaus Copernicus University (Poland), Sep 2025.",
  },
];

/* ------------------------------------------------------------------ */
/* Background                                                           */
/* ------------------------------------------------------------------ */

export type EducationEntry = {
  degree: string;
  org: string;
  period: string;
  score: string;
  /** The resume lists every score; the page shows only the stronger ones. */
  showScore: boolean;
};

export const education: EducationEntry[] = [
  { degree: "M.Tech in Computational Science", org: "Dayalbagh Educational Institute, Agra", period: "Sep 2022 – Jun 2024", score: "CGPA 8.1", showScore: true },
  { degree: "PG Diploma in Big Data & Logistics", org: "Dayalbagh Educational Institute, Agra", period: "Sep 2021 – Aug 2022", score: "CGPA 6.8", showScore: true },
  { degree: "ITI in Computer Operator & Programming Assistant (COPA)", org: "Govt. ITI, Bijnor", period: "Aug 2020 – Aug 2021", score: "CGPA 8.8", showScore: true },
  { degree: "B.Sc in Physics, Chemistry and Mathematics", org: "MJP Rohilkhand University, Bareilly", period: "Aug 2017 – Oct 2020", score: "CGPA 6.0", showScore: true },
];

export const certifications = [
  { name: "OCI 2025 Certified AI Foundations Associate", issuer: "Oracle", year: "2025" },
  { name: "Generative AI Mastermind", issuer: "Outskill", year: "2025" },
  { name: "Full Stack Web Development (Delta)", issuer: "Apna College", year: "2025" },
  { name: "AWS Cloud Practitioner Essentials", issuer: "AWS", year: "2024" },
];

// The Best Paper Award is shown once, with its paper, under Publications.
export const achievements: { title: string; by: string; year?: string }[] = [
  { title: "Best Project Showcase", by: "Govt. ITI, Bijnor" },
  { title: "Best Performer Student", by: "MIET Kumaun" },
  { title: "Student of the Year", by: "LIC" },
];

export const volunteer = {
  title: "Programmer & Media Manager (Volunteer)",
  org: "Sahitya Unnayan Sansthan, Chandausi",
  period: "Apr 2026 – Present",
  summary:
    "Lead technology and digital media for a Hindi literary and social-development NGO: digital platforms, outreach and AI-tool adoption.",
};

/* ------------------------------------------------------------------ */
/* Knowledge base — what the copilot can retrieve, in page order       */
/* ------------------------------------------------------------------ */

const SKILL = (group: string) =>
  skills.find((entry) => entry.group === group)?.items.join(", ") ?? "";

const notes: KnowledgeItem[] = [
  {
    id: "profile-summary",
    kind: "profile",
    title: "Profile summary",
    summary:
      "Applied AI Engineer in Agra working on generative AI, RAG, AI agents, computer vision and Python backends, with a focus on Hindi and other Indian languages.",
    tags: ["Applied AI Engineer", "GenAI", "RAG", "AI Agents", "Computer Vision", "FastAPI", "Indic AI", "Hindi"],
    body: `Bhanu Pratap Rana is an Applied AI Engineer based in Agra, Uttar Pradesh, India. He has worked in AI since July 2024: a machine learning internship at Bytical.ai (July to December 2024), part-time AI engineering at Testneo (December 2024 to February 2025), and a full-time role as Research Assistant (Technical) and AI/ML Engineer at Kendriya Hindi Sansthan, Ministry of Education, since March 2025. Since December 2025 he is also the part-time co-founder of Aura AI and Media. His resume describes this as 2+ years building AI systems across generative AI, RAG, AI agents, computer vision and Python backends (FastAPI, LangChain, Celery and Redis, PostgreSQL, Docker). His specialism is multilingual and Indic AI: an offline-first Hindi and Assamese learning app piloted with 570+ rural students, and a semantic search engine over 1,633 Hindi books. He has 2 publications (a book chapter and a journal article) and 2 conference presentations, one of which won a Best Paper Award. Spoken languages: English (professional proficiency) and Hindi (native).`,
    links: [
      { label: "Resume (PDF)", href: profile.resumePath },
      { label: "GitHub", href: profile.github },
      { label: "LinkedIn", href: profile.linkedin },
    ],
    anchor: "top",
    prompt: "Summarise Bhanu in 30 seconds: role, experience and location.",
    aliases: ["summary", "summarise", "summarize", "introduce", "introduction", "overview", "background", "hire", "hiring", "seniority", "senior", "years", "location", "based", "role", "strengths", "strongest", "fit", "languages", "speak", "speaks", "spoken", "english"],
    basis: "resume",
  },
  {
    id: "atal-ai",
    kind: "project",
    title: "ATAL AI 2.0",
    summary:
      "Offline-first Hindi and Assamese learning app with assessments, a voice tutor and teacher dashboards, piloted with 570+ students in six Assam schools.",
    tags: ["ATAL AI", "PWA", "Offline-first", "Next.js", "React", "TypeScript", "Supabase", "pgvector", "TTS", "Voice tutor", "Education", "Hindi", "Assamese"],
    body: `ATAL AI 2.0 is an offline-first Progressive Web App for digital and AI literacy that Bhanu architected and built at Kendriya Hindi Sansthan, under the ICSSR-funded "AI Based Remedial Education Model". Stack named in his resume: Next.js 16, React 19, TypeScript and Supabase with pgvector. It has a Hindi and Assamese curriculum, pre- and post-assessments, gamification, a voice AI tutor using ai4bharat indic-parler-tts, teacher dashboards with CSV analytics, and OTP-based role access. It was piloted with 570+ students across 6 government schools in Assam; his resume reports 50–65% student adoption in pilot comparisons against existing digital learning platforms (self-reported; the measurement method is not documented here). The public repository adds detail: offline support uses IndexedDB (Dexie), a service worker and a background sync queue with retries; the backend is Supabase (PostgreSQL, Auth, Realtime, pgvector); the curriculum has 568 markdown items; tests are written in Playwright. This project does not use FastAPI, Redis or Celery.`,
    links: [{ label: "Code", href: `${GITHUB}/ATAL-AI-2.0` }],
    anchor: "work-atal-ai-2-0",
    prompt: "How is ATAL AI 2.0 built to work offline, and where does the voice tutor fit?",
    aliases: ["atal", "learning", "literacy", "students", "pilot", "piloted", "schools", "assam", "offline", "tutor", "classroom", "teachers", "adoption", "edtech", "architecture", "production", "shipped", "ship", "users"],
    basis: "resume+repo",
  },
  {
    id: "hindi-semantic-search",
    kind: "project",
    title: "Hindi Semantic Search System",
    summary:
      "Cross-lingual semantic search and RAG Q&A over 1,633 Hindi book records, with MiniLM embeddings in ChromaDB, a TF-IDF baseline and a CrewAI metadata pipeline.",
    tags: ["RAG", "Semantic Search", "Embeddings", "ChromaDB", "LangChain", "LCEL", "CrewAI", "Groq", "Streamlit", "MiniLM", "TF-IDF", "Hindi", "Vector Search", "Multilingual"],
    body: `The Hindi Semantic Search System is a cross-lingual search engine over 1,633 Hindi books, built by Bhanu at Kendriya Hindi Sansthan. A reader can search in Hindi or in English and reach the same book: the repository's example is that "Godan" and "गोदान" resolve to the same title. It embeds book records with paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions) and stores them in ChromaDB with an HNSW index and cosine distance. A TF-IDF keyword baseline runs beside it for side-by-side comparison. RAG question answering is built with LangChain LCEL on a Groq-hosted LLaMA model. A CrewAI multi-agent pipeline improves the metadata with three agents: a description generator, a category classifier and a quality validator. The interface is Streamlit, and the data comes from Google Books and Open Library. It is published as a book chapter in the 71st Annual ILA International Conference Proceedings. Limitation, from the repository: only about a fifth of the records have descriptions, and no measured retrieval scores (such as precision at k) are reported yet.`,
    links: [{ label: "Code", href: `${GITHUB}/Hindi-Books-Semantic-Search-System` }],
    anchor: "work-hindi-semantic-search",
    prompt: "How does the Hindi Semantic Search pipeline work, end to end?",
    aliases: ["books", "library", "search", "retrieval", "embedding", "vector", "database", "cross-lingual", "multilingual", "indic", "agents", "agentic", "strongest"],
    basis: "resume+repo",
  },
  {
    id: "voice-ai-assistant",
    kind: "project",
    title: "Voice AI Assistant",
    summary:
      "Real-time voice assistant: Deepgram streaming transcription, then a Groq LLaMA 3.3 70B that suggests follow-ups or answers from an uploaded document.",
    tags: ["Voice AI", "Deepgram", "STT", "Groq", "LLaMA 3.3 70B", "FastAPI", "React", "Vite", "WebSockets", "RAG", "Realtime"],
    body: `The Voice AI Assistant is a real-time voice assistant. It streams microphone audio to Deepgram nova-2 over WebSockets for live speech-to-text. A Groq-hosted LLaMA 3.3 70B then works in one of two modes: it suggests five follow-up questions from the transcript, or it answers questions from an uploaded PDF, DOCX or TXT file. The frontend is React 18 with Vite; the backend is FastAPI. Read-aloud uses the browser's speech synthesis. His resume describes the document answering as RAG; in the repository the uploaded document's text is passed to the model as context, without a vector store. Limitation: the hosted GitHub Pages link shows the interface only, and full function needs the backend running locally.`,
    links: [
      { label: "Code", href: `${GITHUB}/voice-assistant` },
      { label: "Interface preview", href: "https://bhanu-pratap-rana.github.io/voice-assistant/" },
    ],
    anchor: "work-voice-ai-assistant",
    prompt: "How does the Voice AI Assistant handle streaming speech and document answers?",
    aliases: ["speech", "audio", "microphone", "transcription", "streaming", "real-time", "realtime", "demo"],
    basis: "resume+repo",
  },
  {
    id: "aura-ai",
    kind: "experience",
    title: "Aura AI — Co-Founder, Aura AI and Media",
    summary:
      "AI beauty platform in active development: facial analysis and skin-tone detection, makeup recommendations and a GPT-4o assistant on an asynchronous FastAPI backend.",
    tags: ["Aura AI", "Co-Founder", "FastAPI", "PostgreSQL", "Redis", "Celery", "Docker", "React Native", "OpenCV", "MediaPipe", "GPT-4o", "Computer Vision", "Facial Analysis"],
    body: `Bhanu is the co-founder of Aura AI and Media, an AI-first beauty technology and media venture, part-time and remote since December 2025. Aura AI is its platform. Status: in active development, not launched; the repository is private. He designed the end-to-end architecture of an asynchronous platform on FastAPI, PostgreSQL, Redis, Celery, Docker and React Native. He built computer vision pipelines with MediaPipe and OpenCV for real-time facial analysis, skin-tone detection and personalised makeup recommendation. He integrated GPT-4o as an AI beauty assistant for consultations and product recommendations. He implemented containerised asynchronous processing with Celery and Redis, and multilingual React Native apps.`,
    anchor: "work-aura-ai",
    prompt: "How did he design the Aura AI platform, and what stage is it at?",
    aliases: ["aura", "beauty", "makeup", "startup", "founder", "cofounder", "venture", "vision", "face", "skin", "async", "asynchronous", "architecture", "product", "end-to-end", "gpt"],
    basis: "resume",
  },
  {
    id: "testneo-api-generator",
    kind: "experience",
    title: "Testneo — AI Engineer (API Test Case Generator)",
    summary:
      "Part-time, December 2024 to February 2025: built a Groq and ChromaDB RAG system that generates API tests from documentation.",
    tags: ["Testneo", "AI Engineer", "Groq", "ChromaDB", "LangChain", "RAG", "OpenAPI", "pytest", "Test Generation"],
    body: `At Testneo (remote, part-time, December 2024 to February 2025) Bhanu worked as an AI Engineer. He built an AI-powered API Test Case Generator using Groq LLMs and ChromaDB retrieval that generates functional, security and edge-case tests from API documentation in PDF, DOCX, OpenAPI (JSON or YAML) and TXT. He implemented LangChain RAG workflows for context-aware generation, with export pipelines to JSON, CSV, Markdown and pytest. The code belongs to Testneo and there is no public repository.`,
    anchor: "experience-testneo",
    prompt: "What did he build at Testneo?",
    aliases: ["testing", "tests", "qa", "api", "documentation", "swagger"],
    basis: "resume",
  },
  {
    id: "smart-hr-tool",
    kind: "project",
    title: "Smart HR Tool",
    summary:
      "HR document generator on FastAPI and Streamlit with a local Ollama model or a Groq-hosted one, and PDF and DOCX export.",
    tags: ["Smart HR Tool", "FastAPI", "SQLModel", "Alembic", "Pydantic", "Ollama", "Groq", "Streamlit", "HR", "Automation"],
    body: `Smart HR Tool generates HR documents. Bhanu first built it during his internship at Bytical.ai as a FastAPI and Streamlit tool producing job letters, job descriptions and onboarding plans; his resume reports that it cut HR workload 50%, improved content accuracy 30% and reduced time-to-hire 25% (self-reported; the measurement method is not documented here). The public repository is a later version with two model options: a local model through Ollama, or Groq's hosted LLaMA 3.3 70B. Its backend is FastAPI with SQLModel, Pydantic and Alembic migrations; documents export to PDF and DOCX. It adds interview questions and performance reviews to the generators and exposes a documented REST API. The repository itself reports no metrics.`,
    links: [{ label: "Code", href: `${GITHUB}/Smart-HR-Tool` }],
    anchor: "work-smart-hr-tool",
    prompt: "What does the Smart HR Tool do, and how is it built?",
    aliases: ["hr", "recruitment", "letters", "onboarding", "documents", "local", "rest"],
    basis: "resume+repo",
  },
  {
    id: "eye-disease-classification",
    kind: "project",
    title: "Eye Disease Classification — VGG19 vs ResNet50",
    summary:
      "Transfer learning on 5,335 fundus images across 10 classes: ResNet50 reached 85% accuracy and 0.85 F1, the VGG19 baseline 55% and 0.55.",
    tags: ["Computer Vision", "TensorFlow", "Keras", "Transfer Learning", "CNN", "VGG19", "ResNet50", "Scikit-learn", "Medical Imaging", "Classification"],
    body: `Eye Disease Classification compares two ImageNet-pretrained CNNs fine-tuned to classify eye diseases from fundus images. The dataset has 5,335 images across 10 classes (including diabetic retinopathy, glaucoma, retinal detachment, myopia and healthy), resized to 224×224, with augmentation and early stopping. ResNet50 reached 85% accuracy and 0.85 F1. The VGG19 baseline reached 55% accuracy and 0.55 F1. Precision, recall and confusion matrices were also evaluated. It was built with TensorFlow/Keras and Scikit-learn. Limitation: this is not a controlled comparison. The repository shows the two models were trained with different settings (VGG19 for 50 epochs at batch size 32, ResNet50 for 10 epochs at batch size 16), and it does not document the evaluation split.`,
    links: [{ label: "Code", href: `${GITHUB}/Eye-Image-Classification-Using-VGG19-and-ResNet50` }],
    anchor: "work-eye-disease-classification",
    prompt: "What were the results of the eye disease classification project, and how far can they be trusted?",
    aliases: ["eye", "fundus", "retina", "medical", "deep", "learning", "accuracy", "f1", "model", "training", "trained", "train", "neural", "network", "networks", "vision", "image", "images"],
    basis: "resume+repo",
  },
  {
    id: "custom-document-ai-chatbot",
    kind: "project",
    title: "Custom Document AI Chatbot",
    summary:
      "OCR, entity recognition and summarisation pipeline with Milvus vector search behind a chat interface.",
    tags: ["OCR", "Tesseract", "spaCy", "NER", "BART", "Milvus", "MySQL", "NLP", "Document Intelligence", "Vector Search"],
    body: `The Custom Document AI Chatbot is a document pipeline. It extracts text from document images with Tesseract OCR, recognises named entities with spaCy, summarises with BART, stores vectors in Milvus for retrieval and structured data in MySQL, and serves the result through a chat interface. The repository includes a synthetic ticket dataset generator for testing. It reports no metrics.`,
    links: [{ label: "Code", href: `${GITHUB}/Custom-Document-AI-chatbot` }],
    anchor: "work-custom-document-ai-chatbot",
    prompt: "How does the Custom Document AI Chatbot process a document?",
    aliases: ["document", "documents", "pdf", "scan", "chatbot", "summarisation", "summarization", "entities", "vector", "database"],
    basis: "resume+repo",
  },
  {
    id: "bolchaal-hindi",
    kind: "project",
    title: "Bolchaal Hindi",
    summary:
      "A 20-day spoken-Hindi course app with voiced dialogues in Hindi, Roman and English that works offline. A preview: the lessons are still under review.",
    tags: ["Hindi", "TTS", "Piper", "JavaScript", "Service Worker", "Offline", "Python", "Playwright", "Language Learning"],
    body: `Bolchaal Hindi is a personal project started in November 2026: a 20-day spoken-Hindi course for travellers and international students. Each day is a set of everyday conversations (airport, railway, hotel, restaurant, shopping, health, emergencies), with every line voiced and shown in Hindi, Roman script and English. Because Hindi verbs change with the speaker's gender, a switch changes the learner's lines, what others say to them, and the voice. The learner can listen line by line at different speeds, speak and record themselves, and take short listening checks. A day can be saved to the phone and played offline. It is built with plain HTML, CSS and JavaScript modules with a service worker; Python tooling validates the lessons and builds the audio with Piper Hindi voices; Playwright tests run on laptop and phone sizes. A reviewer mode lets a teacher mark each line and export corrections. Status, from the repository: all 20 days are drafted, but the lessons are still under review by students and a Hindi teacher, and the voices are AI-generated demo voices, so the site is a preview.`,
    links: [
      { label: "Code", href: `${GITHUB}/bolchaal-hindi` },
      { label: "Preview", href: "https://bhanu-pratap-rana.github.io/bolchaal-hindi/" },
    ],
    anchor: "work-bolchaal-hindi",
    prompt: "What is Bolchaal Hindi, and how does it work?",
    aliases: ["bolchaal", "spoken", "course", "travellers", "language", "lessons", "audio", "voices", "newest", "latest", "recent"],
    basis: "repo",
  },
  {
    id: "sales-pitch-generator",
    kind: "project",
    title: "Sales Pitch Generator and other public repositories",
    summary:
      "Smaller public work: a PDF-to-sales-pitch app with FAISS retrieval, a prompt-improving browser extension, and an Azure OpenAI sentiment script.",
    tags: ["Streamlit", "LangChain", "Groq", "FAISS", "Embeddings", "RAG", "Azure OpenAI", "Chrome Extension"],
    body: `Beyond the featured work, Bhanu's public GitHub has smaller projects. Sales Pitch Generator is a Streamlit app that turns an uploaded PDF into a tailored sales pitch: it loads the document, builds HuggingFace embeddings in FAISS, retrieves the most relevant sections, and generates the pitch with Groq through LangChain, showing the passages it used. Prompt Perfect Generator is a browser extension with a LangChain backend that rewrites prompts and supports several model providers. There is also an Azure OpenAI sentiment-analysis script built with LangChain, related to his Bytical.ai internship work.`,
    links: [
      { label: "Sales Pitch Generator", href: `${GITHUB}/Sales-Pitch-generator` },
      { label: "Prompt Perfect Generator", href: `${GITHUB}/prompt-perfect-generator` },
      { label: "All repositories", href: GITHUB },
    ],
    anchor: "work-more",
    prompt: "What other public repositories does he have?",
    aliases: ["github", "repositories", "repos", "open-source", "opensource", "side", "extension", "sales", "sentiment"],
    basis: "repo",
  },
  {
    id: "khs-research-assistant",
    kind: "experience",
    title: "Kendriya Hindi Sansthan — Research Assistant (Technical), AI/ML Engineer",
    summary:
      "Current full-time role since March 2025 on an ICSSR-funded AI education project: built ATAL AI 2.0 and the Hindi Semantic Search engine, and led field research in Assam.",
    tags: ["Kendriya Hindi Sansthan", "KHS", "Research Assistant", "AI/ML Engineer", "ICSSR", "ATAL AI", "Semantic Search", "Field Research", "Power BI", "Education"],
    body: `Bhanu's current job: Research Assistant (Technical) and AI/ML Engineer at Kendriya Hindi Sansthan, Ministry of Education, in Agra. Full-time since March 2025, on the ICSSR-funded "AI Based Remedial Education Model" under ATAL AI — Vision Viksit Bharat @2047. There he architected and built ATAL AI 2.0, an offline-first learning PWA (Next.js 16, React 19, TypeScript, Supabase with pgvector). He built a multilingual Hindi Semantic Search engine over 1,633 books (MiniLM-L12-v2 embeddings in ChromaDB, LangChain LCEL RAG Q&A with Groq LLaMA, and a CrewAI multi-agent metadata pipeline). He led field research across 6 government schools in Assam covering 570+ students; his resume reports 50–65% student adoption in pilot comparisons against existing digital learning platforms. He built data pipelines and Power BI dashboards for stakeholder reporting, reviewed 22 research papers, and contributed to an edited book on AI-enabled education.`,
    links: [{ label: "ATAL AI 2.0 code", href: `${GITHUB}/ATAL-AI-2.0` }],
    anchor: "experience-khs",
    prompt: "What is his current job, and what has he built there?",
    aliases: ["current", "job", "employer", "now", "present", "government", "ministry", "institute", "fieldwork", "field", "research", "dashboards", "reporting", "full-time"],
    basis: "resume",
  },
  {
    id: "assam-field-research",
    kind: "research",
    title: "Field research and the ATAL AI pilot in Assam",
    summary:
      "Led field research across 6 government schools in Assam covering 570+ students, with 50–65% student adoption reported in pilot comparisons.",
    tags: ["Field Research", "Pilot", "Assam", "Schools", "Students", "Adoption", "Education", "ATAL AI", "ICSSR"],
    body: `As part of the ICSSR-funded "AI Based Remedial Education Model" at Kendriya Hindi Sansthan, Bhanu led field research across 6 government schools in Assam covering 570+ students, where ATAL AI 2.0 was piloted. His resume reports 50–65% student adoption in pilot comparisons against existing digital learning platforms. This figure is self-reported; what was measured and how is not documented on this site, so ask him for the study details. Around the pilot he built data pipelines and Power BI dashboards for stakeholder reporting, reviewed 22 research papers, and contributed to an edited book on AI-enabled education. He presented the ATAL AI web app at the ICALS conference in September 2025.`,
    anchor: "experience-khs",
    prompt: "What happened when ATAL AI 2.0 was piloted with 570+ students?",
    aliases: ["pilot", "piloted", "fieldwork", "field", "rural", "study", "survey", "outcomes", "results", "impact", "users", "happened", "evidence", "real"],
    basis: "resume",
  },
  {
    id: "bytical-ai",
    kind: "experience",
    title: "Bytical.ai — Machine Learning Intern",
    summary:
      "Internship, July to December 2024: OCR document pipeline over 3,482 files, the first Smart HR Tool, and an Azure OpenAI sentiment-analysis platform.",
    tags: ["Bytical.ai", "Bytical", "Internship", "OCR", "OpenCV", "PyTesseract", "Azure OpenAI", "Sentiment Analysis", "FastAPI", "Streamlit", "Computer Vision"],
    body: `At Bytical.ai (Gurugram, Haryana, remote; internship, July to December 2024) Bhanu was a Machine Learning Intern. He built an automated document-processing pipeline over 3,482 files with 95%+ OCR accuracy and sub-second query responses, using OpenCV denoising, binarisation and contour detection with PyTesseract. He built an AI Smart HR Tool on FastAPI and Streamlit that generates job letters, job descriptions and onboarding plans; his resume reports it cut HR workload 50%, improved content accuracy 30% and reduced time-to-hire 25%. He created an Azure OpenAI sentiment-analysis platform processing 100 comments per minute, which his resume reports reduced manual review time 70% and improved accuracy 25%. These figures are self-reported on his resume; the measurement method is not documented here.`,
    anchor: "experience-bytical",
    prompt: "What did he do during his internship at Bytical.ai?",
    aliases: ["intern", "internship", "first", "ocr", "scanned", "sentiment", "comments", "azure", "document", "documents"],
    basis: "resume",
  },
  {
    id: "skills-genai-rag",
    kind: "skill",
    title: "Skills — GenAI, LLMs, RAG and vector search",
    summary:
      "LLM APIs and frameworks, plus the retrieval stack: LangChain, ChromaDB, pgvector, Milvus, FAISS and MiniLM embeddings.",
    tags: ["GenAI", "LLM", "OpenAI", "GPT-4o", "Azure OpenAI", "Groq", "Ollama", "Hugging Face", "Prompt Engineering", "Pydantic", "RAG", "LangChain", "ChromaDB", "pgvector", "Milvus", "FAISS", "Semantic Search", "TF-IDF"],
    body: `Skills listed on his resume. GenAI & LLMs: ${SKILL("GenAI & LLMs")}. RAG & vector search: ${SKILL("RAG & vector search")}. Where they were used: ChromaDB in the Hindi Semantic Search System (with MiniLM-L12-v2 embeddings) and at Testneo; pgvector in ATAL AI 2.0; Milvus in the Custom Document AI Chatbot; FAISS in the Sales Pitch Generator; GPT-4o at Aura AI; Azure OpenAI at Bytical.ai; Ollama in the Smart HR Tool. PyTorch is not listed on his resume; his deep learning work uses TensorFlow/Keras and Hugging Face Transformers.`,
    anchor: "skills",
    prompt: "Which LLM and retrieval tools has he used, and in which projects?",
    aliases: ["skills", "stack", "tools", "technologies", "tech", "vector", "database", "databases", "llms", "models", "frameworks", "pytorch", "gpt"],
    // FAISS in the Sales Pitch Generator and Ollama in the Smart HR Tool are
    // known from those repositories, not from the resume.
    basis: "resume+repo",
  },
  {
    id: "skills-agents",
    kind: "skill",
    title: "Skills — AI agents",
    summary:
      "CrewAI multi-agent pipelines, tool integration and retry/backoff, used in the Hindi search metadata pipeline.",
    tags: ["AI Agents", "CrewAI", "Multi-agent", "Tool Integration", "Tenacity", "Agentic"],
    body: `AI agents skills listed on his resume: ${SKILL("AI agents")}. Where they were used: the Hindi Semantic Search System has a CrewAI multi-agent metadata pipeline with three agents, a description generator, a category classifier and a quality validator.`,
    anchor: "skills",
    prompt: "What has he built with AI agents?",
    aliases: ["agents", "agent", "orchestration", "crew", "multiagent", "workflow", "workflows"],
    basis: "resume",
  },
  {
    id: "skills-ml-vision-speech",
    kind: "skill",
    title: "Skills — ML, computer vision, speech and NLP",
    summary:
      "TensorFlow/Keras, Scikit-learn, OpenCV, MediaPipe and OCR, plus Deepgram speech-to-text, Indic text-to-speech, spaCy and BART.",
    tags: ["Machine Learning", "Computer Vision", "TensorFlow", "Keras", "Scikit-learn", "CNN", "OpenCV", "MediaPipe", "OCR", "PyTesseract", "Speech", "Deepgram", "TTS", "NLP", "spaCy", "BART"],
    body: `Skills listed on his resume. ML & computer vision: ${SKILL("ML & computer vision")}. Speech & NLP: ${SKILL("Speech & NLP")}. Where they were used: OpenCV and MediaPipe for facial analysis at Aura AI; OpenCV and PyTesseract for the OCR pipeline at Bytical.ai; VGG19 and ResNet50 transfer learning in Eye Disease Classification; Deepgram in the Voice AI Assistant; indic-parler-tts in ATAL AI 2.0; spaCy and BART in the Custom Document AI Chatbot.`,
    anchor: "skills",
    prompt: "Show me his computer vision and speech work.",
    aliases: ["vision", "cv", "image", "images", "deep", "learning", "ml", "neural", "network", "networks", "speech", "voice", "nlp", "ocr", "skills"],
    basis: "resume",
  },
  {
    id: "skills-backend-cloud",
    kind: "skill",
    title: "Skills — backend, data, cloud, frontend and analytics",
    summary:
      "Python and FastAPI backends with Celery, Redis and PostgreSQL; Docker and AWS; TypeScript, React, Next.js and React Native; Pandas and Power BI.",
    tags: ["Python", "FastAPI", "SQLModel", "Celery", "Redis", "REST", "WebSockets", "PostgreSQL", "Supabase", "MySQL", "SQL", "Docker", "AWS", "Vercel", "pytest", "TypeScript", "JavaScript", "React", "Next.js", "React Native", "Tailwind CSS", "Pandas", "Power BI"],
    body: `Skills listed on his resume. Backend & data: ${SKILL("Backend & data")}. Cloud & DevOps: ${SKILL("Cloud & DevOps")}. Frontend: ${SKILL("Frontend")}. Analytics: ${SKILL("Analytics")}. Where they were used: FastAPI, PostgreSQL, Redis, Celery and Docker in the Aura AI backend; FastAPI in the Voice AI Assistant and Smart HR Tool; Supabase and Next.js in ATAL AI 2.0; React Native at Aura AI; Power BI dashboards at Kendriya Hindi Sansthan. AWS (ECS/Fargate) is listed on his resume, but no project described here documents where it was used.`,
    anchor: "skills",
    prompt: "What is his backend and deployment experience?",
    aliases: ["backend", "server", "api", "apis", "database", "databases", "cloud", "deployment", "deploy", "devops", "frontend", "full-stack", "fullstack", "web", "mobile", "analytics", "dashboards", "skills", "aws"],
    basis: "resume",
  },
  {
    id: "publications",
    kind: "research",
    title: "Publications",
    summary:
      "A book chapter on Hindi library automation with semantic search (ILA, 2026) and a journal article on AI and human creativity (Shodh Bhumi, 2025).",
    tags: ["Publications", "Research", "Book Chapter", "Journal Article", "ILA", "Shodh Bhumi", "Semantic Search"],
    body: `Bhanu has 2 publications. (1) Rana, B. P., & Mandusia, A. K. (2026). "Transforming Hindi Library Automation: Semantic Search and AI-Enhanced Metadata." Book chapter, 71st Annual ILA International Conference Proceedings, Indian Library Association, New Delhi & Kendriya Hindi Sansthan, Agra, p. 302. He is first author. (2) Kumari, S., Rana, B. P., & Tripathi, M. (2025). "Artificial Intelligence and Human Creativity: A Collaborative or Inhibitory Relationship." Shodh Bhumi, ISSN 3048-6203, Vol. 2, Issue 2, pp. 672–690. He is second author. His resume does not state whether these venues are peer-reviewed.`,
    anchor: "publications",
    prompt: "What has he published?",
    aliases: ["papers", "paper", "published", "publication", "journal", "chapter", "author", "writing", "academic", "research", "peer-reviewed"],
    basis: "publication",
  },
  {
    id: "conference-presentations",
    kind: "research",
    title: "Conference presentations and the Best Paper Award",
    summary:
      "Two conference presentations in 2025, including a Best Paper Award (Technical Session 8) at a national AI and law conference.",
    tags: ["Conference", "Presentation", "Best Paper Award", "AI and Law", "Neuromorphic Computing", "Sustainability", "ICALS"],
    body: `Bhanu has 2 conference presentations. (1) Kumari, S., Kumar, A., & Rana, B. P. "Emerging AI Applications for Legal Self-Help in India." National Conference on the Intersection of AI and Law, Amity Law School, Chhattisgarh, August 2025. It received the Best Paper Award, Technical Session 8; he is a co-author (third author). (2) Rana, B. P. "AI, Technology & Sustainability: A Comparative Study of Neuromorphic Computing and the ATAL AI Web App." 1st International Conference on AI, Law and Sustainability (ICALS), Manipal University Jaipur, with UENP (Brazil) and Nicolaus Copernicus University (Poland), September 2025. He is the sole author.`,
    anchor: "publications",
    prompt: "Tell me about his conference presentations and the Best Paper Award.",
    aliases: ["award", "awards", "talks", "talk", "presented", "conferences", "prize", "recognition", "research"],
    basis: "publication",
  },
  {
    id: "education",
    kind: "education",
    title: "Education",
    summary:
      "M.Tech in Computational Science from Dayalbagh Educational Institute, Agra (CGPA 8.1), after a PG Diploma, an ITI certificate and a B.Sc.",
    tags: ["Education", "M.Tech", "Computational Science", "Dayalbagh Educational Institute", "DEI", "PG Diploma", "Big Data", "ITI", "B.Sc"],
    body: `Bhanu's education, where he studied and his degrees: M.Tech in Computational Science, Dayalbagh Educational Institute, Agra (September 2022 to June 2024), CGPA 8.1. PG Diploma in Big Data & Logistics, Dayalbagh Educational Institute, Agra (September 2021 to August 2022), CGPA 6.8. ITI in Computer Operator & Programming Assistant (COPA), Govt. ITI, Bijnor (August 2020 to August 2021), CGPA 8.8. B.Sc in Physics, Chemistry and Mathematics, MJP Rohilkhand University, Bareilly (August 2017 to October 2020), CGPA 6.0.`,
    anchor: "background",
    prompt: "Where did he study, and what are his degrees?",
    aliases: ["study", "studied", "degree", "degrees", "university", "college", "qualification", "qualifications", "masters", "master", "graduate", "cgpa", "grades", "academic"],
    basis: "resume",
  },
  {
    id: "certifications",
    kind: "education",
    title: "Certifications",
    summary:
      "Oracle OCI 2025 AI Foundations Associate, Generative AI Mastermind, Full Stack Web Development, and AWS Cloud Practitioner Essentials.",
    tags: ["Certifications", "Oracle", "OCI", "AWS", "Outskill", "Apna College"],
    body: `Certifications listed on his resume: OCI 2025 Certified AI Foundations Associate, Oracle (2025). Generative AI Mastermind, Outskill (2025). Full Stack Web Development (Delta), Apna College (2025). AWS Cloud Practitioner Essentials, AWS (2024).`,
    anchor: "background",
    prompt: "Which certifications does he hold?",
    aliases: ["certificates", "certificate", "certified", "certification", "courses", "course", "training"],
    basis: "resume",
  },
  {
    id: "achievements",
    kind: "education",
    title: "Achievements",
    summary:
      "Best Paper Award (2025), Best Project Showcase, Best Performer Student and Student of the Year.",
    tags: ["Achievements", "Awards", "Best Paper Award", "Honours"],
    body: `Achievements listed on his resume: Best Paper Award, Amity Law School (2025), for a co-authored paper at the National Conference on the Intersection of AI and Law. Best Project Showcase, Govt. ITI, Bijnor. Best Performer Student, MIET Kumaun. Student of the Year, LIC.`,
    anchor: "background",
    prompt: "What awards has he received?",
    aliases: ["honours", "honors", "recognition", "prizes", "award", "winner", "achievement"],
    basis: "resume",
  },
  {
    id: "volunteer",
    kind: "experience",
    title: "Volunteering — Sahitya Unnayan Sansthan",
    summary:
      "Programmer & Media Manager (volunteer) for a Hindi literary and social-development NGO in Chandausi since April 2026.",
    tags: ["Volunteer", "NGO", "Sahitya Unnayan Sansthan", "Hindi", "Media", "Community"],
    body: `Since April 2026 Bhanu volunteers as Programmer & Media Manager at Sahitya Unnayan Sansthan, Chandausi, a Hindi literary and social-development NGO. He leads its technology and digital media: digital platforms, outreach and AI-tool adoption.`,
    anchor: "background",
    prompt: "Does he volunteer anywhere?",
    aliases: ["volunteering", "volunteers", "community", "literary", "literature", "social", "nonprofit", "non-profit", "outside", "extracurricular"],
    basis: "resume",
  },
  {
    id: "contact",
    kind: "profile",
    title: "Contact and availability",
    summary:
      "Email ranabhanu514@gmail.com, or reach him on LinkedIn or GitHub. The resume PDF is on this site.",
    tags: ["Contact", "Email", "LinkedIn", "GitHub", "Resume", "Availability"],
    body: `To contact Bhanu: email ranabhanu514@gmail.com, or message him on LinkedIn (linkedin.com/in/bhanu-pratap-rana). His code is on GitHub (github.com/bhanu-pratap-rana). His resume can be downloaded as a PDF from this site. He is based in Agra, Uttar Pradesh, India. His phone number is on the resume PDF and is not given by this assistant. Notice period, salary expectations, relocation and remote-work preferences are not stated on his resume: ask him by email.`,
    links: [
      { label: "Email", href: `mailto:${profile.email}` },
      { label: "LinkedIn", href: profile.linkedin },
      { label: "GitHub", href: profile.github },
      { label: "Resume (PDF)", href: profile.resumePath },
    ],
    anchor: "contact",
    prompt: "How do I contact him and get his resume?",
    // The page writes "resume" plain; visitors may still type the accented
    // word, which the tokenizer keeps as-is, so it is a synonym here (escaped:
    // resume-spelling.test.ts keeps the accented spelling out of the source).
    aliases: ["reach", "email", "mail", "phone", "call", "message", "resume", "r\u00e9sum\u00e9", "cv", "hire", "hiring", "interview", "available", "availability", "notice", "relocation", "relocate", "remote", "linkedin"],
    basis: "resume",
  },
  {
    id: "this-copilot",
    kind: "project",
    title: "How this copilot works",
    summary:
      "This site's assistant: a keyword-and-tag retriever over about two dozen hand-written notes, a Groq-hosted model, and cited answers. No vector database.",
    tags: ["This site", "Copilot", "RAG", "Retrieval", "Citations", "Next.js", "Groq", "Evaluation"],
    body: `This portfolio's copilot is a small retrieval-augmented system that Bhanu built with Next.js 16 and TypeScript. The knowledge base is about two dozen hand-written notes drawn from his resume and public repositories. Retrieval is lexical: each question is tokenised, expanded with a small synonym and Hindi-to-English word list, and scored against each note's title, tags and text. It is keyword and tag matching, not embeddings and not a vector database. The whole knowledge base would fit in the model's prompt, so retrieval is not needed for capacity. It is kept because a short numbered list of notes makes every citation checkable, keeps each request inside a small token budget, and is the layer that would be swapped for embeddings if the corpus grew. The project where he did use embeddings and a vector database is the Hindi Semantic Search System (MiniLM and ChromaDB). The top notes are sent with the question to a Groq-hosted open model, which answers with numbered citations. The same scoring function runs in the browser, which is how the index lights up while you type. If the model is unavailable, the site answers from the matching notes directly and says so. Retrieval is checked by golden questions in English, Hindi and Roman-script Hindi: the test suite runs them in CI, and the page recomputes and prints the result on every build.`,
    links: [{ label: "Source code", href: `${GITHUB}/Bhanu` }],
    anchor: "how",
    prompt: "How does this copilot retrieve and cite, and why no vector database?",
    aliases: ["copilot", "assistant", "chatbot", "bot", "site", "website", "portfolio", "implementation", "retrieve", "cite", "citations", "lexical", "keyword", "vector", "database", "architecture"],
    basis: "site",
  },
];

/**
 * The notes the copilot reads. A project's working deployment (liveUrl) is
 * put first in its note's links, so the copilot can cite and link the live app.
 */
export const knowledgeBase: KnowledgeItem[] = withLiveLinks(notes, projects);

/**
 * A note's name for chips, captions and lists. The four skill notes share the
 * "Skills" prefix, so they keep their first group to stay distinguishable.
 */
export function shortTitle(item: KnowledgeItem): string {
  const [head, tail] = item.title.split(" — ");
  return head === "Skills" && tail ? `Skills: ${tail.split(",")[0]}` : head;
}

export function getKnowledgeItem(id: string): KnowledgeItem | undefined {
  return knowledgeBase.find((item) => item.id === id);
}

export function getProjectDetail(project: Project): KnowledgeItem | undefined {
  return getKnowledgeItem(project.kbId);
}

/* ------------------------------------------------------------------ */
/* Starter questions                                                    */
/* ------------------------------------------------------------------ */

export type Starter = { question: string; lang?: "hi" };

// Recruiter questions first (who he is, then what real people used), then
// the Hindi and engineering ones; the question about this copilot itself last.
export const starterQuestions: Starter[] = [
  { question: "Summarise Bhanu in 30 seconds: role, experience and location." },
  { question: "What happened when ATAL AI 2.0 was piloted with 570+ students?" },
  { question: "भानु ने हिंदी के लिए कौन-कौन से AI प्रोजेक्ट बनाए हैं?", lang: "hi" },
  { question: "How does the Hindi Semantic Search pipeline work, end to end?" },
  { question: "How does this copilot retrieve and cite, and why no vector database?" },
];

/**
 * Where the copilot panel puts "Paste a job description" among the starter
 * questions: second, right after the summary, because it is the one that
 * saves a recruiter the most time. The hero's demo only plays the questions.
 */
export const JOB_DESCRIPTION_STARTER_INDEX = 1;

export type PanelStarter = ({ kind: "question" } & Starter) | { kind: "job-description" };

/** The copilot panel's starters in order: the questions with the job-description entry slotted in. */
export function panelStarters(): PanelStarter[] {
  const questions: PanelStarter[] = starterQuestions.map((starter) => ({
    kind: "question",
    ...starter,
  }));
  const at = Math.min(Math.max(0, JOB_DESCRIPTION_STARTER_INDEX), questions.length);
  return [...questions.slice(0, at), { kind: "job-description" }, ...questions.slice(at)];
}

/** Prefilled into the composer; the visitor pastes the description after it. */
export const jobDescriptionPrompt =
  "Compare Bhanu against this job description. List what is evidenced, what is adjacent, and what is not on his resume:\n\n";
