
"use client";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// This is the actual UI component. It can accept props.
function TermsOfServiceContent({ goBack, canGoBack }: { goBack?: () => void, canGoBack?: boolean }) {
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
                <p>
                  من خلال الوصول إلى الخدمة أو استخدامها، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق على أي جزء من الشروط، فلا يجوز لك الوصول إلى الخدمة.
                </p>

                <h3 className="font-bold text-lg text-foreground pt-4">2. استخدام الخدمة</h3>
                <p>
                  أنت توافق على استخدام الخدمة فقط للأغراض المشروعة ووفقًا لهذه الشروط. أنت مسؤول عن جميع الأنشطة التي تحدث تحت حسابك.
                </p>
                <ul className="list-disc pr-5 space-y-2">
                    <li><b>السلوك المحظور:</b> يُحظر عليك استخدام الخدمة لنشر أي محتوى غير قانوني، أو افترائي، أو مسيء، أو يحض على الكراهية، أو ينتهك حقوق الآخرين.</li>
                    <li><b>حساب المستخدم:</b> أنت مسؤول عن الحفاظ على أمان حسابك. يجب ألا تشارك تفاصيل حسابك مع الآخرين.</li>
                </ul>

                <h3 className="font-bold text-lg text-foreground pt-4">3. المحتوى الذي ينشئه المستخدم</h3>
                <p>
                  أنت تحتفظ بملكية المحتوى الذي تقوم بإنشائه (مثل التعليقات والتوقعات). ومع ذلك، من خلال نشره على خدمتنا، فإنك تمنحنا ترخيصًا عالميًا، غير حصري، خاليًا من حقوق الملكية لاستخدام هذا المحتوى وعرضه وتوزيعه فيما يتعلق بتشغيل الخدمة.
                </p>
                <p>
                    نحتفظ بالحق في إزالة أي محتوى ينتهك هذه الشروط أو نعتبره غير لائق، دون إشعار مسبق.
                </p>

                <h3 className="font-bold text-lg text-foreground pt-4">4. الملكية الفكرية</h3>
                <p>
                  الخدمة وجميع محتوياتها الأصلية (باستثناء المحتوى الذي يقدمه المستخدمون)، والميزات، والوظائف هي وستبقى ملكية حصرية لـ نبض الملاعب ومرخصيها. خدمتنا محمية بموجب حقوق النشر والعلامات التجارية والقوانين الأخرى.
                </p>

                <h3 className="font-bold text-lg text-foreground pt-4">5. دقة البيانات</h3>
                 <p>
                  بيانات المباريات والنتائج والإحصائيات يتم توفيرها من خلال أطراف ثالثة. على الرغم من أننا نسعى لتقديم معلومات دقيقة، إلا أننا لا نضمن دقتها أو اكتمالها أو توقيتها. يتم توفير المعلومات "كما هي" لأغراض إعلامية فقط.
                </p>

                <h3 className="font-bold text-lg text-foreground pt-4">6. إنهاء الخدمة</h3>
                <p>
                  يجوز لنا إنهاء أو تعليق حسابك ووصولك إلى الخدمة فورًا، دون إشعار مسبق، إذا انتهكت هذه الشروط. عند الإنهاء، ينتهي حقك في استخدام الخدمة فورًا.
                </p>

                <h3 className="font-bold text-lg text-foreground pt-4">7. تحديد المسؤولية</h3>
                <p>
                  لن يكون نبض الملاعب أو مديروه أو موظفوه مسؤولين بأي حال من الأحوال عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية تنشأ عن استخدامك أو عدم قدرتك على استخدام الخدمة.
                </p>

                 <h3 className="font-bold text-lg text-foreground pt-4">8. التغييرات على الشروط</h3>
                <p>
                  نحتفظ بالحق، وفقًا لتقديرنا الخاص، في تعديل أو استبدال هذه الشروط في أي وقت. سنقدم إشعارًا بالتغييرات الجوهرية قبل دخولها حيز التنفيذ.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
}

// Default export for Next.js page routing. It CANNOT take props for static export.
export default function TermsOfServiceScreen(props: { goBack?: () => void, canGoBack?: boolean }) {
  // The props are passed from AppContentWrapper for navigation, but the default export must be compatible
  // with being called with NO props during `next build`.
  // We pass the props down to the actual content component.
  return <TermsOfServiceContent {...props} />;
}
