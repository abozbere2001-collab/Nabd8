

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

  const itemTypeDisplay = item ? itemTypeMap[item.type] : 'العنصر';
  const isTeamAndUser = item?.type === 'team' && !isAdmin;
  const isTeamAndAdmin = item?.type === 'team' && isAdmin;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
             {isTeamAndUser ? `ملاحظة على ${item.name}` : `تعديل ${itemTypeDisplay}`}
          </DialogTitle>
           <DialogDescription>
             {isTeamAndUser && "أضف ملاحظة شخصية على هذا الفريق. ستظهر هذه الملاحظة لك فقط."}
             {isTeamAndAdmin && "يمكنك تعديل الاسم المخصص للفريق وإضافة ملاحظة إدارية."}
             {isAdmin && item?.type !== 'team' && `أدخل القيمة الجديدة لـ ${itemTypeDisplay}.`}
           </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          
          {isAdmin && !isTeamAndUser && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="name">{item?.type === 'status' ? 'الحالة المخصصة' : 'الاسم المخصص'}</Label>
                <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={item?.type === 'status' ? 'مثال: مؤجلة' : `الاسم الأصلي: ${item?.originalName || item?.name}`}
                />
            </div>
          )}

          {item?.type === 'team' && (
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="note">ملاحظة</Label>
                <Textarea 
                    id="note"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={isAdmin ? "ملاحظة (تظهر للجميع)" : "اكتب ملاحظتك الشخصية هنا..."}
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

