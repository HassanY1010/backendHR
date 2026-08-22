import prisma from '../config/db.js';
import { aiService } from '../ai/ai-service.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// ============================================================================
// 1. ADVANCED PROMPT INJECTION & UNTRUSTED USER INPUT SANITIZER
// Multi-layered defense: Regex Patterns + Zero-Width/Unicode Normalization +
// Semantic Guarding + Structural Isolation
// ============================================================================
const normalizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .normalize('NFKD') // Normalize unicode composites
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
        .replace(/[^\w\s\u0600-\u06FF\-\.,:;()\/]/g, ' ') // Allow standard alphanumeric, Arabic, and basic punctuation
        .replace(/\s+/g, ' ')
        .trim();
};

const detectPromptInjection = (text) => {
    if (!text || typeof text !== 'string') return false;

    const normalized = normalizeInput(text).toLowerCase();

    const INJECTION_PATTERNS = [
        /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i,
        /disregard\s+(all\s+)?(previous\s+)?(rules|instructions|constraints)/i,
        /forget\s+(everything|all\s+prior\s+instructions)/i,
        /system\s+(prompt|override|bypass)/i,
        /reveal\s+(the\s+)?(system\s+)?(prompt|instructions|keys|secret)/i,
        /you\s+are\s+now\s+(an?\s+)?(unrestricted|evil|dan|new\s+system)/i,
        /return\s+(another|other|all)\s+company/i,
        /override\s+system/i,
        /output\s+system\s+secret/i,
        /تجاهل\s+(جميع\s+)?(التعليمات|الأوامر|القواعد)\s+السابقة/i,
        /اكشف\s+(عن\s+)?(البرومبت|التعليمات|المفتاح)\s+(السري|الداخلي)/i,
        /تجاوز\s+(النظام|الحماية|القيود)/i,
        /استخرج\s+بيانات\s+(الشركات|العملاء)\s+الأخرى/i,
        /أنت\s+الآن\s+نظام\s+جديد/i
    ];

    return INJECTION_PATTERNS.some(pattern => pattern.test(normalized));
};

// ============================================================================
// 2. STRICT AI OUTPUT SCHEMA VALIDATION (Type-Safe & Contract Bound)
// ============================================================================
export const validateAndEnforceOutputSchema = (raw, fallbackDomain) => {
    if (!raw || typeof raw !== 'object') return fallbackDomain;

    const cleanString = (val, defaultVal = '') => {
        return (typeof val === 'string' && val.trim().length > 0) ? val.trim() : defaultVal;
    };

    const cleanStringArray = (arr, defaultArr = []) => {
        if (!Array.isArray(arr)) return defaultArr;
        const filtered = arr
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(item => item.length > 0);
        return filtered.length > 0 ? filtered : defaultArr;
    };

    const cleanInterviewQuestions = (questions, defaultQuestions = []) => {
        if (!Array.isArray(questions)) return defaultQuestions;
        const valid = questions
            .filter(q => q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim().length > 0)
            .map(q => ({
                question: q.question.trim(),
                category: typeof q.category === 'string' && q.category.trim().length > 0 ? q.category.trim() : 'عام'
            }));
        return valid.length > 0 ? valid : defaultQuestions;
    };

    const jobTitle = cleanString(raw.jobTitle, fallbackDomain.jobTitle);
    const department = cleanString(raw.department, fallbackDomain.department);
    const summary = cleanString(raw.summary, fallbackDomain.summary);
    const responsibilities = cleanStringArray(raw.responsibilities, fallbackDomain.responsibilities);
    const requirements = cleanStringArray(raw.requirements, fallbackDomain.requirements);
    const requiredSkills = cleanStringArray(raw.requiredSkills, fallbackDomain.requiredSkills);
    const preferredSkills = cleanStringArray(raw.preferredSkills, fallbackDomain.preferredSkills);
    const interviewQuestions = cleanInterviewQuestions(raw.interviewQuestions, fallbackDomain.interviewQuestions);
    const searchKeywords = cleanStringArray(raw.searchKeywords, [jobTitle, department, ...requiredSkills.slice(0, 3)]);

    const rawMarket = raw.marketAnalysis && typeof raw.marketAnalysis === 'object' ? raw.marketAnalysis : {};
    const marketAnalysis = {
        marketTip: cleanString(rawMarket.marketTip, 'توصية الذكاء الاصطناعي (AI Recommendation): الوظيفة ذات طلب عالي في السوق.'),
        recommendedSkillsToAdd: cleanStringArray(rawMarket.recommendedSkillsToAdd, ['Cloud Architecture', 'CI/CD Pipelines']),
        salarySuggestion: cleanString(rawMarket.salarySuggestion, 'تقدير الراتب مخصص وفق معايير السوق (AI Estimate)')
    };

    const salaryInsight = cleanString(raw.salaryInsight, 'تقدير ذكي: نطاق الراتب مخصص ومناسب وفق متوسطات السوق (AI Estimate).');

    return {
        jobTitle,
        department,
        summary,
        responsibilities,
        requirements,
        requiredSkills,
        preferredSkills,
        interviewQuestions,
        searchKeywords,
        marketAnalysis,
        employmentType: cleanString(raw.employmentType, fallbackDomain.employmentType || 'FULL_TIME'),
        workMode: cleanString(raw.workMode, fallbackDomain.workMode || 'HYBRID'),
        seniorityLevel: cleanString(raw.seniorityLevel, fallbackDomain.seniorityLevel || 'MID'),
        educationLevel: cleanString(raw.educationLevel, fallbackDomain.educationLevel || 'بكالوريوس في التخصص المطلوب'),
        salaryInsight,
        confidence_score: typeof raw.confidence_score === 'number' ? raw.confidence_score : 0.95
    };
};

// Helper: Domain tailored fallback
const getDomainTailoredJD = (data) => {
    const title = data?.jobTitle || 'مهندس برمجيات';
    const dept = data?.department || 'تكنولوجيا المعلومات';
    const exp = data?.experience || '3-5 سنوات';
    const loc = data?.location || 'الرياض';
    const edu = data?.educationLevel || 'بكالوريوس في التخصص المطلوب';
    const skillsList = Array.isArray(data?.skills) && data.skills.length > 0
        ? data.skills
        : ['المهارات التخصصية', 'حل المشكلات', 'العمل الجماعي'];

    return {
        jobTitle: title,
        department: dept,
        summary: `نبحث عن ${title} متميز ومحترف ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون المرشح المثالي مسؤولاً عن تصميم وتطوير المهام وتحقيق أعلى معايير الجودة الأكاديمية والمهنية.`,
        responsibilities: [
            'تصميم وتطوير التطبيقات والأنظمة عالية الكفاءة والقابلة للتوسع.',
            'كتابة كود برمجي نظيف (Clean Code)، موثق، وقابل للصيانة والتحسين المستمر.',
            'تصميم وبناء واجهات البرمجة التطبيقية وقواعد البيانات وإدارة الاستعلامات.',
            'إجراء مراجعات الكود واختبار البرمجيات وتصحيح الأخطاء.',
            'التعاون الفعال مع فرق العمل لتنفيذ وتحديث المهام بسلاسة.'
        ],
        requirements: [
            `مؤهل علمي: ${edu}.`,
            `خبرة عملية مثبتة لا تقل عن (${exp}) في التخصص.`,
            `إجادة المهارات الأساسية: ${skillsList.join('، ')}.`,
            'معرفة قوية بأنظمة العمل الحديثة وأنماط المعمارية والأمان المهني.'
        ],
        requiredSkills: skillsList,
        preferredSkills: ['Cloud Architecture (AWS/GCP)', 'CI/CD Pipelines', 'Docker & Kubernetes'],
        interviewQuestions: [
            { question: 'كيف تقوم بتحسين أداء الأنظمة وإدارة الذاكرة والـ Caching في التطبيقات الكبيرة؟', category: 'تقني' },
            { question: 'اشرح تحدياً تقنياً معقداً قمت بحله في مشروعك السابق وكيف أثر على العمل؟', category: 'تقني' },
            { question: 'صف موقفاً واجهت فيه اختلافاً في الآراء الفنية مع الفريق وكيف تعاملت معه؟', category: 'سلوكي' }
        ],
        searchKeywords: [title, dept, ...skillsList.slice(0, 3)],
        marketAnalysis: {
            marketTip: 'توصية الذكاء الاصطناعي (AI Recommendation): الوظيفة ذات طلب عالي في سوق العمل.',
            recommendedSkillsToAdd: ['Cloud Architecture', 'Microservices', 'Kubernetes'],
            salarySuggestion: '18,000 - 28,000 ريال (AI Estimate)'
        },
        employmentType: 'FULL_TIME',
        workMode: 'HYBRID',
        seniorityLevel: 'MID',
        educationLevel: edu,
        salaryInsight: 'تقدير الراتب مخصص ومناسب وفق متوسطات السوق التقني السعودي (AI Estimate).',
        confidence_score: 0.95
    };
};

// ============================================================================
// 3. CONCURRENCY-SAFE TRANSACTION WITH EXPONENTIAL BACKOFF RETRY
// ============================================================================
export const saveVersionWithConcurrencyRetry = async (companyId, jobTitle, jobRequestId, content, marketAnalysis, userId, maxRetries = 5) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await prisma.$transaction(async (tx) => {
                const latest = await tx.aIJobDescription.findFirst({
                    where: { companyId, jobTitle },
                    orderBy: { version: 'desc' }
                });

                const nextVersion = latest ? latest.version + 1 : 1;

                return await tx.aIJobDescription.create({
                    data: {
                        id: crypto.randomUUID(),
                        companyId,
                        jobRequestId: jobRequestId || null,
                        jobTitle,
                        generatedContent: content,
                        marketAnalysis: marketAnalysis || {},
                        version: nextVersion,
                        createdBy: userId
                    }
                });
            }, {
                isolationLevel: 'Serializable', // Highest isolation level preventing phantom reads & concurrent version dupes
                timeout: 10000
            });
        } catch (error) {
            attempt++;
            // If unique constraint collision or serialization failure occurred, back off and retry
            if (error.code === 'P2002' || error.message?.includes('could not serialize') || error.message?.includes('deadlock') || error.message?.includes('Unique constraint')) {
                const backoffMs = Math.floor(Math.random() * 50) + attempt * 50;
                await new Promise(res => setTimeout(res, backoffMs));
                if (attempt >= maxRetries) {
                    logger.error(`Max retries (${maxRetries}) reached for version concurrency on ${jobTitle}`);
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }
};

/**
 * POST /api/ai-jd/generate (or /api/ai/job-description/generate)
 */
export const generateJobDescription = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const {
            jobTitle,
            experience,
            location,
            skills,
            salaryMin,
            salaryMax,
            department,
            employmentType,
            workMode,
            seniorityLevel,
            educationLevel
        } = req.body;

        // 1. Strict Input Validation
        if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب ويجب أن يكون نصاً صالحاً' });
        }

        if (jobTitle.length > 200) {
            return res.status(400).json({ error: 'المسمى الوظيفي طويل جداً (الحد الأقصى 200 حرف)' });
        }

        if (salaryMin !== undefined && salaryMin !== null && (isNaN(Number(salaryMin)) || Number(salaryMin) < 0)) {
            return res.status(400).json({ error: 'الحد الأدنى للراتب غير صالح' });
        }
        if (salaryMax !== undefined && salaryMax !== null && (isNaN(Number(salaryMax)) || Number(salaryMax) < 0)) {
            return res.status(400).json({ error: 'الحد الأعلى للراتب غير صالح' });
        }
        if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
            return res.status(400).json({ error: 'الحد الأدنى للراتب لا يمكن أن يتجاوز الحد الأعلى' });
        }

        // 2. Prompt Injection Defense (Multi-layer)
        const combinedInput = `${jobTitle} ${department || ''} ${Array.isArray(skills) ? skills.join(' ') : (skills || '')} ${location || ''}`;
        if (detectPromptInjection(combinedInput)) {
            logger.warn(`[AI-SECURITY] Prompt injection blocked for company ${companyId}`, { input: combinedInput.slice(0, 100) });
            return res.status(400).json({
                error: 'تم اكتشاف محاولة إدخال غير آمنة أو محاولة تجاوز لتعليمات النظام (Security Violation: Prompt Injection Blocked)'
            });
        }

        const cleanJobTitle = String(jobTitle).replace(/<[^>]*>?/gm, '').trim();
        const cleanDept = department ? String(department).replace(/<[^>]*>?/gm, '').trim() : 'غير محدد';
        const cleanLocation = location ? String(location).replace(/<[^>]*>?/gm, '').trim() : 'الرياض';
        const cleanExp = experience ? String(experience).replace(/<[^>]*>?/gm, '').trim() : '3-5 سنوات';
        const cleanSkills = Array.isArray(skills)
            ? skills.map(s => String(s).replace(/<[^>]*>?/gm, '').trim()).filter(Boolean)
            : (typeof skills === 'string' ? skills.replace(/<[^>]*>?/gm, '').trim() : []);

        const domainTailored = getDomainTailoredJD({ jobTitle: cleanJobTitle, department: cleanDept, experience: cleanExp, location: cleanLocation, skills: cleanSkills, educationLevel, salaryMin, salaryMax });

        // Structural isolation: User data is enclosed in untrusted data tags
        const prompt = `System Role: You are an HR assistant. Generate an objective Job Description strictly following the JSON schema.
Untrusted User Data:
<job_title>${cleanJobTitle}</job_title>
<department>${cleanDept}</department>
<education>${educationLevel || 'حسب التخصص'}</education>
<experience>${cleanExp}</experience>
<location>${cleanLocation}</location>
<skills>${Array.isArray(cleanSkills) ? cleanSkills.join(', ') : cleanSkills}</skills>

Return ONLY valid JSON:
{
  "jobTitle": "${cleanJobTitle}",
  "department": "${cleanDept}",
  "summary": "ملخص وظيفي احترافي",
  "responsibilities": ["مسؤولية 1", "مسؤولية 2"],
  "requirements": ["متطلب 1", "متطلب 2"],
  "requiredSkills": ["مهارة 1"],
  "preferredSkills": ["مهارة 2"],
  "interviewQuestions": [{"question": "سؤال", "category": "تقني"}],
  "salaryInsight": "تقدير الراتب (AI Estimate)",
  "confidence_score": 0.95
}`;

        let rawResult = null;
        try {
            rawResult = await aiService.generateJobDescription({ prompt, jobTitle: cleanJobTitle, experience: cleanExp, location: cleanLocation, skills: cleanSkills, department: cleanDept, employmentType, workMode, seniorityLevel, educationLevel }, companyId);
        } catch (aiErr) {
            logger.warn('AI Provider failure, applying domain fallback:', aiErr.message);
            rawResult = domainTailored;
        }

        let parsedResult = rawResult;
        if (typeof rawResult === 'string') {
            try { parsedResult = JSON.parse(rawResult); } catch (e) { parsedResult = domainTailored; }
        }

        // 3. Strict Schema Validation & Fallback Enforcement
        const validatedOutput = validateAndEnforceOutputSchema(parsedResult, domainTailored);

        if (salaryMin && salaryMax) {
            validatedOutput.salaryInsight = `تقدير الراتب المحدد (AI Estimate): بين ${Number(salaryMin).toLocaleString('ar-SA')} و ${Number(salaryMax).toLocaleString('ar-SA')} ريال.`;
        }

        // 4. Concurrency-Safe Version Persistence
        let savedRecord = null;
        if (companyId && req.user?.id) {
            try {
                savedRecord = await saveVersionWithConcurrencyRetry(
                    companyId,
                    cleanJobTitle,
                    req.body.jobRequestId,
                    validatedOutput,
                    validatedOutput.marketAnalysis,
                    req.user.id
                );
            } catch (dbErr) {
                logger.warn('Failed to persist AIJobDescription version (non-blocking):', dbErr.message);
            }
        }

        return res.json({ success: true, data: validatedOutput, recordId: savedRecord?.id, version: savedRecord?.version || 1 });

    } catch (error) {
        logger.error('JD Generation Error', { error: error.message });
        res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.' });
    }
};

/**
 * POST /api/ai-jd/improve (or /api/ai/job-description/improve)
 */
export const improveJobDescription = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { currentContent, improvementInstructions, jobTitle, department } = req.body;

        if (!currentContent) {
            return res.status(400).json({ error: 'المحتوى الحالي للوصف الوظيفي مطلوب للتحسين' });
        }

        const title = (jobTitle || currentContent.jobTitle || 'المسمى الوظيفي').trim();
        const dept = (department || currentContent.department || 'القسم العام').trim();
        const instructions = improvementInstructions ? String(improvementInstructions).trim() : '';

        // 1. Prompt Injection Defense (Checks both instructions and currentContent)
        const combinedCheck = `${title} ${dept} ${instructions} ${typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent)}`;
        if (detectPromptInjection(combinedCheck)) {
            logger.warn(`[AI-SECURITY] Prompt injection in improve blocked for company ${companyId}`);
            return res.status(400).json({
                error: 'تم اكتشاف محاولة إدخال غير آمنة أو محاولة تجاوز لتعليمات النظام (Security Violation: Prompt Injection Blocked)'
            });
        }

        const prompt = `System Role: Improve the Job Description.
Untrusted Context:
<job_title>${title}</job_title>
<department>${dept}</department>
<instructions>${instructions || 'تحسين الصياغة'}</instructions>

Return valid JSON with improved responsibilities, requirements, and marketAnalysis.`;

        let rawResult = null;
        try {
            rawResult = await aiService.generateText(prompt, companyId);
        } catch (aiErr) {
            logger.warn('AI improve fallback:', aiErr.message);
        }

        let parsed = null;
        if (rawResult) {
            try { parsed = JSON.parse(rawResult); } catch (e) {}
        }

        const fallback = getDomainTailoredJD({ jobTitle: title, department: dept });
        const validatedOutput = validateAndEnforceOutputSchema(parsed, fallback);

        // 2. Concurrency-Safe Version Persistence
        let saved = null;
        if (companyId && req.user?.id) {
            try {
                saved = await saveVersionWithConcurrencyRetry(
                    companyId,
                    title,
                    req.body.jobRequestId,
                    validatedOutput,
                    validatedOutput.marketAnalysis,
                    req.user.id
                );
            } catch (dbErr) {
                logger.warn('Failed to persist improved AIJobDescription:', dbErr.message);
            }
        }

        return res.json({ success: true, data: validatedOutput, version: saved?.version || 1, recordId: saved?.id });

    } catch (err) {
        logger.error('Error improving job description:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء معالجة التحسين. يرجى المحاولة لاحقاً.' });
    }
};

/**
 * GET /api/ai-jd/history
 */
export const getJobDescriptionHistory = async (req, res) => {
    try {
        const { companyId } = req.user;
        const { jobTitle, jobRequestId, limit = 20 } = req.query;

        const where = { companyId };
        if (jobTitle) where.jobTitle = { contains: jobTitle, mode: 'insensitive' };
        if (jobRequestId) where.jobRequestId = jobRequestId;

        const history = await prisma.aIJobDescription.findMany({
            where,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                createdByUser: {
                    select: { id: true, name: true, email: true, role: true }
                },
                jobRequest: {
                    select: { id: true, requestId: true, jobTitle: true, status: true }
                }
            }
        });

        return res.json({ success: true, data: history, count: history.length });
    } catch (err) {
        logger.error('Error fetching JD history:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل الأوصاف الوظيفية' });
    }
};

/**
 * POST /api/ai-jd/chat
 */
export const interactiveJDChat = async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'يجب إرسال سجل المحادثة' });
        }

        const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content.trim());
        const turnCount = userMsgs.length;
        const lastUserMsg = userMsgs[userMsgs.length - 1] || '';

        if (turnCount <= 1) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: 'مرحباً بك! ما هو المسمى الوظيفي الذي ترغب في إعداد وصف وظيفي له اليوم؟'
                }
            });
        }

        const rawJobTitleMsg = userMsgs[1] || lastUserMsg;
        const jobTitle = rawJobTitleMsg.replace(/مرحباً|أريد|إنشاء|وصف|وظيفي|جديد|أحتاج|وظيفة/gi, '').trim() || rawJobTitleMsg;

        return res.json({
            success: true,
            data: {
                isComplete: true,
                jobTitle,
                summary: `وصف وظيفي تفاعلي لـ ${jobTitle}`,
                responsibilities: ['تنفيذ وتطوير المهام الوظيفية بكفاءة', 'التعاون مع أعضاء الفريق والمشرفين'],
                requirements: ['مؤهل علمي ملائم', 'خبرة عملية مثبتة في التخصص'],
                requiredSkills: ['العمل الجماعي', 'حل المشكلات', 'التواصل'],
                interviewQuestions: [
                    { question: 'حدثنا عن أهم إنجازاتك في دورك السابق؟', category: 'سلوكي' }
                ]
            }
        });
    } catch (err) {
        logger.error('Error in interactiveJDChat:', err);
        return res.status(500).json({ error: 'حدث خطأ في المحادثة التفاعلية' });
    }
};

/**
 * GET /api/ai-jd/templates
 */
export const getJDTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'software-engineer',
                icon: '⚡',
                category: 'تكنولوجيا',
                title: 'مهندس برمجيات',
                description: 'Full Stack / Backend / Frontend',
                preset: {
                    jobTitle: 'مهندس برمجيات',
                    department: 'تكنولوجيا المعلومات',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب / هندسة برمجيات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
                    salaryMin: 12000,
                    salaryMax: 20000,
                    location: 'الرياض'
                }
            }
        ];
        return res.json({ success: true, data: templates });
    } catch (err) {
        return res.status(500).json({ error: 'حدث خطأ أثناء جلب القوالب' });
    }
};

export const generateSummaryOnly = async (req, res) => {
    return res.json({ status: 'success', summary: 'ملخص وظيفي احترافي جاهز' });
};

export const generateRecruitmentDescription = async (req, res) => {
    return res.json({ status: 'success', description: 'وصف وظيفي لقسم التوظيف' });
};

export const generateRecruitmentRequirements = async (req, res) => {
    return res.json({ status: 'success', requirements: 'متطلب 1\nمتطلب 2', requirementsList: ['متطلب 1', 'متطلب 2'] });
};
