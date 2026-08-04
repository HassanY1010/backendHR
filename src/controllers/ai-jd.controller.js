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

        const rawResult = await aiService.generateJobDescription({ prompt, jobTitle, experience, location, skills, department, employmentType, workMode, seniorityLevel }, companyId);

        let parsedResult = rawResult;
        if (typeof rawResult === 'string') {
            try { parsedResult = JSON.parse(rawResult); } catch (e) { parsedResult = {}; }
        }

        // Strict overriding to ensure template/preset selection is 100% accurate
        const finalJobTitle = jobTitle;
        const finalDepartment = department || 'قسم التخصص';
        const finalSkills = Array.isArray(skills) && skills.length > 0 ? skills : (parsedResult?.requiredSkills || []);
        const finalLocation = location || 'الرياض';
        const finalExp = experience || '2-4 سنوات';

        const customSummary = parsedResult?.summary && parsedResult.summary.includes(finalJobTitle)
            ? parsedResult.summary
            : `نبحث عن ${finalJobTitle} ذو خبرة (${finalExp}) للانضمام إلى ${finalDepartment} في (${finalLocation}). سيكون المرشح المثالي مسؤولاً عن تصميم وتطوير وإدارة كافة التخصصات والمهام المطلوبة لتحقيق أهداف الفريق بكفاءة عالية.`;

        const result = {
            ...parsedResult,
            jobTitle: finalJobTitle,
            summary: customSummary,
            requiredSkills: finalSkills,
            employmentType: employmentType || parsedResult?.employmentType || 'FULL_TIME',
            workMode: workMode || parsedResult?.workMode || 'HYBRID',
            seniorityLevel: seniorityLevel || parsedResult?.seniorityLevel || 'MID',
            salaryInsight: (salaryMin && salaryMax)
                ? `نطاق الراتب المخصص لهذه الوظيفة بين ${salaryMin} و ${salaryMax} ريال.`
                : (parsedResult?.salaryInsight || 'نطاق الراتب تنافسي ومناسب لمستوى السوق.')
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

        // ── Turn 5: Ask for Location, Work Mode & Salary ───────────────────────
        if (turnCount === 5 && !isFinishRequested) {
            return res.json({
                success: true,
                data: {
                    isComplete: false,
                    nextQuestion: `ممتاز جداً! ما هو موقع العمل (مثل الرياض/جدة/اليمن) وطريقة العمل (حضوري / عن بُعد / هجين)، وهل تود إضافة نطاق راتب محدد؟`
                }
            });
        }

        // ── Advanced Real Data Extraction Engine ──────────────────────────────
        const rawLocationAndSalaryMsg = userMsgs[5] || userMsgs[userMsgs.length - 1] || '';
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
