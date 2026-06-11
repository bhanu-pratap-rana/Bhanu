export type KnowledgeKind =
  | "profile"
  | "experience"
  | "project"
  | "skill"
  | "education"
  | "research";

export type KnowledgeItem = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  tags: string[];
  body: string;
  links?: { label: string; href: string }[];
};

// Minimal shape sent to the client (kept small enough to travel in a header).
export type SourceRef = Pick<KnowledgeItem, "id" | "title" | "summary">;

export const profileSnapshot = {
  name: "Bhanu Pratap Rana",
  title:
    "Applied AI Engineer specializing in GenAI, Computer Vision, RAG, FastAPI, and AI automation",
  location: "Agra, Uttar Pradesh, India",
  email: "ranabhanu514@gmail.com",
  altEmail: "bhanuprataprana2202062@dei.ac.in",
  phone: "8979016694",
  linkedin: "https://www.linkedin.com/in/bhanu-pratap-rana/",
  github: "https://github.com/bhanu-pratap-rana",
  leetcode: "https://leetcode.com/u/aaEVn94SMA/",
  resumePath: "/bhanu-pratap-rana-resume.pdf",
};

export const knowledgeBase: KnowledgeItem[] = [
  {
    id: "profile-summary",
    kind: "profile",
    title: "Profile Summary",
    summary:
      "Applied AI Engineer building production-grade GenAI, RAG, computer vision, automation, and full-stack AI products.",
    tags: [
      "GenAI",
      "RAG",
      "Computer Vision",
      "FastAPI",
      "AI Automation",
      "Full-stack AI",
    ],
    body: `Bhanu Pratap Rana is an Applied AI Engineer focused on Generative AI, Computer Vision, RAG systems, AI automation, and scalable AI platform development. He builds with Python, FastAPI, OpenCV, PyTorch, PostgreSQL, Redis, Docker, Supabase, and modern AI infrastructure. His work spans automation platforms, OCR and document intelligence, semantic search engines, multilingual AI applications, and real-time AI products. Much of his work is open-source on GitHub (github.com/bhanu-pratap-rana), spanning RAG, voice AI, document intelligence, automation, and classical ML. He is open to remote AI engineering roles, startup collaborations, AI product development, and GenAI projects.`,
    links: [
      { label: "GitHub", href: profileSnapshot.github },
      { label: "LinkedIn", href: profileSnapshot.linkedin },
      { label: "Resume", href: profileSnapshot.resumePath },
    ],
  },
  {
    id: "khs-research-assistant",
    kind: "experience",
    title: "Kendriya Hindi Sansthan - Research Assistant",
    summary:
      "AI-driven education, digital empowerment, ATAL AI, semantic search, assessments, field studies, and research reporting.",
    tags: [
      "KHS",
      "ATAL AI",
      "RAG",
      "Semantic Search",
      "Education",
      "PWA",
      "Power BI",
    ],
    body: `At Kendriya Hindi Sansthan in Agra, Bhanu contributes to AI-driven educational technology, digital empowerment initiatives, and research projects focused on rural learning outcomes. He designed and developed the ATAL AI Progressive Web Application for digital literacy, adaptive learning, and AI-enabled education. He built a multilingual semantic search library using Retrieval-Augmented Generation, vector embeddings, and LLMs. He also developed AI-powered assessment and evaluation frameworks, data pipelines, dashboards, and reporting workflows. His field research covered 6 government schools and 570+ students across Sualkuchi, Bongshar, Bamundi, Dadra, Amingaon, and Hajo in Assam. Reported pilot adoption was approximately 50-65%. Technologies include Python, FastAPI, PostgreSQL, Supabase, OpenAI, RAG, semantic search, Power BI, analytics, PWA, vector databases, and Generative AI.`,
  },
  {
    id: "aura-ai",
    kind: "project",
    title: "Aura AI",
    summary:
      "Production-grade AI beauty platform for makeup recommendations, facial analysis, and virtual try-on (private, in active development).",
    tags: [
      "FastAPI",
      "Redis",
      "Celery",
      "PostgreSQL",
      "React Native",
      "OpenCV",
      "MediaPipe",
      "GPT-4o",
      "Computer Vision",
    ],
    body: `Aura AI is an AI-powered beauty technology platform for personalized makeup recommendations, facial analysis, and real-time virtual try-on. Bhanu leads the AI architecture using FastAPI, PostgreSQL, Redis, Celery, Docker, and React Native. He developed computer vision pipelines with MediaPipe and OpenCV for facial analysis, skin tone detection, and recommendations. The platform integrates a GPT-4o-powered AI beauty assistant for personalized consultations, asynchronous AI processing pipelines, containerized deployment workflows, and multilingual mobile experiences. The repository is private and the product is in active development.`,
  },
  {
    id: "atal-ai",
    kind: "project",
    title: "ATAL AI 2.0",
    summary:
      "Offline-first digital-literacy and adaptive-learning PWA built on Next.js 16, React 19, and Supabase with multilingual content and a voice AI tutor.",
    tags: [
      "Next.js",
      "React",
      "TypeScript",
      "Supabase",
      "pgvector",
      "PWA",
      "Offline-first",
      "TTS",
      "Education",
    ],
    body: `ATAL AI 2.0 is a digital-literacy and adaptive-learning Progressive Web App built with Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Framer Motion, backed by Supabase (PostgreSQL, Auth, Realtime, pgvector). It is offline-first using IndexedDB (Dexie), service workers, and a background sync queue. Features include an interactive multilingual curriculum (Hindi, Assamese) with markdown lessons, pre/post assessments with i18n, a teacher class-management dashboard with invite/QR codes and CSV analytics export, OTP email auth with role-based access control, gamification (points, badges, leaderboards), and a voice AI tutor using HuggingFace multilingual TTS (ai4bharat/indic-parler-tts). End-to-end tested with Playwright.`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/ATAL-AI-2.0",
      },
    ],
  },
  {
    id: "voice-ai-assistant",
    kind: "project",
    title: "Voice AI Assistant",
    summary:
      "Real-time voice assistant: Deepgram streaming STT + Groq LLaMA 3.3 70B that suggests follow-ups or answers from uploaded documents (RAG).",
    tags: [
      "Deepgram",
      "Groq",
      "LLaMA 3.3 70B",
      "FastAPI",
      "React",
      "Vite",
      "RAG",
      "Realtime",
      "Voice AI",
    ],
    body: `The Voice AI Assistant streams microphone audio to Deepgram nova-2 over WebSockets for live speech-to-text, then uses Groq LLaMA 3.3 70B Versatile to either suggest follow-up questions (5 per transcript) or answer questions grounded in uploaded PDF/DOCX/TXT documents via retrieval-augmented generation. The frontend is React 18 + Vite 6 + Tailwind v4; the backend is FastAPI + Python with PyPDF2 and python-docx for document parsing, and the browser SpeechSynthesis API for read-aloud. It offers two modes: Suggest Questions and Answer Questions. A frontend UI demo is hosted on GitHub Pages (full functionality needs the backend running locally).`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/voice-assistant",
      },
      {
        label: "Live demo",
        href: "https://bhanu-pratap-rana.github.io/voice-assistant/",
      },
    ],
  },
  {
    id: "hindi-semantic-search",
    kind: "project",
    title: "Hindi Books Semantic Search System",
    summary:
      "Agentic cross-lingual semantic search over 1,633 Hindi books using MiniLM embeddings, ChromaDB, LangChain RAG, and a CrewAI metadata pipeline.",
    tags: [
      "Embeddings",
      "ChromaDB",
      "LangChain",
      "CrewAI",
      "Groq",
      "Streamlit",
      "RAG",
      "Hindi",
      "Vector Search",
    ],
    body: `An agentic semantic search engine over 1,633 Hindi books that enables cross-lingual (Hindi and English) natural-language book discovery. It embeds content with paraphrase-multilingual-MiniLM-L12-v2 (384-dim) stored in ChromaDB (HNSW, cosine), alongside a TF-IDF keyword baseline for side-by-side comparison. RAG-based Q&A is built with LangChain (LCEL) and Groq llama-3.1-8b-instant. A CrewAI multi-agent pipeline enriches metadata with a description generator, a category classifier, and a quality validator. The UI is built in Streamlit; data is sourced from the Google Books and Open Library APIs, with relevance scoring and CSV export.`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/Hindi-Books-Semantic-Search-System",
      },
    ],
  },
  {
    id: "smart-hr-tool",
    kind: "project",
    title: "Smart HR Tool",
    summary:
      "AI HR document generator with dual models — local Ollama (deepseek-r1) and cloud Groq (LLaMA 3.3 70B) — on FastAPI + Streamlit with PDF/DOCX export.",
    tags: [
      "FastAPI",
      "SQLModel",
      "Ollama",
      "Groq",
      "Streamlit",
      "AI Automation",
      "HR Tech",
    ],
    body: `Smart HR Tool is an AI-powered HR document generator with dual-model support: "HRCraft Mini" runs locally on Ollama (deepseek-r1:8b) and "HRCraft Pro" runs on Groq (llama-3.3-70b-versatile). The backend is FastAPI with SQLModel, Pydantic, and Alembic migrations; the frontend is Streamlit; documents export to PDF and DOCX via python-docx and xhtml2pdf. It generates job descriptions, offer letters, interview questions, onboarding plans, and performance reviews, and includes a document manager to view, export, and delete generated documents over a documented REST API. MIT licensed.`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/Smart-HR-Tool",
      },
    ],
  },
  {
    id: "custom-document-ai-chatbot",
    kind: "project",
    title: "Custom Document AI Chatbot (OCR)",
    summary:
      "Document-intelligence system combining Tesseract OCR, spaCy NER, and BART summarization with Milvus vector search and a chatbot interface.",
    tags: [
      "OCR",
      "Tesseract",
      "spaCy",
      "BART",
      "Milvus",
      "MySQL",
      "NLP",
      "Document Intelligence",
    ],
    body: `A document-intelligence system that combines Tesseract OCR for text extraction, spaCy named-entity recognition (en_core_web_sm), and BART summarization, with Milvus vector search and a MySQL store, served through an interactive chatbot interface. It extracts text from document images, runs entity recognition and summarization, and supports semantic retrieval over the processed corpus. Milvus runs via docker-compose, and the project includes a synthetic ticket dataset generator for testing.`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/Custom-Document-AI-chatbot",
      },
    ],
  },
  {
    id: "sales-pitch-generator",
    kind: "project",
    title: "Sales Pitch Generator",
    summary:
      "Streamlit app that turns an uploaded PDF into a tailored sales pitch using LangChain, Groq, HuggingFace embeddings, and FAISS retrieval.",
    tags: [
      "Streamlit",
      "LangChain",
      "Groq",
      "FAISS",
      "Embeddings",
      "RAG",
      "GenAI",
    ],
    body: `Sales Pitch Generator is a Streamlit application that turns an uploaded PDF into a tailored sales pitch. It ingests the document with PyPDFLoader, builds vector embeddings with HuggingFace embeddings stored in FAISS, retrieves the most relevant sections, and generates a focused pitch using Groq through LangChain. Users can enter key points to steer the output, and the app displays the source sections used to generate the pitch. MIT licensed.`,
    links: [
      {
        label: "GitHub",
        href: "https://github.com/bhanu-pratap-rana/Sales-Pitch-generator",
      },
    ],
  },
  {
    id: "testneo-api-generator",
    kind: "project",
    title: "AI-Powered API Test Case Generator",
    summary:
      "Groq + ChromaDB + LangChain system that generates functional, security, and edge-case API tests from docs (built at testneo).",
    tags: [
      "Groq",
      "ChromaDB",
      "LangChain",
      "FastAPI",
      "Streamlit",
      "RAG",
      "OpenAPI",
      "Vector Search",
    ],
    body: `At testneo, Bhanu built an AI-powered API Test Case Generator capable of producing functional, security, and edge-case test scenarios from API documentation and business requirements. The system ingested PDF, DOCX, OpenAPI JSON/YAML, and TXT files; used ChromaDB and semantic search for RAG; integrated Groq LLMs for test generation and validation workflows; and exported JSON, CSV, Markdown, and Python pytest formats.`,
  },
  {
    id: "additional-open-source",
    kind: "project",
    title: "Additional Open-Source Work",
    summary:
      "Public GitHub work spanning automation, classical ML, and computer vision beyond the featured AI products.",
    tags: [
      "Azure OpenAI",
      "LangChain",
      "Automation",
      "Machine Learning",
      "Computer Vision",
      "Trading",
    ],
    body: `Beyond his featured AI products, Bhanu's public GitHub includes Azure OpenAI sentiment analysis with LangChain, Google Sheets automation with the Groq API, a trading-strategy backtester, eye-image classification with VGG19 and ResNet50, a prompt-perfect generator, and an interactive code editor. Together these show breadth across GenAI, AI automation, classical machine learning, and computer vision.`,
    links: [{ label: "GitHub", href: profileSnapshot.github }],
  },
  {
    id: "bytical-ai",
    kind: "experience",
    title: "Bytical.ai - Machine Learning Intern",
    summary:
      "Computer vision, OCR, NLP, model training, deployment, and intelligent workflow automation.",
    tags: ["OpenCV", "TensorFlow", "PyTorch", "OCR", "NLP", "Computer Vision"],
    body: `At Bytical.ai, Bhanu contributed to AI, computer vision, and intelligent document processing solutions. He developed workflows using Python, OpenCV, TensorFlow, and PyTorch; built OCR-based document processing systems for information extraction and digitization; developed NLP pipelines for text analysis, semantic processing, and intelligent search; and assisted in model training, evaluation, deployment, and optimization for production-oriented AI products.`,
  },
  {
    id: "illinois-data-analyst",
    kind: "experience",
    title: "Illinois Institute of Technology - Data Analyst",
    summary:
      "Data cleaning, dashboarding, reporting improvements, and process optimization across 50,000+ records.",
    tags: ["Data Analytics", "Dashboards", "Data Cleaning", "Reporting"],
    body: `At Illinois Institute of Technology, Bhanu enhanced data integrity for over 50,000 records, increasing accuracy by 15% through cleaning techniques. He developed interactive dashboards that reduced reporting time by 30% and proposed process improvements that increased data processing efficiency by 20%.`,
  },
  {
    id: "research-education",
    kind: "research",
    title: "AI Education Research and Field Studies",
    summary:
      "Reviewed 22 research papers and supported an edited academic book on AI-enabled education and digital empowerment.",
    tags: ["Research", "AI Education", "Field Study", "Policy", "Digital Empowerment"],
    body: `Bhanu contributed to the review and evaluation of 22 research papers and participated in the development of an edited academic book related to AI-enabled education and digital empowerment. He analyzed educational datasets and prepared reports supporting policy recommendations, AI adoption strategies, and digital learning interventions.`,
  },
  {
    id: "education",
    kind: "education",
    title: "Education",
    summary:
      "M.Tech in Computational Science, postgraduate data processing education, B.Sc. PCM, and ITI COPA.",
    tags: ["Computational Science", "Data Processing", "Computer Science"],
    body: `Bhanu holds a Master of Technology in Computational Science from Dayalbagh Educational Institute, completed between September 2022 and June 2024. He also completed a postgraduate degree in Data Processing and Data Processing Technology from Dayalbagh Educational Institute, a Bachelor of Science in PCM from MJPRU Bareilly, and ITI COPA in Computer Science from Government Industrial Training Institute, Bijnor.`,
  },
];

export const featuredQuestions = [
  "Why should we hire Bhanu?",
  "Show me his strongest RAG projects.",
  "How did he build the Voice AI Assistant?",
  "What production AI systems has he worked on?",
  "Generate interview questions from his profile.",
  "Explain the ATAL AI architecture.",
];

export const impactMetrics = [
  {
    value: "570+",
    label: "students studied",
    detail: "Assam field research across digital learning adoption.",
  },
  {
    value: "6",
    label: "schools covered",
    detail: "Sualkuchi, Bongshar, Bamundi, Dadra, Amingaon, and Hajo.",
  },
  {
    value: "22",
    label: "papers reviewed",
    detail: "AI-enabled education and digital empowerment research.",
  },
  {
    value: "50-65%",
    label: "pilot adoption",
    detail: "Observed during comparative digital learning pilots.",
  },
];

export type PortfolioProject = {
  name: string;
  role: string;
  category: string;
  summary: string;
  stack: string[];
  repoUrl?: string;
  demoUrl?: string;
  isPrivate?: boolean;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    name: "Aura AI",
    role: "Founding AI Engineer",
    category: "Computer Vision + GenAI",
    summary:
      "AI beauty platform with facial analysis, skin tone detection, recommendations, and virtual try-on.",
    stack: ["FastAPI", "OpenCV", "MediaPipe", "Redis", "Celery", "React Native"],
    isPrivate: true,
  },
  {
    name: "ATAL AI 2.0",
    role: "AI/ML Engineer",
    category: "Education AI",
    summary:
      "Offline-first digital-literacy PWA with multilingual lessons, assessments, analytics, and a voice AI tutor.",
    stack: ["Next.js 16", "React 19", "Supabase", "pgvector", "PWA", "TTS"],
    repoUrl: "https://github.com/bhanu-pratap-rana/ATAL-AI-2.0",
  },
  {
    name: "Voice AI Assistant",
    role: "AI Engineer",
    category: "Realtime Voice AI",
    summary:
      "Real-time Deepgram streaming STT with Groq LLaMA 3.3 70B that answers from uploaded documents via RAG.",
    stack: ["Deepgram", "Groq", "FastAPI", "React", "Vite", "RAG"],
    repoUrl: "https://github.com/bhanu-pratap-rana/voice-assistant",
    demoUrl: "https://bhanu-pratap-rana.github.io/voice-assistant/",
  },
  {
    name: "Hindi Semantic Search",
    role: "RAG Engineer",
    category: "Multilingual Retrieval",
    summary:
      "Agentic cross-lingual search over 1,633 Hindi books with MiniLM embeddings, ChromaDB, LangChain, and CrewAI.",
    stack: ["ChromaDB", "LangChain", "CrewAI", "Groq", "Streamlit", "Embeddings"],
    repoUrl:
      "https://github.com/bhanu-pratap-rana/Hindi-Books-Semantic-Search-System",
  },
  {
    name: "Smart HR Tool",
    role: "AI Engineer",
    category: "Developer / HR Automation",
    summary:
      "Dual-model HR document generator — local Ollama and cloud Groq — on FastAPI + Streamlit with PDF/DOCX export.",
    stack: ["FastAPI", "SQLModel", "Ollama", "Groq", "Streamlit"],
    repoUrl: "https://github.com/bhanu-pratap-rana/Smart-HR-Tool",
  },
  {
    name: "Custom Document AI Chatbot",
    role: "ML Engineer",
    category: "Document Intelligence + OCR",
    summary:
      "OCR + NER + summarization pipeline with Milvus vector search and a chatbot interface over a document corpus.",
    stack: ["Tesseract", "spaCy", "BART", "Milvus", "MySQL"],
    repoUrl: "https://github.com/bhanu-pratap-rana/Custom-Document-AI-chatbot",
  },
  {
    name: "Sales Pitch Generator",
    role: "GenAI",
    category: "GenAI Automation",
    summary:
      "Turns an uploaded PDF into a tailored sales pitch with LangChain, Groq, HuggingFace embeddings, and FAISS.",
    stack: ["Streamlit", "LangChain", "Groq", "FAISS", "Embeddings"],
    repoUrl: "https://github.com/bhanu-pratap-rana/Sales-Pitch-generator",
  },
];

export const experienceTimeline = [
  {
    org: "Kendriya Hindi Sansthan",
    role: "Research Assistant / AI ML Engineer",
    period: "March 2025 - Present",
    proof: "ATAL AI, multilingual semantic search, field studies, analytics, and AI education research.",
  },
  {
    org: "Aura AI",
    role: "Founding AI Engineer",
    period: "December 2025 - Present",
    proof: "FastAPI, Redis, Celery, PostgreSQL, React Native, OpenCV, MediaPipe, and GPT-4o workflows.",
  },
  {
    org: "Bytical.ai",
    role: "Machine Learning Intern",
    period: "July 2024 - December 2025",
    proof: "Computer vision, OCR, NLP, intelligent document processing, and model deployment support.",
  },
  {
    org: "testneo",
    role: "AI Engineer",
    period: "November 2024 - February 2025",
    proof: "Groq and ChromaDB powered API test generation from PDF, DOCX, OpenAPI, YAML, JSON, and TXT inputs.",
  },
];

export const techStack = [
  "Python",
  "FastAPI",
  "PostgreSQL",
  "Supabase",
  "Redis",
  "Celery",
  "Docker",
  "OpenCV",
  "MediaPipe",
  "PyTorch",
  "TensorFlow",
  "Groq",
  "OpenAI",
  "LangChain",
  "ChromaDB",
  "React Native",
  "TypeScript",
  "Next.js",
];
