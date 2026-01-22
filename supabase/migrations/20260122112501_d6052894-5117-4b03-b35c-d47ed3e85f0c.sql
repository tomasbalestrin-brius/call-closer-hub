-- Remove duplicate calls keeping only the most recent per source_file_id
DELETE FROM calls
WHERE id NOT IN (
  SELECT DISTINCT ON (source_file_id) id
  FROM calls
  WHERE source_file_id IS NOT NULL
  ORDER BY source_file_id, created_at DESC
)
AND source_file_id IS NOT NULL;

-- Add unique constraint to prevent future duplicates
ALTER TABLE calls ADD CONSTRAINT unique_source_file_id UNIQUE (source_file_id);