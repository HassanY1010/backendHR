
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

const generateQuestions = () => {
    const questions = [];

    // Components for generating diverse questions
    const productivityVerbs = ['أنجزت', 'أتممت', 'بدأت', 'خططت', 'راجعت', 'سلمت', 'حسنت', 'وثقت', 'نظمت', 'حللت'];
    const productivityNouns = ['المهام اليومية', 'التقرير المطلوب', 'مشروعك الحالي', 'قائمة أعمالك', 'أهدافك لهذا اليوم', 'الخطة الأسبوعية', 'البريد العاجل', 'التوثيق الفني', 'جدولك الزمني', 'أولوياتك'];

    const feelingAdjectives = ['بالحماس', 'بالضغط', 'بالرضا', 'بالإنجاز', 'بالقلق', 'بالتفاؤل', 'بالتركيز', 'بالتشتت', 'بالهدوء', 'بالإرهاق'];
    const feelingContexts = ['تجاه العمل', 'مع الفريق', 'بخصوص المهام', 'في الاجتماعات', 'أثناء العمل', 'في بداية اليوم', 'في نهاية الدوام', 'بشأن التطورات', 'تجاه الإدارة', 'حول مستقبلك'];

    const barrierNouns = ['نقص المعلومات', 'بطء النظام', 'كثرة الاجتماعات', 'تداخل المهام', 'ضوضاء المكتب', 'انتظار الموافقة', 'مشاكل تقنية', 'غموض المتطلبات', 'قاطع الزملاء', 'تغير الأولويات'];

    // Generators
    const generateFact = () => {
        const v = productivityVerbs[Math.floor(Math.random() * productivityVerbs.length)];
        const n = productivityNouns[Math.floor(Math.random() * productivityNouns.length)];
        return `هل ${v} ${n} كما كنت تخطط؟`;
    };

    const generateFeeling = () => {
        const adj = feelingAdjectives[Math.floor(Math.random() * feelingAdjectives.length)];
        const ctx = feelingContexts[Math.floor(Math.random() * feelingContexts.length)];
        return `كيف تصف شعورك ${adj} ${ctx} اليوم من 1 إلى 5؟`;
    };

    const generateBarrier = () => {
        const b = barrierNouns[Math.floor(Math.random() * barrierNouns.length)];
        return `هل شكل "${b}" عائقاً رئيسياً أمام إنجازك اليوم؟`;
    };

    // Generate 1000 varied questions
    for (let i = 0; i < 1000; i++) {
        const seed = Math.random();
        let q = {};

        if (seed < 0.33) {
            // FACT
            q = {
                text: generateFact(),
                type: 'FACT',
                answerType: 'YES_NO',
                isActive: true,
                createdBy: "1"
            };
        } else if (seed < 0.66) {
            // FEELING
            q = {
                text: generateFeeling(),
                type: 'FEELING',
                answerType: 'SCALE_1_5',
                isActive: true,
                createdBy: "1"
            };
        } else {
            // BARRIER
            q = {
                text: generateBarrier(),
                type: 'BARRIER',
                answerType: 'TEXT',
                isActive: true,
                createdBy: "1"
            };
        }

        questions.push(q);
    }

    return questions;
};

const main = async () => {
    try {
        const questions = generateQuestions();

        // Save to JSON
        const outputPath = path.join(__dirname, 'prisma', 'questions.json');

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), 'utf-8');
        console.log(`Successfully generated ${questions.length} questions to ${outputPath}`);

        // Seed to Database
        console.log('Inserting questions into database...');

        // Batch insert to avoid huge query
        const batchSize = 100;
        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            await prisma.checkInQuestion.createMany({
                data: batch
            });
            console.log(`Inserted batch ${i} to ${i + batch.length}`);
        }

        console.log('Database seeded successfully.');

    } catch (error) {
        console.error('Error generating/seeding questions:', error);
    } finally {
        await prisma.$disconnect();
    }
};

main();
