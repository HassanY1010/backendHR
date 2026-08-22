import { Resend } from 'resend';

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

export const emailService = {
    /**
     * Send an interview invitation to a candidate
     * @param {Object} candidate - Candidate details
     * @param {Object} job - Job details
     * @param {string} interviewLink - Unique link for the AI interview
     */
    sendInterviewInvitation: async (candidate, job, interviewLink) => {
        try {
            if (!resend) {
                console.warn('⚠️ Resend is not configured (missing RESEND_API_KEY). Simulating email send. Link:', interviewLink);
                return { id: 'simulated-email-id', simulated: true };
            }
            const { data, error } = await resend.emails.send({
                from: 'AI HR Platform <onboarding@resend.dev>',
                to: [candidate.email],
                subject: `دعوة للمقابلة الشخصية: ${job.title}`,
                html: `
                <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin-bottom: 10px;">دعوة للمقابلة الذكية</h1>
                        <p style="color: #64748b; font-size: 16px;">منصة التوظيف بالذكاء الاصطناعي</p>
                    </div>

                    <div style="margin-bottom: 30px;">
                        <p style="font-size: 18px; color: #1e293b;">مرحباً <strong>${candidate.fullName}</strong>،</p>
                        <p style="font-size: 16px; color: #475569; line-height: 1.6;">
                            يسعدنا إبلاغك بأنه قد تم اختيارك للانتقال إلى مرحلة المقابلة الشخصية لوظيفة <strong>${job.title}</strong>.
                        </p>
                        <p style="font-size: 16px; color: #475569; line-height: 1.6;">
                            نحن نستخدم نظام المقابلات الذكي الذي يتيح لك إجراء المقابلة في الوقت الذي يناسبك، حيث سيقوم المساعد الذكي بطرح الأسئلة عليك وتقييم إجاباتك.
                        </p>
                    </div>

                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
                        <h3 style="color: #1e293b; margin-bottom: 15px;">رابط المقابلة الخاص بك</h3>
                        <a href="${interviewLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background-color 0.2s;">ابدأ المقابلة الآن</a>
                        <p style="color: #94a3b8; font-size: 12px; margin-top: 15px;">هذا الرابط صالح لمدة 7 أيام عمل.</p>
                    </div>

                    <div style="border-top: 1px solid #e2e8f0; pt: 20px; margin-top: 20px;">
                        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
                            <strong>ملاحظات هامة:</strong><br>
                            - يرجى التأكد من التواجد في مكان هادئ.<br>
                            - تأكد من عمل الكاميرا والميكروفون بشكل جيد.<br>
                            - المقابلة ستستغرق حوالي 15-20 دقيقة.
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8;">
                        <p>&copy; 2026 AI HR Platform. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
                `
            });

            if (error) {
                console.error('Resend Email Error:', error);
                throw error;
            }

            return data;
        } catch (err) {
            console.error('Failed to send email:', err);
            throw err;
        }
    },

    /**
     * Send SLA Breach Alert Email to Assigned User & Escalation Managers
     * @param {Object} recipient - Recipient details { email, name }
     * @param {Object} details - Breach details { stepName, jobTitle, requestId, expectedHours, hoursOverdue, isEscalation }
     */
    sendWorkflowSLABreachEmail: async (recipient, details) => {
        try {
            const subject = details.isEscalation
                ? `🚨 تصعيد إداري: تجاوز SLA في مسار التوظيف — ${details.jobTitle}`
                : `⚠️ تنبيه تجاوز SLA: مرحلة "${details.stepName}" — ${details.jobTitle}`;

            if (!resend) {
                console.warn(`⚠️ [EmailService] Resend unconfigured. Simulating SLA breach email to ${recipient.email}:`, subject);
                return { id: 'simulated-sla-email-id', simulated: true, to: recipient.email, subject };
            }

            const { data, error } = await resend.emails.send({
                from: 'AI HR Platform Alerts <alerts@resend.dev>',
                to: [recipient.email],
                subject,
                html: `
                <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 25px; border-bottom: 1px solid #fee2e2; padding-bottom: 15px;">
                        <h1 style="color: #dc2626; margin-bottom: 8px; font-size: 22px;">${details.isEscalation ? '🚨 تصعيد إداري عاجل' : '⚠️ تنبيه تجاوز الحد الزمني (SLA)'}</h1>
                        <p style="color: #64748b; font-size: 14px;">محرك مسارات التوظيف — Recruitment Workflow Engine</p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 16px; color: #1e293b;">مرحباً <strong>${recipient.name || 'المسؤول'}</strong>،</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
                            ${details.isEscalation 
                                ? `نود إحاطتكم علماً بأنه تم تصعيد طلب التوظيف التالي إليكم بسبب تأخر إنجاز المرحلة وتجاوز مدة الـ SLA المحددة.`
                                : `نحيطكم علماً بأن مرحلة العمل المسندة إليكم قد تجاوزت الحد الزمني المحدد (SLA) وتتطلب إجراءً فورياً.`}
                        </p>
                    </div>

                    <div style="background-color: #fef2f2; padding: 18px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #fca5a5;">
                        <table style="width: 100%; font-size: 14px; color: #334155;">
                            <tr><td style="padding: 6px 0; font-weight: bold; width: 40%;">طلب التوظيف:</td><td>${details.jobTitle} (${details.requestId})</td></tr>
                            <tr><td style="padding: 6px 0; font-weight: bold;">المرحلة الحالية:</td><td style="color: #b91c1c; font-weight: bold;">${details.stepName}</td></tr>
                            <tr><td style="padding: 6px 0; font-weight: bold;">المدة المتوقعة (SLA):</td><td>${details.expectedHours} ساعة</td></tr>
                            <tr><td style="padding: 6px 0; font-weight: bold;">مدة التأخير الحالية:</td><td style="color: #dc2626; font-weight: bold;">${details.hoursOverdue || 1} ساعة تأخير</td></tr>
                        </table>
                    </div>

                    <div style="text-align: center; margin-bottom: 25px;">
                        <p style="color: #64748b; font-size: 13px; margin-bottom: 10px;">يرجى الدخول إلى لوحة التحكم واستكمال المرحلة أو تسجيل سبب التأخير.</p>
                    </div>

                    <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
                        <p>&copy; 2026 AI HR Platform · Workflow Engine Automations</p>
                    </div>
                </div>
                `
            });

            if (error) {
                console.error('[EmailService] SLA Email send error:', error);
                throw error;
            }

            return data;
        } catch (err) {
            console.error('[EmailService] Failed to send SLA Breach Email:', err);
            return { error: err.message, failed: true };
        }
    }
};
