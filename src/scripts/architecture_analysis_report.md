# 📋 تقرير الفحص والتحليل المعماري لميزة AI Interview Practice

تم إجراء فحص شامل ودقيق لهيكل المشروع والـ Backend والـ Frontend والـ Prisma Schema ومحرك الذكاء الاصطناعي والأمان قبل البدء بالتنفيذ.

---

## 1. نتائج الفحص والتحليل المعماري

1. **الـ Backend (`backendHR`):**
   - يعمل بـ Express.js و Prisma ORM و PostgreSQL.
   - مسار المقابلات الأساسي مسجل في `src/app.js` تحت `/api/interviews`.
   - نظام حماية الـ Token: استخدام SHA-256 Hashing لتخزين الـ Tokens العامة الخاصة بالمرشحين بأمان مع Expiration (كما في `schedulingSession`).
   - محرك الذكاء الاصطناعي: `ai-service.js` يستخدم `callOpenAI` بنماذج OpenAI (مثل GPT-4o-mini) مع JSON parsing واستخراج دقيق للأدلة.

2. **الـ Frontend (`frontendHR`):**
   - تطبيق React + TypeScript + Vite + TailwindCSS + Lucide Icons + Framer Motion.
   - التوجيه العام لصفحات المرشح العامة موجود في `apps/manager-dashboard/src/routes/index.tsx` مثل `/book-interview/:token`.
   - إدارة الاتصال عبر حزمة `@hr/services` (`api-client.ts`).

3. **الخصوصية وعدم تخزين الفيديو:**
   - يتم معالجة الفحص الصوتي والمرئي في متصفح المرشح (Client-side MediaStream + Web Audio API).
   - ترسل إجابات ومؤشرات التدريب للـ AI Coach لتحليلها وإصدار الـ Feedback ثم التخلص فوراً من أي وسائط خام دون رفعها للمخزن إلا بموافقة صريحة.

---

## 2. تفاصيل الملفات والمكونات

### 📁 الملفات التي سيتم إنشاؤها:
1. `backendHR/src/controllers/interview-practice.controller.js`: المتحكم البرمجي الخاص بإنشاء، جلب، وتحليل التدريب وإرجاع الملاحظات الذكية مع حماية المحاولة الواحدة.
2. `backendHR/src/routes/interview-practice.routes.js`: مسارات الـ API العامة والمحمية للتدريب.
3. `frontendHR/apps/manager-dashboard/src/modules/recruitment/interviews/pages/InterviewPracticePage.tsx`: صفحة غرفة التدريب (Practice Room) بمراحلها الثلاث (Readiness Check, Practice Session, AI Coach Report).
4. `backendHR/tests/interview-practice.test.js`: اختبارات آلية للتحقق من أمان الجلسة، منع الاستخدام الثاني، وعدم تسريب أسئلة المقابلة الحقيقية.

### 📝 الملفات التي سيتم تعديلها:
1. `backendHR/prisma/schema.prisma`: إضافة نموذج `PracticeSession` وربطه مع `Candidate` و `SchedulingSession`.
2. `backendHR/src/app.js`: تسجيل مسارات `interview-practice.routes.js` تحت `/api/interviews/practice`.
3. `backendHR/src/ai/ai-service.js`: إضافة دالة `evaluatePracticeSession` المتخصصة في تحليل الأداء التدريبي (الصوت، الصورة، الإجابات).
4. `frontendHR/packages/services/src/interview-scheduling.service.ts`: إضافة دوال استدعاء Practice APIs.
5. `frontendHR/apps/manager-dashboard/src/routes/index.tsx`: تسجيل المسار العام `/practice-interview/:token`.
6. `frontendHR/apps/manager-dashboard/src/modules/recruitment/interviews/pages/CandidateBookingPage.tsx`: إضافة بطاقة "تدرب الآن قبل المقابلة الحقيقية" بعد تأكيد الحجز مباشرة.

---

## 3. نماذج قاعدة البيانات (Models)

```prisma
model PracticeSession {
  id                    String    @id @default(uuid())
  candidateId           String
  schedulingSessionId   String?
  tokenHash             String    @unique
  duration              Int?      // بالثواني
  overallScore          Float?    // 0 - 100
  communicationScore    Float?
  answerScore           Float?
  voiceScore            Float?
  visualScore           Float?
  confidenceIndicators  Json?     // مؤشرات الثقة والأداء (Speaking speed, pauses, eye contact, etc.)
  feedback              Json?     // نقاط القوة، مجالات التحسين، نصائح مخصصة
  status                String    @default("ACTIVE") // ACTIVE, COMPLETED, EXPIRED
  expiresAt             DateTime
  startedAt             DateTime?
  completedAt           DateTime?
  createdAt             DateTime  @default(now())

  candidate             Candidate          @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  schedulingSession     SchedulingSession? @relation(fields: [schedulingSessionId], references: [id], onDelete: SetNull)

  @@index([candidateId])
  @@index([tokenHash])
  @@map("practicesession")
}
```

---

## 4. الـ APIs المطلوبة

1. `POST /api/interviews/practice/create-session`: (توليد جلسة تدريبية لمرة واحدة بعد حجز الموعد أو للمرشح المؤهل).
2. `GET /api/interviews/practice/session/:token`: (التحقق من صلاحية الجلسة، منع الاستخدام الثاني أو المنتهي).
3. `GET /api/interviews/practice/questions`: (جلب بنك الأسئلة التدريبية العامة حصراً).
4. `POST /api/interviews/practice/analyze`: (إرسال إجابات ومؤشرات التدريب واستخراج تقييم الـ AI المدرب).
5. `POST /api/interviews/practice/complete`: (إغلاق الجلسة نهائياً وتثبيت النتيجة ومنع إعادة الدخول).
