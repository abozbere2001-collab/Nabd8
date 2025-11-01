"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// This is the actual UI component. It can accept props.
export function TermsOfServiceContent({ goBack, canGoBack }: { goBack?: () => void, canGoBack?: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader title="شروط الخدمة" onBack={goBack} canGoBack={!!canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>شروط الخدمة لتطبيق نبض الملاعب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p className="font-bold">
              مرحبًا بك في نبض الملاعب. باستخدامك لتطبيقنا ("الخدمة")، فإنك توافق على الالتزام بشروط وأحكام الخدمة هذه ("الشروط"). آخر تحديث: أكتوبر {currentYear}.
            </p>

            <h3 className="font-bold text-lg text-foreground pt-4">1. قبول الشروط</h3>
            <p>من خلال الوصول إلى الخدمة أو استخدامها، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق على أي جزء من الشروط، فلا يجوز لك الوصول إلى الخدمة.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">2. استخدام الخدمة</h3>
            <p>أنت توافق على استخدام الخدمة فقط للأغراض المشروعة ووفقًا لهذه الشروط. أنت مسؤول عن جميع الأنشطة التي تحدث تحت حسابك.</p>
            <ul className="list-disc pr-5 space-y-2">
              <li><b>السلوك المحظور:</b> يُحظر عليك استخدام الخدمة لنشر أي محتوى غير قانوني أو مسيء أو ينتهك حقوق الآخرين.</li>
              <li><b>حساب المستخدم:</b> أنت مسؤول عن الحفاظ على أمان حسابك. يجب ألا تشارك تفاصيل حسابك مع الآخرين.</li>
            </ul>

            <h3 className="font-bold text-lg text-foreground pt-4">3. المحتوى الذي ينشئه المستخدم</h3>
            <p>أنت تحتفظ بملكية المحتوى الذي تقوم بإنشائه. ومع ذلك، من خلال نشره على خدمتنا، تمنحنا ترخيصًا عالميًا لاستخدام هذا المحتوى فيما يتعلق بتشغيل الخدمة.</p>
            <p>نحتفظ بالحق في إزالة أي محتوى ينتهك هذه الشروط دون إشعار مسبق.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">4. الملكية الفكرية</h3>
            <p>الخدمة وجميع محتوياتها الأصلية هي ملكية حصرية لـ نبض الملاعب ومرخصيها، محمية بموجب حقوق النشر والقوانين الأخرى.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">5. دقة البيانات</h3>
            <p>بيانات المباريات والإحصائيات يتم توفيرها من أطراف ثالثة. المعلومات "كما هي" لأغراض إعلامية فقط.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">6. إنهاء الخدمة</h3>
            <p>يجوز لنا إنهاء أو تعليق حسابك ووصولك إلى الخدمة فورًا إذا انتهكت هذه الشروط.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">7. تحديد المسؤولية</h3>
            <p>لن يكون نبض الملاعب مسؤولاً عن أي أضرار غير مباشرة أو تبعية ناتجة عن استخدامك للخدمة.</p>

            <h3 className="font-bold text-lg text-foreground pt-4">8. التغييرات على الشروط</h3>
            <p>نحتفظ بالحق في تعديل أو استبدال هذه الشروط في أي وقت ونقدم إشعارًا بالتغييرات الجوهرية قبل دخولها حيز التنفيذ.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Default export for Next.js page routing. It accepts NO props.
export default function TermsOfServicePage() {
  return <TermsOfServiceContent />;
}
