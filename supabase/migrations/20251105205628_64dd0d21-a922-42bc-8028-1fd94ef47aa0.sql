-- Enable INSERT for transactions
CREATE POLICY "Allow users to create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable INSERT for unlocked_content  
CREATE POLICY "Allow users to unlock content"
ON public.unlocked_content
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable INSERT for profiles (for new user creation)
CREATE POLICY "Allow users to create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_timestamp 
ON public.transactions(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_unlocked_content_user 
ON public.unlocked_content(user_id, content_item_id);

CREATE INDEX IF NOT EXISTS idx_content_items_creator 
ON public.content_items(creator_id, created_at DESC);