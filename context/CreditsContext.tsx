
import React, { createContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { User, Transaction, TransactionType, ContentItem, SubscriptionPlan, UserSubscription, DevSettings, UserRole, CreatorTransaction, UserTimeout, Screen, CreditPackage } from '../types';
import { REWARD_AMOUNT, INITIAL_CONTENT_ITEMS, INITIAL_SUBSCRIPTION_PLANS, INITIAL_CREDIT_PACKAGES, INITIAL_USERS } from '../constants';
import { supabase } from '../src/integrations/supabase/client';

// --- DEFAULT STATES ---
const initialDevSettings: DevSettings = {
  platformCommission: 0.50, // Updated as per request
  creditValueUSD: 0.01, // Updated for more realistic value
  withdrawalCooldownHours: 24,
  maxImagesPerCard: 5,
  maxVideosPerCard: 2,
  commentsEnabled: false,
};

export interface SidebarVisibility {
  store: boolean;
  outfitGenerator: boolean;
  themeGenerator: boolean;
  manageSubscription: boolean;
  earnCredits: boolean;
  createContent: boolean;
  myCreations: boolean;
  creatorPayouts: boolean;
}

export interface NavbarVisibility {
  addCreditsButton: boolean;
  planButton: boolean;
}

const initialSidebarVisibility: SidebarVisibility = {
  store: true,
  outfitGenerator: true,
  themeGenerator: true,
  manageSubscription: true,
  earnCredits: true,
  createContent: false,
  myCreations: false,
  creatorPayouts: false,
};

const initialNavbarVisibility: NavbarVisibility = {
  addCreditsButton: true,
  planButton: true,
};

// --- CONTEXT TYPE ---
interface CreditsContextType {
  // State
  balance: number;
  earnedBalance: number;
  transactions: Transaction[];
  creatorTransactions: CreatorTransaction[];
  contentItems: ContentItem[];
  subscriptionPlans: SubscriptionPlan[];
  creditPackages: CreditPackage[];
  userSubscription: UserSubscription | null;
  subscriptions: Record<string, UserSubscription | null>; // Key is now user ID (string)
  devSettings: DevSettings;
  userRole: UserRole;
  currentScreen: Screen;
  unlockedContentIds: string[];
  withdrawalTimeEnd: number;
  
  // User & Social State
  isLoggedIn: boolean;
  currentUser: User | null;
  allUsers: User[];
  activeTagFilter: string | null;
  viewingCreatorId: string | null; // Changed to string

  // Showcase state
  showcasedUserIds: string[]; // Changed to string[]
  setShowcasedUserIds: (userIds: string[]) => void;

  // Theme state
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Sidebar visibility state
  sidebarVisibility: SidebarVisibility;
  updateSidebarVisibility: (updates: Partial<SidebarVisibility>) => void;
  
  // Navbar visibility state
  navbarVisibility: NavbarVisibility;
  updateNavbarVisibility: (updates: Partial<NavbarVisibility>) => void;

  // Actions
  addCredits: (amount: number, description: string, type: TransactionType) => void;
  processPurchase: (item: ContentItem) => boolean;
  addReward: () => void;
  addContentItem: (item: ContentItem) => void;
  deleteContent: (itemId: string) => boolean;
  updateSubscriptionPlan: (updatedPlan: SubscriptionPlan) => void;
  updateCreditPackage: (updatedPackage: CreditPackage) => void;
  subscribeToPlan: (plan: SubscriptionPlan) => void; // For current user
  cancelSubscription: () => void; // For current user
  subscribeUserToPlan: (userId: string, plan: SubscriptionPlan) => void; // For dev panel
  cancelUserSubscription: (userId: string) => void; // For dev panel
  addReaction: (itemId: string, emoji: string) => void;
  addLike: (itemId: string) => void;
  incrementShareCount: (itemId: string) => void;
  
  // User & Social Actions
  login: (userId: string) => void;
  logout: () => void;
  registerOrLoginUser: (userId: string, email: string, username?: string) => void;
  updateUserProfile: (updatedProfile: Partial<User>) => void;
  followUser: (userIdToFollow: string) => void;
  unfollowUser: (userIdToUnfollow: string) => void;
  setTagFilter: (tag: string | null) => void;
  setViewCreator: (creatorId: string | null) => void;
  shareVitrine: () => void;

  // Role & Screen Management
  setCurrentScreen: (screen: Screen) => void;

  // Dev Actions
  updateDevSettings: (settings: Partial<DevSettings>) => void;
  addCreditsToUser: (userId: string, amount: number) => void;
  toggleContentVisibility: (itemId: string) => void;
  removeContent: (itemId: string) => void;
  setTimeOut: (userId: string, durationHours: number, message: string) => void;
  hideAllContentFromCreator: (creatorId: string) => void;
  deleteAllContentFromCreator: (creatorId: string) => void;

  // Timeout Info
  isTimedOut: (userId: string) => boolean;
  timeoutInfo: (userId: string) => UserTimeout | undefined;
}

export const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

// --- PROVIDER COMPONENT ---
export const CreditsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core State
  const [balance, setBalance] = useState(0);
  const [earnedBalances, setEarnedBalances] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creatorTransactions, setCreatorTransactions] = useState<CreatorTransaction[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState({} as Record<string, UserSubscription | null>);
  const [unlockedContentIds, setUnlockedContentIds] = useState<string[]>([]);
  
  // Role, Dev, and Screen State
  const [devSettings, setDevSettings] = useState<DevSettings>(initialDevSettings);
  const [timeouts, setTimeouts] = useState<Record<string, UserTimeout>>({});
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [withdrawalTimeEnd, setWithdrawalTimeEnd] = useState(0);

  // New User, Auth & Social State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTagFilter, setTagFilter] = useState<string | null>(null);
  const [viewingCreatorId, setViewCreatorId] = useState<string | null>(null);

  // New Showcase & Theme State
  const [showcasedUserIds, setShowcasedUserIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [sidebarVisibility, setSidebarVisibility] = useState<SidebarVisibility>(initialSidebarVisibility);
  const [navbarVisibility, setNavbarVisibility] = useState<NavbarVisibility>(initialNavbarVisibility);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Carregar dados do Supabase quando usuário faz login
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoadingData(true);
        try {
          // Carregar perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            // Carregar followers
            const { data: followersData } = await supabase
              .from('followers')
              .select('follower_id, following_id')
              .or(`follower_id.eq.${session.user.id},following_id.eq.${session.user.id}`);

            const followers = followersData?.filter(f => f.following_id === session.user.id).map(f => f.follower_id) || [];
            const following = followersData?.filter(f => f.follower_id === session.user.id).map(f => f.following_id) || [];

            const user: User = {
              id: profile.id,
              username: profile.username,
              email: session.user.email || '',
              profilePictureUrl: profile.profile_picture_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              role: 'user',
              followers,
              following,
              vitrineSlug: profile.vitrine_slug,
            };

            setCurrentUser(user);
            setIsLoggedIn(true);
            setBalance(profile.credits_balance || 0);
            setEarnedBalances({ [profile.id]: profile.earned_balance || 0 });

            // Carregar transações
            const { data: transactionsData } = await supabase
              .from('transactions')
              .select('*')
              .eq('user_id', session.user.id)
              .order('timestamp', { ascending: false });

            if (transactionsData) {
              setTransactions(transactionsData.map(t => ({
                id: t.id,
                type: t.type as TransactionType,
                amount: t.amount,
                description: t.description || '',
                timestamp: t.timestamp,
              })));
            }

            // Carregar conteúdo desbloqueado
            const { data: unlockedData } = await supabase
              .from('unlocked_content')
              .select('content_item_id')
              .eq('user_id', session.user.id);

            if (unlockedData) {
              setUnlockedContentIds(unlockedData.map(u => u.content_item_id));
            }

            // Carregar assinatura
            const { data: subData } = await supabase
              .from('user_subscriptions')
              .select('*, subscription_plans(*)')
              .eq('user_id', session.user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (subData && subData.subscription_plans) {
              const plan = subData.subscription_plans;
              setSubscriptions({
                [session.user.id]: {
                  id: plan.id,
                  name: plan.name,
                  price: Number(plan.price),
                  currency: plan.currency as 'USD' | 'BRL' | 'EUR',
                  credits: plan.credits,
                  features: plan.features,
                  renewsOn: subData.renews_on,
                  paymentMethod: 'Stripe',
                  stripeProductId: plan.stripe_product_id,
                }
              });
            }
          }

          // Carregar conteúdo (independente do usuário)
          const { data: contentData } = await supabase
            .from('content_items')
            .select('*, media(*)')
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });

          if (contentData) {
            const items: ContentItem[] = await Promise.all(contentData.map(async (item) => {
              // Carregar likes
              const { data: likesData } = await supabase
                .from('likes')
                .select('user_id')
                .eq('content_item_id', item.id);

              // Carregar shares
              const { data: sharesData } = await supabase
                .from('shares')
                .select('user_id')
                .eq('content_item_id', item.id);

              // Carregar reactions
              const { data: reactionsData } = await supabase
                .from('reactions')
                .select('user_id, emoji')
                .eq('content_item_id', item.id);

              const userReactions: Record<string, string> = {};
              reactionsData?.forEach(r => {
                userReactions[r.user_id] = r.emoji;
              });

              return {
                id: item.id,
                creatorId: item.creator_id,
                title: item.title,
                price: item.price,
                imageUrl: item.media?.[0]?.storage_path || '',
                mediaType: item.media?.[0]?.media_type || 'image',
                userReactions,
                mediaCount: {
                  images: item.media?.filter((m: any) => m.media_type === 'image').length || 0,
                  videos: item.media?.filter((m: any) => m.media_type === 'video').length || 0,
                },
                isHidden: item.is_hidden,
                blurLevel: item.blur_level,
                likedBy: likesData?.map(l => l.user_id) || [],
                sharedBy: sharesData?.map(s => s.user_id) || [],
                createdAt: item.created_at,
                tags: item.tags || [],
              };
            }));
            setContentItems(items);
          }

          // Carregar planos e pacotes
          const { data: plansData } = await supabase.from('subscription_plans').select('*');
          const { data: packagesData } = await supabase.from('credit_packages').select('*');

          if (plansData) {
            setSubscriptionPlans(plansData.map(p => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              currency: p.currency as 'USD' | 'BRL' | 'EUR',
              credits: p.credits,
              features: p.features,
              stripeProductId: p.stripe_product_id,
            })));
          }

          if (packagesData) {
            setCreditPackages(packagesData.map(p => ({
              id: p.id,
              credits: p.credits,
              price: Number(p.price),
              bonus: p.bonus,
              bestValue: p.best_value,
              stripeProductId: p.stripe_product_id,
            })));
          }
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
        } finally {
          setIsLoadingData(false);
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    };

    loadUserData();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadUserData();
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setBalance(0);
        setTransactions([]);
        setUnlockedContentIds([]);
        setSubscriptions({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
      setWithdrawalTimeEnd(Date.now() + initialDevSettings.withdrawalCooldownHours * 3600 * 1000);
  }, []);
  
  const userSubscription = useMemo(() => {
      if (!currentUser) return null;
      return subscriptions[currentUser.id] || null;
  }, [currentUser, subscriptions]);

  const earnedBalance = useMemo(() => {
    if (!currentUser) return 0;
    return earnedBalances[currentUser.id] || 0;
  }, [currentUser, earnedBalances]);


  const registerOrLoginUser = useCallback((userId: string, email: string, username?: string) => {
    let user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      // Criar novo usuário se não existir
      user = {
        id: userId,
        username: username || email.split('@')[0],
        email: email,
        profilePictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        role: 'user',
        followers: [],
        following: [],
        vitrineSlug: userId,
      };
      setAllUsers(prev => [...prev, user!]);
    }
    
    setCurrentUser(user);
    setIsLoggedIn(true);
    setCurrentScreen('home');
    // For simulation, reset balances on login to reflect a new session
    setBalance(500); // Give user enough credits to buy content
    setEarnedBalances({}); // Reset all earnings
    setUnlockedContentIds([]);
  }, [allUsers]);

  const login = useCallback((userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setCurrentScreen('home');
      // For simulation, reset balances on login to reflect a new session
      setBalance(500); // Give user enough credits to buy content
      setEarnedBalances({}); // Reset all earnings
      setUnlockedContentIds([]);
    }
  }, [allUsers]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setViewCreatorId(null); 
  }, []);
  
  const updateUserProfile = useCallback(async (updatedProfile: Partial<User>) => {
      if (!currentUser) return;
      const updatedUser = { ...currentUser, ...updatedProfile };
      setCurrentUser(updatedUser);
      setAllUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

      // Salvar no Supabase
      try {
        await supabase
          .from('profiles')
          .update({
            username: updatedProfile.username,
            profile_picture_url: updatedProfile.profilePictureUrl,
            vitrine_slug: updatedProfile.vitrineSlug,
          })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
      }
  }, [currentUser]);

  const followUser = useCallback(async (userIdToFollow: string) => {
    if (!currentUser || currentUser.id === userIdToFollow) return;
    
    setAllUsers(prev => prev.map(user => {
        if (user.id === currentUser.id) {
            return { ...user, following: [...new Set([...user.following, userIdToFollow])] };
        }
        if (user.id === userIdToFollow) {
             return { ...user, followers: [...new Set([...user.followers, currentUser.id])] };
        }
        return user;
    }));
    setCurrentUser(prev => prev ? { ...prev, following: [...new Set([...prev.following, userIdToFollow])] } : null);

    // Save to Supabase
    try {
      await supabase
        .from('followers')
        .insert({ follower_id: currentUser.id, following_id: userIdToFollow });
    } catch (error) {
      console.error('Error saving follow:', error);
    }
  }, [currentUser]);

  const unfollowUser = useCallback(async (userIdToUnfollow: string) => {
     if (!currentUser) return;
     
     setAllUsers(prev => prev.map(user => {
        if (user.id === currentUser.id) {
            return { ...user, following: user.following.filter(id => id !== userIdToUnfollow) };
        }
        if (user.id === userIdToUnfollow) {
            return { ...user, followers: user.followers.filter(id => id !== currentUser.id) };
        }
        return user;
    }));
    setCurrentUser(prev => prev ? { ...prev, following: prev.following.filter(id => id !== userIdToUnfollow) } : null);

    // Save to Supabase
    try {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userIdToUnfollow);
    } catch (error) {
      console.error('Error removing follow:', error);
    }
  }, [currentUser]);

  const setTagFilterCallback = useCallback((tag: string | null) => {
      setTagFilter(tag);
      setViewCreatorId(null); 
      setCurrentScreen('home');
  }, []);

  const setViewCreatorCallback = useCallback((creatorId: string | null) => {
      setViewCreatorId(creatorId);
      setTagFilter(null); 
      setCurrentScreen(creatorId ? 'view-creator' : 'home');
  }, []);

  const shareVitrine = useCallback(() => {
    if (!currentUser || !currentUser.vitrineSlug) {
        alert("Could not generate a share link.");
        return;
    }
    const url = `https://funfans.com/vitrine/${currentUser.vitrineSlug}`;
    navigator.clipboard.writeText(url);
    alert(`Link copied to clipboard!\n${url}`);
  }, [currentUser]);

  const addTransaction = async (trans: Omit<Transaction, 'id' | 'timestamp'>) => {
    if (!currentUser) return;
    
    const newTrans = { 
      id: Date.now().toString(), 
      timestamp: new Date().toISOString(), 
      ...trans 
    };
    
    setTransactions(prev => [newTrans, ...prev]);

    // Salvar no Supabase
    try {
      await supabase.from('transactions').insert({
        user_id: currentUser.id,
        type: trans.type,
        amount: trans.amount,
        description: trans.description,
      });
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
    }
  };

  const addCredits = useCallback(async (amount: number, description: string, type: TransactionType) => {
    if (!currentUser) return;
    
    const newBalance = balance + amount;
    setBalance(newBalance);
    addTransaction({ type, amount, description });

    // Atualizar saldo no Supabase
    try {
      await supabase
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('id', currentUser.id);
    } catch (error) {
      console.error('Erro ao atualizar créditos:', error);
    }
  }, [balance, currentUser]);

  const processPurchase = useCallback(async (item: ContentItem) => {
    if (!currentUser) return false;
    if (balance >= item.price) {
      // Usar função do Supabase para compra segura
      try {
        const { data, error } = await supabase.rpc('purchase_content', {
          item_id: item.id
        });

        if (error) {
          console.error('Erro na compra:', error);
          return false;
        }

        if (data) {
          const result = data as { success: boolean; message: string };
          if (result.success) {
            // Atualizar estado local
            setBalance(prev => prev - item.price);
            setUnlockedContentIds(prev => [...prev, item.id]);
            
            addTransaction({ 
              type: TransactionType.PURCHASE, 
              amount: -item.price, 
              description: `Purchase of ${item.title}` 
            });

            return true;
          }
        }
      } catch (error) {
        console.error('Erro ao processar compra:', error);
      }
    }
    return false;
  }, [balance, currentUser]);
  
  const addReward = useCallback(() => {
    addCredits(REWARD_AMOUNT, 'Credits from watching ad', TransactionType.REWARD);
  }, [addCredits]);

  const addContentItem = useCallback(async (item: ContentItem) => {
    if (!currentUser) return;
    
    setContentItems(prev => [item, ...prev]);

    // Salvar no Supabase
    try {
      const { data: contentData, error } = await supabase
        .from('content_items')
        .insert({
          creator_id: currentUser.id,
          title: item.title,
          price: item.price,
          blur_level: item.blurLevel,
          tags: item.tags,
        })
        .select()
        .single();

      if (error) throw error;

      // Salvar mídia
      if (item.imageUrl && contentData) {
        await supabase.from('media').insert({
          content_item_id: contentData.id,
          media_type: item.mediaType || 'image',
          storage_path: item.imageUrl,
          display_order: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao criar conteúdo:', error);
    }
  }, [currentUser]);

  const deleteContent = useCallback((itemId: string): boolean => {
    const item = contentItems.find(i => i.id === itemId);
    if (!item) return false;

    const canDelete = (Date.now() - new Date(item.createdAt).getTime()) > 24 * 60 * 60 * 1000;
    if (canDelete) {
        setContentItems(prev => prev.filter(i => i.id !== itemId));
        return true;
    }
    return false;
  }, [contentItems]);

  const updateSubscriptionPlan = useCallback((updatedPlan: SubscriptionPlan) => {
    setSubscriptionPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  }, []);

   const updateCreditPackage = useCallback((updatedPackage: CreditPackage) => {
    setCreditPackages(prev => prev.map(p => p.id === updatedPackage.id ? updatedPackage : p));
  }, []);

  const subscribeToPlan = useCallback((plan: SubscriptionPlan) => {
    if (!currentUser) return;
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const newSubscription: UserSubscription = {
        ...plan,
        renewsOn: renewalDate.toISOString(),
        paymentMethod: 'Credit Card ending **** 4242'
    };
    setSubscriptions(prev => ({...prev, [currentUser.id]: newSubscription}));
    addCredits(plan.credits, `Subscription credits for ${plan.name} plan`, TransactionType.SUBSCRIPTION);
  }, [addCredits, currentUser]);

  const cancelSubscription = useCallback(() => {
    if (userSubscription && currentUser) {
        addTransaction({ type: TransactionType.SUBSCRIPTION, amount: 0, description: `Canceled ${userSubscription.name} plan` });
        setSubscriptions(prev => {
            const newSubs = {...prev};
            delete newSubs[currentUser.id];
            return newSubs;
        });
    }
  }, [userSubscription, currentUser]);

  const subscribeUserToPlan = useCallback((userId: string, plan: SubscriptionPlan) => {
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const newSubscription: UserSubscription = {
        ...plan,
        renewsOn: renewalDate.toISOString(),
        paymentMethod: 'Admin Assigned'
    };
    
    setSubscriptions(prev => ({...prev, [userId]: newSubscription}));
  }, []);

  const cancelUserSubscription = useCallback((userId: string) => {
    const subToCancel = subscriptions[userId];
    if (subToCancel) {
        addTransaction({ type: TransactionType.SUBSCRIPTION, amount: 0, description: `Admin Canceled ${subToCancel.name} for ${userId}` });
        setSubscriptions(prev => {
            const newSubs = {...prev};
            delete newSubs[userId];
            return newSubs;
        });
    }
  }, [subscriptions]);

  const addReaction = useCallback(async (itemId: string, emoji: string) => {
    if (!currentUser) return;
    
    setContentItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const newUserReactions = { ...item.userReactions };
            if (newUserReactions[currentUser.id] === emoji) {
                 delete newUserReactions[currentUser.id];
            } else {
                newUserReactions[currentUser.id] = emoji;
            }
            return { ...item, userReactions: newUserReactions };
        }
        return item;
    }));

    // Save to Supabase
    try {
      const { data: existingReaction } = await supabase
        .from('reactions')
        .select()
        .eq('content_item_id', itemId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (existingReaction && existingReaction.emoji === emoji) {
        // Remove reaction
        await supabase
          .from('reactions')
          .delete()
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id);
      } else if (existingReaction) {
        // Update reaction
        await supabase
          .from('reactions')
          .update({ emoji })
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id);
      } else {
        // Insert new reaction
        await supabase
          .from('reactions')
          .insert({ content_item_id: itemId, user_id: currentUser.id, emoji });
      }
    } catch (error) {
      console.error('Error saving reaction:', error);
    }
  }, [currentUser]);

  const addLike = useCallback(async (itemId: string) => {
      if (!currentUser) return;
      
      setContentItems(prev => prev.map(item => {
          if (item.id === itemId) {
              const hasLiked = item.likedBy.includes(currentUser.id);
              const newLikedBy = hasLiked 
                  ? item.likedBy.filter(id => id !== currentUser.id)
                  : [...item.likedBy, currentUser.id];
              return { ...item, likedBy: newLikedBy };
          }
          return item;
      }));

      // Save to Supabase
      try {
        const { data: existingLike } = await supabase
          .from('likes')
          .select()
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (existingLike) {
          // Remove like
          await supabase
            .from('likes')
            .delete()
            .eq('content_item_id', itemId)
            .eq('user_id', currentUser.id);
        } else {
          // Add like
          await supabase
            .from('likes')
            .insert({ content_item_id: itemId, user_id: currentUser.id });
        }
      } catch (error) {
        console.error('Error saving like:', error);
      }
  }, [currentUser]);

  const incrementShareCount = useCallback((itemId: string) => {
    if (!currentUser) return;
    setContentItems(prev => prev.map(item => {
        if (item.id === itemId) {
            if (!item.sharedBy.includes(currentUser.id)) {
                return { ...item, sharedBy: [...item.sharedBy, currentUser.id] };
            }
        }
        return item;
    }));
  }, [currentUser]);

  const updateDevSettings = useCallback((settings: Partial<DevSettings>) => {
    setDevSettings(prev => ({...prev, ...settings}));
  }, []);

  const addCreditsToUser = useCallback((userId: string, amount: number) => {
      // This is a simulation. In a real app, you'd target a specific user's balance.
      // Here, we add to the current user's balance for demonstration if they are the target.
      if (currentUser?.id === userId) {
          setBalance(prev => prev + amount);
          addTransaction({ type: TransactionType.CREDIT_PURCHASE, amount: amount, description: `Admin grant for user ${userId}`})
      } else {
          console.log(`(Simulated) Added ${amount} credits to user ${userId}. Balance would update if you were logged in as them.`);
      }
  }, [currentUser]);
  
  const toggleContentVisibility = useCallback((itemId: string) => {
      setContentItems(prev => prev.map(item => item.id === itemId ? {...item, isHidden: !item.isHidden} : item));
  }, []);

  const removeContent = useCallback((itemId: string) => {
      setContentItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const hideAllContentFromCreator = useCallback((creatorId: string) => {
      setContentItems(prev => prev.map(item => item.creatorId === creatorId ? {...item, isHidden: true} : item));
  }, []);

  const deleteAllContentFromCreator = useCallback((creatorId: string) => {
      setContentItems(prev => prev.filter(item => item.creatorId !== creatorId));
  }, []);

  const setTimeOut = useCallback((userId: string, durationHours: number, message: string) => {
      const endTime = Date.now() + durationHours * 60 * 60 * 1000;
      setTimeouts(prev => ({...prev, [userId]: { userId, endTime, message }}));
  }, []);

  const isTimedOut = useCallback((userId: string) => {
      const timeout = timeouts[userId];
      return timeout && Date.now() < timeout.endTime;
  }, [timeouts]);

  const timeoutInfo = useCallback((userId: string) => {
      return timeouts[userId];
  }, [timeouts]);

  const updateSidebarVisibility = useCallback((updates: Partial<SidebarVisibility>) => {
    setSidebarVisibility(prev => ({ ...prev, ...updates }));
  }, []);

  const updateNavbarVisibility = useCallback((updates: Partial<NavbarVisibility>) => {
    setNavbarVisibility(prev => ({ ...prev, ...updates }));
  }, []);
  
  const contextValue = useMemo(() => ({
    balance,
    earnedBalance,
    transactions,
    creatorTransactions,
    contentItems: contentItems.filter(item => (currentUser?.role === 'developer' || !item.isHidden)),
    subscriptionPlans,
    creditPackages,
    userSubscription,
    subscriptions,
    devSettings,
    userRole: currentUser?.role ?? 'user',
    currentScreen,
    unlockedContentIds,
    withdrawalTimeEnd,
    isLoggedIn,
    currentUser,
    allUsers,
    activeTagFilter,
    viewingCreatorId,
    showcasedUserIds,
    setShowcasedUserIds,
    theme,
    setTheme,
    addCredits,
    processPurchase,
    addReward,
    addContentItem,
    deleteContent,
    updateSubscriptionPlan,
    updateCreditPackage,
    subscribeToPlan,
    cancelSubscription,
    subscribeUserToPlan,
    cancelUserSubscription,
    addReaction,
    addLike,
    incrementShareCount,
    login,
    logout,
    registerOrLoginUser,
    updateUserProfile,
    followUser,
    unfollowUser,
    setTagFilter: setTagFilterCallback,
    setViewCreator: setViewCreatorCallback,
    shareVitrine,
    setCurrentScreen,
    updateDevSettings,
    addCreditsToUser,
    toggleContentVisibility,
    removeContent,
    setTimeOut,
    hideAllContentFromCreator,
    deleteAllContentFromCreator,
    isTimedOut,
    timeoutInfo,
    sidebarVisibility,
    updateSidebarVisibility,
    navbarVisibility,
    updateNavbarVisibility,
  }), [
      balance, earnedBalance, transactions, creatorTransactions, contentItems, 
      subscriptionPlans, creditPackages, userSubscription, subscriptions, devSettings, currentUser, currentScreen,
      unlockedContentIds, withdrawalTimeEnd, isLoggedIn, allUsers, activeTagFilter, viewingCreatorId,
      showcasedUserIds, theme, addCredits, processPurchase, addReward, addContentItem, deleteContent, 
      updateSubscriptionPlan, updateCreditPackage, subscribeToPlan, cancelSubscription, subscribeUserToPlan, 
      cancelUserSubscription, addReaction, addLike, incrementShareCount, login, logout, registerOrLoginUser, 
      updateUserProfile, followUser, unfollowUser, setTagFilterCallback, setViewCreatorCallback, shareVitrine, 
      updateDevSettings, addCreditsToUser, toggleContentVisibility, removeContent, setTimeOut, 
      hideAllContentFromCreator, deleteAllContentFromCreator, isTimedOut, timeoutInfo, sidebarVisibility, 
      updateSidebarVisibility, navbarVisibility, updateNavbarVisibility,
  ]);

  return (
    <CreditsContext.Provider value={contextValue}>
      {children}
    </CreditsContext.Provider>
  );
};