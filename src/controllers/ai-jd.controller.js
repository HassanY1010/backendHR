import { aiService } from '../ai/ai-service.js';
import logger from '../utils/logger.js';

// ============================================================================
// AI Job Description Controller
// ============================================================================

/**
 * POST /api/ai-jd/generate
 * One-shot JD generation from structured form data
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
            seniorityLevel
        } = req.body;

        if (!jobTitle) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب' });
        }

        const prompt = `أنت خبير موارد بشرية محترف. قم بإنشاء وصف وظيفي احترافي وشامل باللغة العربية بناءً على المعلومات التالية:

المسمى الوظيفي: ${jobTitle}
القسم / الإدارة: ${department || 'غير محدد'}
سنوات الخبرة المطلوبة: ${experience || 'غير محدد'}
الموقع الجغرافي: ${location || 'الرياض'}
نوع التوظيف: ${employmentType || 'دوام كامل'}
طريقة العمل: ${workMode || 'مكتب'}
مستوى الأقدمية: ${seniorityLevel || 'غير محدد'}
المهارات المطلوبة: ${Array.isArray(skills) ? skills.join('، ') : (skills || 'غير محدد')}
نطاق الراتب: ${salaryMin && salaryMax ? `${salaryMin} - ${salaryMax} ريال` : 'حسب الكفاءة'}

أرجع JSON بالهيكل التالي بالضبط:
{
  "jobTitle": "المسمى الوظيفي",
  "summary": "ملخص وظيفي احترافي فقرة كاملة",
  "responsibilities": ["مسؤولية 1", "مسؤولية 2", "..."],
  "requirements": ["متطلب 1", "متطلب 2", "..."],
  "requiredSkills": ["مهارة 1", "مهارة 2", "..."],
  "preferredSkills": ["مهارة مفضلة 1", "..."],
  "interviewQuestions": [
    { "question": "سؤال المقابلة 1", "category": "تقني" },
    { "question": "سؤال المقابلة 2", "category": "سلوكي" },
    { "question": "سؤال المقابلة 3", "category": "استراتيجي" },
    { "question": "سؤال المقابلة 4", "category": "تقني" },
    { "question": "سؤال المقابلة 5", "category": "قيادي" }
  ],
  "salaryInsight": "تحليل مختصر لمدى تنافسية الراتب في السوق",
  "employmentType": "${employmentType || 'FULL_TIME'}",
  "workMode": "${workMode || 'ONSITE'}",
  "seniorityLevel": "${seniorityLevel || 'MID'}",
  "confidence_score": 0.95
}`;

        const result = await aiService.generateJobDescription({ prompt, jobTitle, experience, location, skills, department }, companyId);

        // Try to parse as structured if it's a simple string response
        if (result && typeof result === 'object' && result.job_summary) {
            // Old format — remap
            return res.json({
                success: true,
                data: {
                    jobTitle: jobTitle,
                    summary: result.job_summary || result.full_details || '',
                    responsibilities: [],
                    requirements: [],
                    requiredSkills: Array.isArray(skills) ? skills : [],
                    preferredSkills: [],
                    interviewQuestions: [],
                    salaryInsight: '',
                    confidence_score: 0.85
                }
            });
        }

        return res.json({ success: true, data: result });

    } catch (error) {
        logger.error('JD Generation Error', { error: error.message });
        res.status(500).json({ error: 'فشل توليد الوصف الوظيفي. تأكد من إعداد مفتاح OpenAI.' });
    }
};

/**
 * POST /api/ai-jd/chat
 * Interactive multi-turn conversation for JD creation
 */
export const interactiveJDChat = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'يجب إرسال سجل المحادثة' });
        }

        // ── Extract collected info from conversation history ──────────────────
        const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
        const conversationText = messages.map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`).join('\n');

        // ── Build a smart system prompt that handles the full conversation ─────
        const systemPrompt = `أنت مساعد متخصص في إنشاء الأوصاف الوظيفية الاحترافية.
مهمتك هي جمع المعلومات التالية من المستخدم بشكل تفاعلي ثم توليد الوصف الوظيفي:

1. المسمى الوظيفي
2. القسم / الإدارة
3. سنوات الخبرة المطلوبة
4. الموقع الجغرافي
5. المهارات الأساسية المطلوبة

قواعد مهمة:
- اطرح سؤالاً واحداً فقط في كل رد، وكن محدداً ومختصراً
- إذا قدّم المستخدم معلومة غير كافية (مثل "لا شيء" أو "غير محدد")، استخدم قيمة افتراضية منطقية ولا تسأل مرة أخرى
- بعد جمع المسمى الوظيفي والقسم والخبرة فقط، يمكنك البدء بالتوليد مباشرة
- إذا قال المستخدم "اكتب أنت" أو "أضف أنت" أو أي عبارة تدل على أنه يريد منك الاكتمال، قم بتوليد الوصف فوراً باستخدام ما جمعته
- عندما تكون جاهزاً لتوليد الوصف، أعد JSON بالشكل التالي فقط، لا تضف أي نص قبله أو بعده:
GENERATE_JD:{"jobTitle":"...","department":"...","experience":"...","location":"...","skills":["..."]}

المحادثة حتى الآن:
${conversationText}`;

        // ── Send to OpenAI ────────────────────────────────────────────────────
        const aiMessages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messages[messages.length - 1].content }
        ];

        const rawResponse = await aiService.generateJobDescription(
            { prompt: systemPrompt, isChat: true, chatMessages: aiMessages },
            companyId
        );

        // Handle case where aiService returns structured object vs string
        let responseText = '';
        if (typeof rawResponse === 'string') {
            responseText = rawResponse;
        } else if (rawResponse?.summary || rawResponse?.jobTitle) {
            // Already a full JD — return it directly
            return res.json({ success: true, data: { jobDescription: rawResponse, isComplete: true } });
        } else {
            responseText = JSON.stringify(rawResponse);
        }

        // ── Check if AI decided to generate the JD ────────────────────────────
        if (responseText.includes('GENERATE_JD:')) {
            const match = responseText.match(/GENERATE_JD:(\{.*\})/s);
            if (match) {
                const params = JSON.parse(match[1]);
                const jdPrompt = `أنت خبير موارد بشرية محترف. قم بإنشاء وصف وظيفي احترافي وشامل باللغة العربية بناءً على المعلومات التالية:

المسمى الوظيفي: ${params.jobTitle}
القسم / الإدارة: ${params.department || 'غير محدد'}
سنوات الخبرة: ${params.experience || 'غير محدد'}
الموقع: ${params.location || 'الرياض'}
المهارات: ${Array.isArray(params.skills) ? params.skills.join('، ') : (params.skills || 'حسب المتطلبات')}

أرجع JSON بالهيكل التالي بالضبط:
{
  "jobTitle": "المسمى الوظيفي",
  "summary": "ملخص وظيفي احترافي فقرة كاملة",
  "responsibilities": ["مسؤولية 1", "مسؤولية 2", "مسؤولية 3", "مسؤولية 4", "مسؤولية 5"],
  "requirements": ["متطلب 1", "متطلب 2", "متطلب 3"],
  "requiredSkills": ["مهارة 1", "مهارة 2", "مهارة 3"],
  "preferredSkills": ["مهارة مفضلة 1", "مهارة مفضلة 2"],
  "interviewQuestions": [
    { "question": "سؤال 1", "category": "تقني" },
    { "question": "سؤال 2", "category": "سلوكي" },
    { "question": "سؤال 3", "category": "استراتيجي" },
    { "question": "سؤال 4", "category": "تقني" },
    { "question": "سؤال 5", "category": "قيادي" }
  ],
  "salaryInsight": "تحليل مختصر لتنافسية الراتب في السوق",
  "employmentType": "FULL_TIME",
  "workMode": "ONSITE",
  "seniorityLevel": "MID",
  "confidence_score": 0.92
}`;

                const jdResult = await aiService.generateJobDescription(
                    { prompt: jdPrompt, ...params },
                    companyId
                );
                return res.json({ success: true, data: { jobDescription: jdResult, isComplete: true } });
            }
        }

        // ── Not yet ready — return next question ──────────────────────────────
        // Clean up the response text
        const nextQuestion = responseText
            .replace(/^(المساعد:|Assistant:)\s*/i, '')
            .trim();

        return res.json({
            success: true,
            data: {
                nextQuestion: nextQuestion || 'هل يمكنك إخباري بالمسمى الوظيفي الذي تريد إنشاء وصفه؟',
                isComplete: false
            }
        });

    } catch (error) {
        logger.error('Interactive JD Chat Error', { error: error.message });
        res.status(500).json({ error: 'خطأ في المحادثة التفاعلية.' });
    }
};


/**
 * GET /api/ai-jd/templates
 * Return pre-built JD templates for common roles
 */
export const getJDTemplates = async (req, res) => {
    const templates = [
        {
            id: 'software-engineer',
            icon: '⚡',
            category: 'تكنولوجيا',
            title: 'مهندس برمجيات',
            description: 'Full Stack / Backend / Frontend Developer',
            preset: {
                jobTitle: 'مهندس برمجيات',
                department: 'تكنولوجيا المعلومات',
                experience: '3-5 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                seniorityLevel: 'MID',
                skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
                salaryMin: 12000,
                salaryMax: 20000,
                location: 'الرياض'
            }
        },
        {
            id: 'hr-specialist',
            icon: '👥',
            category: 'موارد بشرية',
            title: 'أخصائي موارد بشرية',
            description: 'HR Generalist / Recruitment Specialist',
            preset: {
                jobTitle: 'أخصائي موارد بشرية',
                department: 'الموارد البشرية',
                experience: '2-4 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'ONSITE',
                seniorityLevel: 'MID',
                skills: ['استقطاب المواهب', 'إدارة الأداء', 'نظم الموارد البشرية', 'التواصل'],
                salaryMin: 8000,
                salaryMax: 14000,
                location: 'الرياض'
            }
        },
        {
            id: 'data-analyst',
            icon: '📊',
            category: 'تحليل البيانات',
            title: 'محلل بيانات',
            description: 'Data Analyst / Business Intelligence',
            preset: {
                jobTitle: 'محلل بيانات',
                department: 'تكنولوجيا المعلومات',
                experience: '2-4 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                seniorityLevel: 'MID',
                skills: ['Python', 'SQL', 'Power BI', 'Excel المتقدم', 'التحليل الإحصائي'],
                salaryMin: 10000,
                salaryMax: 18000,
                location: 'الرياض'
            }
        },
        {
            id: 'product-manager',
            icon: '🚀',
            category: 'إدارة المنتج',
            title: 'مدير المنتج',
            description: 'Product Manager / Product Owner',
            preset: {
                jobTitle: 'مدير منتج',
                department: 'إدارة المنتج',
                experience: '5-8 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                seniorityLevel: 'SENIOR',
                skills: ['استراتيجية المنتج', 'Agile / Scrum', 'تحليل السوق', 'تجربة المستخدم'],
                salaryMin: 18000,
                salaryMax: 30000,
                location: 'الرياض'
            }
        },
        {
            id: 'sales-manager',
            icon: '💼',
            category: 'مبيعات',
            title: 'مدير مبيعات',
            description: 'Sales Manager / Business Development',
            preset: {
                jobTitle: 'مدير مبيعات',
                department: 'التسويق والمبيعات',
                experience: '5-7 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'ONSITE',
                seniorityLevel: 'SENIOR',
                skills: ['إدارة فريق المبيعات', 'CRM', 'تطوير الأعمال', 'التفاوض'],
                salaryMin: 15000,
                salaryMax: 25000,
                location: 'جدة'
            }
        },
        {
            id: 'marketing-specialist',
            icon: '📣',
            category: 'تسويق',
            title: 'أخصائي تسويق رقمي',
            description: 'Digital Marketing / Social Media',
            preset: {
                jobTitle: 'أخصائي تسويق رقمي',
                department: 'التسويق والمبيعات',
                experience: '2-4 سنوات',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                seniorityLevel: 'MID',
                skills: ['Google Ads', 'Meta Ads', 'SEO/SEM', 'تحليلات التسويق', 'إنشاء المحتوى'],
                salaryMin: 8000,
                salaryMax: 14000,
                location: 'الرياض'
            }
        }
    ];

    res.json({ success: true, data: templates });
};
