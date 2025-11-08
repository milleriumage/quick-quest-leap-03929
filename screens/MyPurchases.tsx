import React, { useState, useEffect } from 'react';
import { useCredits } from '../hooks/useCredits';
import { supabase } from '../src/integrations/supabase/client';
import OnlyFansCard from '../components/OnlyFansCard';
import ViewContentModal from '../components/ViewContentModal';
import { ContentItem } from '../types';

const MyPurchases: React.FC = () => {
  const { currentUser, contentItems } = useCredits();
  const [unlockedContentIds, setUnlockedContentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    const loadUnlockedContent = async () => {
      if (!currentUser) return;

      try {
        const { data, error } = await supabase
          .from('unlocked_content')
          .select('content_item_id')
          .eq('user_id', currentUser.id);

        if (error) {
          console.error('Error loading unlocked content:', error);
          return;
        }

        const ids = data?.map(item => item.content_item_id) || [];
        setUnlockedContentIds(ids);
      } catch (error) {
        console.error('Error in loadUnlockedContent:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUnlockedContent();
  }, [currentUser]);

  const purchasedContent = contentItems.filter(item => 
    unlockedContentIds.includes(item.id)
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Minhas Compras</h1>
      
      {purchasedContent.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <svg 
            className="mx-auto h-12 w-12 text-muted-foreground mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
            />
          </svg>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhuma compra realizada
          </h3>
          <p className="text-muted-foreground">
            Você ainda não desbloqueou nenhum conteúdo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchasedContent.map(item => (
            <OnlyFansCard
              key={item.id}
              item={item}
              onCardClick={(clickedItem) => setSelectedItem(clickedItem)}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <ViewContentModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default MyPurchases;
