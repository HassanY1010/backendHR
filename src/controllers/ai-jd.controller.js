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

        const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
        const lastUserMsg = userMsgs[userMsgs.length - 1] || '';
        const conversationText = messages.map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`).join('\n');

        // Check for immediate completion signals (or 2+ turns)
        const isForceComplete = 
            userMsgs.length >= 2 ||
            /لا شيء|لا شي|اكتب أنت|قم أنت|كمل أنت|يكفي|جاهز|توليد|أنشئ/i.test(lastUserMsg);

        // Smart extraction prompt
        const prompt = `أنت مساعد توظيف وموارد بشرية ذكي ومحترف.
قم بتحليل المحادثة التالية بين المستخدم والمساعد:

${conversationText}

التعليمات:
1. استخرج المعلومات التي ذكرها المستخدم (المسمى الوظيفي، القسم، سنوات الخبرة، المهارات، الموقع).
2. إذا تم تحديد المسمى الوظيفي ومرت إجابتان أو قال المستخدم "لا شيء" أو ما شابه ذلك، اجعل "isComplete": true.
3. إذا كانت "isComplete": false، حدد "nextQuestion": "سؤال محدد ومختصر لجمع معلومة واحدة إضافية".

أرجع JSON فقط بالهيكل التالي:
{
  "isComplete": true/false,
  "nextQuestion": "السؤال التالي أو null",
  "extractedData": {
    "jobTitle": "المسمى المستخرج أو مبرمج مواقع",
    "department": "القسم أو تكنولوجيا المعلومات",
    "experience": "الخبرة أو 3 سنوات",
    "location": "المدينة أو الرياض",
    "skills": ["مهارة 1", "مهارة 2"]
  }
}`;

        const aiRes = await aiService.generateJobDescription(prompt, companyId);

        let parsed = aiRes;
        if (typeof aiRes === 'string') {
            try { parsed = JSON.parse(aiRes); } catch (e) { parsed = {}; }
        }

        const isComplete = parsed?.isComplete || isForceComplete || (parsed?.extractedData?.jobTitle && userMsgs.length >= 2);

        if (isComplete || (parsed?.extractedData?.jobTitle && !parsed?.nextQuestion)) {
            const extracted = parsed?.extractedData || {};
            const jobTitle = extracted.jobTitle || lastUserMsg.replace(/مرحباً|أريد|إنشاء/g, '').trim() || 'مبرمج مواقع';
            const dept = extracted.department || 'تكنولوجيا المعلومات';

            const fullJD = await aiService.generateJobDescription({
                jobTitle,
                department: dept,
                experience: extracted.experience || '2-4 سنوات',
                location: extracted.location || 'الرياض',
                skills: extracted.skills || ['HTML5', 'CSS3', 'JavaScript', 'تطوير المواقع']
            }, companyId);

            return res.json({
                success: true,
                data: {
                    isComplete: true,
                    jobDescription: fullJD
                }
            });
        }

        // Return next question to continue chat
        const nextQ = parsed?.nextQuestion || 'ما هي أبرز المهارات أو التقنيات المطلوبة لهذه الوظيفة؟';

        return res.json({
            success: true,
            data: {
                isComplete: false,
                nextQuestion: nextQ
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
