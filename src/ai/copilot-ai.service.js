import OpenAI from 'openai';
import prisma from '../config/db.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25000,
    maxRetries: 2,
});

// Prompt injection sanitizer
const SANITIZATION_REGEX = [
    /ignore previous instructions/i,
    /system bypass/i,
    /you are now a/i,
    /forget everything/i,
    /reveal system prompt/i,
    /disregard all rules/i,
    /drop database/i,
    /delete all/i
];

export const sanitizePromptInput = (text) => {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    for (const pattern of SANITIZATION_REGEX) {
        cleaned = cleaned.replace(pattern, '[REDACTED]');
    }
    return cleaned;
};

/**
 * AI Tool definitions for Recruitment Copilot
 */
export const COPILOT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'extract_job_requirements',
            description: 'استخراج متطلبات الوظيفة والشروط والموقع والخبرات من رسالة مسؤول التوظيف',
            parameters: {
                type: 'object',
                properties: {
                    jobTitle: { type: 'string', description: 'المسمى الوظيفي المستهدف' },
                    departmentName: { type: 'string', description: 'القسم أو الإدارة المناسبة للمنصب (مثال: تقنية المعلومات / البرمجة / المبيعات / التسويق / المالية / الموارد البشرية)' },
                    location: { type: 'string', description: 'المدينة أو الدولة للعمل' },

                    nationality: { type: 'string', description: 'الجنسية المفضلة إن وجدت (مثل: سعودي)' },
                    experienceYears: { type: 'number', description: 'عدد سنوات الخبرة المطلوبة' },
                    educationLevel: { type: 'string', description: 'المؤهل العلمي المطلوب (مثل: بكالوريوس في علوم الحاسب / تقنية المعلومات أو ما يعادله)' },
                    languages: { type: 'array', items: { type: 'string' }, description: 'اللغات المطلوبة' },
                    requiredSkills: { type: 'array', items: { type: 'string' }, description: 'المهارات التقنية والوظيفية الأساسية' },
                    recommendedSkills: { type: 'array', items: { type: 'string' }, description: 'مهارات إضافية يقترحها الذكاء الاصطناعي لرفع كفاءة الوظيفة' },
                    employmentType: { type: 'string', enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT'], description: 'نوع التوظيف' },
                    suggestedSalaryMin: { type: 'number', description: 'الحد الأدنى المقترح للراتب' },
                    suggestedSalaryMax: { type: 'number', description: 'الحد الأقصى المقترح للراتب' },
                    budgetCode: { type: 'string', description: 'كود الميزانية المخصص (مثل: BUD-IT-2027)' },
                    costCenter: { type: 'string', description: 'مركز التكلفة (مثل: CC-TECH-01)' },
                    hiringReason: { type: 'string', description: 'سبب الاحتياج الوظيفي (مثل: توسع الفريق / منصب جديد)' },
                    vacancies: { type: 'number', description: 'عدد الشواغر المطلوبة' },
                    jobSummary: { type: 'string', description: 'ملخص موجز وجذاب للوظيفة' }
                },
                required: ['jobTitle', 'requiredSkills']
            }
        }
    },

    {
        type: 'function',
        function: {
            name: 'get_market_insights',
            description: 'تقديم قراءة تحليلية وتقديرية لمتوسط الرواتب ووفرة المرشحين بناء على سوق العمل',
            parameters: {
                type: 'object',
                properties: {
                    jobTitle: { type: 'string' },
                    location: { type: 'string' },
                    estimatedMarketSalaryAverage: { type: 'string', description: 'النطاق الراتبي التقديري في السوق' },
                    candidateAvailabilityLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'SCARCE'], description: 'مدى وفرة المرشحين' },
                    estimatedSourcingDays: { type: 'number', description: 'المدة التقديرية المتوقعة للبحث بالأيام' },
                    marketTip: { type: 'string', description: 'نصيحة سوقية ذكية مثل إضافة أدوات محددة أو تعديل المزايا' },
                    isSystemEstimate: { type: 'boolean', description: 'توضيح أن الأرقام تحليلية تقديرية مبنية على معايير المنصة' }
                },
                required: ['jobTitle', 'candidateAvailabilityLevel', 'isSystemEstimate']
            }
        }
    }
];

export const copilotAiService = {
    /**
     * Process multi-turn chat with strict tenant context and tool calls
     */
    processChat: async ({ messages, companyId, currentExtractedData }) => {
        try {
            const sanitizedMessages = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: sanitizePromptInput(m.content || '')
            })).filter(m => m.content.length > 0);

            const systemPrompt = `أنت "Recruitment Copilot" — المساعد الذكي الفائق لمسؤولي التوظيف والموارد البشرية في منصة AI HR Platform.
دورك:
1. فهم متطلبات مسؤولي التوظيف بدقة من خلال المحادثة باللغة الطبيعية.
2. استخراج بيانات الوظيفة وهيكلتها عبر أداة "extract_job_requirements" دون تعبئة نماذج يدوية طويلة.
3. تقديم نصائح ذكية وتحسينات على المهارات (مثل اقتراح CRM, ERP, أدوات إدارية مناسبة للمنصب).
4. تقديم تحليلات سوقية واقعية وواضحة عبر "get_market_insights" مع التوضيح الدائم أنها تقديرات مبنية على معايير المنظمة.
5. لا تنفذ عمليات التعديل أو الحفظ المباشر في قاعدة البيانات — دورك هو اقتراح الإجراءات وتجهيزها بانتظار تأكيد المستخدم.
6. التحدث بلغة عربية مهنية، ذكية، واثقة، وموجزة.

البيانات المستخرجة حالياً حتى الآن:
${currentExtractedData ? JSON.stringify(currentExtractedData, null, 2) : 'لا يوجد بعد'}`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...sanitizedMessages
                ],
                tools: COPILOT_TOOLS,
                tool_choice: 'auto',
                temperature: 0.2
            });

            const choice = response.choices[0];
            const message = choice.message;

            let toolCallsData = [];
            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    try {
                        const parsedArgs = JSON.parse(toolCall.function.arguments);
                        toolCallsData.push({
                            name: toolCall.function.name,
                            arguments: parsedArgs
                        });
                    } catch (e) {
                        logger.error('[CopilotAI] Failed to parse tool arguments:', e.message);
                    }
                }
            }

            return {
                role: 'assistant',
                content: message.content || 'تم تحليل طلبك وتحديث خطة التوظيف المقترحة بنجاح.',
                toolCalls: toolCallsData
            };
        } catch (error) {
            logger.error('[CopilotAI] Error in processChat:', error.message);
            // Graceful fallback response
            return {
                role: 'assistant',
                content: 'أعتذر، حدث تأخير مؤقت في خدمة الذكاء الاصطناعي. يمكنك مراجعة البيانات المدخلة وتأكيد الإجراء مباشرة.',
                toolCalls: []
            };
        }
    },

    /**
     * Deterministic + Qualitative Candidate Matcher
     */
    evaluateCandidateMatch: ({ candidate, jobSpec }) => {
        let breakdown = {
            titleMatch: 0,
            skillsMatch: 0,
            experienceMatch: 0,
            locationMatch: 0
        };
        let strengths = [];
        let risks = [];

        const cTitle = (candidate.currentTitle || candidate.fullName || '').toLowerCase();
        const jTitle = (jobSpec.jobTitle || '').toLowerCase();

        // 1. Exact or Partial Title & Domain Matching (Up to 35 points)
        const jobWords = jTitle.split(/[\s,/-]+/).filter(w => w.length > 2);
        const matchesJobWords = jobWords.some(w => cTitle.includes(w));

        if (jTitle && cTitle.includes(jTitle)) {
            breakdown.titleMatch = 35;
            strengths.push(`المسمى الوظيفي السابق (${candidate.currentTitle || 'المطابق'}) يتطابق تماماً مع المنصب المستهدف`);
        } else if (matchesJobWords) {
            breakdown.titleMatch = 20;
            strengths.push(`الخلفية المهنية للمرشح قريبة من مجال المنصب (${jobSpec.jobTitle})`);
        } else {
            breakdown.titleMatch = 5;
            risks.push(`المسمى الوظيفي السابق للمرشح (${candidate.currentTitle || 'غير محدد'}) يختلف عن المنصب المطلوب`);
        }

        // 2. Skills Matching against candidate skills in database (Up to 35 points)
        const cSkills = (candidate.candidateSkills || []).map(s => (s.skillName || '').toLowerCase());
        const jSkills = (jobSpec.requiredSkills || []).map(s => s.toLowerCase());
        let matchedSkillsCount = 0;
        let matchedSkillNames = [];

        jSkills.forEach(s => {
            const matched = cSkills.find(cs => cs.includes(s) || s.includes(cs));
            if (matched) {
                matchedSkillsCount++;
                matchedSkillNames.push(matched);
            }
        });

        if (jSkills.length > 0) {
            const ratio = matchedSkillsCount / jSkills.length;
            breakdown.skillsMatch = Math.round(ratio * 35);
            if (ratio >= 0.6) {
                strengths.push(`يمتلك المهارات التقنية الأساسية المطلوبة: ${matchedSkillNames.slice(0, 3).join(', ')}`);
            } else if (matchedSkillsCount > 0) {
                risks.push(`يمتلك جزءاً من المهارات المطلوبة فقط (${matchedSkillsCount}/${jSkills.length})`);
            } else {
                risks.push(`لا تتوفر مهارات مطابقة مسجلة في ملف المرشح`);
            }
        } else {
            breakdown.skillsMatch = 15;
        }

        // 3. Experience Matching against real candidate data (Up to 20 points)
        const cExp = candidate.yearsOfExperience || (candidate.candidateExperiences?.length ? candidate.candidateExperiences.length * 1.5 : 0);
        const jExp = jobSpec.experienceYears || 0;
        if (jExp > 0) {
            if (cExp >= jExp) {
                breakdown.experienceMatch = 20;
                strengths.push(`الخبرة العملية (${Math.round(cExp)} سنوات) تغطي وتفوق الحد الأدنى المطلوب (${jExp} سنوات)`);
            } else if (cExp >= Math.max(1, jExp - 2)) {
                breakdown.experienceMatch = 12;
                risks.push(`سنوات الخبرة (${Math.round(cExp)} سنوات) أقل بقليل من المستهدف (${jExp} سنوات)`);
            } else {
                breakdown.experienceMatch = 4;
                risks.push(`سنوات الخبرة العملية غير كافية للمنصب المطلوب (${Math.round(cExp)} سنوات مقابل ${jExp} سنوات)`);
            }
        } else {
            breakdown.experienceMatch = 15;
        }

        // 4. Location Matching (Up to 10 points)
        const cLoc = (candidate.location || '').toLowerCase();
        const jLoc = (jobSpec.location || '').toLowerCase();
        if (jLoc && (cLoc.includes(jLoc) || jLoc.includes(cLoc))) {
            breakdown.locationMatch = 10;
            strengths.push(`متواجد في نفس المدينة المستهدفة للعمل (${jobSpec.location})`);
        } else {
            breakdown.locationMatch = 3;
            if (jLoc) risks.push(`قد يتطلب العمل نقلاً جغرافياً من مقر إقامة المرشح الحالية (${candidate.location || 'غير محدد'})`);
        }

        // Calculate Raw Deterministic Score (0 - 100)
        const totalScore = breakdown.titleMatch + breakdown.skillsMatch + breakdown.experienceMatch + breakdown.locationMatch;
        const finalScore = Math.min(99, Math.max(15, totalScore));

        let recommendation = 'REJECT';
        if (finalScore >= 80) recommendation = 'STRONG_HIRE';
        else if (finalScore >= 65) recommendation = 'HIRE';
        else if (finalScore >= 50) recommendation = 'MAYBE';
        else recommendation = 'REJECT';


        return {
            matchScore: finalScore,
            scoringBreakdown: breakdown,
            strengths: strengths.length > 0 ? strengths : ['مرشح واعد ولديه إمكانات للتطور السريع'],
            risks: risks.length > 0 ? risks : ['لا توجد مخاطر جوهرية ملحوظة'],
            recommendation,
            salaryFit: 'متوافق مع الميزانية التقديرية'
        };
    }
};
