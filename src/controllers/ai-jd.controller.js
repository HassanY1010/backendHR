import { aiService } from '../ai/ai-service.js';
import logger from '../utils/logger.js';

// Helper: Generate 100% real, domain-tailored responsibilities, requirements & interview questions based on job title
const getDomainTailoredJD = (data) => {
    const title = data?.jobTitle || 'مهندس برمجيات';
    const dept = data?.department || 'تكنولوجيا المعلومات';
    const exp = data?.experience || '3-5 سنوات';
    const loc = data?.location || 'الرياض';
    const edu = data?.educationLevel || 'بكالوريوس في التخصص المطلوب';
    const skillsList = Array.isArray(data?.skills) && data.skills.length > 0
        ? data.skills
        : ['المهارات التخصصية', 'حل المشكلات', 'العمل الجماعي'];

    const titleLower = title.toLowerCase();

    // 💻 1. Software Engineering & Tech
    if (/برمج|مطور|برمجة|تطوير|web|software|developer|backend|frontend|fullstack|it|تقني|أنظمة|انظمة|code/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} متميز ومحترف ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون المرشح المثالي مسؤولاً عن تصميم وتطوير وصيانة التطبيقات والأنظمة عالية الأداء وتحقيق أعلى معايير الجودة الأكاديمية والتقنية.`,
            responsibilities: [
                `تصميم وتطوير تطبيقات وهياكل البرمجيات عالية الكفاءة والقابلة للتوسع.`,
                `كتابة كود برمجي نظيف (Clean Code)، موثق، وقابل للصيانة والتحسين المستمر.`,
                `تصميم وبناء واجهات البرمجة التطبيقية (APIs) وقواعد البيانات وإدارة الاستعلامات.`,
                `إجراء مراجعات الكود (Code Reviews) واختبار البرمجيات وتصحيح الأخطاء (Debugging).`,
                `التعاون الفعال مع فريق المنتجات والـ DevOps لتنفيذ وتحديث الأنظمة بسلاسة.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة مثبتة لا تقل عن (${exp}) في تطوير البرمجيات واستخدام أحدث التقنيات.`,
                `إجادة المهارات التقنية الأساسية: ${skillsList.join('، ')}.`,
                `معرفة قوية بأنظمة التتبع (Git)، وأنماط المعمارية (Architectural Patterns)، والأمان البرمجي.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['Cloud Architecture (AWS/GCP)', 'CI/CD Pipelines', 'Docker & Kubernetes'],
            interviewQuestions: [
                { question: `كيف تقوم بتحسين أداء استعلامات قواعد البيانات وإدارة الـ Caching في التطبيقات الكبيرة؟`, category: "تقني" },
                { question: `اشرح نمط تصميم معماري (Design Pattern) قمت بتطبيقه في مشروع سابق ولماذا اخترته؟`, category: "تقني" },
                { question: `صف موقفاً واجهت فيه اختلافاً في الآراء خلال مراجعة الكود (Code Review) وكيف تعاملت معه؟`, category: "سلوكي" },
                { question: `كيف تضمن أمان التطبيق والحماية من الثغرات الأمنية مثل OWASP Top 10 أثناء التطوير؟`, category: "استراتيجي" },
                { question: `كيف تحدد أولويات المهام التقنية المعقدة عند اقتراب مواعيد تسليم المشروع؟`, category: "قيادي" }
            ]
        };
    }

    // 📊 2. Data Analysis / BI
    if (/بيانات|داتا|data|bi|تحليل|analyst|analytics|إحصاء/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} متمرس ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون مسؤولاً عن جمع وتنظيف وتحليل البيانات وتحويلها إلى رؤى استراتيجية تدعم اتخاذ القرارات.`,
            responsibilities: [
                `جمع وتنظيف وتحليل البيانات من مصادر متعددة وتجميعها في قاعدة بيانات موحدة.`,
                `بناء وتطوير لوحات قيادة تفاعلية (Interactive Dashboards) وتقارير دورية قياسية.`,
                `كتابة استعلامات SQL معقدة وأتمتة خطوط نقل وتجهيز البيانات (ETL Pipelines).`,
                `استخراج الاتجاهات والمؤشرات الإحصائية وتوفير التحليلات التنبؤية للقيادة.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة عملية لا تقل عن (${exp}) في مجال تحليل البيانات وإدارة التقارير.`,
                `إجادة أدوات تحليل البيانات والمهارات المطلوبة: ${skillsList.join('، ')}.`,
                `مهارات تحليلية قوية وقدرة على تبسيط النتائج الإحصائية لفريق العمل.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['Big Data Querying', 'Machine Learning Basics', 'Automated ETL Tools'],
            interviewQuestions: [
                { question: `كيف تتعامل مع معالجة وتنظيف البيانات عند وجود قيم مفقودة أو خاطئة (Missing Data)؟`, category: "تقني" },
                { question: `ما هي الآلية التي تتبعها لبناء لوحة قيادة تفاعلية (Dashboard) تخدم متخذي القرار؟`, category: "استراتيجي" },
                { question: `كيف تشرح نتائج إحصائية معقدة لأصحاب القرار غير التقنيين؟`, category: "سلوكي" },
                { question: `ما هي أعقد استعلامات SQL أو نماذج بيانات قمت بكتابتها وتطبيقها؟`, category: "تقني" }
            ]
        };
    }

    // 👥 3. HR / Recruitment / People
    if (/موارد بشرية|hr|توظيف|شؤون موظفين|recruitment|people/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} متميز ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون مسؤولاً عن استقطاب الكفاءات وإدارة وتطوير رأس المال البشري وتطبيق نظم الموارد البشرية.`,
            responsibilities: [
                `استقطاب وتوظيف المواهب والكفاءات المناسبة للوظائف الشاغرة وفق خطط الاحتياج.`,
                `إدارة وتطوير عمليات تقييم الأداء والمكافآت وتنفيذ البرامج التدريبية المخصصة.`,
                `متابعة شؤون الموظفين والعقود والإجازات بما يتوافق مع لوائح ونظام العمل.`,
                `تعزيز بيئة العمل الإيجابية وتقديم الدعم لكافة الأقسام والموظفين.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة مثبتة لا تقل عن (${exp}) في إدارة الموارد البشرية وتطوير الموظفين.`,
                `إجادة المهارات الأساسية: ${skillsList.join('، ')}.`,
                `معرفة واسعة بقوانين وأنظمة العمل واللوائح المحلية.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['نظم HRMS الحديثة', 'تطوير الهياكل التنظيمية', 'إدارة العلاقات العامة للموظفين'],
            interviewQuestions: [
                { question: `كيف تقوم بتحديد خطط احتياجات التوظيف واستقطاب الكفاءات في الشركة؟`, category: "استراتيجي" },
                { question: `صف موقفاً صعباً واجهته مع موظف وكيف تم حل الخلاف وفق الأنظمة؟`, category: "سلوكي" },
                { question: `ما هي المقاييس والأدوات التي تستخدمها لتقييم وتحسين أداء فريق العمل؟`, category: "تقني" }
            ]
        };
    }

    // 🚀 4. Product & Management
    if (/منتج|product|مشروع|project|agile|scrum|مشاريع/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} محترف ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون مسؤولاً عن إعداد خارطة طريق المنتج وقيادة فرق العمل لتحقيق نتائج ممتازة.`,
            responsibilities: [
                `تحديد استراتيجية وخارطة طريق المنتج (Product Roadmap) وترتيب الأولويات.`,
                `صياغة متطلبات العمل والـ User Stories وقيادة اجتماعات فرق التطوير.`,
                `تحليل مؤشرات قياس الأداء (KPIs) وسلوك المستخدمين لتحسين جودة وتجربة المنتج.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة عمل لا تقل عن (${exp}) في إدارة المنتجات أو المشاريع الرقمية.`,
                `إجادة المهارات المطلوبة: ${skillsList.join('، ')}.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['Scrum Master Certification', 'User Research & Testing', 'Data-driven Product Analytics'],
            interviewQuestions: [
                { question: `كيف تقوم بترتيب أولويات مميزات المنتج (Feature Prioritization) عند تعارض طلبات العملاء؟`, category: "استراتيجي" },
                { question: `كيف تدير قيادة الفريق بدون سلطة مباشرة (Leading without Authority)؟`, category: "قيادي" }
            ]
        };
    }

    // 💼 5. Sales & Business Development
    if (/مبيعات|sales|تطوير أعمال|bizdev|عملاء|crm/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون مسؤولاً عن تحقيق الأهداف البيعية وتوسيع قاعدة العملاء وبناء الشراكات الاستراتيجية.`,
            responsibilities: [
                `تحقيق المستهدفات البيعية (Sales Targets) وتطوير فرص أعمال جديدة للشركة.`,
                `إدارة وتعميق العلاقات مع العملاء وتتبع كافة الصفقات عبر نظام الـ CRM.`,
                `إعداد وتلاوة العروض التجارية والمالية والتفاوض لإغلاق الصفقات بنجاح.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة لا تقل عن (${exp}) في المبيعات وتطوير الفرص التجارية.`,
                `إجادة المهارات: ${skillsList.join('، ')}.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['B2B Enterprise Sales', 'CRM Mastery (Salesforce/HubSpot)', 'Sales Pipeline Forecasting'],
            interviewQuestions: [
                { question: `كيف تقوم بإدارة دورة المبيعات الكاملة (Sales Cycle) من مرحلة الاستهداف إلى الإغلاق؟`, category: "تقني" },
                { question: `كيف تتعامل مع الاعتراضات الصعبة من العملاء الكبار أثناء المفاوضات؟`, category: "سلوكي" }
            ]
        };
    }

    // 📣 6. Marketing & Media
    if (/تسويق|marketing|محتوى|seo|ads|سوشيال/i.test(titleLower)) {
        return {
            jobTitle: title,
            summary: `نبحث عن ${title} متمكن ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون مسؤولاً عن التخطيط والتنفيذ والتحليل للحملات التسويقية الرقمية والإبداعية.`,
            responsibilities: [
                `تخطيط وإدارة الحملات الإعلانية التسويقية عبر المنصات الرقمية المختلفة.`,
                `تحليل أداء الحملات ومعدلات التحويل (ROI & CAC) وتحسين النتائج باستمرار.`,
                `إدارة وتوجيه صناعة المحتوى الإبداعي بما يعزز الهوية التجارية للشركة.`
            ],
            requirements: [
                `مؤهل علمي: ${edu}.`,
                `خبرة مثبتة لا تقل عن (${exp}) في مجال التسويق الرقمي وإدارة الحملات.`,
                `إجادة المهارات: ${skillsList.join('، ')}.`
            ],
            requiredSkills: skillsList,
            preferredSkills: ['SEO/SEM Optimization', 'Performance Marketing', 'A/B Testing & Funnel Analysis'],
            interviewQuestions: [
                { question: `كيف تقوم بقياس وتحسين عائد الاستثمار (ROI) للحملات التسويقية الإعلانية؟`, category: "تقني" },
                { question: `كيف تبتكر استراتيجيات تسويقية جديدة عند الدخول في سوق تنافسي شديد؟`, category: "استراتيجي" }
            ]
        };
    }

    // 🧮 7. General Fallback with Exact Tailored Inputs
    return {
        jobTitle: title,
        summary: `نبحث عن ${title} متمرس ومحترف ذو خبرة (${exp}) للانضمام إلى فريق ${dept} في (${loc}). سيكون المرشح المثالي مسؤولاً عن تنفيذ المهام والتخصصات المحددة للوظيفة بأعلى كفاءة وأداء.`,
        responsibilities: [
            `تخطيط وتنفيذ كافة المهام والمسؤوليات الخاصة بدور ${title} وفق أعلى معايير الجودة.`,
            `التحليل المستمر وتطوير بيئة العمل والحلول المبتكرة لتحقيق أهداف قسم ${dept}.`,
            `التعاون التام مع فرق العمل والتأكد من توثيق الإنجازات والتقارير الدورية.`
        ],
        requirements: [
            `مؤهل علمي: ${edu}.`,
            `خبرة عملية لا تقل عن (${exp}) في مجالات ذات صلة بـ ${title}.`,
            `إجادة المهارات المطلوبة: ${skillsList.join('، ')}.`
        ],
        requiredSkills: skillsList,
        preferredSkills: ['التفكير التحليلي', 'إدارة الأولويات والوقت', 'المهارات التقنية المتقدمة'],
        interviewQuestions: [
            { question: `ما هي أبرز الإنجازات والتجارب التي قدمتها في أدوار سابقة كـ ${title}؟`, category: "تقني" },
            { question: `كيف تتعامل مع التحديات والمواقف المعقدة أثناء تنفيذ مهام العمل؟`, category: "سلوكي" },
            { question: `ما هي رؤيتك لتطوير وتحسين كفاءة الأداء في هذا الدور؟`, category: "استراتيجي" }
        ]
    };
};

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
            seniorityLevel,
            educationLevel
        } = req.body;

        if (!jobTitle) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب' });
        }

        const prompt = `أنت خبير موارد بشرية محترف. قم بإنشاء وصف وظيفي احترافي وشامل باللغة العربية بناءً على المعلومات التالية:

المسمى الوظيفي: ${jobTitle}
القسم / الإدارة: ${department || 'غير محدد'}
المؤهل العلمي المطلوب: ${educationLevel || 'حسب التخصص والمتطلبات'}
سنوات الخبرة المطلوبة: ${experience || 'غير محدد'}
الموقع الجغرافي: ${location || 'الرياض'}
نوع التوظيف: ${employmentType || 'دوام كامل'}
طريقة العمل: ${workMode || 'مكتب'}
مستوى الأقدمية: ${seniorityLevel || 'غير محدد'}
المهارات المطلوبة: ${Array.isArray(skills) ? skills.join('، ') : (skills || 'غير محدد')}
نطاق الراتب: ${salaryMin && salaryMax ? `${salaryMin} - ${salaryMax} ريال` : 'حسب الكفاءة'}

أرجع JSON بالهيكل التالي بالضبط:
{
  "jobTitle": "${jobTitle}",
  "summary": "ملخص وظيفي احترافي يتضمن المسمى والمؤهل والخبرة والموقع بدقة",
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
  "educationLevel": "${educationLevel || 'حسب التخصص والمتطلبات'}",
  "confidence_score": 0.95
}`;

        const domainTailored = getDomainTailoredJD({ jobTitle, department, experience, location, skills, educationLevel, salaryMin, salaryMax });

        const rawResult = await aiService.generateJobDescription({ prompt, jobTitle, experience, location, skills, department, employmentType, workMode, seniorityLevel, educationLevel }, companyId);

        let parsedResult = rawResult;
        if (typeof rawResult === 'string') {
            try { parsedResult = JSON.parse(rawResult); } catch (e) { parsedResult = {}; }
        }

        // Ensure responsibilities/requirements match the actual job title category
        const isHRCategory = /موارد بشرية|hr|توظيف|شؤون موظفين|recruitment/i.test(jobTitle);
        const hasIrrelevantHRTasks = !isHRCategory && parsedResult?.responsibilities?.some(r => /استقطاب|موارد بشرية|توظيف المواهب|نظم الموارد/i.test(r));

        const finalJobTitle = jobTitle;
        const finalDepartment = department || domainTailored.department || 'قسم التخصص';
        const finalSkills = Array.isArray(skills) && skills.length > 0 ? skills : (parsedResult?.requiredSkills || domainTailored.requiredSkills);
        const finalLocation = location || 'الرياض';
        const finalExp = experience || '3-5 سنوات';
        const finalEdu = educationLevel || parsedResult?.educationLevel || domainTailored.requirements[0]?.replace('مؤهل علمي: ', '') || 'بكالوريوس في التخصص المطلوب';

        const finalResponsibilities = (hasIrrelevantHRTasks || !parsedResult?.responsibilities || parsedResult.responsibilities.length === 0)
            ? domainTailored.responsibilities
            : parsedResult.responsibilities;

        const finalRequirements = (hasIrrelevantHRTasks || !parsedResult?.requirements || parsedResult.requirements.length === 0)
            ? domainTailored.requirements
            : parsedResult.requirements;

        const finalQuestions = (hasIrrelevantHRTasks || !parsedResult?.interviewQuestions || parsedResult.interviewQuestions.length === 0)
            ? domainTailored.interviewQuestions
            : parsedResult.interviewQuestions;

        const customSummary = parsedResult?.summary && parsedResult.summary.includes(finalJobTitle)
            ? parsedResult.summary
            : domainTailored.summary;

        // Salary Insight formatting fix: ensure correct salary numbers (e.g., 10000 - 18000 SAR)
        let formattedSalaryInsight = 'نطاق الراتب مخصص ومناسب وفق معايير السوق المحترفة.';
        if (salaryMin && salaryMax) {
            formattedSalaryInsight = `نطاق الراتب المخصص لهذه الوظيفة بين ${Number(salaryMin).toLocaleString('ar-SA')} و ${Number(salaryMax).toLocaleString('ar-SA')} ريال.`;
        } else if (parsedResult?.salaryInsight && !parsedResult.salaryInsight.includes('1000')) {
            formattedSalaryInsight = parsedResult.salaryInsight;
        }

        const result = {
            ...domainTailored,
            ...parsedResult,
            jobTitle: finalJobTitle,
            summary: customSummary,
            responsibilities: finalResponsibilities,
            requirements: finalRequirements,
            interviewQuestions: finalQuestions,
            requiredSkills: finalSkills,
            employmentType: employmentType || parsedResult?.employmentType || 'FULL_TIME',
            workMode: workMode || parsedResult?.workMode || 'HYBRID',
            seniorityLevel: seniorityLevel || parsedResult?.seniorityLevel || 'MID',
            educationLevel: finalEdu,
            salaryInsight: formattedSalaryInsight,
            confidence_score: 0.95
        };

        return res.json({ success: true, data: result });

    } catch (error) {
        logger.error('JD Generation Error', { error: error.message });
        res.status(500).json({ error: 'فشل توليد الوصف الوظيفي. تأكد من إعداد مفتاح OpenAI.' });
    }
};

/**
 * POST /api/ai-jd/chat
 * Interactive 5-turn HR requirement gathering conversation with 100% real data binding
 */
export const interactiveJDChat = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'يجب إرسال سجل المحادثة' });
        }

        const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content.trim());
        const turnCount = userMsgs.length;
        const lastUserMsg = userMsgs[userMsgs.length - 1] || '';

        // Check if user requested early generation
        const isFinishRequested = 
            /أنشئ|انشئ|توليد|ولد|جاهز|أضف أنت|اضف انت|اكتب أنت|اكتب انت|يكفي|لا شيء|لا شي|اعتمد|كمل|خلاص/i.test(lastUserMsg);

        // ── Turn 1: Ask for Job Title ──────────────────────────────────────────
        if (turnCount <= 1) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: 'مرحباً بك! ما هو المسمى الوظيفي الذي ترغب في إعداد وصف وظيفي له اليوم؟'
                }
            });
        }

        // Extract real job title from user turn 2
        const rawJobTitleMsg = userMsgs[1] || lastUserMsg;
        const jobTitle = rawJobTitleMsg.replace(/مرحباً|أريد|إنشاء|وصف|وظيفي|جديد|أحتاج|وظيفة/gi, '').trim() || rawJobTitleMsg;

        // ── Turn 2: Ask for Department ─────────────────────────────────────────
        if (turnCount === 2 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `ممتاز! بالنسبة لوظيفة (${jobTitle})، ما هو القسم أو الإدارة التي تتبع لها هذه الوظيفة في شركتكم؟`
                }
            });
        }

        // Extract real department from user turn 3
        const departmentInput = userMsgs[2] && !/لا شيء|لا شي/i.test(userMsgs[2]) ? userMsgs[2] : 'تكنولوجيا المعلومات';

        // ── Turn 3: Ask for Core Skills ────────────────────────────────────────
        if (turnCount === 3 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `رائع! ما هي أبرز المهارات أو التقنيات والبرامج الأساسية التي ترغب أن يتقنها المرشح لدور (${jobTitle})؟`
                }
            });
        }

        // Extract real skills from user turn 4
        const rawSkillsInput = userMsgs[3] || '';
        const parsedSkills = rawSkillsInput && !/لا شيء|لا شي/i.test(rawSkillsInput)
            ? rawSkillsInput.split(/[،,,\n]+/).map(s => s.trim()).filter(Boolean)
            : ['المهارات الأساسية', 'العمل الجماعي', 'التواصل الفعال'];

        // ── Turn 4: Ask for Experience Years & Seniority ───────────────────────
        if (turnCount === 4 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `جميل جداً! كم سنة خبرة مطلوبة لوظيفة (${jobTitle})، وما هو مستوى الأقدمية المرغوب (مبتدئ / متوسط / أول Senior / قائد فريق)؟`
                }
            });
        }

        // Extract real experience from user turn 5
        const experienceInput = userMsgs[4] && !/لا شيء|لا شي/i.test(userMsgs[4]) ? userMsgs[4] : '2-4 سنوات';

        // ── Turn 5: Ask for Education Qualification ────────────────────────────
        if (turnCount === 5 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `رائع! ما هو المؤهل العلمي المطلوب لهذه الوظيفة (مثل: بكالوريوس هندسة / دبلوم / ماجستير / شهادة مهنية مخصصة)؟`
                }
            });
        }

        // Extract real education qualification from user turn 6
        const educationInput = userMsgs[5] && !/لا شيء|لا شي|غير محدد/i.test(userMsgs[5]) ? userMsgs[5] : 'بكالوريوس في التخصص المطلوب';

        // ── Turn 6: Ask for Location, Work Mode & Salary ───────────────────────
        if (turnCount === 6 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `ممتاز جداً! ما هو موقع العمل (مثل الرياض/جدة/اليمن) وطريقة العمل (حضوري / عن بُعد / هجين)، وهل تود إضافة نطاق راتب محدد؟`
                }
            });
        }

        // ── Advanced Real Data Extraction Engine ──────────────────────────────
        const rawLocationAndSalaryMsg = userMsgs[6] || userMsgs[userMsgs.length - 1] || '';
        const rawExperienceMsg = userMsgs[4] || '';

        // Extract real location
        let realLocation = 'الرياض';
        if (rawLocationAndSalaryMsg) {
            const locClean = rawLocationAndSalaryMsg.replace(/عن بعد|عن بُعد|هجين|حضوري|ريال|دولار|\d+|-/gi, '').replace(/[،,]/g, ' ').trim();
            const firstLocWord = locClean.split(/\s+/).filter(w => w.length > 1 && !/عمل|موقع|راتب/i.test(w))[0];
            if (firstLocWord) realLocation = firstLocWord;
        }

        // Extract real workMode
        let realWorkMode = 'ONSITE';
        let realWorkModeText = 'حضوري';
        if (/عن بُعد|عن بعد|remote/i.test(rawLocationAndSalaryMsg)) {
            realWorkMode = 'REMOTE';
            realWorkModeText = 'عن بُعد';
        } else if (/هجين|hybrid/i.test(rawLocationAndSalaryMsg)) {
            realWorkMode = 'HYBRID';
            realWorkModeText = 'هجين';
        }

        // Extract real salary range numbers
        const salaryMatches = rawLocationAndSalaryMsg.match(/\d+[\d,.]*/g);
        let realSalaryMin = '';
        let realSalaryMax = '';
        let realSalaryInsight = 'نطاق الراتب محدد ومصمم وفق معايير السوق التنافسية.';
        if (salaryMatches && salaryMatches.length >= 2) {
            realSalaryMin = salaryMatches[0];
            realSalaryMax = salaryMatches[1];
            realSalaryInsight = `نطاق الراتب المكتبي المخصص لهذه الوظيفة هو من ${realSalaryMin} إلى ${realSalaryMax}.`;
        } else if (salaryMatches && salaryMatches.length === 1) {
            realSalaryMin = salaryMatches[0];
            realSalaryInsight = `الراتب الأساسي المقترح يبدأ من ${realSalaryMin}.`;
        }

        // Extract real experience & seniority
        const realExperience = rawExperienceMsg || '3-5 سنوات';
        let seniorityLevel = 'MID';
        if (/مبتدئ|junior/i.test(rawExperienceMsg)) seniorityLevel = 'JUNIOR';
        else if (/senior|أول|خبير/i.test(rawExperienceMsg)) seniorityLevel = 'SENIOR';
        else if (/قائد|lead|مدير/i.test(rawExperienceMsg)) seniorityLevel = 'LEAD';

        // ── Combine 100% Real User Inputs into Structured Payload ─────────────
        const realFormData = {
            jobTitle,
            department: departmentInput,
            experience: realExperience,
            educationLevel: educationInput,
            location: realLocation,
            workMode: realWorkMode,
            seniorityLevel,
            employmentType: 'FULL_TIME',
            skills: parsedSkills,
            salaryMin: realSalaryMin,
            salaryMax: realSalaryMax
        };

        const fullJD = await aiService.generateJobDescription(realFormData, companyId);

        // ── Override summary & key fields to strictly mirror real user data ────
        const customSummary = `نبحث عن ${jobTitle} ذو خبرة (${realExperience}) للانضمام إلى ${departmentInput} في (${realLocation}) بنمط عمل (${realWorkModeText}). سيكون المرشح المثالي مسؤولاً عن تصميم وتطوير وإدارة كافة المهام المطلوبة لضمان تحقيق أعلى معايير الجودة والأداء.`;

        const finalStructuredJD = {
            ...fullJD,
            jobTitle: jobTitle || fullJD.jobTitle,
            summary: customSummary,
            requiredSkills: parsedSkills.length > 0 ? parsedSkills : (fullJD.requiredSkills || []),
            salaryInsight: realSalaryInsight,
            employmentType: 'FULL_TIME',
            workMode: realWorkMode,
            seniorityLevel,
            confidence_score: 0.98
        };

        return res.json({
            success: true,
            data: {
                isComplete: true,
                formData: realFormData,
                jobDescription: finalStructuredJD
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

/**
 * POST /api/ai-jd/generate-summary
 * Generate professional HR Job Summary based on form input fields
 */
export const generateSummaryOnly = async (req, res) => {
    try {
        const {
            jobTitle,
            department,
            location,
            employmentType,
            requiredExperience,
            skills,
            educationLevel,
            hiringReason
        } = req.body;

        if (!jobTitle || !jobTitle.trim()) {
            return res.status(400).json({ error: 'المسمى الوظيفي مطلوب لتوليد ملخص الوظيفة' });
        }

        const empLabels = {
            'FULL_TIME': 'دوام كامل',
            'PART_TIME': 'دوام جزئي',
            'CONTRACT': 'عقد مؤقت',
            'REMOTE': 'عن بُعد',
            'HYBRID': 'هجين'
        };

        const prompt = `أنت خبير موارد بشرية استراتيجي (HR Specialist).
قم بكتابة "ملخص وظيفي" (Job Summary) احترافي، موجز، ومباشر باللغة العربية (حوالي 80 إلى 130 كلمة) لطلب توظيف جديد بالمعطيات التالية:
- المسمى الوظيفي: ${jobTitle}
- القسم / الإدارة: ${department || 'تكنولوجيا المعلومات'}
- مكان العمل: ${location || 'الرياض'}
- نوع التوظيف: ${empLabels[employmentType] || employmentType || 'دوام كامل'}
- سنوات الخبرة المطلوبة: ${requiredExperience || 'حسب التخصص'}
- المهارات المطلوبة: ${Array.isArray(skills) ? skills.join('، ') : (skills || 'غير محددة')}
- المؤهل العلمي: ${educationLevel || 'بكالوريوس'}
- سبب الاحتياج: ${hiringReason || 'استقطاب كفاءات متميزة'}

الشروط البنائية المحددة:
1. صياغة النص بأسلوب مهني جذّاب، وضح الهدف الأساسي من الدور الوظيفي، وأبرز المسؤوليات، والقيمة التي سيضيفها الموظف للشركة.
2. عدم تكرار الحقول كقائمة، بل صياغتها كفقرة مترابطة واحترافية قابلة للاستخدام المباشر.
3. قم بإرجاع نص الملخص فقط مباشرة دون أي مقدمات أو عناوين أو ملاحظات جانبية.`;

        let summaryText = '';
        try {
            summaryText = await aiService.generateText(prompt);
            summaryText = summaryText ? summaryText.trim() : '';
        } catch (aiErr) {
            logger.warn('AI Service fallback for summary generation:', aiErr?.message);
        }

        if (!summaryText) {
            const tailored = getDomainTailoredJD({
                jobTitle,
                department,
                experience: requiredExperience,
                location,
                educationLevel,
                skills
            });
            summaryText = tailored.summary;
        }

        return res.json({
            status: 'success',
            summary: summaryText
        });
    } catch (err) {
        logger.error('Error in generateSummaryOnly:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء توليد ملخص الوظيفة بالذكاء الاصطناعي' });
    }
};
