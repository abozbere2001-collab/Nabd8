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
    purpose: 'rename' | 'note';
    originalData?: any;
    originalName?: string;
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
    if (item.purpose === 'note') return `إضافة ملاحظة على ${item.name}`;
    return `تعديل اسم ${itemTypeMap[item.type]}`;
  }
  
  const getDescription = () => {
      if (!item) return '';
      if(item.purpose === 'note') return 'سيتم حفظ هذا العنصر مع ملاحظتك في قسم "بلدي".';
      if(isAdmin && item.purpose === 'rename') return `أدخل الاسم الجديد (الترجمة). اتركه فارغًا للعودة للاسم الأصلي.`;
      return '';
  }

  const showNameField = isAdmin && item?.purpose === 'rename';
  const showNoteField = item?.purpose === 'note';

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
          
          {showNameField && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="name">الاسم المخصص (للترجمة)</Label>
                <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`الاسم الأصلي: ${item?.originalName || item?.name}`}
                />
            </div>
          )}

          {showNoteField && (
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

    