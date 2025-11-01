
"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// This is the actual UI component. It can accept props.
export function PrivacyPolicyContent({ goBack, canGoBack }: { goBack?: () => void, canGoBack?: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader title="سياسة الخصوصية" onBack={goBack} canGoBack={!!canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>سياسة الخصوصية لتطبيق نبض الملاعب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p className="font-bold">
              تاريخ آخر تحديث: أكتوبر {currentYear}
            </p>
            <p>
              نحن في نبض الملاعب ("نحن"، "التطبيق") نأخذ خصوصيتك على محمل الجد. توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحماية معلوماتك الشخصية عند استخدامك لتطبيقنا وخدماتنا.
            </p>
            
            <h3 className="font-bold text-lg text-foreground pt-4">1. المعلومات التي نجمعها</h3>
            <h4 className="font-semibold text-md text-foreground/90 pt-2">أ. المعلومات التي تقدمها لنا مباشرة:</h4>
            <ul className="list-disc pr-5 space-y-2">
              <li>
                <b>معلومات الحساب:</b> عند تسجيل الدخول باستخدام حساب جوجل، نحصل على المعلومات الأساسية المرتبطة بحسابك مثل الاسم، البريد الإلكتروني، وصورة الملف الشخصي، وذلك لإنشاء حسابك وتخصيصه.
              </li>
              <li>
                <b>المحتوى الذي تنشئه:</b> نجمع المحتوى الذي تقوم بإنشائه داخل التطبيق، مثل التعليقات على المباريات، وتوقعاتك للنتائج.
              </li>
            </ul>
            <h4 className="font-semibold text-md text-foreground/90 pt-2">ب. المعلومات التي نجمعها تلقائيًا:</h4>
             <ul className="list-disc pr-5 space-y-2">
              <li>
                <b>بيانات الاستخدام:</b> نجمع معلومات حول كيفية تفاعلك مع التطبيق، مثل الشاشات التي تزورها، والميزات التي تستخدمها، والفرق والبطولات التي تفضلها.
              </li>
               <li>
                <b>بيانات الجهاز:</b> قد نجمع معلومات أساسية عن جهازك مثل نوعه ونظام التشغيل، وذلك لأغراض التحليل وتحسين التوافق.
              </li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">2. كيف نستخدم معلوماتك</h3>
            <p>نستخدم المعلومات التي نجمعها للأغراض التالية:</p>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>توفير وتخصيص خدماتنا:</b> لإدارة حسابك، وعرض المحتوى الذي يهمك بناءً على مفضلاتك.</li>
              <li><b>التواصل معك:</b> لإرسال إشعارات حول التفاعلات مع تعليقاتك (الردود والإعجابات) أو إشعارات أخرى تختار تفعيلها.</li>
              <li><b>تحسين التطبيق:</b> لتحليل بيانات الاستخدام وفهم سلوك المستخدمين، مما يساعدنا على تحسين أداء التطبيق وتطوير ميزات جديدة.</li>
              <li><b>الأمان:</b> لحماية أمان حسابك وسلامة خدماتنا.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">3. مشاركة المعلومات</h3>
            <p>
              نحن لا نبيع أو نؤجر معلوماتك الشخصية لأي طرف ثالث. قد نشارك معلوماتك في الحالات المحدودة التالية:
            </p>
             <ul className="list-disc pr-5 space-y-2">
                <li><b>مقدمو الخدمات:</b> قد نستعين بخدمات أطراف ثالثة (مثل Firebase من Google) للمساعدة في تشغيل خدماتنا (مثل الاستضافة وقاعدة البيانات والمصادقة). تلتزم هذه الأطراف بالحفاظ على سرية معلوماتك.</li>
                <li><b>لأسباب قانونية:</b> قد نكشف عن معلوماتك إذا كان ذلك مطلوبًا بموجب القانون أو استجابة لطلب قانوني صالح.</li>
             </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">4. أمان البيانات</h3>
            <p>
              نتخذ إجراءات أمنية معقولة وتقنيات متقدمة لحماية معلوماتك الشخصية من الوصول أو الاستخدام أو التغيير أو الكشف غير المصرح به. ومع ذلك، لا توجد طريقة نقل عبر الإنترنت أو تخزين إلكتروني آمنة بنسبة 100%.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">5. التغييرات على سياسة الخصوصية</h3>
            <p>
              قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنعلمك بأي تغييرات جوهرية عن طريق نشر السياسة الجديدة على هذه الصفحة و/أو من خلال إشعار داخل التطبيق.
            </p>
            
            <h3 className="font-bold text-lg text-foreground pt-4">6. اتصل بنا</h3>
            <p>
              إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية هذه، فلا تتردد في التواصل معنا.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Default export for Next.js page routing. It accepts no props.
export default function PrivacyPolicyScreen() {
  // This version of the component is only used for static export.
  // The actual interactive component used in the app is PrivacyPolicyContent.
  return <PrivacyPolicyContent />;
}
