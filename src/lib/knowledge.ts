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
    body: `Smart HR Tool is an AI-powered HR document generator with dual-model support: "HRCraft Mini" runs locally on Ollama (deepseek-r1:8b) and "HRCraft Pro" runs on Groq (llama-3.3-70b-versatile). The backend is FastAPI with SQLModel, Pydantic, and Alembic migrations; the frontend is Streamlit; documents export to PDF and DOCX via python-docx and xhtml2pdf. It generates job descriptions, offer letters, interview questions, onboarding plans, and performance reviews, and includes a document manager to view, export, and delete generated documents over a documented REST API.`,
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
    body: `Sales Pitch Generator is a Streamlit application that turns an uploaded PDF into a tailored sales pitch. It ingests the document with PyPDFLoader, builds vector embeddings with HuggingFace embeddings stored in FAISS, retrieves the most relevant sections, and generates a focused pitch using Groq through LangChain. Users can enter key points to steer the output, and the app displays the source sections used to generate the pitch.`,
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
      "OCR document pipeline (3,482 files, 95%+ accuracy), Smart HR Tool, Azure sentiment analysis, and NLP — with measurable impact.",
    tags: [
      "OpenCV",
      "PyTesseract",
      "OCR",
      "Azure OpenAI",
      "Streamlit",
      "NLP",
      "Computer Vision",
    ],
    body: `At Bytical.ai (Gurugram, July 2024 - December 2025), Bhanu built production-oriented AI, computer vision, and document-intelligence systems. He developed an automated document processing pipeline handling 3,482 files with 95%+ OCR accuracy and sub-second query responses using OpenCV (noise reduction, binarization, contour detection) and PyTesseract. He built an AI-powered Smart HR Tool (FastAPI + Streamlit) with job-letter, job-description, and onboarding-plan generators that reduced HR workload by 50%, improved content accuracy by 30%, and cut time-to-hire by 25%. He also created an Azure OpenAI sentiment-analysis platform processing 100 comments per minute that reduced manual review time by 70% and increased accuracy by 25%, and built NLP pipelines for text analysis, semantic processing, and intelligent search while supporting model training, evaluation, deployment, and optimization.`,
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
      "M.Tech in Computational Science (DEI, CGPA 8.1), PG Diploma in Big Data & Logistics, ITI COPA, and B.Sc. PCM.",
    tags: ["Computational Science", "Big Data", "Education", "DEI"],
    body: `Bhanu's education: Master of Technology (M.Tech) in Computational Science, Dayalbagh Educational Institute, Agra (September 2022 - June 2024), CGPA 8.1. Postgraduate Diploma in Big Data & Logistics, Dayalbagh Educational Institute, Agra (September 2021 - August 2022), CGPA 6.8. ITI in Computer Operator & Programming Assistant (COPA), Government Industrial Training Institute, Afzalgarh, Bijnor (August 2020 - 2021), CGPA 8.8. Bachelor of Science (B.Sc.) in Physics, Chemistry, and Mathematics, MJP Rohilkhand University, Bareilly (August 2017 - October 2020), CGPA 6.0.`,
  },
  {
    id: "publications",
    kind: "research",
    title: "Publications",
    summary:
      "Peer-reviewed journal article and an ILA international conference book chapter on AI, creativity, and Hindi library automation.",
    tags: [
      "Publications",
      "Research",
      "RAG",
      "Semantic Search",
      "AI Education",
      "Peer-reviewed",
    ],
    body: `Bhanu has peer-reviewed research output. (1) Kumari, S., Rana, B. P., & Tripathi, M. (2025), "Artificial Intelligence and Human Creativity: A Collaborative or Inhibitory Relationship," Shodh Bhumi, ISSN 3048-6203, Vol. 2, Issue 2, July-December 2025, pp. 672-690. (2) Rana, B. P., & Mandusia, A. K. (2026), "Transforming Hindi Library Automation: Semantic Search and AI-Enhanced Metadata," a book chapter in "Transforming Library Services in the AI Era: Library Services, User Engagement and Community Impact" — the 71st Annual ILA International Conference Proceedings (Indian Library Association, New Delhi & Swami Vivekanand Central Library, Kendriya Hindi Sansthan, Agra, Ministry of Education, Govt. of India), p. 302.`,
  },
  {
    id: "conference-presentations",
    kind: "research",
    title: "Conference Presentations & Awards",
    summary:
      "Two AI-and-law conference presentations, including a Best Paper award at a national conference.",
    tags: [
      "Conference",
      "Best Paper",
      "AI and Law",
      "Neuromorphic",
      "Sustainability",
      "Award",
    ],
    body: `Bhanu has presented award-winning conference work. (1) "Emerging AI Applications for Legal Self-Help in India" (Kumari, S., Kumar, A., & Rana, B. P.) — presented at the National Conference on the Intersection of Artificial Intelligence and Law, Amity Law School, Amity University Chhattisgarh, 20-21 August 2025; awarded Best Paper in Technical Session 8. (2) "AI, Technology & Sustainability: A Comparative Study of Neuromorphic Computing and the ATAL AI Web App" (Rana, B. P.) — presented at the 1st International Conference on AI, Law and Sustainability (ICALS), Manipal University Jaipur, 11-12 September 2025, in collaboration with Universidade Estadual do Norte do Paraná (Brazil) and Nicolaus Copernicus University (Poland).`,
  },
  {
    id: "certifications",
    kind: "skill",
    title: "Certifications",
    summary:
      "Cloud and AI certifications from Oracle, AWS, University of Helsinki, Google, and others.",
    tags: ["Certifications", "Oracle", "AWS", "AI", "Cloud"],
    body: `Bhanu's certifications include: Oracle Cloud Infrastructure 2025 Certified AI Foundations Associate (Oracle University, 2025); AWS Cloud Practitioner Essentials (AWS Training & Certification, 2024); Generative AI Mastermind (Outskill); Elements of AI (University of Helsinki & MinnaLearn, 2020); Full Stack Web Development - Delta (Apna College); ChatGPT for Beginners (Great Learning Academy, 2024); Fundamentals of Digital Marketing (Google Digital Unlocked, 2020); Android Enterprise Associate Learning Path (Google, 2020); and Java Programming Quiz (CodeAlpha, 2024).`,
  },
  {
    id: "achievements",
    kind: "profile",
    title: "Achievements & Recognition",
    summary:
      "Best Paper award, strong pilot adoption, research review, and academic honors.",
    tags: ["Awards", "Best Paper", "Recognition", "Research"],
    body: `Recognition includes: Best Paper Award (Technical Session 8, National Conference on the Intersection of AI and Law, Amity Law School, August 2025); 50-65% student adoption in the ATAL AI pilot across 6 rural government schools in Assam; review of 22+ research papers and contributions to an edited academic book on AI-enabled education; Best Project Showcase (Industrial Training Institute); Best Performer Student (MIET Kumaun); and Student of the Year (LIC).`,
  },
  {
    id: "technical-skills",
    kind: "skill",
    title: "Technical Skills",
    summary:
      "Full stack of languages, AI/ML frameworks, GenAI/LLM, RAG, computer vision, backend, and data tooling.",
    tags: ["Skills", "Python", "GenAI", "RAG", "Computer Vision", "FastAPI"],
    body: `Languages: Python, JavaScript, TypeScript, SQL, Core Java, HTML5, CSS3. AI/ML frameworks: PyTorch, TensorFlow, Keras, Scikit-learn, Hugging Face Transformers, LangChain (LCEL), CrewAI. GenAI & LLM: OpenAI GPT-4o, Groq (LLaMA family), Ollama, Deepgram (STT), HuggingFace TTS, prompt engineering. RAG & vector search: ChromaDB, pgvector, Milvus, FAISS, MiniLM embeddings, semantic and hybrid retrieval. Computer vision: OpenCV, MediaPipe, PyTesseract, CNNs (VGG19, ResNet50), OCR, facial analysis. Backend & APIs: FastAPI, SQLModel, Redis, Celery, Docker, REST. Frontend: React 18/19, Next.js 16 (App Router), React Native, Vite, Tailwind CSS, Streamlit, Gradio, shadcn/ui. Databases: PostgreSQL, Supabase (Auth, Realtime, pgvector), MySQL, MongoDB, ChromaDB, Milvus. Cloud & DevOps: Docker, Vercel, Azure OpenAI, Power BI, Jupyter, Google Colab. NLP & data: spaCy, BART, TF-IDF, Pandas, NumPy, Matplotlib, Seaborn, Plotly. Spoken languages: English (professional proficiency) and Hindi (native).`,
  },
];

export const featuredQuestions = [
  "Why should we hire Bhanu?",
  "Show me his strongest RAG projects.",
  "What are his publications and research?",
  "What production AI systems has he worked on?",
  "Show me his computer vision work.",
  "Explain the ATAL AI architecture.",
];

export const impactMetrics = [
  {
    value: "2+ yrs",
    label: "AI engineering",
    detail: "Shipping production GenAI, RAG, and computer vision systems.",
  },
  {
    value: "95%+",
    label: "OCR accuracy",
    detail: "Automated document pipeline over 3,482 files at Bytical.ai.",
  },
  {
    value: "570+",
    label: "students reached",
    detail: "Assam field research across digital learning adoption.",
  },
  {
    value: "50-65%",
    label: "pilot adoption",
    detail: "Observed during comparative digital learning pilots.",
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

export function projectSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const projectKnowledgeMap: Record<string, string> = {
  "Aura AI": "aura-ai",
  "ATAL AI 2.0": "atal-ai",
  "Voice AI Assistant": "voice-ai-assistant",
  "Hindi Semantic Search": "hindi-semantic-search",
  "Smart HR Tool": "smart-hr-tool",
  "Custom Document AI Chatbot": "custom-document-ai-chatbot",
  "Sales Pitch Generator": "sales-pitch-generator",
};

export function getProjectBySlug(slug: string): PortfolioProject | undefined {
  return portfolioProjects.find((project) => projectSlug(project.name) === slug);
}

export function getProjectDetail(name: string): KnowledgeItem | undefined {
  const id = projectKnowledgeMap[name];
  return id ? knowledgeBase.find((item) => item.id === id) : undefined;
}

export type ArchitectureView = {
  key: string;
  label: string;
  steps: { node: string; detail: string }[];
};

export const architectures: ArchitectureView[] = [
  {
    key: "this-site",
    label: "This site",
    steps: [
      { node: "Next.js client", detail: "React 19 chat UI, streamed render" },
      { node: "Route handler /api/chat", detail: "Server-side, rate-limited" },
      { node: "Hybrid retrieval", detail: "Full profile index + keyword-scored evidence" },
      { node: "Groq Llama 4 Scout", detail: "Streamed completion" },
      { node: "Grounded fallback", detail: "Local answer if Groq is unavailable" },
    ],
  },
  {
    key: "aura-ai",
    label: "Aura AI",
    steps: [
      { node: "React Native app", detail: "Mobile client" },
      { node: "FastAPI", detail: "Service + orchestration layer" },
      { node: "OpenCV + MediaPipe", detail: "Facial analysis, skin-tone detection" },
      { node: "Redis + Celery", detail: "Async AI processing" },
      { node: "GPT-4o assistant", detail: "Personalized consultation" },
    ],
  },
  {
    key: "voice-ai",
    label: "Voice AI",
    steps: [
      { node: "React + Vite client", detail: "Mic capture + read-aloud" },
      { node: "Deepgram nova-2", detail: "WebSocket streaming STT" },
      { node: "FastAPI backend", detail: "Document parsing + orchestration" },
      { node: "Doc RAG", detail: "PDF/DOCX retrieval context" },
      { node: "Groq LLaMA 3.3 70B", detail: "Answers / follow-up questions" },
    ],
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
    proof: "OCR pipeline over 3,482 files at 95%+ accuracy, Smart HR Tool (-50% workload), and an Azure sentiment platform.",
  },
  {
    org: "testneo",
    role: "AI Engineer",
    period: "November 2024 - February 2025",
    proof: "Groq and ChromaDB powered API test generation from PDF, DOCX, OpenAPI, YAML, JSON, and TXT inputs.",
  },
  {
    org: "Illinois Institute of Technology",
    role: "Data Analyst (Intern)",
    period: "May 2023 - July 2023",
    proof: "Improved data integrity across 50,000+ records (+15% accuracy) and built dashboards that cut reporting time 30%.",
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
  "LangChain",
  "Groq",
  "OpenAI GPT-4o",
  "CrewAI",
  "ChromaDB",
  "pgvector",
  "Milvus",
  "Deepgram",
  "spaCy",
  "React Native",
  "TypeScript",
  "Next.js",
];

export type EducationEntry = {
  degree: string;
  org: string;
  period: string;
  score: string;
};

export const educationEntries: EducationEntry[] = [
  {
    degree: "M.Tech — Computational Science",
    org: "Dayalbagh Educational Institute, Agra",
    period: "Sep 2022 – Jun 2024",
    score: "CGPA 8.1",
  },
  {
    degree: "PG Diploma — Big Data & Logistics",
    org: "Dayalbagh Educational Institute, Agra",
    period: "Sep 2021 – Aug 2022",
    score: "CGPA 6.8",
  },
  {
    degree: "ITI — Computer Operator & Programming Assistant (COPA)",
    org: "Govt. Industrial Training Institute, Afzalgarh, Bijnor",
    period: "Aug 2020 – 2021",
    score: "CGPA 8.8",
  },
  {
    degree: "B.Sc — Physics, Chemistry, Mathematics",
    org: "MJP Rohilkhand University, Bareilly",
    period: "Aug 2017 – Oct 2020",
    score: "CGPA 6.0",
  },
];

export type ResearchEntry = {
  title: string;
  venue: string;
  year: string;
  award?: boolean;
};

export const researchOutput: ResearchEntry[] = [
  {
    title:
      "Transforming Hindi Library Automation: Semantic Search and AI-Enhanced Metadata",
    venue:
      "Book chapter — 71st Annual ILA International Conference Proceedings (Indian Library Association & KHS Agra)",
    year: "2026",
  },
  {
    title:
      "Emerging AI Applications for Legal Self-Help in India",
    venue:
      "National Conference on AI & Law, Amity Law School — Best Paper, Technical Session 8",
    year: "Aug 2025",
    award: true,
  },
  {
    title:
      "AI, Technology & Sustainability: Neuromorphic Computing and the ATAL AI Web App",
    venue:
      "1st Intl. Conference on AI, Law & Sustainability (ICALS), Manipal University Jaipur",
    year: "Sep 2025",
  },
  {
    title:
      "Artificial Intelligence and Human Creativity: A Collaborative or Inhibitory Relationship",
    venue: "Shodh Bhumi, ISSN 3048-6203, Vol. 2, Issue 2, pp. 672–690",
    year: "2025",
  },
];

export const certifications = [
  "OCI 2025 Certified AI Foundations Associate — Oracle",
  "AWS Cloud Practitioner Essentials — AWS",
  "Generative AI Mastermind — Outskill",
  "Elements of AI — University of Helsinki",
  "Full Stack Web Development (Delta) — Apna College",
  "ChatGPT for Beginners — Great Learning",
  "Fundamentals of Digital Marketing — Google",
  "Android Enterprise Associate — Google",
  "Java Programming Quiz — CodeAlpha",
];
