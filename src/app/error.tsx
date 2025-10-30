
"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
    
    // Check if the error is a chunk loading error
    if (error.message.includes("Failed to fetch") || error.message.includes("Failed to load chunk")) {
      // This is a common issue after a new deployment.
      // Reloading the page fetches the latest assets and resolves the error.
      window.location.reload();
    }

  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="mt-4">حدث خطأ ما</CardTitle>
          <CardDescription>
            عذرًا، حدث خطأ غير متوقع. يمكنك محاولة إعادة تحميل الصفحة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === "development" && (
            <div className="text-left text-xs bg-muted p-3 rounded-md text-muted-foreground overflow-auto max-h-40">
              <p className="font-bold">تفاصيل الخطأ (للمطورين):</p>
              <pre className="whitespace-pre-wrap font-mono mt-2">
                {error.message}
              </pre>
            </div>
          )}
          <Button
            onClick={
              // Attempt to recover by trying to re-render the segment
              () => reset()
            }
            className="w-full"
          >
            حاول مرة أخرى
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
