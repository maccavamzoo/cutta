-- Protocol content changed from MacroRange objects to single numbers.
-- fat_g_per_kg removed (auto-calculated).
-- Existing protocol rows in the DB will fail validation.
-- Run this to deactivate all existing protocols so users pick the new Default template.
UPDATE protocols SET is_active = false;
