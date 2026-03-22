import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface JobRequirements {
  name: string;
  experience: string;
  field: string;
  skills: string;
  otherRequirements: string;
}

export interface ScreeningResult {
  candidateName: string;
  score: number;
  keyFeatures: string[];
  summary: string;
  experienceMatch?: string;
  skillsMatch?: string;
  redFlags?: string[];
  recommendation?: string;
  smartInsight?: string;
  improvementSuggestions?: string[];
}

export async function screenCV(fileBase64: string, mimeType: string, requirements: JobRequirements): Promise<ScreeningResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const prompt = `
    You are an expert HR recruiter. Analyze the provided CV against the following job requirements:
    - Job Title: ${requirements.name}
    - Required Experience: ${requirements.experience}
    - Field: ${requirements.field}
    - Required Skills: ${requirements.skills}
    - Other Requirements: ${requirements.otherRequirements}

    Extract the candidate's name and provide a match score (0-100), top 3-5 key features (strengths), a quick summary, experience match analysis, skills match analysis, any red flags or missing requirements, and a final recommendation (Strong Hire, Hire, Consider, or Reject).
    Also provide a 'smartInsight' (a one-sentence killer insight, e.g., "Candidate fits 70% but lacks critical business intelligence tools") and 'improvementSuggestions' (a list of specific skills or keywords the candidate should add to improve their CV, e.g., ["Power BI", "Advanced Excel"]).
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          candidateName: { type: Type.STRING },
          score: { type: Type.NUMBER },
          keyFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          summary: { type: Type.STRING },
          experienceMatch: { type: Type.STRING },
          skillsMatch: { type: Type.STRING },
          redFlags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          recommendation: { type: Type.STRING },
          smartInsight: { type: Type.STRING },
          improvementSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["candidateName", "score", "keyFeatures", "summary", "experienceMatch", "skillsMatch", "redFlags", "recommendation", "smartInsight", "improvementSuggestions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
}

export async function generateCVReport(screening: ScreeningResult, requirements: JobRequirements): Promise<string> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const prompt = `
You are an elite Executive HR Consultant and professional reporting system.

Generate a premium, corporate-grade CV Screening & Evaluation Report based on the following candidate data and job requirements.

Job Requirements:
- Job Title: ${requirements.name}
- Required Experience: ${requirements.experience}
- Field: ${requirements.field}
- Required Skills: ${requirements.skills}

Candidate Data:
- Name: ${screening.candidateName}
- Score: ${screening.score}%
- Summary: ${screening.summary}
- Experience Match: ${screening.experienceMatch || 'N/A'}
- Skills Match: ${screening.skillsMatch || 'N/A'}
- Strengths: ${screening.keyFeatures.join(', ')}
- Weaknesses/Missing: ${screening.redFlags?.join(', ') || 'None'}
- Recommendation: ${screening.recommendation || 'N/A'}
- Smart Insight: ${screening.smartInsight || 'N/A'}
- Improvement Suggestions: ${screening.improvementSuggestions?.join(', ') || 'None'}

Structure the report as a highly polished, formal corporate document using Markdown. Use horizontal rules (---) for section separation, bolding for emphasis, and clear hierarchical headings.

Required Structure:

# CANDIDATE EVALUATION REPORT
*Confidential HR Document*
**Date:** ${new Date().toLocaleDateString()}

---

## 1. EXECUTIVE SUMMARY
- **Candidate Name:** [Name]
- **Target Position:** [Role]
- **Overall Match Score:** [Score]%
- **Final Recommendation:** [Accept / Maybe / Reject]

**Overview:**
[Provide a polished, formal paragraph summarizing the candidate's fit based on the summary and smart insight.]

---

## 2. COMPETENCY & FIT ANALYSIS
### 2.1 Experience Evaluation
- **Experience Level:** [Junior / Mid / Senior / Executive]
- **Alignment:** [Formal analysis of experience match]

### 2.2 Skills Assessment
- **Core Competencies (Matched):** [List of matched skills]
- **Skill Gaps (Missing):** [List of missing skills]
- **Alignment:** [Formal analysis of skills match]

---

## 3. DETAILED ASSESSMENT
### 3.1 Key Strengths
[Use bullet points to list strengths professionally]

### 3.2 Areas of Concern / Risk Factors
[Use bullet points to list weaknesses or missing elements professionally]

---

## 4. STRATEGIC RECOMMENDATIONS
### 4.1 Hiring Decision Justification
[Provide a short, formal justification for the final decision]

### 4.2 Candidate Development Plan (If Applicable)
[List specific improvements the candidate should make to their CV or skill set, based on the AI recommendations]

---
*Generated by AI HR Screening System*
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "";
}
