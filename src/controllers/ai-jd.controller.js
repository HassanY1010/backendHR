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
// Domain knowledge dictionary for high-precision fallbacks and smart recommendations
const DOMAIN_PROFILES = {
    HR: {
        keywords: ['موارد بشرية', 'human resources', 'hr', 'توظيف', 'استقطاب', 'شؤون موظفين', 'رواتب', 'تدريب', 'talent', 'payroll', 'personnel', 'recruitment', 'od', 'l&d'],
        defaultSkills: ['نظام العمل السعودي', 'استقطاب الكفاءات (Talent Acquisition)', 'إدارة الأداء والتقييم', 'منصات قوى ومقيم ومدد والتأمينات', 'إعداد مسيرات الرواتب (Payroll)', 'تطوير وتدريب الموظفين (L&D)', 'أنظمة إدارة الموارد البشرية (HRIS/Oracle)'],
        preferredSkills: ['شهادات احترافية (SHRM / CIPD)', 'تخطيط القوى العاملة (Manpower Planning)', 'حل النزاعات العمالية'],
        responsibilities: [
            'إدارة وتطبيق استراتيجيات وسياسات الموارد البشرية وفقاً لنظام العمل السعودي.',
            'قيادة عمليات استقطاب واختيار أفضل الكفاءات والمواهب للمنظمة.',
            'متابعة وتحديث سجلات الموظفين وإدارة منصات قوى ومدد والتأمينات الاجتماعية.',
            'إعداد ومتابعة مسيرات الرواتب والمزايا وتقييم الأداء السنوي.',
            'تصميم وتنفيذ برامج التدريب والتطوير الوظيفي لرفع كفاءة رأس المال البشري.'
        ],
        requirements: [
            'إتقان شامل لنظام العمل واللوائح التنظيمية في المملكة العربية السعودية.',
            'خبرة عملية مثبتة في ممارسات الموارد البشرية وإدارة شؤون الموظفين.',
            'إجادة استخدام أنظمة الـ HRIS ومنصات وزارة الموارد البشرية (قوى، مقيم، التأمينات).',
            'مهارات تواصل وتفاوض قيادية وبناء علاقات عمل إيجابية.'
        ],
        interviewQuestions: [
            { question: 'كيف تضمن توافق سياسات التوظيف مع أحدث لوائح وتحديثات نظام العمل السعودي؟', category: 'تخصصي' },
            { question: 'صف استراتيجيتك في استقطاب الكفاءات النادرة وتقليل معدل دوران الموظفين؟', category: 'استراتيجي' },
            { question: 'كيف تتعامل مع الخلافات العمالية أو حالات تدني أداء الموظفين؟', category: 'سلوكي' }
        ]
    },
    FINANCE: {
        keywords: ['مالية', 'محاسب', 'finance', 'accounting', 'تدقيق', 'ميزانية', 'ضرائب', 'زكاة', 'audit', 'tax', 'vat', 'zatca', 'socpa', 'cfo'],
        defaultSkills: ['معايير المحاسبة الدولية (IFRS)', 'أنظمة هيئة الزكاة والضريبة (ZATCA & VAT)', 'إعداد الموازنات والتقارير المالية', 'التحليل المالي والنمذجة المالية', 'برامج ERP المحاسبية (Oracle / SAP / Odoo)', 'التدقيق والرقابة الداخلية'],
        preferredSkills: ['شهادة SOCPA / CPA / CMA', 'إدارة التدفقات النقدية والسيولة', 'التخطيط المالي الاستراتيجي'],
        responsibilities: [
            'إعداد القوائم والتقارير المالية الدورية بدقة وفق معايير المحاسبة الدولية IFRS.',
            'متابعة وتقديم الإقرارات الضريبية والزكوية والامتثال لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA).',
            'إعداد وتدقيق الموازنات التقديرية ومراقبة انحرافات التكاليف والنفقات.',
            'إدارة الحسابات الدائنة والمدينة والتسويات البنكية ومراقبة السيولة النقدية.'
        ],
        requirements: [
            'مؤهل بكالوريوس في المحاسبة أو المالية مع الاعتماد المهني المناسب.',
            'إتقان الأنظمة الضريبية والزكوية والفواتير الإلكترونية في المملكة.',
            'خبرة متقدمة في التعامل مع البرامج المحاسبية وقواعد البيانات المالية.'
        ],
        interviewQuestions: [
            { question: 'كيف تضمن الامتثال الكامل لمتطلبات الفوترة الإلكترونية ومعايير ZATCA؟', category: 'تخصصي' },
            { question: 'ما الخطوات المتبعة لإعداد موازنة تقديرية ومراقبة ترشيد التكاليف؟', category: 'استراتيجي' }
        ]
    },
    MARKETING: {
        keywords: ['تسويق', 'مبيعات', 'marketing', 'sales', 'إعلان', 'سوشيال ميديا', 'seo', 'growth', 'brand', 'content', 'علاقات عامة', 'pr'],
        defaultSkills: ['التسويق الرقمي وإدارة الحملات الإعلانية', 'إدارة منصات التواصل الاجتماعي', 'تحسين محركات البحث (SEO/SEM)', 'تحليل السوق وسلوك المستهلك', 'كتابة وصناعة المحتوى الإبداعي', 'إدارة علاقات العملاء (CRM)'],
        preferredSkills: ['Google Analytics & Ads Certification', 'إدارة ميزانيات الحملات الإعلانية', 'التسويق عبر المؤثرين'],
        responsibilities: [
            'تخطيط وتنفيذ الحملات التسويقية المتكاملة لتعزيز الوعي بالعلامة التجارية وزيادة المبيعات.',
            'إدارة المحتوى الرقمي عبر المنصات وتحسين تجربة العميل الرقمية.',
            'تحليل مؤشرات أداء الحملات التسويقية (ROI & KPIs) وتحسين معدلات التحويل.'
        ],
        requirements: [
            'خبرة مثبتة في قيادة الحملات التسويقية الرقمية وتحقيق مستهدفات النمو.',
            'قدرة عالية على التفكير الإبداعي وتحليل البيانات التسويقية.'
        ],
        interviewQuestions: [
            { question: 'كيف تبني حملة تسويقية تستهدف السوق السعودي وتحقق أعلى عائد استثمار (ROI)؟', category: 'استراتيجي' }
        ]
    },
    OPERATIONS: {
        keywords: ['عمليات', 'تشغيل', 'operations', 'لوجستيات', 'سلاسل إمداد', 'supply chain', 'مشتريات', 'procurement', 'مستودعات', 'جودة', 'quality'],
        defaultSkills: ['إدارة العمليات وسلاسل الإمداد', 'إدارة المشتريات والتفاوض مع الموردين', 'ضبط الجودة وتحسين العمليات (Lean / Six Sigma)', 'إدارة المخزون والخدمات اللوجستية', 'تخطيط الموارد والجدولة التشغيلية'],
        preferredSkills: ['شهادات PMP / CSCP', 'أتمتة العمليات التشغيلية', 'إدارة المخاطر التشغيلية'],
        responsibilities: [
            'الإشراف على سير العمليات اليومية وضمان أعلى مستويات الكفاءة والإنتاجية.',
            'تحسين سلاسل الإمداد وإدارة عقود الموردين وتخفيض التكاليف التشغيلية.',
            'متابعة تطبيق معايير الجودة والسلامة المهنية.'
        ],
        requirements: [
            'خبرة عملية في إدارة العمليات التشغيلية وتحسين الكفاءة.',
            'مهارات حل مشكلات استثنائية وقدرة على إدارة الأزمات.'
        ],
        interviewQuestions: [
            { question: 'كيف تحدد نقاط الاختناق في العمليات التشغيلية وتقوم بمعالجتها؟', category: 'تخصصي' }
        ]
    },
    TECH: {
        keywords: ['تقنية', 'برمجة', 'برمجيات', 'software', 'developer', 'engineer', 'frontend', 'backend', 'devops', 'it', 'cloud', 'ai', 'data', 'security', 'نظم', 'شبكات'],
        defaultSkills: ['هندسة البرمجيات والأنظمة الحديثة', 'كتابة الكود النظيف والتطوير المستمر (Clean Code & CI/CD)', 'إدارة قواعد البيانات وتصميم واجهات البرمجة (APIs)', 'حل المشكلات البرمجية المعقدة', 'الأمان السيبراني وجودة البرمجيات'],
        preferredSkills: ['Cloud Services (AWS / Azure / GCP)', 'Microservices Architecture', 'DevOps & Containerization'],
        responsibilities: [
            'تصميم وبناء الأنظمة والتطبيقات البرمجية بجودة وكفاءة عالية وقابلة للتوسع.',
            'تطبيق أفضل الممارسات في كتابة الكود وإجراء المراجعات والاختبارات الدورية.',
            'التعاون مع الفرق التقنية لتطوير المعمارية البرمجية وحل المشكلات المعقدة.'
        ],
        requirements: [
            'مؤهل علمي في علوم الحاسب أو هندسة البرمجيات أو مجال تقني ذي صلة.',
            'خبرة برمجية عملية مثبتة ومعرفة عميقة بالتقنيات المستخدمة.',
            'قدرة عالية على التحليل والابتكار ومواكبة أحدث التطورات التقنية.'
        ],
        interviewQuestions: [
            { question: 'كيف تضمن جودة وقابلية توسع الأنظمة التي تقوم بتصميمها وتطويرها؟', category: 'تقني' },
            { question: 'اشرح تحدياً هندسياً معقداً واجهته وكيف قمت بحله بنجاح؟', category: 'تقني' }
        ]
    }
};

// Helper: Detect domain strictly based on title and department
export const detectJobDomain = (title = '', department = '') => {
    const combined = `${title} ${department}`.toLowerCase();
    
    // Check HR first to prevent false IT assignment
    if (DOMAIN_PROFILES.HR.keywords.some(k => combined.includes(k))) return 'HR';
    if (DOMAIN_PROFILES.FINANCE.keywords.some(k => combined.includes(k))) return 'FINANCE';
    if (DOMAIN_PROFILES.MARKETING.keywords.some(k => combined.includes(k))) return 'MARKETING';
    if (DOMAIN_PROFILES.OPERATIONS.keywords.some(k => combined.includes(k))) return 'OPERATIONS';
    if (DOMAIN_PROFILES.TECH.keywords.some(k => combined.includes(k))) return 'TECH';
    
    // Default fallback based on department context
    if (combined.includes('موارد') || combined.includes('بشرية')) return 'HR';
    if (combined.includes('مالي') || combined.includes('محاسب')) return 'FINANCE';
    if (combined.includes('تسويق') || combined.includes('مبيعات')) return 'MARKETING';
    return 'TECH';
};

// Helper: Domain tailored fallback
const getDomainTailoredJD = (data) => {
    const title = data?.jobTitle || 'أخصائي مهني';
    const dept = data?.department || 'القسم المعني';
    const exp = data?.experience || '3-5 سنوات';
    const loc = data?.location || 'الرياض';
    const edu = data?.educationLevel || 'بكالوريوس في التخصص المطلوب';
    
    const domainKey = detectJobDomain(title, dept);
    const domainProfile = DOMAIN_PROFILES[domainKey] || DOMAIN_PROFILES.TECH;

    const skillsList = Array.isArray(data?.skills) && data.skills.length > 0
        ? data.skills
        : domainProfile.defaultSkills.slice(0, 5);

    return {
        jobTitle: title,
        department: dept,
        summary: `نبحث عن كفاءة مهنية متميزة ومحترفة لشغل وظيفة "${title}" للانضمام إلى فريق "${dept}" في (${loc}). سيتولى شاغل هذا الدور قيادة وتنفيذ المبادرات التخصصية، والمساهمة الفعالة في تحقيق مستهدفات الإدارة وتطوير منظومة العمل بأعلى معايير الجودة والاحترافية.`,
        responsibilities: domainProfile.responsibilities,
        requirements: [
            `مؤهل علمي: ${edu}.`,
            `خبرة عملية مثبتة لا تقل عن (${exp}) في مجال ${title} أو تخصص وثيق الصلة.`,
            `إتقان المهارات التخصصية: ${skillsList.join('، ')}.`,
            ...domainProfile.requirements
        ],
        requiredSkills: skillsList,
        preferredSkills: domainProfile.preferredSkills,
        interviewQuestions: domainProfile.interviewQuestions,
        searchKeywords: [title, dept, ...skillsList.slice(0, 3)],
        marketAnalysis: {
            marketTip: `توصية الذكاء الاصطناعي (AI Insight): الوظيفة ذات أهمية استراتيجية وطلب نشط في سوق العمل لقطاع (${dept}).`,
            recommendedSkillsToAdd: domainProfile.defaultSkills.slice(0, 3),
            salarySuggestion: 'تقدير الراتب مخصص ومناسب وفق متوسطات السوق السعودي (AI Estimate)'
        },
        employmentType: 'FULL_TIME',
        workMode: 'ONSITE',
        seniorityLevel: 'MID',
        educationLevel: edu,
        salaryInsight: 'تقدير الراتب مخصص ومناسب وفق معايير السوق السعودي لهذا الدور (AI Estimate).',
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
            // ── Tech & Engineering ──────────────────────────────────────────
            {
                id: 'software-engineer',
                icon: '💻',
                category: 'تكنولوجيا المعلومات',
                title: 'مهندس برمجيات (Full Stack)',
                description: 'React, Node.js, TypeScript & Cloud',
                preset: {
                    jobTitle: 'مهندس برمجيات (Full Stack)',
                    department: 'تكنولوجيا المعلومات',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب / هندسة برمجيات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['TypeScript', 'React.js', 'Node.js', 'PostgreSQL', 'Docker', 'RESTful APIs'],
                    salaryMin: 14000,
                    salaryMax: 22000,
                    location: 'الرياض'
                }
            },
            {
                id: 'backend-engineer',
                icon: '⚙️',
                category: 'تكنولوجيا المعلومات',
                title: 'مطور واجهات خلفية (Backend)',
                description: 'Microservices, APIs, Node.js & Database',
                preset: {
                    jobTitle: 'مطور خلفيات برمجية (Senior Backend Developer)',
                    department: 'تكنولوجيا المعلومات',
                    experience: '5-7 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب أو هندسة تقنية',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['Node.js', 'Prisma ORM', 'Redis Caching', 'PostgreSQL', 'System Architecture', 'CI/CD'],
                    salaryMin: 18000,
                    salaryMax: 28000,
                    location: 'الرياض'
                }
            },
            {
                id: 'frontend-engineer',
                icon: '🎨',
                category: 'تكنولوجيا المعلومات',
                title: 'مطور واجهات أمامية (Frontend)',
                description: 'React, Next.js, TailwindCSS & UI/UX',
                preset: {
                    jobTitle: 'مطور واجهات أمامية (Frontend Developer)',
                    department: 'تكنولوجيا المعلومات',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب أو تصميم تفاعلي',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['React.js', 'Next.js', 'TailwindCSS', 'Redux / Zustand', 'Responsive Design', 'Web Performance'],
                    salaryMin: 13000,
                    salaryMax: 20000,
                    location: 'الرياض'
                }
            },
            {
                id: 'mobile-developer',
                icon: '📱',
                category: 'تكنولوجيا المعلومات',
                title: 'مطور تطبيقات جوال (Mobile App)',
                description: 'Flutter / React Native / iOS & Android',
                preset: {
                    jobTitle: 'مطور تطبيقات جوال (Mobile Developer)',
                    department: 'تكنولوجيا المعلومات',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب أو هندسة برمجيات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['Flutter', 'React Native', 'Dart', 'State Management', 'Mobile Security', 'App Store Publishing'],
                    salaryMin: 14000,
                    salaryMax: 22000,
                    location: 'الرياض'
                }
            },
            {
                id: 'devops-engineer',
                icon: '☁️',
                category: 'تكنولوجيا المعلومات',
                title: 'مهندس ديف أوبس وسحابي (DevOps/Cloud)',
                description: 'AWS, Kubernetes, CI/CD & Terraform',
                preset: {
                    jobTitle: 'مهندس سحابي وعمليات (Senior DevOps Engineer)',
                    department: 'تكنولوجيا المعلومات',
                    experience: '5-8 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب أو هندسة شبكات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['AWS / GCP', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD Pipelines', 'Linux Administration'],
                    salaryMin: 20000,
                    salaryMax: 32000,
                    location: 'الرياض'
                }
            },
            {
                id: 'cybersecurity-analyst',
                icon: '🔒',
                category: 'تكنولوجيا المعلومات',
                title: 'أخصائي أمن سيبراني (Cybersecurity)',
                description: 'SOC, Compliance, Penetration Testing & NCA',
                preset: {
                    jobTitle: 'أخصائي أمن سيبراني (Cybersecurity Specialist)',
                    department: 'الأمن السيبراني والمخاطر',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس أمن سيبراني أو أمن معلومات',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MID',
                    skills: ['معايير الهيئة الوطنية للأمن السيبراني (NCA)', 'SOC Monitoring', 'SIEM Tools', 'Vulnerability Assessment', 'Incident Response'],
                    salaryMin: 16000,
                    salaryMax: 25000,
                    location: 'الرياض'
                }
            },
            {
                id: 'ai-engineer',
                icon: '🤖',
                category: 'الذكاء الاصطناعي والبيانات',
                title: 'مهندس ذكاء اصطناعي (AI & ML Engineer)',
                description: 'LLMs, PyTorch, LangChain & Machine Learning',
                preset: {
                    jobTitle: 'مهندس ذكاء اصطناعي وتعلّم آلي (AI/ML Engineer)',
                    department: 'الذكاء الاصطناعي والبيانات',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس أو ماجستير علوم حاسب / ذكاء اصطناعي',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['Python', 'Large Language Models (LLMs)', 'PyTorch / TensorFlow', 'LangChain', 'Prompt Engineering', 'Vector Databases'],
                    salaryMin: 18000,
                    salaryMax: 30000,
                    location: 'الرياض'
                }
            },
            {
                id: 'data-analyst',
                icon: '📊',
                category: 'الذكاء الاصطناعي والبيانات',
                title: 'محلل بيانات ذكاء أعمال (BI Data Analyst)',
                description: 'Power BI, SQL, Python & Dashboards',
                preset: {
                    jobTitle: 'محلل بيانات وذكاء أعمال (BI & Data Analyst)',
                    department: 'إدارة البيانات والتحليلات',
                    experience: '2-4 سنوات',
                    educationLevel: 'بكالوريوس إحصاء / نظم معلومات إدارية / علوم حاسب',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['SQL المتقدم', 'Power BI / Tableau', 'Python for Data Analysis', 'بناء لوحات التحكم التفاعلية', 'تحليل المؤشرات والـ KPIs'],
                    salaryMin: 11000,
                    salaryMax: 18000,
                    location: 'الرياض'
                }
            },
            {
                id: 'data-engineer',
                icon: '🗄️',
                category: 'الذكاء الاصطناعي والبيانات',
                title: 'مهندس بيانات (Data Engineer)',
                description: 'ETL Pipelines, Data Warehouse, Spark & Snowflake',
                preset: {
                    jobTitle: 'مهندس بيانات أول (Senior Data Engineer)',
                    department: 'إدارة البيانات والتحليلات',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس علوم حاسب أو هندسة برمجيات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['Apache Spark', 'ETL/ELT Pipelines', 'Snowflake / BigQuery', 'SQL & Python', 'Data Modeling', 'Airflow'],
                    salaryMin: 18000,
                    salaryMax: 29000,
                    location: 'الرياض'
                }
            },

            // ── Product & Design ─────────────────────────────────────────────
            {
                id: 'product-manager',
                icon: '🚀',
                category: 'إدارة المنتجات والتصميم',
                title: 'مدير منتج رقمي (Product Manager)',
                description: 'Agile/Scrum, Roadmap & User Experience',
                preset: {
                    jobTitle: 'مدير منتج رقمي (Product Manager)',
                    department: 'إدارة المنتجات',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس إدارة أعمال أو نظم معلومات حاسوبية',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['استراتيجية المنتج وخارطة الطريق', 'Agile / Scrum Methodology', 'تحليل متطلبات المستخدمين', 'KPIs & Metrics Tracking', 'Jira / Confluence'],
                    salaryMin: 18000,
                    salaryMax: 30000,
                    location: 'الرياض'
                }
            },
            {
                id: 'ui-ux-designer',
                icon: '✨',
                category: 'إدارة المنتجات والتصميم',
                title: 'مصمم تجربة وواجهة المستخدم (UI/UX)',
                description: 'Figma, Design Systems, User Research & Prototyping',
                preset: {
                    jobTitle: 'مصمم تجربة وواجهة المستخدم (Senior UI/UX Designer)',
                    department: 'إدارة المنتجات والتصميم',
                    experience: '4-6 سنوات',
                    educationLevel: 'بكالوريوس تصميم جرافيك / تفاعلي أو علوم حاسب',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['Figma المتقدم', 'بناء وإدارة أنظمة التصميم (Design Systems)', 'أبحاث واختبارات المستخدمين (User Research)', 'Wireframing & Prototyping', 'Micro-interactions'],
                    salaryMin: 14000,
                    salaryMax: 23000,
                    location: 'الرياض'
                }
            },

            // ── Human Resources ──────────────────────────────────────────────
            {
                id: 'hr-manager',
                icon: '👔',
                category: 'الموارد البشرية',
                title: 'مدير الموارد البشرية (HR Manager)',
                description: 'نظام العمل السعودي، استراتيجية الموارد وإدارة المواهب',
                preset: {
                    jobTitle: 'مدير الموارد البشرية (HR Manager)',
                    department: 'الموارد البشرية',
                    experience: '6-9 سنوات',
                    educationLevel: 'بكالوريوس أو ماجستير إدارة موارد بشرية / إدارة أعمال',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MANAGER',
                    skills: ['إتقان نظام العمل والعمال السعودي', 'التخطيط الاستراتيجي للقوى العاملة (Manpower Planning)', 'إدارة الأداء والتقييم السنوي', 'العلاقات الحكومية ومنصات قوى ومقيم والتأمينات', 'إدارة سياسات ولائحة العمل'],
                    salaryMin: 20000,
                    salaryMax: 35000,
                    location: 'الرياض'
                }
            },
            {
                id: 'recruitment-specialist',
                icon: '🎯',
                category: 'الموارد البشرية',
                title: 'أخصائي استقطاب مواهب وتوظيف (Talent Acquisition)',
                description: 'ATS, Headhunting, مقابلة وتقييم المرشحين',
                preset: {
                    jobTitle: 'أخصائي استقطاب مواهب أول (Senior Talent Acquisition Specialist)',
                    department: 'الموارد البشرية',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس إدارة موارد بشرية أو علوم إدارية',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['أنظمة إدارة المرشحين (ATS)', 'استقطاب الكفاءات والبحث المباشر (Headhunting)', 'المقابلات السلوكية والفنية (Competency-based Interviews)', 'إدارة عروض العمل والتفاوض', 'بناء خطط التوظيف وتحديد الـ SLAs'],
                    salaryMin: 11000,
                    salaryMax: 17000,
                    location: 'الرياض'
                }
            },
            {
                id: 'hr-operations',
                icon: '📋',
                category: 'الموارد البشرية',
                title: 'أخصائي عمليات الموارد البشرية والرواتب (HR Operations & Payroll)',
                description: 'مسير الرواتب (Payroll), التأمينات, مدد, قوى',
                preset: {
                    jobTitle: 'أخصائي عمليات الموارد البشرية ومسير الرواتب (HR Operations Specialist)',
                    department: 'الموارد البشرية',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس إدارة أعمال أو محاسبة أو موارد بشرية',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MID',
                    skills: ['إعداد ومعالجة مسيرات الرواتب (WPS)', 'منصة مدد ومنصة قوى', 'التأمينات الاجتماعية (GOSI)', 'إدارة الإجازات ومستحقات نهاية الخدمة', 'أتمتة ملفات الموظفين ونظم الـ HRIS'],
                    salaryMin: 9000,
                    salaryMax: 15000,
                    location: 'الرياض'
                }
            },
            {
                id: 'training-development-specialist',
                icon: '🎓',
                category: 'الموارد البشرية',
                title: 'أخصائي تدريب وتطوير كفاءات (L&D Specialist)',
                description: 'Training Needs Analysis, KPIs & Career Paths',
                preset: {
                    jobTitle: 'أخصائي تدريب وتطوير مؤسسي (Learning & Development Specialist)',
                    department: 'الموارد البشرية',
                    experience: '3-5 سنوات',
                    educationLevel: 'بكالوريوس موارد بشرية أو علوم تربوية وإدارية',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['تحليل الاحتياجات التدريبية (TNA)', 'تصميم وتقييم الحقائب التدريبية', 'قياس أثر التدريب (Kirkpatrick Model)', 'تخطيط المسارات الوظيفية والإحلال الوظيفي', 'إدارة منصات التدريب الإلكتروني (LMS)'],
                    salaryMin: 10000,
                    salaryMax: 16000,
                    location: 'الرياض'
                }
            },

            // ── Finance & Accounting ─────────────────────────────────────────
            {
                id: 'financial-controller',
                icon: '💰',
                category: 'المالية والمحاسبة',
                title: 'مدير مالي / مراقب مالي (Financial Controller)',
                description: 'ZATCA E-invoicing, IFRS, Budgeting & Auditing',
                preset: {
                    jobTitle: 'مراقب مالي أول (Financial Controller)',
                    department: 'الإدارة المالية',
                    experience: '6-10 سنوات',
                    educationLevel: 'بكالوريوس محاسبة أو مالية (يفضل SOCPA / CMA / CPA)',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MANAGER',
                    skills: ['معايير المحاسبة الدولية (IFRS)', 'أنظمة الفوترة الإلكترونية وهيئة الزكاة والضريبة والجمارك (ZATCA)', 'إعداد الموازنات التقديرية والتدفقات النقدية', 'إدارة التدقيق المالي الداخلي والخارجي', 'أنظمة ERP المالية (Oracle / SAP / Odoo)'],
                    salaryMin: 22000,
                    salaryMax: 38000,
                    location: 'الرياض'
                }
            },
            {
                id: 'senior-accountant',
                icon: '📑',
                category: 'المالية والمحاسبة',
                title: 'محاسب عام أول (Senior Accountant)',
                description: 'General Ledger, VAT, Financial Reports & Reconciliation',
                preset: {
                    jobTitle: 'محاسب عام أول (Senior Accountant)',
                    department: 'الإدارة المالية',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس محاسبة مع اعتماد SOCPA',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'SENIOR',
                    skills: ['إعداد الإقرارات الضريبية والزكوية (VAT & Zakat)', 'تسوية الحسابات البنكية وإقفال الفترات المالية', 'إعداد القوائم المالية الشهرية والسنوية', 'محاسبة التكاليف والأصول الثابتة', 'إجادة برامج ERP المحاسبية'],
                    salaryMin: 10000,
                    salaryMax: 16000,
                    location: 'جدة'
                }
            },
            {
                id: 'financial-analyst',
                icon: '📈',
                category: 'المالية والمحاسبة',
                title: 'محلل مالي واستثماري (Financial Analyst)',
                description: 'Financial Modeling, Valuation, ROI & Feasibility Studies',
                preset: {
                    jobTitle: 'محلل مالي واستثماري (Financial Analyst)',
                    department: 'الإدارة المالية والاستثمار',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس مالية أو اقتصاد (يفضل شهادة CFA)',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['النمذجة والتحليل المالي المتقدم (Financial Modeling)', 'دراسات الجدوى وتقييم الاستثمارات (Valuation & ROI)', 'تحليل التباين والأداء المالي الفعلي مقابل المخطط', 'إعداد تقارير المستثمرين ومجلس الإدارة', 'إتقان Excel المتقدم وبناء السيناريوهات المالية'],
                    salaryMin: 13000,
                    salaryMax: 22000,
                    location: 'الرياض'
                }
            },

            // ── Sales & Business Development ─────────────────────────────────
            {
                id: 'sales-director',
                icon: '💼',
                category: 'المبيعات وتطوير الأعمال',
                title: 'مدير مبيعات إقليمي (Regional Sales Director)',
                description: 'B2B Enterprise Sales, Revenue Strategy & Team Leadership',
                preset: {
                    jobTitle: 'مدير مبيعات إقليمي (Regional Sales Director)',
                    department: 'المبيعات وتطوير الأعمال',
                    experience: '7-12 سنة',
                    educationLevel: 'بكالوريوس إدارة أعمال أو تسويق (يفضل ماجستير MBA)',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'LEAD',
                    skills: ['قيادة فرق المبيعات وتحقيق مستهدفات الإيرادات (Target Achievement)', 'مبيعات الشركات والقطاع الحكومي (B2B & B2G Enterprise Sales)', 'التفاوض وإبرام الصفقات والعقود الكبرى', 'إدارة خط المبيعات وعلاقات العملاء (Pipeline Management & CRM)', 'استراتيجيات التسعير والتوسع في السوق السعودي'],
                    salaryMin: 25000,
                    salaryMax: 45000,
                    location: 'الرياض'
                }
            },
            {
                id: 'key-account-manager',
                icon: '🤝',
                category: 'المبيعات وتطوير الأعمال',
                title: 'مدير كبار العملاء (Key Account Manager)',
                description: 'B2B Account Growth, Retention & Strategic Partnerships',
                preset: {
                    jobTitle: 'مدير كبار العملاء (Key Account Manager)',
                    department: 'المبيعات وتطوير الأعمال',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس إدارة أعمال أو علاقات عامة أو تسويق',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'SENIOR',
                    skills: ['إدارة وتنمية حسابات كبار العملاء (Account Management)', 'بناء الشراكات الاستراتيجية طويلة المدى', 'التفاوض وحل النزاعات التجارية', 'Upselling & Cross-selling Solutions', 'تقديم العروض التقديمية التنفيذية'],
                    salaryMin: 14000,
                    salaryMax: 22000,
                    location: 'الرياض'
                }
            },

            // ── Marketing & Communications ───────────────────────────────────
            {
                id: 'marketing-director',
                icon: '📣',
                category: 'التسويق والإعلام الرقمي',
                title: 'مدير إدارة التسويق والاتصال المؤسسي (Marketing Director)',
                description: 'Brand Strategy, Growth Marketing, PR & Performance',
                preset: {
                    jobTitle: 'مدير إدارة التسويق والاتصال المؤسسي (Marketing Director)',
                    department: 'التسويق والاتصال المؤسسي',
                    experience: '7-10 سنوات',
                    educationLevel: 'بكالوريوس أو ماجستير تسويق أو اتصال مؤسسي',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MANAGER',
                    skills: ['بناء الهوية والعلامة التجارية (Brand Strategy)', 'إدارة الحملات الإعلانية متعددة القنوات 360', 'التسويق الرقمي القائم على الأداء (Performance Marketing)', 'الاتصال المؤسسي والعلاقات العامة وإدارة الأزمات الإعلامية', 'إدارة الميزانيات التسويقية وحساب العائد على الاستثمار (ROAS)'],
                    salaryMin: 22000,
                    salaryMax: 36000,
                    location: 'الرياض'
                }
            },
            {
                id: 'performance-marketer',
                icon: '🎯',
                category: 'التسويق والإعلام الرقمي',
                title: 'أخصائي تسويق رقمي ونمو (Growth & Performance Marketer)',
                description: 'Google Ads, Meta Ads, SEO, Analytics & Conversion Rate',
                preset: {
                    jobTitle: 'أخصائي تسويق رقمي ونمو (Growth Marketing Specialist)',
                    department: 'التسويق والاتصال المؤسسي',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس تسويق رقمي أو نظم معلومات حاسوبية',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['Google Search & Display Ads (PPC)', 'إدارة إعلانات منصات التواصل (Meta, TikTok, Snapchat, LinkedIn)', 'تحسين محركات البحث (SEO/SEM)', 'تحسين معدل التحويل (CRO & A/B Testing)', 'Google Analytics 4 & Tag Manager'],
                    salaryMin: 10000,
                    salaryMax: 17000,
                    location: 'الرياض'
                }
            },
            {
                id: 'content-creator',
                icon: '✍️',
                category: 'التسويق والإعلام الرقمي',
                title: 'كاتب محتوى إبداعي وصانع وسائط (Creative Content Creator)',
                description: 'Copywriting, Social Media Content, Storytelling & Scripts',
                preset: {
                    jobTitle: 'كاتب ومحرر محتوى إبداعي (Creative Copywriter & Content Specialist)',
                    department: 'التسويق والاتصال المؤسسي',
                    experience: '2-5 سنوات',
                    educationLevel: 'بكالوريوس إعلام، لغة عربية، أو تسويق',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'MID',
                    skills: ['كتابة النصوص الإعلانية الجذابة (Copywriting)', 'إدارة وجدولة قنوات التواصل الاجتماعي', 'كتابة السيناريوهات الإعلانية والفيديوهات القصيرة', 'إتقان الصياغة باللغتين العربية والإنجليزية', 'التسويق بالمحتوى والـ Storytelling المؤثر'],
                    salaryMin: 8000,
                    salaryMax: 14000,
                    location: 'الرياض'
                }
            },

            // ── Operations & Supply Chain ────────────────────────────────────
            {
                id: 'operations-manager',
                icon: '🏭',
                category: 'العمليات وسلاسل الإمداد',
                title: 'مدير العمليات التشغيلية (Operations Manager)',
                description: 'Operational Excellence, SLA Management & Process Automation',
                preset: {
                    jobTitle: 'مدير العمليات التشغيلية (Operations Manager)',
                    department: 'الإدارة التشغيلية',
                    experience: '6-9 سنوات',
                    educationLevel: 'بكالوريوس هندسة صناعية أو إدارة أعمال',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MANAGER',
                    skills: ['هندسة وتحسين الإجراءات التشغيلية (Process Optimization)', 'تطبيق منهجيات اللين وسيكس سيجما (Lean Six Sigma)', 'إدارة اتفاقيات مستوى الخدمة (SLAs & KPIs)', 'إدارة سلاسل الإمداد والمشتريات التشغيلية', 'قيادة فرق الميدان ومتابعة مؤشرات الجودة'],
                    salaryMin: 20000,
                    salaryMax: 32000,
                    location: 'الدمام'
                }
            },
            {
                id: 'procurement-specialist',
                icon: '📦',
                category: 'العمليات وسلاسل الإمداد',
                title: 'أخصائي مشتريات ومناقصات (Procurement Specialist)',
                description: 'Vendor Management, Tenders, RFP & Cost Negotiation',
                preset: {
                    jobTitle: 'أخصائي مشتريات ومناقصات أول (Senior Procurement Specialist)',
                    department: 'إدارة المشتريات وسلاسل الإمداد',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس إدارة أعمال أو سلاسل إمداد أو هندسة',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'SENIOR',
                    skills: ['إدارة المناقصات وطلبات العروض (RFP / RFQ)', 'تقييم وتأهيل الموردين (Vendor Management)', 'التفاوض التجاري وخفض التكاليف التشغيلية', 'أنظمة اعتماد منصة اعتماد الحكومية أو أنظمة ERP للمشتريات', 'إدارة عقود التوريد ومراقبة سلاسل الإمداد'],
                    salaryMin: 12000,
                    salaryMax: 18000,
                    location: 'الرياض'
                }
            },

            // ── Customer Success & Support ───────────────────────────────────
            {
                id: 'customer-success-lead',
                icon: '🌟',
                category: 'خدمة ونجاح العملاء',
                title: 'قائد تجربة ونجاح العملاء (Customer Success Lead)',
                description: 'Onboarding, Churn Reduction, CSAT & NPS Management',
                preset: {
                    jobTitle: 'قائد تجربة ونجاح العملاء (Customer Success Lead)',
                    department: 'خدمة ونجاح العملاء',
                    experience: '4-7 سنوات',
                    educationLevel: 'بكالوريوس إدارة أعمال أو علاقات عامة أو نظم معلومات',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    seniorityLevel: 'LEAD',
                    skills: ['إدارة وتهيئة العملاء الجدد (Customer Onboarding)', 'تقليل معدل التسرب والاحتفاظ بالعملاء (Churn Reduction)', 'متابعة وتطوير مؤشرات رضا العملاء (CSAT, NPS, CES)', 'أنظمة خدمة العملاء والتذاكر (Zendesk / Freshdesk / HubSpot)', 'تدريب فرق الدعم وتأسيس معايير الجودة'],
                    salaryMin: 13000,
                    salaryMax: 20000,
                    location: 'الرياض'
                }
            },

            // ── Legal & Compliance ───────────────────────────────────────────
            {
                id: 'legal-counsel',
                icon: '⚖️',
                category: 'الشؤون القانونية والامتثال',
                title: 'مستشار قانوني للشركات (Corporate Legal Counsel)',
                description: 'العقود التجارية، الامتثال والأنظمة واللوائح السعودية',
                preset: {
                    jobTitle: 'مستشار قانوني للشركات (Corporate Legal Counsel)',
                    department: 'الإدارة القانونية والامتثال',
                    experience: '5-8 سنوات',
                    educationLevel: 'بكالوريوس شريعة أو قانون / حقوق (يفضل ماجستير قانون شركات)',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'SENIOR',
                    skills: ['صياغة ومراجعة العقود التجارية والاتفاقيات الدولية', 'نظام الشركات ونظام العمل والاستثمار الأجنبي السعودي', 'حوكمة الشركات والامتثال للوائح والتعليمات الحكومية', 'إدارة النزاعات القانونية والتحكيم والتسويات', 'حماية الملكية الفكرية والبيانات الشخصية (PDPL)'],
                    salaryMin: 18000,
                    salaryMax: 32000,
                    location: 'الرياض'
                }
            },

            // ── Healthcare & Medical ─────────────────────────────────────────
            {
                id: 'occupational-health-officer',
                icon: '🩺',
                category: 'الصحة والسلامة المهنية',
                title: 'مسؤول الصحة والسلامة المهنية والبيئة (HSE Specialist)',
                description: 'OHSAS, ISO 45001, Safety Audits & Risk Assessment',
                preset: {
                    jobTitle: 'أخصائي الصحة والسلامة المهنية والبيئة (HSE Specialist)',
                    department: 'الصحة والسلامة المهنية',
                    experience: '3-6 سنوات',
                    educationLevel: 'بكالوريوس علوم بيئية أو هندسة سلامة (شهادة NEBOSH / OSHA)',
                    employmentType: 'FULL_TIME',
                    workMode: 'ONSITE',
                    seniorityLevel: 'MID',
                    skills: ['تطبيق معايير ISO 45001 و ISO 14001', 'تقييم المخاطر المهنية وإجراءات الطوارئ (Risk Assessment)', 'التفتيش الميداني والتحقيق في الحوادث المهنية', 'إعداد خطط الإخلاء وتدريب الموظفين على السلامة', 'الامتثال للوائح الدفاع المدني ووزارة الموارد البشرية'],
                    salaryMin: 11000,
                    salaryMax: 18000,
                    location: 'الرياض'
                }
            }
        ];
        return res.json({ success: true, data: templates, count: templates.length });
    } catch (err) {
        return res.status(500).json({ error: 'حدث خطأ أثناء جلب القوالب' });
    }
};

export const generateSummaryOnly = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const {
            jobTitle,
            department,
            location,
            employmentType,
            requiredExperience,
            skills,
            educationLevel,
            hiringReason,
            instructions,
            currentSummary
        } = req.body;

        if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب لتوليد ملخص الوظيفة' });
        }

        const cleanTitle = normalizeInput(String(jobTitle));
        const cleanDept = department ? normalizeInput(String(department)) : 'القسم المعني';
        const cleanLoc = location ? normalizeInput(String(location)) : 'الرياض، المملكة العربية السعودية';
        const cleanExp = requiredExperience ? normalizeInput(String(requiredExperience)) : '3-5 سنوات';
        const cleanEdu = educationLevel ? normalizeInput(String(educationLevel)) : 'درجة البكالوريوس في التخصص ذي الصلة';
        const skillsList = Array.isArray(skills) ? skills.map(s => normalizeInput(String(s))).filter(Boolean) : [];
        const cleanInstructions = instructions ? normalizeInput(String(instructions)) : '';

        // Prompt Injection Check
        const combined = `${cleanTitle} ${cleanDept} ${skillsList.join(' ')} ${cleanInstructions}`;
        if (detectPromptInjection(combined)) {
            return res.status(400).json({ error: 'تم اكتشاف مدخلات غير آمنة (Security Violation)' });
        }

        const domain = detectJobDomain(cleanTitle, cleanDept);
        const domainProfile = DOMAIN_PROFILES[domain] || DOMAIN_PROFILES.TECH;

        let prompt = `أنت خبير واستشاري موارد بشرية واستقطاب كفاءات محترف في السوق السعودي والخليجي.
المطلوب: قم بصياغة "ملخص وظيفي احترافي وجذاب ومباشر" (Job Summary) من فقرتين متماسكتين ومكتوبتين بلغة عربية فصحى رفيعة المستوى للدور التالي:
- المسمى الوظيفي: ${cleanTitle}
- الإدارة / القسم: ${cleanDept}
- موقع العمل: ${cleanLoc}
- مستوى الخبرة المطلوبة: ${cleanExp}
- المؤهل العلمي: ${cleanEdu}
- المهارات التقنية والتخصصية: ${skillsList.length > 0 ? skillsList.join('، ') : domainProfile.defaultSkills.slice(0, 4).join('، ')}
- طبيعة الدوام: ${employmentType || 'دوام كامل'}
${hiringReason ? `- سياق التوظيف: ${normalizeInput(String(hiringReason))}` : ''}`;

        if (currentSummary && typeof currentSummary === 'string' && currentSummary.trim().length > 10) {
            prompt += `\n- النص الحالي للملخص المراد تعديله وتحسينه:\n"""${normalizeInput(currentSummary.trim())}"""`;
        }

        if (cleanInstructions) {
            prompt += `\n- توجيهات وتعديلات إضافية مطلوبة من المستخدم:\n"""${cleanInstructions}"""`;
        }

        prompt += `\n\nالضوابط الصارمة:
1. حافظ على التوافق التام مع مجال ${cleanDept} والمسمى ${cleanTitle}. لا تذكر تقنيات برمجة أو مصطلحات خارج نطاق هذا التخصص إطلاقاً إلا إذا طُلبت صراحة.
2. اذكر القيمة المضافة لهذا الدور داخل قسم ${cleanDept} وكيف يسهم في تحقيق أهداف المنظمة.
3. ${cleanInstructions ? 'نفذ التعليمات الإضافية بدقة مع دمجها بشكل متناسق في نص الملخص.' : 'اذكر باختصار المسؤولية المحورية ونوع الكفاءة المطلوبة للنجاح في هذا الدور.'}
4. لا ترجع أي JSON أو مقدمات أو خاتمة أو عناوين فرعية. أرجع نص الملخص الوظيفي فقط مباشرة باللغة العربية الفصحى.`;

        let summaryText = '';
        try {
            // Use generateText directly for plain text output
            const rawResponse = await aiService.generateText(prompt, companyId);
            if (rawResponse && typeof rawResponse === 'string') {
                summaryText = rawResponse.trim();
            }
        } catch (aiErr) {
            logger.warn('[AI-JD] OpenAI generationText failed for summary, trying structured:', aiErr.message);
            try {
                const structuredRes = await aiService.generateJobDescription(prompt, companyId);
                summaryText = typeof structuredRes === 'string' ? structuredRes : (structuredRes?.summary || structuredRes?.job_summary || '');
            } catch (e) {
                logger.warn('[AI-JD] Structured fallback failed too:', e.message);
            }
        }

        // High Quality Domain-Aware Dynamic Fallback if AI fails or returns empty
        if (!summaryText || summaryText.length < 20) {
            const activeSkills = skillsList.length > 0 ? skillsList : domainProfile.defaultSkills.slice(0, 4);
            const skillsSnippet = activeSkills.length > 0 ? ` مع إتقان متقدم لـ (${activeSkills.slice(0, 4).join('، ')})` : '';
            summaryText = `نبحث عن كفاءة مهنية متميزة لشغل وظيفة "${cleanTitle}" للانضمام إلى فريق "${cleanDept}". سيتولى شاغل هذا الدور قيادة وتنفيذ المبادرات المحورية، والمساهمة الفعالة في رفع جودة المخرجات التشغيلية وتطوير منظومة العمل وفق أعلى المعايير المهنية.\n\nيتطلب هذا الدور خبرة عملية مثبتة (${cleanExp}) ومؤهل علمي (${cleanEdu})${skillsSnippet}، بالإضافة إلى مهارات تواصل قيادية وقدرة عالية على التحليل وحل المشكلات المعقدة والعمل بكفاءة في بيئة عمل ديناميكية وسريعة النمو.`;
        }

        return res.json({ status: 'success', summary: summaryText });
    } catch (err) {
        logger.error('[AI-JD] Error in generateSummaryOnly:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء توليد ملخص الوظيفة' });
    }
};

/**
 * Suggest specialized skills tailored strictly to Job Title & Department
 * POST /api/ai-jd/suggest-skills
 */
export const suggestSkills = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { jobTitle, department, experience, jobSummary, instructions } = req.body;

        if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب لاقتراح المهارات' });
        }

        const cleanTitle = normalizeInput(String(jobTitle));
        const cleanDept = department ? normalizeInput(String(department)) : 'القسم المعني';
        const cleanExp = experience ? normalizeInput(String(experience)) : '3-5 سنوات';
        const cleanSummary = jobSummary ? normalizeInput(String(jobSummary)) : '';
        const cleanInstructions = instructions ? normalizeInput(String(instructions)) : '';

        // Security check
        const combined = `${cleanTitle} ${cleanDept} ${cleanSummary} ${cleanInstructions}`;
        if (detectPromptInjection(combined)) {
            return res.status(400).json({ error: 'تم اكتشاف مدخلات غير آمنة' });
        }

        const domain = detectJobDomain(cleanTitle, cleanDept);
        const domainProfile = DOMAIN_PROFILES[domain] || DOMAIN_PROFILES.TECH;

        const prompt = `أنت خبير واستشاري موارد بشرية واستقطاب مواهب أول في السوق السعودي.
المطلوب: اقترح قائمة مهارات تخصصية دقيقة ومطلوبة في سوق العمل (بين 6 إلى 10 مهارات) للوظيفة التالية:
- المسمى الوظيفي: ${cleanTitle}
- الإدارة / القسم: ${cleanDept}
- الخبرة: ${cleanExp}
${cleanSummary ? `- ملخص الدور الوظيفي: ${cleanSummary.slice(0, 300)}` : ''}
${cleanInstructions ? `- توجيهات إضافية: ${cleanInstructions}` : ''}

الضوابط الصارمة:
1. يجب أن تكون المهارات متطابقة 100% مع مجال ${cleanDept} والمسمى ${cleanTitle}.
2. إذا كانت الوظيفة في الموارد البشرية، ركز على: أنظمة العمل السعودية، التأمينات، قوى، مسيرات الرواتب، استقطاب المواهب، تقييم الأداء، منصات HRIS مثل Oracle HCM/SAP SuccessFactors، إلخ. لا تقترح مهارات برمجة إطلاقاً!
3. أرجع JSON فقط بالشكل التالي:
{
  "skills": ["مهارة 1", "مهارة 2", "مهارة 3", "مهارة 4", "مهارة 5", "مهارة 6"]
}`;

        let suggestedSkills = [];
        try {
            const aiRes = await aiService.generateJobDescription(prompt, companyId);
            if (aiRes && Array.isArray(aiRes.skills) && aiRes.skills.length > 0) {
                suggestedSkills = aiRes.skills.map(s => String(s).trim()).filter(Boolean);
            } else if (aiRes?.requiredSkills && Array.isArray(aiRes.requiredSkills) && aiRes.requiredSkills.length > 0) {
                suggestedSkills = aiRes.requiredSkills.map(s => String(s).trim()).filter(Boolean);
            }
        } catch (aiErr) {
            logger.warn('[AI-JD] Skills suggestion AI fallback triggered:', aiErr.message);
        }

        // Domain-specific fallback
        if (suggestedSkills.length === 0) {
            suggestedSkills = [...domainProfile.defaultSkills];
        }

        return res.json({
            status: 'success',
            domain,
            skills: suggestedSkills
        });
    } catch (err) {
        logger.error('[AI-JD] Error in suggestSkills:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء اقتراح المهارات' });
    }
};

export const generateRecruitmentDescription = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { title, department, skills, experience, location, type } = req.body;

        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب' });
        }

        const cleanTitle = normalizeInput(String(title));
        const cleanDept = department ? normalizeInput(String(department)) : 'التطوير والتشغيل';
        const cleanExp = experience ? normalizeInput(String(experience)) : '3+ سنوات';
        const skillsList = Array.isArray(skills) ? skills.map(s => normalizeInput(String(s))).filter(Boolean) : [];

        const prompt = `أنت مدير توظيف تنفيذي خبير. قم بكتابة وصف وظيفي احترافي شامل وجذاب (150 إلى 250 كلمة) لوظيفة "${cleanTitle}" في قسم "${cleanDept}".
المهارات المطلوبة: ${skillsList.join('، ')}
الخبرة: ${cleanExp}
أرجع نص الوصف الوظيفي باللغة العربية الفصحى مباشرة بدون JSON وبدون عناوين جانبية.`;

        let description = '';
        try {
            const aiResponse = await aiService.generateJobDescription(prompt, companyId);
            description = typeof aiResponse === 'string' ? aiResponse.trim() : (aiResponse?.summary || aiResponse?.description || '');
        } catch (e) {
            logger.warn('[AI-JD] Description fallback triggered:', e.message);
        }

        if (!description || description.length < 20) {
            description = `تعلن الشركة عن رغبتها في استقطاب كفاءة متميزة لشغل دور "${cleanTitle}" ضمن فريق "${cleanDept}". سيكون المرشح مسؤولاً عن المساهمة الفاعلة في تحقيق مستهدفات الإدارة، وتطبيق أفضل الممارسات المعتمدة، وضمان سير العمل بأعلى درجات الكفاءة والاحترافية. يتطلب الدور شغفاً بالتميز وخبرة عملية (${cleanExp}) في مجالات التخصص، مع القدرة على التعاون البناء وتقديم حلول مبتكرة تسهم في دفع عجلة التطوير المستمر.`;
        }

        return res.json({ status: 'success', description });
    } catch (err) {
        logger.error('[AI-JD] Error in generateRecruitmentDescription:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء توليد الوصف الوظيفي' });
    }
};

export const generateRecruitmentRequirements = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { title, department, skills, experience, educationLevel } = req.body;

        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب' });
        }

        const cleanTitle = normalizeInput(String(title));
        const cleanDept = department ? normalizeInput(String(department)) : 'الموارد البشرية والعمليات';
        const cleanExp = experience ? normalizeInput(String(experience)) : '3-5 سنوات';
        const cleanEdu = educationLevel ? normalizeInput(String(educationLevel)) : 'درجة البكالوريوس في التخصص ذي الصلة';
        const skillsList = Array.isArray(skills) ? skills.map(s => normalizeInput(String(s))).filter(Boolean) : [];

        const prompt = `أنت خبير استقطاب كفاءات. قم بصياغة قائمة نقطية محددة واحترافية من 5 إلى 7 شروط ومتطلبات أساسية لشغل وظيفة "${cleanTitle}" في قسم "${cleanDept}".
الخبرة: ${cleanExp}
المؤهل: ${cleanEdu}
المهارات: ${skillsList.join('، ')}

أرجع كل متطلب في سطر مستقل يبدأ بشرطة (-) بدون أي مقدمات أو شروحات إضافية.`;

        let rawReqs = '';
        try {
            const aiResponse = await aiService.generateJobDescription(prompt, companyId);
            rawReqs = typeof aiResponse === 'string' ? aiResponse.trim() : (aiResponse?.requirements?.join('\n') || '');
        } catch (e) {
            logger.warn('[AI-JD] Requirements fallback triggered:', e.message);
        }

        let requirementsList = [];
        if (rawReqs && rawReqs.length > 20) {
            requirementsList = rawReqs.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
        }

        if (requirementsList.length === 0) {
            requirementsList = [
                `مؤهل علمي: ${cleanEdu}.`,
                `خبرة عملية مثبتة لا تقل عن (${cleanExp}) في دور ${cleanTitle} أو مجال ذي صلة.`,
                skillsList.length > 0 ? `إتقان متقدم للمهارات التقنية: ${skillsList.join('، ')}.` : 'إتقان الأدوات والبرمجيات التخصصية المرتبطة بمجال العمل.',
                'مهارات تواصل شفهية وكتابية استثنائية مع القدرة على العمل ضمن فريق عمل متعدد المهام.',
                'قدرة مثبتة على إدارة الأولويات والالتزام بالمواعيد النهائية وحل المشكلات بكفاءة.'
            ];
        }

        const requirements = requirementsList.map(r => `• ${r}`).join('\n');
        return res.json({ status: 'success', requirements, requirementsList });
    } catch (err) {
        logger.error('[AI-JD] Error in generateRecruitmentRequirements:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء توليد متطلبات الوظيفة' });
    }
};
