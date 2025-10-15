
"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenProps } from "@/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader title="سياسة الخصوصية" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>سياسة الخصوصية لتطبيق Goal Stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              تاريخ آخر تحديث: 25 يوليو 2024
            </p>
            <p>
              نحن في Goal Stack نقدر خصوصيتك ونسعى لحماية معلوماتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحماية معلوماتك عند استخدامك لتطبيقنا.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">المعلومات التي نجمعها</h3>
            <p>
              نحن نجمع المعلومات التي تقدمها مباشرة عند إنشاء حساب، مثل اسمك وبريدك الإلكتروني. قد نجمع أيضًا بيانات الاستخدام لفهم كيفية تفاعلك مع التطبيق وتحسين خدماتنا.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">كيف نستخدم معلوماتك</h3>
            <ul className="list-disc pr-5 space-y-2">
              <li>لتخصيص تجربتك وعرض المحتوى الذي يهمك.</li>
              <li>لتحسين أداء التطبيق وإضافة ميزات جديدة.</li>
              <li>لإرسال إشعارات مهمة تتعلق بحسابك أو المباريات التي تتابعها.</li>
              <li>للتواصل معك بشأن التحديثات أو العروض الخاصة.</li>
            </ul>
             <h3 className="font-bold text-lg text-foreground pt-4">مشاركة المعلومات</h3>
            <p>
              نحن لا نبيع أو نؤجر معلوماتك الشخصية لأطراف ثالثة. قد نشارك بيانات مجمعة ومجهولة الهوية لأغراض التحليل والأعمال.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">الأمان</h3>
            <p>
              نتخذ إجراءات أمنية معقولة لحماية معلوماتك من الوصول غير المصرح به أو التغيير أو الكشف.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">التغييرات على هذه السياسة</h3>
            <p>
              قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنعلمك بأي تغييرات عن طريق نشر السياسة الجديدة على هذه الصفحة.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
