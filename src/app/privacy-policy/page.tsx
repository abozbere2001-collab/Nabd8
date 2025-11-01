"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function PrivacyPolicyContent() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader title="سياسة الخصوصية" />
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
            <ul className="list-disc pr-5 space-y-2">
              <li><b>معلومات الحساب:</b> الاسم، البريد الإلكتروني، وصورة الملف الشخصي عند تسجيل الدخول.</li>
              <li><b>المحتوى الذي تنشئه:</b> التعليقات وتوقعات النتائج داخل التطبيق.</li>
              <li><b>بيانات الاستخدام:</b> تتبع التفاعل مع التطبيق والشاشات المفضلة.</li>
              <li><b>بيانات الجهاز:</b> نوع الجهاز ونظام التشغيل لتحسين الأداء.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">2. كيف نستخدم معلوماتك</h3>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>توفير وتخصيص خدماتنا:</b> إدارة الحساب وعرض المحتوى المناسب.</li>
              <li><b>التواصل معك:</b> إشعارات حول التفاعلات والردود.</li>
              <li><b>تحليل وتحسين التطبيق:</b> تطوير ميزات جديدة وفهم سلوك المستخدمين.</li>
              <li><b>الأمان:</b> حماية حسابك وسلامة الخدمات.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">3. مشاركة المعلومات</h3>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>مقدمو الخدمات:</b> Firebase وغيرها لتشغيل الخدمات، مع الالتزام بالسرية.</li>
              <li><b>لأسباب قانونية:</b> الكشف عن المعلومات إذا كان مطلوبًا بموجب القانون.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">4. أمان البيانات</h3>
            <p>
              نتخذ إجراءات أمنية معقولة لحماية بياناتك، لكن لا يوجد ضمان نقل أو تخزين آمن بنسبة 100%.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">5. التغييرات على سياسة الخصوصية</h3>
            <p>
              سنعلمك بالتغييرات الجوهرية عن طريق نشر السياسة الجديدة على هذه الصفحة و/أو من خلال إشعار داخل التطبيق.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">6. اتصل بنا</h3>
            <p>إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية هذه، فلا تتردد في التواصل معنا.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}
