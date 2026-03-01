# AI Prompts Documentation

## Overview
This directory contains professional AI prompts for the HR platform's AI Orchestrator.

## Available Prompts

### 1. **JOB_DESCRIPTION** - Job Description Generation
Generates professional job descriptions based on title and requirements.

**Input:**
- Job title
- Basic responsibilities
- Required skills
- Experience level

**Output:** JSON with complete job description

---

### 2. **CV_SCREENING** - Resume Analysis
Analyzes candidate CVs against job requirements.

**Input:**
- Job description
- Resume text

**Output:** Match percentage, decision, strengths/weaknesses

---

### 3. **INTERVIEW_QUESTIONS** - Interview Question Generator
Creates 5 relevant interview questions.

**Input:**
- Job title
- Required skills
- Interview type

**Output:** Numbered list of questions

---

### 4. **INTERVIEW_EVALUATION** - Interview Assessment
Evaluates candidate responses objectively.

**Input:**
- Questions
- Candidate answers

**Output:** Score, decision, analysis

---

### 5. **CANDIDATE_RANKING** - Candidate Sorting
Ranks candidates by overall performance.

**Input:**
- Candidate list
- Assessment scores

**Output:** Ranked list with recommendations

---

### 6. **EMAIL_GENERATOR** - Email Templates
Generates professional acceptance/rejection emails.

**Input:**
- Candidate name
- Decision
- Company name

**Output:** Subject and email body

---

### 7. **BEHAVIORAL_ANALYSIS** - 30x3 Analysis
Analyzes employee behavioral data over time.

**Input:**
- Timeline of responses
- Question types

**Output:** Satisfaction, stress, attrition risk

---

### 8. **TRAINING_NEEDS** - Training Needs Analysis
Identifies training requirements.

**Input:**
- 30x3 data
- Task performance
- Manager feedback

**Output:** Training needs, priority level

---

### 9. **TRAINING_PROGRAM** - Training Program Generator
Creates personalized training programs.

**Input:**
- Weak areas

**Output:** Complete training plan with free resources

---

### 10. **TALENT_DETECTION** - Talent Identification
Identifies high-potential employees.

**Input:**
- Employee data
- 30x3 results
- Task completion

**Output:** Talent score, recommended path

---

### 11. **PRODUCTIVITY_ANALYSIS** - Productivity Assessment
Analyzes task and project data.

**Input:**
- Tasks
- Timelines
- Completion status

**Output:** Productivity level, burnout risk

---

## Usage

```javascript
import { buildAIRequest, mockAIResponse } from './prompts.js';

// Build request
const request = buildAIRequest(
  'JOB_DESCRIPTION',
  { title: 'مطور برمجيات', skills: ['JavaScript'] },
  'company-123',
  'job-456'
);

// Get response (mock for development)
const response = await mockAIResponse('JOB_DESCRIPTION', request.data);
```

## Security Notes

⚠️ **CRITICAL:** All AI requests MUST include:
- `companyId` - For data isolation
- `entityId` - For tracking
- `context` - For audit trail

This prevents data leakage between companies.

## Integration with AI Orchestrator

Replace `mockAIResponse` with actual AI service call:

```javascript
export async function callAI(promptKey, data, companyId, entityId) {
  const request = buildAIRequest(promptKey, data, companyId, entityId);
  
  // Call your AI service (OpenAI, Gemini, etc.)
  const response = await aiOrchestrator.process(request);
  
  return response;
}
```
