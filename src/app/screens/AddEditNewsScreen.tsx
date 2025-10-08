
"use client";

import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface AddEditNewsScreenProps extends ScreenProps {
  article?: NewsArticle;
  isEditing: boolean;
}

export function AddEditNewsScreen({ navigate, goBack, canGoBack, headerActions, article, isEditing }: AddEditNewsScreenProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageHint, setImageHint] = useState('');
  const [saving, setSaving] = useState(false);
  const { db } = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && article) {
      setTitle(article.title);
      setContent(article.content);
      setImageUrl(article.imageUrl);
      setImageHint(article.imageHint || '');
    }
  }, [isEditing, article]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !imageUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'الرجاء ملء جميع الحقول المطلوبة (العنوان، المحتوى، رابط الصورة).',
      });
      return;
    }

    setSaving(true);
    const newsData = {
      title: title.trim(),
      content: content.trim(),
      imageUrl: imageUrl.trim(),
      imageHint: imageHint.trim(),
      timestamp: serverTimestamp(),
    };

    try {
      if (isEditing && article?.id) {
        const docRef = doc(db, 'news', article.id);
        await setDoc(docRef, newsData, { merge: true });
        toast({ title: 'نجاح', description: 'تم تحديث الخبر بنجاح.' });
      } else {
        const collectionRef = collection(db, 'news');
        await addDoc(collectionRef, newsData);
        toast({ title: 'نجاح', description: 'تم نشر الخبر بنجاح.' });
      }
      goBack();
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: isEditing && article?.id ? `news/${article.id}` : 'news',
            operation: isEditing ? 'update' : 'create',
            requestResourceData: newsData,
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={isEditing ? 'تعديل الخبر' : 'إضافة خبر جديد'} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الخبر الرئيسي" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">المحتوى</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب تفاصيل الخبر هنا..." rows={10} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">رابط الصورة</Label>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" dir="ltr" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="imageHint">تلميح للصورة (اختياري)</Label>
              <Input id="imageHint" value={imageHint} onChange={(e) => setImageHint(e.target.value)} placeholder="مثال: football match" />
               <p className="text-xs text-muted-foreground">كلمتان كحد أقصى لوصف الصورة لمساعدة الذكاء الاصطناعي.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? 'حفظ التعديلات' : 'نشر الخبر')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
