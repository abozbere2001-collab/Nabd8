"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// الصفحة نفسها كـ Page export افتراضي
export default function PrivacyPolicyPage({ goBack, canGoBack }: { goBack?: () => void; canGoBack?: boolean }) {
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
            <p className="font-bold">تاريخ آخر تحديث: أكتوبر {currentYear}</p>

            <p>
              نحن في نبض الملاعب ("نحن"، "التطبيق") نأخذ خصوصيتك على محمل الجد. توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحماية معلوماتك الشخصية عند استخدامك لتطبيقنا وخدماتنا.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">1. المعلومات التي نجمعها</h3>
            <h4 className="font-semibold text-md text-foreground/90 pt-2">أ. المعلومات التي تقدمها لنا مباشرة:</h4>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>معلومات الحساب:</b> عند تسجيل الدخول باستخدام حساب جوجل، نحصل على المعلومات الأساسية المرتبطة بحسابك مثل الاسم، البريد الإلكتروني، وصورة الملف الشخصي.</li>
              <li><b>المحتوى الذي تنشئه:</b> نجمع المحتوى الذي تقوم بإنشائه داخل التطبيق، مثل التعليقات على المباريات، وتوقعاتك للنتائج.</li>
            </ul>

            <h4 className="font-semibold text-md text-foreground/90 pt-2">ب. المعلومات التي نجمعها تلقائيًا:</h4>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>بيانات الاستخدام:</b> معلومات حول كيفية تفاعلك مع التطبيق، مثل الشاشات التي تزورها، والميزات التي تستخدمها.</li>
              <li><b>بيانات الجهاز:</b> معلومات أساسية عن جهازك مثل نوعه ونظام التشغيل، لأغراض التحليل وتحسين التوافق.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">2. كيف نستخدم معلوماتك</h3>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>توفير وتخصيص خدماتنا:</b> إدارة حسابك وعرض المحتوى المناسب لمفضلاتك.</li>
              <li><b>التواصل معك:</b> إرسال إشعارات حول التفاعلات مع تعليقاتك أو إشعارات أخرى.</li>
              <li><b>تحسين التطبيق:</b> تحليل بيانات الاستخدام وفهم سلوك المستخدمين لتطوير ميزات جديدة.</li>
              <li><b>الأمان:</b> حماية أمان حسابك وسلامة خدماتنا.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">3. مشاركة المعلومات</h3>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>مقدمو الخدمات:</b> الاستعانة بخدمات أطراف ثالثة (مثل Firebase) للمساعدة في تشغيل خدماتنا مع الالتزام بسرية معلوماتك.</li>
              <li><b>لأسباب قانونية:</b> الكشف عن المعلومات إذا كان مطلوبًا بموجب القانون أو استجابة لطلب قانوني صالح.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">4. أمان البيانات</h3>
            <p>
              نتخذ إجراءات أمنية معقولة لحماية معلوماتك الشخصية من الوصول أو الاستخدام أو التغيير أو الكشف غير المصرح به. لكن لا توجد طريقة نقل أو تخزين آمنة بنسبة 100%.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">5. التغييرات على سياسة الخصوصية</h3>
            <p>
              قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنعلمك بأي تغييرات جوهرية من خلال نشر السياسة الجديدة على هذه الصفحة أو إشعار داخل التطبيق.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">6. اتصل بنا</h3>
            <p>
              إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية، فلا تتردد في التواصل معنا.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
