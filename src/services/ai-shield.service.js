/**
 * AI Shield Service & Deterministic Scoring Engine
 * =================================================
 * Architecture & Principles:
 * 1. AI Shield NEVER declares binary "cheating". It captures "Observed Signals" and computes an explainable "Risk Score".
 * 2. Clear Separation of Concerns:
 *    - Detection Signals (Raw observations with confidence & timestamps)
 *    - AIShield Events (Classified events with severity: LOW, MEDIUM, HIGH, CRITICAL)
 *    - Deterministic Scoring Engine (Explicit mathematical formulas, no LLM hallucinations)
 *    - Risk Rule Engine (Hard security overrides for critical failures)
 *    - Human Review (Auditing & final decision state)
 * 3. Identity Verification Architecture:
 *    - Face Detection (Presence count & bounding coordinates)
 *    - Face Embedding / Identity Matching (Landmark consistency, similarity metric against baseline)
 *    - Liveness Verification (Natural micro-movements, eye blink / head-yaw variance)
 *    - Head & Gaze Orientation (Yaw/Pitch/Roll deviation)
 * 4. Zero Raw Biometric Retention: Stores numerical similarity indices and event signals only.
 */

import OpenAI from 'openai';
import logger from '../utils/logger.js';

let _openaiInstance = null;
const getOpenAI = () => {
    if (!_openaiInstance) {
        _openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_test',
            timeout: 30000,
            maxRetries: 2,
        });
    }
    return _openaiInstance;
};

export const EVENT_TYPES = {
    MULTIPLE_FACES: 'MULTIPLE_FACES',
    NO_FACE: 'NO_FACE',
    FACE_CHANGED: 'FACE_CHANGED',
    GAZE_AWAY: 'GAZE_AWAY',
    MULTIPLE_SPEAKERS: 'MULTIPLE_SPEAKERS',
    AUDIO_ANOMALY: 'AUDIO_ANOMALY',
    AI_RECITATION: 'AI_RECITATION',
    CV_COMPLEXITY_VARIANCE: 'CV_COMPLEXITY_VARIANCE'
};

export const SEVERITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

export const RISK_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
};

export const SESSION_STATUS = {
    CREATED: 'CREATED',
    CONSENTED: 'CONSENTED',
    ACTIVE: 'ACTIVE',
    COMPLETING: 'COMPLETING',
    COMPLETED: 'COMPLETED',
    FLAGGED: 'FLAGGED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED'
};

export const HUMAN_REVIEW_STATUS = {
    NOT_REVIEWED: 'NOT_REVIEWED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    REVIEWED: 'REVIEWED'
};

// ─── 1. Identity Baseline Verification Engine ─────────────────────────────────

/**
 * Verifies candidate identity during onboarding / pre-interview baseline check.
 * Strictly separates Face Detection, Similarity Index, Liveness, and Landmark Quality.
 */
export const verifyIdentityBaseline = (params) => {
    const {
        faceDetected = true,
        faceCount = 1,
        similarityIndex = 0.92, // 0.0 to 1.0 vs registered profile / ID
        livenessScore = 0.88,   // 0.0 to 1.0
        landmarkQuality = 0.90, // 0.0 to 1.0
        baselineEmbeddingHash = null
    } = params;

    const signals = [];
    let isVerified = false;
    let confidence = 0.9;
    let identityScore = 100;
    const details = {
        faceCount,
        similarityIndex,
        livenessScore,
        landmarkQuality,
        hasBaselineHash: Boolean(baselineEmbeddingHash)
    };

    if (!faceDetected || faceCount === 0) {
        identityScore = 0;
        confidence = 0.95;
        isVerified = false;
        signals.push({
            type: EVENT_TYPES.NO_FACE,
            severity: SEVERITY_LEVELS.CRITICAL,
            description: 'لم يتم رصد أي وجه في إطار الكاميرا أثناء التحقق الأولي من الهوية.',
            confidence: 0.95
        });
    } else if (faceCount > 1) {
        identityScore = Math.max(20, Math.round(50 - (faceCount * 10)));
        confidence = 0.9;
        isVerified = false;
        signals.push({
            type: EVENT_TYPES.MULTIPLE_FACES,
            severity: SEVERITY_LEVELS.HIGH,
            description: `تم رصد أكثر من وجه (${faceCount} وجوه) في إطار التحقق الأولي.`,
            confidence: 0.9
        });
    } else {
        // Single face detected — calculate weighted similarity and liveness
        // Similarity: 60%, Liveness: 25%, Landmark Quality: 15%
        const computedScore = Math.round(
            (similarityIndex * 60) +
            (livenessScore * 25) +
            (landmarkQuality * 15)
        );
        identityScore = Math.min(100, Math.max(0, computedScore));
        isVerified = identityScore >= 70;
        confidence = (similarityIndex + livenessScore + landmarkQuality) / 3;

        if (similarityIndex < 0.65) {
            signals.push({
                type: EVENT_TYPES.FACE_CHANGED,
                severity: SEVERITY_LEVELS.HIGH,
                description: 'مؤشر تطابق ملامح الوجه مع السجل المعتمد منخفض (أقل من 65%).',
                confidence: 0.85
            });
        }
    }

    return {
        identityScore,
        isVerified,
        confidence: Number(confidence.toFixed(2)),
        signals,
        details
    };
};

// ─── 2. Frame & Visual Signal Analyzer ────────────────────────────────────────

/**
 * Analyzes structured computer vision metrics submitted from client-side or frame processor.
 * Avoids raw frame streaming to protect privacy and optimize network bandwidth.
 */
export const processFrameSignals = (frameData, currentOffsetSeconds = 0) => {
    const {
        faceCount = 1,
        facePresent = true,
        gazeDirection = 'CENTER', // CENTER, LEFT, RIGHT, UP, DOWN, AWAY
        gazeOffScreenDuration = 0, // Continuous seconds looking away
        faceEmbeddingSimilarity = 0.95, // vs Baseline
        headPose = { yaw: 0, pitch: 0, roll: 0 }
    } = frameData;

    const detectedEvents = [];
    let behaviorDeductions = 0;

    // Signal A: No Face Presence
    if (!facePresent || faceCount === 0) {
        behaviorDeductions += 15;
        detectedEvents.push({
            eventType: EVENT_TYPES.NO_FACE,
            timestamp: currentOffsetSeconds,
            duration: 1,
            severity: SEVERITY_LEVELS.MEDIUM,
            confidence: 0.92,
            description: 'انقطاع ظهور المرشح في إطار الكاميرا.',
            metadata: { faceCount: 0 }
        });
    }

    // Signal B: Multiple Faces in Frame
    if (faceCount > 1) {
        behaviorDeductions += 25;
        detectedEvents.push({
            eventType: EVENT_TYPES.MULTIPLE_FACES,
            timestamp: currentOffsetSeconds,
            duration: 1,
            severity: SEVERITY_LEVELS.HIGH,
            confidence: 0.90,
            description: `رصد أكثر من شخص (${faceCount} أشخاص) داخل إطار المقابلة.`,
            metadata: { faceCount }
        });
    }

    // Signal C: Face Substitution / Sudden Change
    if (facePresent && faceCount === 1 && faceEmbeddingSimilarity < 0.60) {
        behaviorDeductions += 35;
        detectedEvents.push({
            eventType: EVENT_TYPES.FACE_CHANGED,
            timestamp: currentOffsetSeconds,
            duration: 1,
            severity: SEVERITY_LEVELS.CRITICAL,
            confidence: 0.88,
            description: 'تغير ملحوظ في ملامح الوجه مقارنة ببيانات التحقق الأساسية.',
            metadata: { faceEmbeddingSimilarity }
        });
    }

    // Signal D: Prolonged Gaze Away / Reading Off-Screen
    if (gazeDirection === 'AWAY' || Math.abs(headPose.yaw) > 30 || gazeOffScreenDuration > 4) {
        const dur = Math.max(1, gazeOffScreenDuration || 2);
        const severity = dur > 8 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.LOW;
        behaviorDeductions += dur > 8 ? 15 : 5;
        detectedEvents.push({
            eventType: EVENT_TYPES.GAZE_AWAY,
            timestamp: currentOffsetSeconds,
            duration: dur,
            severity,
            confidence: 0.82,
            description: `النظر بعيداً عن الشاشة بشكل متواصل لمدة ${dur} ثوانٍ (مؤشر على قراءة محتوى خارجي).`,
            metadata: { gazeDirection, gazeOffScreenDuration: dur, headPose }
        });
    }

    return {
        detectedEvents,
        behaviorDeductions
    };
};

// ─── 3. Audio Anomaly Signal Analyzer ─────────────────────────────────────────

/**
 * Analyzes audio acoustic signals (noise, secondary voice frequency, suspicious silences).
 */
export const processAudioSignals = (audioData, currentOffsetSeconds = 0) => {
    const {
        speakerCount = 1,
        secondarySpeakerDetected = false,
        secondarySpeakerConfidence = 0,
        abnormalSilenceDuration = 0,
        backgroundVoiceOverlap = false
    } = audioData;

    const detectedEvents = [];
    let audioDeductions = 0;

    // Signal A: Secondary Voice / Prompting
    if (secondarySpeakerDetected || speakerCount > 1 || backgroundVoiceOverlap) {
        audioDeductions += 25;
        detectedEvents.push({
            eventType: EVENT_TYPES.MULTIPLE_SPEAKERS,
            timestamp: currentOffsetSeconds,
            duration: 2,
            severity: SEVERITY_LEVELS.HIGH,
            confidence: secondarySpeakerConfidence || 0.85,
            description: 'رصد أصوات إضافية أو متحدث ثانوي في الخلفية أثناء الإجابة.',
            metadata: { speakerCount, secondarySpeakerConfidence, backgroundVoiceOverlap }
        });
    }

    // Signal B: Abnormal Disconnect / Acoustic Mute
    if (abnormalSilenceDuration > 15) {
        audioDeductions += 10;
        detectedEvents.push({
            eventType: EVENT_TYPES.AUDIO_ANOMALY,
            timestamp: currentOffsetSeconds,
            duration: abnormalSilenceDuration,
            severity: SEVERITY_LEVELS.MEDIUM,
            confidence: 0.78,
            description: `انقطاع صوتي غير طبيعي استمر ${abnormalSilenceDuration} ثانية.`,
            metadata: { abnormalSilenceDuration }
        });
    }

    return {
        detectedEvents,
        audioDeductions
    };
};

// ─── 4. Answer Integrity & LLM Recitation Analyzer ────────────────────────────

/**
 * Uses LLM ONLY for structural feature extraction (monotone text, verbatim LLM phrases, vocabulary variance vs CV).
 * The final scoring and decision remains 100% deterministic in the Backend.
 */
export const extractAnswerIntegritySignals = async (answersText = '', cvText = '', jobTitle = '') => {
    if (!answersText || answersText.trim().length < 30) {
        return {
            signals: [],
            extractedMetrics: { recitationLikelihood: 0.1, cvConsistency: 0.9, notes: 'نص الإجابات قصير جداً' }
        };
    }

    const systemPrompt = `You are an AI Interview Linguistics and Signal Extraction Auditor.
Your task is to analyze candidate interview responses against their CV profile and detect observational signals of:
1. Script recitation or LLM-generated verbatim playback (e.g. repetitive "As an AI...", robotic bullet-point oral speech).
2. Major vocabulary / technical complexity mismatch with the candidate's CV experience level.

You MUST NOT output a final pass/fail hiring judgment. Output ONLY observational metrics and signals in JSON format:
{
  "recitationLikelihood": <float 0.0 to 1.0>,
  "cvConsistency": <float 0.0 to 1.0>,
  "hasLlmLanguageMarkers": <boolean>,
  "markersFound": ["list of markers or phrases if any"],
  "observations": ["bullet points of objective observations"]
}`;

    const userPrompt = `Job Title: ${jobTitle}
Candidate CV Summary:
${cvText ? cvText.substring(0, 1000) : 'Not provided'}

Candidate Spoken Answers:
${answersText.substring(0, 3000)}`;

    try {
        const openai = getOpenAI();
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1000
        });

        const content = response.choices[0]?.message?.content?.trim();
        const parsed = content ? JSON.parse(content) : {};

        const signals = [];
        const recitationLikelihood = typeof parsed.recitationLikelihood === 'number' ? parsed.recitationLikelihood : 0.1;
        const cvConsistency = typeof parsed.cvConsistency === 'number' ? parsed.cvConsistency : 0.9;

        if (recitationLikelihood > 0.65 || parsed.hasLlmLanguageMarkers) {
            signals.push({
                eventType: EVENT_TYPES.AI_RECITATION,
                timestamp: 0,
                severity: recitationLikelihood > 0.85 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
                confidence: Number(recitationLikelihood.toFixed(2)),
                description: 'مؤشرات أسلوبية قوية على قراءة نصوص مُعدة آلياً أو الاستعانة بمساعد ذكاء اصطناعي أثناء الإجابة.',
                metadata: {
                    recitationLikelihood,
                    markersFound: parsed.markersFound || [],
                    observations: parsed.observations || []
                }
            });
        }

        if (cvConsistency < 0.50) {
            signals.push({
                eventType: EVENT_TYPES.CV_COMPLEXITY_VARIANCE,
                timestamp: 0,
                severity: SEVERITY_LEVELS.MEDIUM,
                confidence: Number((1 - cvConsistency).toFixed(2)),
                description: 'تباين ملحوظ بين المستوى التقني للإجابات والخبرات المسجلة في السيرة الذاتية.',
                metadata: { cvConsistency, observations: parsed.observations || [] }
            });
        }

        return {
            signals,
            extractedMetrics: parsed
        };
    } catch (err) {
        logger.warn('[AIShield] LLM signal extraction failed (using conservative fallback):', err.message);
        return {
            signals: [],
            extractedMetrics: { recitationLikelihood: 0.1, cvConsistency: 0.85, error: err.message }
        };
    }
};

// ─── 5. Deterministic Scoring Engine & Hard Security Rules ────────────────────

/**
 * Computes all four sub-scores and the composite Overall Integrity Score deterministically.
 * Evaluates Hard Security Rules to override Risk Level on critical threats.
 */
export const computeSessionScoresAndRisk = (sessionData, events = []) => {
    const {
        identityScore: rawIdentity = 100,
        totalFramesAnalyzed = 1,
        totalAudioSlicesAnalyzed = 1
    } = sessionData;

    // A. Identity Score (0-100)
    const identityScore = typeof rawIdentity === 'number' ? Math.min(100, Math.max(0, Math.round(rawIdentity))) : 100;

    // B. Behavior Score (0-100)
    // Count behavior events weighted by severity
    let behaviorDeductions = 0;
    const behaviorEvents = events.filter(e => [EVENT_TYPES.NO_FACE, EVENT_TYPES.MULTIPLE_FACES, EVENT_TYPES.FACE_CHANGED, EVENT_TYPES.GAZE_AWAY].includes(e.eventType));
    for (const ev of behaviorEvents) {
        if (ev.severity === SEVERITY_LEVELS.CRITICAL) behaviorDeductions += 30 * ev.confidence;
        else if (ev.severity === SEVERITY_LEVELS.HIGH) behaviorDeductions += 15 * ev.confidence;
        else if (ev.severity === SEVERITY_LEVELS.MEDIUM) behaviorDeductions += 8 * ev.confidence;
        else behaviorDeductions += 3 * ev.confidence;
    }
    const behaviorScore = Math.min(100, Math.max(0, Math.round(100 - behaviorDeductions)));

    // C. Audio Score (0-100)
    let audioDeductions = 0;
    const audioEvents = events.filter(e => [EVENT_TYPES.MULTIPLE_SPEAKERS, EVENT_TYPES.AUDIO_ANOMALY].includes(e.eventType));
    for (const ev of audioEvents) {
        if (ev.severity === SEVERITY_LEVELS.HIGH || ev.severity === SEVERITY_LEVELS.CRITICAL) audioDeductions += 20 * ev.confidence;
        else if (ev.severity === SEVERITY_LEVELS.MEDIUM) audioDeductions += 10 * ev.confidence;
        else audioDeductions += 5 * ev.confidence;
    }
    const audioScore = Math.min(100, Math.max(0, Math.round(100 - audioDeductions)));

    // D. Answer Integrity Score (0-100)
    let answerDeductions = 0;
    const answerEvents = events.filter(e => [EVENT_TYPES.AI_RECITATION, EVENT_TYPES.CV_COMPLEXITY_VARIANCE].includes(e.eventType));
    for (const ev of answerEvents) {
        if (ev.eventType === EVENT_TYPES.AI_RECITATION) {
            answerDeductions += (ev.severity === SEVERITY_LEVELS.HIGH ? 35 : 20) * ev.confidence;
        } else if (ev.eventType === EVENT_TYPES.CV_COMPLEXITY_VARIANCE) {
            answerDeductions += 15 * ev.confidence;
        }
    }
    const answerIntegrityScore = Math.min(100, Math.max(0, Math.round(100 - answerDeductions)));

    // E. Deterministic Weighted Overall Score
    // Identity: 35%, Behavior: 25%, Audio: 20%, Answer: 20% (Sum = 100%)
    const weightedOverall = (identityScore * 0.35) + (behaviorScore * 0.25) + (audioScore * 0.20) + (answerIntegrityScore * 0.20);
    const overallScore = Math.min(100, Math.max(0, Math.round(weightedOverall)));

    // F. Risk Rule Engine (Hard Security Overrides)
    const hardRuleReasons = [];
    let isHardRuleTriggered = false;

    // Hard Rule 1: Identity Failure (Critical)
    if (identityScore < 50) {
        isHardRuleTriggered = true;
        hardRuleReasons.push('فشل التحقق من الهوية الأساسية (Identity Verification Failure).');
    }

    // Hard Rule 2: Critical Face Swap Detected
    const faceChangedEvents = events.filter(e => e.eventType === EVENT_TYPES.FACE_CHANGED && (e.severity === SEVERITY_LEVELS.CRITICAL || e.severity === SEVERITY_LEVELS.HIGH));
    if (faceChangedEvents.length > 0) {
        isHardRuleTriggered = true;
        hardRuleReasons.push('رصد مؤشرات قوية على تبدل الشخص الذي يؤدي المقابلة (Face Swap/Impersonation Signal).');
    }

    // Hard Rule 3: Chronic Multiple Faces
    const multiFaceEvents = events.filter(e => e.eventType === EVENT_TYPES.MULTIPLE_FACES);
    if (multiFaceEvents.length >= 3) {
        isHardRuleTriggered = true;
        hardRuleReasons.push('تكرار رصد أشخاص متعددين داخل إطار الكاميرا أكثر من 3 مرات.');
    }

    // G. Determine Final Risk Level
    let riskLevel = RISK_LEVELS.LOW;
    if (isHardRuleTriggered || overallScore < 55) {
        riskLevel = RISK_LEVELS.HIGH;
    } else if (overallScore < 80 || events.some(e => e.severity === SEVERITY_LEVELS.HIGH)) {
        riskLevel = RISK_LEVELS.MEDIUM;
    } else {
        riskLevel = RISK_LEVELS.LOW;
    }

    // Recommendations Builder
    const recommendations = [];
    if (riskLevel === RISK_LEVELS.HIGH) {
        recommendations.push('يوصى بإجراء مراجعة بشرية دقيقة ومطابقة هوية المرشح قبل اعتماد قرار التوظيف.');
        if (isHardRuleTriggered) {
            recommendations.push(...hardRuleReasons.map(r => `ملاحظة أمنية حرجة: ${r}`));
        }
    } else if (riskLevel === RISK_LEVELS.MEDIUM) {
        recommendations.push('لوحظت بعض المؤشرات غير المعتادة أثناء المقابلة؛ يوصى بمراجعة المخطط الزمني للأحداث.');
    } else {
        recommendations.push('مؤشرات النزاهة والانتباه مستقرة وضمن المعدل الطبيعي.');
    }

    return {
        identityScore,
        behaviorScore,
        audioScore,
        answerIntegrityScore,
        overallScore,
        riskLevel,
        isHardRuleTriggered,
        hardRuleReasons,
        recommendations
    };
};
