"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from './ui/textarea';
import { useAdmin } from '@/firebase/provider';

type ItemType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'status';

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item?: {
    id: string | number;
    name: string;
    note?: string;
    type: ItemType;
    originalData?: any;
  } | null;
  onSave: (type: ItemType, id: string | number, newName: string, newNote?: string) => void;
}

export function RenameDialog({
  isOpen,
  onOpenChange,
  item,
  onSave,
}: RenameDialogProps) {
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (isOpen && item) {
      setNewName(item.name || '');
      setNewNote(item.note || '');
    }
  }, [isOpen, item]);

  const handleSave = () => {
    if (item) {
        onSave(item.type, item.id, newName, newNote);
    }
    onOpenChange(false);
  };

  const itemTypeMap: Record<ItemType, string> = {
    league: 'البطولة',
    team: 'الفريق',
    player: 'اللاعب',
    continent: 'القارة',
    country: 'الدولة',
    coach: 'المدرب',
    status: 'الحالة',
  };

  const getTitle = () => {
    if (!item) return '';
    if (item.type === 'team') return `إضافة ملاحظة على فريق ${item.name}`;
    return `تعديل ${itemTypeMap[item.type]}`;
  }
  
  const getDescription = () => {
      if (!item) return '';
      if(item.type === 'team') return 'سيتم حفظ هذا الفريق مع ملاحظتك في قسم "بلدي".';
      if(isAdmin && item.type !== 'status') return `أدخل الاسم الجديد لـ ${itemTypeMap[item.type]}. اتركه فارغًا للعودة للاسم الأصلي.`;
      if(isAdmin && item.type === 'status') return `أدخل الحالة المخصصة للمباراة. اترك الحقل فارغًا لإزالته.`;
      return '';
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
             {getTitle()}
          </DialogTitle>
           <DialogDescription>
             {getDescription()}
           </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          
          {isAdmin && (item?.type !== 'team') && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="name">{item?.type === 'status' ? 'الحالة المخصصة' : 'الاسم المخصص'}</Label>
                <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={item?.type === 'status' ? 'مثال: مؤجلة' : `الاسم الأصلي: ${item?.originalData?.name || item?.name}`}
                />
            </div>
          )}

          {item?.type === 'team' && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="note">ملاحظة (اختياري)</Label>
                <Textarea 
                    id="note"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="اكتب ملاحظتك الشخصية هنا..."
                />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              إلغاء
            </Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}