"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentName: string;
  onSave: (newName: string) => void;
  itemType?: string;
}

export function RenameDialog({
  isOpen,
  onOpenChange,
  currentName,
  onSave,
  itemType = 'العنصر',
}: RenameDialogProps) {
  const [newName, setNewName] = useState(currentName);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إعادة تسمية {itemType}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              الاسم الجديد
            </Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="col-span-3"
            />
          </div>
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
