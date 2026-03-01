import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailService = {
    /**
     * Send an interview invitation to a candidate
     * @param {Object} candidate - Candidate details
     * @param {Object} job - Job details
     * @param {string} interviewLink - Unique link for the AI interview
     */
    sendInterviewInvitation: async (candidate, job, interviewLink) => {
        try {
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
    }
};
