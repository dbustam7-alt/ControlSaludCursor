# Project Roadmap: Control de Salud - Gestión y Control Médico Familiar

## Phase 1: Next.js & Supabase Core Setup
- [x] Initial project setup and architecture planning with Next.js 14+ (App Router), TypeScript, Tailwind CSS, and Lucide Icons.
- [x] Context configuration files generation (`general.md`, `.cursorrules`, `design.md`, `purpose.md`, `status.md`, `user_preference.md`, `supabase.md`).
- [x] Supabase Auth setup (Google OAuth & Email login) with local fallback.
- [x] Shared Family Workspace architecture definition with Supabase Row Level Security (RLS).

## Phase 2: Core Medical Modules Development
- [x] Medical Appointments Module (`AppointmentModule.tsx`): Registration, doctor, specialty, location, date/time, pending/completed status toggles, and filters.
- [x] Medical Orders & Exams Module (`OrderModule.tsx`): Authorization control, expiration dates, exam types, and attachment link handling.
- [x] Medications & Treatments Module (`MedicationModule.tsx`): Dosage tracking, frequency, treatment period, active/paused status, and end-of-treatment alerts.
- [x] Interactive confirmation modal (`ConfirmModal.tsx`) for all destructive operations.

## Phase 3: Gemini AI Intelligent Document Reader Integration
- [x] Integration of Google Gemini API (`@google/genai`) via Next.js server actions/handlers for multimodal OCR document processing.
- [x] Development of AI Medical Document Scanner modal (`AiDocumentScanner.tsx`).
- [x] Interactive Human-in-the-Loop Pre-visualization & Verification Pane for user data validation prior to Supabase save.

## Phase 4: Production Deployment on Vercel & GitHub Sync
- [ ] Connect repository to GitHub for version control and team collaboration. [In Progress]
- [ ] Deploy Next.js application to Vercel with automatic CI/CD triggers on push to `main`. [In Progress]
- [x] Provision Supabase production project and execute full PostgreSQL database schema (`supabase.md`).
- [ ] Configure production environment variables on Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
