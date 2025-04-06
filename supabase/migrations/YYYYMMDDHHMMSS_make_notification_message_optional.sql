-- Migration: Make message column optional in notifications table

ALTER TABLE public.notifications
ALTER COLUMN message DROP NOT NULL; 