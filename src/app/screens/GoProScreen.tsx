
"use client";

import React from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const proFeatures = [
    "تجربة خالية من الإعلانات تمامًا",
    "أولوية في الحصول على الميزات الجديدة",
    "دعم فني متميز",
    "شارة مستخدم احترافي (قريبًا)",
];

const subscriptionPlans = [
    {
        name: "شهري",
        price: "4.99",
        description: "فاتورة كل شهر، ألغِ في أي وقت.",
        isPopular: false,
    },
    {
        name: "سنوي",
        price: "49.99",
        description: "وفر 20% مع الخطة السنوية.",
        isPopular: true,
    },
];


export function GoProScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { toast } = useToast();

  const handleSubscribe = (planName: string) => {
    // This is where you would later integrate with a payment provider like Stripe or RevenueCat.
    // For now, we just show a toast message.
    toast({
        title: "قريبًا!",
        description: `ميزة الاشتراك في الخطة الـ ${planName} قيد التطوير.`,
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={"النسخة الاحترافية"} onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="text-center space-y-2">
            <Gem className="mx-auto h-12 w-12 text-yellow-400" />
            <h1 className="text-3xl font-bold">نبض الملاعب برو</h1>
            <p className="text-muted-foreground">احصل على تجربة احترافية ومميزة.</p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>ميزات النسخة الاحترافية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {proFeatures.map((feature, index) => (
                     <div key={index} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-sm font-medium">{feature}</span>
                    </div>
                ))}
            </CardContent>
        </Card>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscriptionPlans.map((plan) => (
                <Card key={plan.name} className={cn("flex flex-col", plan.isPopular && "border-primary border-2")}>
                    {plan.isPopular && (
                        <div className="bg-primary text-primary-foreground text-xs font-bold text-center py-1 rounded-t-lg">
                            الأكثر شيوعًا
                        </div>
                    )}
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 text-center">
                        <p className="text-4xl font-bold">${plan.price}</p>
                        <p className="text-muted-foreground text-sm">/ {plan.name === 'شهري' ? 'شهر' : 'سنة'}</p>
                    </CardContent>
                    <CardFooter>
                         <Button className="w-full" onClick={() => handleSubscribe(plan.name)}>
                            اشترك الآن
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
