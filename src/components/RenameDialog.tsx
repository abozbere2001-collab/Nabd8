

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

type ItemType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'matchStatus';

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item?: {
    id: string | number;
    name: string;
    note?: string;
    type: ItemType;
    originalName?: string;
  } | null;
  onSave: (newName: string, newNote?: string) => void;
}

export function RenameDialog({
  isOpen,
  onOpenChange,
  item,
  onSave,
}: RenameDialogProps) {
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      setNewName(item.name || '');
      setNewNote(item.note || '');
    }
  }, [isOpen, item]);

  const handleSave = () => {
    if (item) {
        onSave(newName, hasNoteField ? newNote : undefined);
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
    matchStatus: 'حالة المباراة'
  };

  const hasNoteField = item?.type === 'team';
  const itemTypeDisplay = item ? itemTypeMap[item.type] : 'العنصر';
  const isMatchStatus = item?.type === 'matchStatus';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تعديل {itemTypeDisplay}</DialogTitle>
           {(hasNoteField || isMatchStatus) && (
             <DialogDescription>
                {isMatchStatus 
                    ? "أدخل نصًا مخصصًا ليظهر بدلاً من توقيت المباراة (مثل 'الكلاسيكو'). اتركه فارغًا للعودة للحالة الافتراضية."
                    : "يمكنك تعديل الاسم المخصص وإضافة ملاحظة إدارية خاصة."
                }
             </DialogDescription>
           )}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">{isMatchStatus ? 'الحالة المخصصة' : 'الاسم المخصص'}</Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isMatchStatus ? 'مثال: الكلاسيكر' : `الاسم الأصلي: ${item?.originalName || item?.name}`}
            />
          </div>
          {hasNoteField && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="note">ملاحظة إدارية (اختياري)</Label>
                <Textarea 
                    id="note"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="اكتب ملاحظتك هنا... (تظهر في قسم 'كرتنا')"
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
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
