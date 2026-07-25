# Project Purpose: Control de Salud - Gestión y Control Médico Familiar

## Vision
Transform family healthcare management into a simple, collaborative, and intelligent experience where adult siblings, parents, and caregivers can effortlessly coordinate medical history, prescriptions, appointments, and lab orders in one unified digital space powered by **Next.js, Supabase, Vercel, and GitHub**.

## Core Problem Solved
Modern family care is fragmented across paper prescriptions, chat apps, and scattered emails. Siblings caring for elderly parents or parents managing pediatric schedules often miss appointment dates, lose lab order authorization deadlines, or lose track of active medication dosages. We resolve this by centralizing health management in shared family workspaces backed by real-time Supabase PostgreSQL.

## Unique Selling Proposition
- **Collaborative Family Workspaces:** Real-time shared access via Supabase Row Level Security (RLS) linked by email without password sharing.
- **Intelligent Document Scanner (Gemini AI) with Human-in-the-Loop Verification:** Automated extraction of prescription and lab data from photos or PDFs, coupled with an interactive preview pane to edit and confirm data before database commitment.
- **Visual Alert System:** Instant visual feedback (color-coded badges/pills) for pending appointments and expiring lab authorizations.

## Target Audience
- **Family Caregivers & Adult Children:** Siblings managing medical care and appointments for elderly parents.
- **Parents:** Families tracking pediatric health, vaccine schedules, and recurring prescriptions for children.
- **Autonomous Patients:** Individuals seeking a clean, structured repository for personal prescriptions and medical records.

## Deployment Strategy
- **Frontend & App Framework:** Built on **Next.js 14+ (App Router)** with React 18/19, TypeScript, Tailwind CSS, and Lucide React icons.
- **Backend & Cloud Infrastructure:** Powered natively by **Supabase** (Supabase Auth, PostgreSQL DB with RLS, Real-time subscriptions) hosted on **Vercel** with **GitHub Actions CI/CD**.
- **AI Processing:** Google Gemini API (`@google/genai`) executed via Next.js Server Actions / API Routes for multimodal OCR and structured medical JSON extraction.

## Commercial Success
Higher treatment adherence, zero expired medical orders, improved family communication during health caregiving, and peace of mind through organized, accessible medical records.