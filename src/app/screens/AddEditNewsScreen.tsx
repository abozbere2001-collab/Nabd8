
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import Image from 'next/image';

interface AddEditNewsScreenProps extends ScreenProps {
  article?: NewsArticle;
  isEditing: boolean;
}

export function AddEditNewsScreen({ goBack, canGoBack, article, isEditing }: AddEditNewsScreenProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageHint, setImageHint] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { db } = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (isEditing && article) {
      setTitle(article.title);
      setContent(article.content);
      setImageUrl(article.imageUrl || '');
      setImageHint(article.imageHint || '');
      setImagePreview(article.imageUrl || null);
    }
  }, [isEditing, article]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'الرجاء ملء حقلي العنوان والمحتوى.',
      });
      return;
    }
    if (!db) return;

    setSaving(true);
    let finalImageUrl: string | undefined = imageUrl.trim() || undefined;

    if (selectedFile) {
        // If a file is selected, its preview (Data URI) becomes the image URL
        finalImageUrl = imagePreview || undefined;
    }

    const newsData: Omit<NewsArticle, 'id'> = {
      title: title.trim(),
      content: content.trim(),
      timestamp: new Date(),
      ...(finalImageUrl && { imageUrl: finalImageUrl }),
      ...(imageHint.trim() && { imageHint: imageHint.trim() }),
    };

    const collectionRef = collection(db, 'news');
    const operation = isEditing && article?.id 
        ? setDoc(doc(collectionRef, article.id), newsData, { merge: true })
        : addDoc(collectionRef, newsData);

    operation.then(() => {
        toast({ title: 'نجاح', description: isEditing ? 'تم تحديث الخبر بنجاح.' : 'تم نشر الخبر بنجاح.' });
        goBack();
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: isEditing && article?.id ? `news/${article.id}` : 'news',
            operation: isEditing ? 'update' : 'create',
            requestResourceData: newsData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setSaving(false);
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={isEditing ? 'تعديل الخبر' : 'إضافة خبر جديد'} onBack={goBack} canGoBack={true} />
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardContent className="space-y-6 pt-6">

             {imagePreview && (
              <div className="relative aspect-video w-full">
                <Image src={imagePreview} alt="معاينة الصورة" fill className="rounded-md object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الخبر الرئيسي" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">المحتوى</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب تفاصيل الخبر هنا..." rows={10} />
            </div>
           
            <div className="space-y-2">
              <Label htmlFor="imageUrl">رابط الصورة (اختياري)</Label>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" dir="ltr" disabled={!!selectedFile} />
            </div>
            
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="flex-shrink mx-4 text-xs text-muted-foreground">أو</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="fileUpload">رفع صورة من الجهاز (اختياري)</Label>
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="ml-2 h-4 w-4"/>
                    {selectedFile ? `تم اختيار: ${selectedFile.name}` : "اختيار ملف"}
                </Button>
                <Input 
                    id="fileUpload"
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden"
                    accept="image/*"
                />
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
