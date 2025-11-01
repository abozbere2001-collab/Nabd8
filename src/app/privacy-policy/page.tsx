"use client";

import React from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = {
  goBack?: () => void;
  canGoBack?: boolean;
};

// المكوّن الرئيسي
export function PrivacyPolicyContent({ goBack, canGoBack }: PageProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader
        title="سياسة الخصوصية"
        onBack={goBack}
        canGoBack={!!canGoBack}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>سياسة الخصوصية لتطبيق نبض الملاعب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p className="font-bold">تاريخ آخر تحديث: أكتوبر {currentYear}</p>
            <p>
              نحن في نبض الملاعب ("نحن"، "التطبيق") نأخذ خصوصيتك على محمل الجد.
              توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحماية معلوماتك الشخصية.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">
              1. المعلومات التي نجمعها
            </h3>
            <h4 className="font-semibold text-md text-foreground/90 pt-2">
              أ. المعلومات التي تقدمها لنا مباشرة:
            </h4>
            <ul className="list-disc pr-5 space-y-2">
              <li>
                <b>معلومات الحساب:</b> عند تسجيل الدخول باستخدام حساب جوجل،
                نحصل على معلومات مثل الاسم والبريد الإلكتروني.
              </li>
              <li>
                <b>المحتوى الذي تنشئه:</b> مثل التعليقات أو التوقعات داخل التطبيق.
              </li>
            </ul>

            <h4 className="font-semibold text-md text-foreground/90 pt-2">
              ب. المعلومات التي نجمعها تلقائيًا:
            </h4>
            <ul className="list-disc pr-5 space-y-2">
              <li>
                <b>بيانات الاستخدام:</b> مثل الصفحات التي تزورها والميزات التي تستخدمها.
              </li>
              <li>
                <b>بيانات الجهاز:</b> مثل نوع الجهاز ونظام التشغيل.
              </li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">
              2. كيف نستخدم معلوماتك
            </h3>
            <ul className="list-disc pr-5 space-y-2">
              <li>لإدارة حسابك وتخصيص تجربتك.</li>
              <li>لتحسين التطبيق وتطوير ميزاته.</li>
              <li>لأغراض الأمان وحماية المستخدمين.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">
              3. مشاركة المعلومات
            </h3>
            <p>
              لا نبيع معلوماتك لأي طرف ثالث. قد نشاركها فقط مع خدمات موثوقة مثل
              Firebase لتشغيل التطبيق.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">
              4. أمان البيانات
            </h3>
            <p>
              نتخذ تدابير معقولة لحماية معلوماتك، ولكن لا يمكن ضمان أمان تام عبر الإنترنت.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">
              5. التغييرات على السياسة
            </h3>
            <p>
              قد نقوم بتحديث هذه السياسة من وقت لآخر وسنبلغك بالتغييرات داخل التطبيق.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">6. اتصل بنا</h3>
            <p>
              إذا كان لديك أي استفسار حول سياسة الخصوصية، يمكنك التواصل معنا في أي وقت.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// التصدير الافتراضي لصفحة Next.js (بدون props)
export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}
