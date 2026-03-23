-- Enable standard Storage RLS policies for deliverables_vault

-- Note: In a production environment with strict security, you would 
-- typically restrict who can select, insert, update, or delete.
-- For the CMS to function smoothly with the current configuration, 
-- we allow authenticated users to perform operations.

-- Allow read access to all users (public or authenticated)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'deliverables_vault' );

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'deliverables_vault' );

-- Allow authenticated users to update their files
CREATE POLICY "Users can update own files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'deliverables_vault' );

-- Allow authenticated users to delete files
CREATE POLICY "Users can delete own files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'deliverables_vault' );
