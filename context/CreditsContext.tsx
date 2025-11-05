
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
  const [isInitializing, setIsInitializing] = useState(true);

  // Load admin settings from Supabase
  useEffect(() => {
    const loadAdminSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (data.dev_settings) {
            setDevSettings(data.dev_settings as unknown as DevSettings);
          }
          if (data.sidebar_visibility) {
            setSidebarVisibility(data.sidebar_visibility as unknown as SidebarVisibility);
          }
          if (data.navbar_visibility) {
            setNavbarVisibility(data.navbar_visibility as unknown as NavbarVisibility);
          }
        }
      } catch (error) {
        console.error('Error loading admin settings:', error);
      }
    };

    loadAdminSettings();
  }, []);

  // Load subscription plans and credit packages
  useEffect(() => {
    const loadPlansAndPackages = async () => {
      try {
        const [plansResult, packagesResult] = await Promise.all([
          supabase.from('subscription_plans').select('*'),
          supabase.from('credit_packages').select('*')
        ]);

        if (plansResult.data) {
          setSubscriptionPlans(plansResult.data.map(p => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            credits: p.credits,
            features: p.features,
            currency: p.currency,
            stripeProductId: p.stripe_product_id || undefined
          })));
        }

        if (packagesResult.data) {
          setCreditPackages(packagesResult.data.map(pkg => ({
            id: pkg.id,
            credits: pkg.credits,
            bonus: pkg.bonus,
            price: Number(pkg.price),
            bestValue: pkg.best_value,
            stripeProductId: pkg.stripe_product_id
          })));
        }
      } catch (error) {
        console.error('Error loading plans and packages:', error);
      }
    };

    loadPlansAndPackages();
  }, []);

  // Monitor auth state and load user data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await loadUserData(session.user.id);
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsInitializing(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Load followers and following
      const [followersResult, followingResult] = await Promise.all([
        supabase.from('followers').select('follower_id').eq('following_id', userId),
        supabase.from('followers').select('following_id').eq('follower_id', userId)
      ]);

      const user: User = {
        id: profile.id,
        username: profile.username,
        email: '', // Email is in auth.users, not profiles
        profilePictureUrl: profile.profile_picture_url || '',
        role: 'user',
        followers: followersResult.data?.map(f => f.follower_id) || [],
        following: followingResult.data?.map(f => f.following_id) || [],
        vitrineSlug: profile.vitrine_slug || ''
      };

      setCurrentUser(user);
      setIsLoggedIn(true);
      setBalance(profile.credits_balance || 0);
      setEarnedBalances(prev => ({ ...prev, [userId]: profile.earned_balance || 0 }));

      // Load user transactions
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (transactionsData) {
        setTransactions(transactionsData.map(t => ({
          id: t.id,
          type: t.type as TransactionType,
          amount: t.amount,
          description: t.description || '',
          timestamp: t.timestamp
        })));
      }

      // Load unlocked content
      const { data: unlockedData } = await supabase
        .from('unlocked_content')
        .select('content_item_id')
        .eq('user_id', userId);

      if (unlockedData) {
        setUnlockedContentIds(unlockedData.map(u => u.content_item_id));
      }

      // Load user subscription
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (subData && subData.subscription_plans) {
        const plan = subData.subscription_plans;
        setSubscriptions(prev => ({
          ...prev,
          [userId]: {
            id: plan.id,
            name: plan.name,
            price: Number(plan.price),
            credits: plan.credits,
            features: plan.features,
            currency: plan.currency,
            renewsOn: subData.renews_on,
            paymentMethod: 'Credit Card'
          }
        }));
      }

      // Load all content items
      await loadContentItems();

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadContentItems = async () => {
    try {
      const { data: items, error } = await supabase
        .from('content_items')
        .select('*, media(*), reactions(*), likes(*), shares(*)')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (items) {
        const formattedItems: ContentItem[] = items.map(item => ({
          id: item.id,
          title: item.title,
          creatorId: item.creator_id,
          price: item.price,
          tags: item.tags || [],
          imageUrl: '', // Will be set from media
          blurLevel: item.blur_level,
          createdAt: item.created_at,
          likes: item.likes?.length || 0,
          shares: item.shares?.length || 0,
          likedBy: item.likes?.map((l: any) => l.user_id) || [],
          sharedBy: item.shares?.map((s: any) => s.user_id) || [],
          userReactions: item.reactions?.reduce((acc: Record<string, string>, r: any) => {
            acc[r.user_id] = r.emoji;
            return acc;
          }, {}),
          mediaCount: {
            images: item.media?.filter((m: any) => m.media_type === 'image').length || 0,
            videos: item.media?.filter((m: any) => m.media_type === 'video').length || 0
          }
        }));

        setContentItems(formattedItems);
      }
    } catch (error) {
      console.error('Error loading content items:', error);
    }
  };

  useEffect(() => {
      setWithdrawalTimeEnd(Date.now() + devSettings.withdrawalCooldownHours * 3600 * 1000);
  }, [devSettings.withdrawalCooldownHours]);
  
  const userSubscription = useMemo(() => {
      if (!currentUser) return null;
      return subscriptions[currentUser.id] || null;
  }, [currentUser, subscriptions]);

  const earnedBalance = useMemo(() => {
    if (!currentUser) return 0;
    return earnedBalances[currentUser.id] || 0;
  }, [currentUser, earnedBalances]);


  const registerOrLoginUser = useCallback((userId: string, email: string, username?: string) => {
    // This is now handled by Supabase auth - loadUserData is called automatically
    console.warn('registerOrLoginUser is deprecated - use Supabase auth directly');
  }, []);

  const login = useCallback((userId: string) => {
    // This is now handled by Supabase auth - loadUserData is called automatically
    console.warn('login is deprecated - use Supabase auth directly');
  }, []);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setViewCreatorId(null);
    setBalance(0);
    setTransactions([]);
    setUnlockedContentIds([]);
    setEarnedBalances({});
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);
  
  const updateUserProfile = useCallback(async (updatedProfile: Partial<User>) => {
    if (!currentUser) return;
    
    const updatedUser = { ...currentUser, ...updatedProfile };
    setCurrentUser(updatedUser);
    setAllUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

    // Save to Supabase
    try {
      const updateData: any = {};
      if (updatedProfile.username) updateData.username = updatedProfile.username;
      if (updatedProfile.profilePictureUrl) updateData.profile_picture_url = updatedProfile.profilePictureUrl;
      if (updatedProfile.vitrineSlug) updateData.vitrine_slug = updatedProfile.vitrineSlug;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', currentUser.id);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
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
    
    const newTransaction = { 
      id: Date.now().toString(), 
      timestamp: new Date().toISOString(), 
      ...trans 
    };
    
    setTransactions(prev => [newTransaction, ...prev]);

    // Save to Supabase
    try {
      await supabase.from('transactions').insert({
        user_id: currentUser.id,
        type: trans.type,
        amount: trans.amount,
        description: trans.description
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const addCredits = useCallback(async (amount: number, description: string, type: TransactionType) => {
    if (!currentUser) return;
    
    const newBalance = balance + amount;
    setBalance(newBalance);
    await addTransaction({ type, amount, description });

    // Update balance in Supabase
    try {
      await supabase
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('id', currentUser.id);
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  }, [balance, currentUser]);

  const processPurchase = useCallback(async (item: ContentItem) => {
    if (!currentUser) return false;
    if (balance >= item.price) {
      const newBalance = balance - item.price;
      setBalance(newBalance);
      await addTransaction({ type: TransactionType.PURCHASE, amount: -item.price, description: `Purchase of ${item.title}` });

      const earnings = item.price * (1 - devSettings.platformCommission);
      
      setEarnedBalances(prev => ({
          ...prev,
          [item.creatorId]: (prev[item.creatorId] || 0) + earnings
      }));

      setCreatorTransactions(prev => [
          {
              id: `ctx_${Date.now()}`,
              cardId: item.id,
              cardTitle: item.title,
              buyerId: currentUser.id,
              amountReceived: earnings,
              originalPrice: item.price,
              timestamp: new Date().toISOString(),
              mediaCount: item.mediaCount,
          },
          ...prev
      ]);
      
      setUnlockedContentIds(prev => [...prev, item.id]);

      // Save to Supabase using purchase_content function
      try {
        await supabase.rpc('purchase_content', { item_id: item.id });
      } catch (error) {
        console.error('Error processing purchase:', error);
      }

      return true;
    }
    return false;
  }, [balance, devSettings.platformCommission, currentUser]);
  
  const addReward = useCallback(() => {
    addCredits(REWARD_AMOUNT, 'Credits from watching ad', TransactionType.REWARD);
  }, [addCredits]);

  const addContentItem = useCallback((item: ContentItem) => {
    setContentItems(prev => [item, ...prev]);
  }, []);

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

  const updateDevSettings = useCallback(async (settings: Partial<DevSettings>) => {
    const newSettings = { ...devSettings, ...settings };
    setDevSettings(newSettings);

    // Save to Supabase
    try {
      const { data: adminSettings } = await supabase
        .from('admin_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (adminSettings) {
        await supabase
          .from('admin_settings')
          .update({ dev_settings: newSettings })
          .eq('id', adminSettings.id);
      }
    } catch (error) {
      console.error('Error updating dev settings:', error);
    }
  }, [devSettings]);

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

  const updateSidebarVisibility = useCallback(async (updates: Partial<SidebarVisibility>) => {
    const newVisibility = { ...sidebarVisibility, ...updates };
    setSidebarVisibility(newVisibility);

    // Save to Supabase
    try {
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (settings) {
        await supabase
          .from('admin_settings')
          .update({ sidebar_visibility: newVisibility })
          .eq('id', settings.id);
      }
    } catch (error) {
      console.error('Error updating sidebar visibility:', error);
    }
  }, [sidebarVisibility]);

  const updateNavbarVisibility = useCallback(async (updates: Partial<NavbarVisibility>) => {
    const newVisibility = { ...navbarVisibility, ...updates };
    setNavbarVisibility(newVisibility);

    // Save to Supabase
    try {
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (settings) {
        await supabase
          .from('admin_settings')
          .update({ navbar_visibility: newVisibility })
          .eq('id', settings.id);
      }
    } catch (error) {
      console.error('Error updating navbar visibility:', error);
    }
  }, [navbarVisibility]);
  
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