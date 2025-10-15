
"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenProps } from "@/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfServiceScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      <ScreenHeader title="شروط الخدمة" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>شروط الخدمة لتطبيق Goal Stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              مرحبًا بك في Goal Stack. باستخدامك لتطبيقنا، فإنك توافق على الالتزام بالشروط والأحكام التالية.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">1. استخدام التطبيق</h3>
            <p>
              يجب عليك استخدام التطبيق وفقًا لجميع القوانين واللوائح المعمول بها. لا يجوز لك استخدام التطبيق لأي غرض غير قانوني أو غير مصرح به.
            </p>
             <h3 className="font-bold text-lg text-foreground pt-4">2. المحتوى</h3>
            <p>
              جميع البيانات والمعلومات المعروضة في التطبيق، بما في ذلك جداول المباريات والنتائج والإحصائيات، يتم توفيرها "كما هي" وقد تخضع للتغيير. نحن لا نضمن دقة أو اكتمال أي معلومات.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">3. حساب المستخدم</h3>
            <p>
              أنت مسؤول عن الحفاظ على سرية معلومات حسابك، بما في ذلك كلمة المرور الخاصة بك. أنت توافق على إبلاغنا فورًا بأي استخدام غير مصرح به لحسابك.
            </p>
             <h3 className="font-bold text-lg text-foreground pt-4">4. الملكية الفكرية</h3>
            <p>
              التطبيق وجميع محتوياته الأصلية وميزاته ووظائفه هي ملك لـ Goal Stack ومحمية بموجب قوانين حقوق النشر والعلامات التجارية الدولية.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">5. إنهاء الخدمة</h3>
            <p>
              يجوز لنا إنهاء أو تعليق وصولك إلى تطبيقنا فورًا، دون إشعار مسبق أو مسؤولية، لأي سبب من الأسباب، بما في ذلك على سبيل المثال لا الحصر إذا انتهكت الشروط.
            </p>
            <h3 className="font-bold text-lg text-foreground pt-4">6. تحديد المسؤولية</h3>
            <p>
              لن يكون Goal Stack مسؤولاً بأي حال من الأحوال عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو عقابية تنشأ عن استخدامك للتطبيق.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
