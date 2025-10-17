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

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentName: string;
  currentNote?: string;
  onSave: (newName: string, newNote?: string) => void;
  itemType?: string;
  hasNoteField?: boolean;
}

export function RenameDialog({
  isOpen,
  onOpenChange,
  currentName,
  currentNote = '',
  onSave,
  itemType = 'العنصر',
  hasNoteField = false,
}: RenameDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [newNote, setNewNote] = useState(currentNote);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setNewNote(currentNote);
    }
  }, [isOpen, currentName, currentNote]);

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim(), hasNoteField ? newNote.trim() : undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تعديل {itemType}</DialogTitle>
           {hasNoteField && (
             <DialogDescription>
                يمكنك تعديل الاسم المخصص وإضافة ملاحظة إدارية خاصة.
             </DialogDescription>
           )}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">الاسم المخصص</Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
