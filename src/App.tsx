import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  FileText, 
  User, 
  LogOut, 
  Save, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Briefcase,
  Layers,
  Star,
  Search,
  Home,
  ArrowRight,
  ArrowLeft,
  Code,
  ThumbsUp,
  AlertTriangle,
  Trophy,
  Lightbulb,
  TrendingUp,
  Medal,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { screenCV, generateCVReport, type JobRequirements, type ScreeningResult } from './services/gemini';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SavedJobProfile extends JobRequirements {
  id: string;
  uid: string;
  createdAt: any;
}

interface SavedScreening extends ScreeningResult {
  id: string;
  jobProfileId: string;
  fileName?: string;
  uid: string;
  createdAt: any;
}

function Dashboard() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobProfiles, setJobProfiles] = useState<SavedJobProfile[]>([]);
  const [screenings, setScreenings] = useState<SavedScreening[]>([]);
  
  const [currentRequirements, setCurrentRequirements] = useState<JobRequirements>({
    name: '',
    experience: '',
    field: '',
    skills: '',
    otherRequirements: ''
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isScreening, setIsScreening] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'requirements' | 'results' | 'profiles'>('home');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [resultsProfileId, setResultsProfileId] = useState<string | null>(null);
  const [selectedScreening, setSelectedScreening] = useState<SavedScreening | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setJobProfiles([]);
      setScreenings([]);
      return;
    }

    const profilesQuery = query(
      collection(db, 'jobProfiles'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const screeningsQuery = query(
      collection(db, 'screenings'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubProfiles = onSnapshot(profilesQuery, (snapshot) => {
      setJobProfiles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavedJobProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'jobProfiles'));

    const unsubScreenings = onSnapshot(screeningsQuery, (snapshot) => {
      setScreenings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavedScreening)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'screenings'));

    return () => {
      unsubProfiles();
      unsubScreenings();
    };
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => {
        const combined = [...prev, ...newFiles];
        // Filter out duplicates by name
        return combined.filter((file, index, self) => 
          index === self.findIndex((f) => f.name === file.name)
        );
      });
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleScreening = async () => {
    if (!activeProfileId) {
      setError("Please save the job profile first before screening CVs.");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("Please select at least one CV file.");
      return;
    }

    // Check for duplicates based on file name and profile ID
    const newFiles = selectedFiles.filter(file => {
      return !screenings.some(s => s.jobProfileId === activeProfileId && s.fileName === file.name);
    });

    if (newFiles.length === 0) {
      setError("All selected CVs have already been screened for this profile.");
      setSelectedFiles([]);
      return;
    }

    if (newFiles.length < selectedFiles.length) {
      setError(`${selectedFiles.length - newFiles.length} CV(s) were skipped because they were already screened for this profile.`);
    } else {
      setError(null);
    }

    setIsScreening(true);

    try {
      for (const file of newFiles) {
        const base64 = await fileToBase64(file);
        const result = await screenCV(base64, file.type, currentRequirements);
        
        if (user) {
          await addDoc(collection(db, 'screenings'), {
            ...result,
            fileName: file.name,
            jobProfileId: activeProfileId,
            uid: user.uid,
            createdAt: serverTimestamp()
          });
        } else {
          setScreenings(prev => [{
            id: Date.now().toString() + Math.random().toString(),
            ...result,
            fileName: file.name,
            jobProfileId: activeProfileId,
            uid: 'local',
            createdAt: new Date()
          } as SavedScreening, ...prev]);
        }
      }
      setActiveTab('results');
      setSelectedFiles([]);
    } catch (err: any) {
      console.error(err);
      setError("Failed to screen CVs. Please try again.");
    } finally {
      setIsScreening(false);
    }
  };

  const saveProfile = async () => {
    if (!currentRequirements.name) {
      setError("Please provide a name for the job profile.");
      return;
    }
    if (!user) {
      if (activeProfileId) {
        setJobProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, ...currentRequirements } as SavedJobProfile : p));
      } else {
        const newId = Date.now().toString();
        setJobProfiles(prev => [{ id: newId, ...currentRequirements, uid: 'local', createdAt: new Date() } as SavedJobProfile, ...prev]);
        setActiveProfileId(newId);
      }
      setError(null);
      return;
    }
    try {
      if (activeProfileId) {
        await updateDoc(doc(db, 'jobProfiles', activeProfileId), {
          ...currentRequirements
        });
      } else {
        const docRef = await addDoc(collection(db, 'jobProfiles'), {
          ...currentRequirements,
          uid: user.uid,
          createdAt: serverTimestamp()
        });
        setActiveProfileId(docRef.id);
      }
      setError(null);
    } catch (err) {
      handleFirestoreError(err, activeProfileId ? OperationType.UPDATE : OperationType.CREATE, 'jobProfiles');
    }
  };

  const loadProfile = (profile: SavedJobProfile) => {
    setCurrentRequirements({
      name: profile.name,
      experience: profile.experience,
      field: profile.field,
      skills: profile.skills,
      otherRequirements: profile.otherRequirements
    });
    setActiveProfileId(profile.id);
    setActiveTab('requirements');
  };

  const deleteProfile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      setJobProfiles(prev => prev.filter(p => p.id !== id));
      if (activeProfileId === id) setActiveProfileId(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'jobProfiles', id));
      if (activeProfileId === id) {
        setActiveProfileId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'jobProfiles');
    }
  };

  const toggleProfileSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedProfileIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedProfileIds(newSet);
  };

  const deleteSelectedProfiles = async () => {
    if (selectedProfileIds.size === 0) return;
    if (!user) {
      setJobProfiles(prev => prev.filter(p => !selectedProfileIds.has(p.id)));
      if (activeProfileId && selectedProfileIds.has(activeProfileId)) {
        setActiveProfileId(null);
      }
      setSelectedProfileIds(new Set());
      return;
    }
    try {
      for (const id of selectedProfileIds) {
        await deleteDoc(doc(db, 'jobProfiles', id));
        if (activeProfileId === id) {
          setActiveProfileId(null);
        }
      }
      setSelectedProfileIds(new Set());
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'jobProfiles');
    }
  };

  const deleteScreening = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      setScreenings(prev => prev.filter(s => s.id !== id));
      if (selectedScreening?.id === id) setSelectedScreening(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'screenings', id));
      if (selectedScreening?.id === id) {
        setSelectedScreening(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'screenings');
    }
  };

  const clearAllCurrentScreenings = async (profileId: string) => {
    if (!profileId) return;
    if (!user) {
      setScreenings(prev => prev.filter(s => s.jobProfileId !== profileId));
      return;
    }
    const toDelete = screenings.filter(s => s.jobProfileId === profileId);
    try {
      for (const s of toDelete) {
        await deleteDoc(doc(db, 'screenings', s.id));
      }
    } catch (err) {
      console.error("Error deleting screenings", err);
    }
  };

  const toggleResultSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedResultIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedResultIds(newSet);
  };

  const deleteSelectedScreenings = async () => {
    if (selectedResultIds.size === 0) return;
    if (!user) {
      setScreenings(prev => prev.filter(s => !selectedResultIds.has(s.id)));
      setSelectedResultIds(new Set());
      return;
    }
    try {
      for (const id of selectedResultIds) {
        await deleteDoc(doc(db, 'screenings', id));
      }
      setSelectedResultIds(new Set());
    } catch (err) {
      console.error("Error deleting selected screenings", err);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedScreening) return;
    setIsGeneratingReport(true);
    setReportText(null);
    setIsReportModalOpen(true);
    try {
      const profile = jobProfiles.find(p => p.id === selectedScreening.jobProfileId);
      if (!profile) throw new Error("Profile not found");
      const report = await generateCVReport(selectedScreening, profile);
      setReportText(report);
    } catch (err) {
      console.error("Error generating report:", err);
      setReportText("Failed to generate report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const reportRef = useRef<HTMLDivElement>(null);
  
  const handleSavePDF = () => {
    // The print styles are already defined in index.css
    // which will hide everything except the report content
    window.print();
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/cancelled-popup-request') {
        // This is often a benign error if multiple clicks happened or a previous one was pending
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login popup was closed. Please try again.");
      } else {
        setError("Failed to login with Google. Please check your connection.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#273F5B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#273F5B] font-sans pb-24">
      {/* Header */}
      <header className="bg-[#1C2D42] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif font-semibold text-2xl tracking-tight text-white">CVfiy</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-3 text-sm font-medium text-white/90 bg-white/10 py-1.5 px-4 rounded-full border border-white/20 shadow-sm">
                  <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full" />
                  <span>{user.displayName}</span>
                </div>
                <button onClick={logout} className="w-10 h-10 flex items-center justify-center bg-white/10 border border-white/20 hover:bg-white/20 rounded-full text-white transition-colors shadow-sm">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/login')} className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
                  Log in
                </button>
                <button onClick={() => navigate('/login')} className="px-4 py-2 text-sm font-medium bg-white/10 text-white border border-white/20 rounded-full hover:bg-white/20 transition-colors shadow-sm">
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex gap-2 bg-[#D2BCA1]/50 p-1.5 rounded-full mb-12 w-fit mx-auto sm:mx-0 overflow-x-auto max-w-full">
          {[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'requirements', label: 'Requirements', icon: FileText },
            { id: 'results', label: 'Results', icon: CheckCircle2 },
            { id: 'profiles', label: 'Saved Profiles', icon: Layers }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                activeTab === tab.id 
                  ? "bg-[#FFFFFF] text-[#273F5B] shadow-sm" 
                  : "text-[#7F715F] hover:text-[#273F5B] hover:bg-[#FFFFFF]/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="relative w-full h-[400px] rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] group">
                <img 
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80" 
                  alt="Man in a navy blue formal suit" 
                  className="w-full h-full object-cover object-[center_20%] transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C2D42] via-[#1C2D42]/70 to-[#1C2D42]/30 flex flex-col justify-end p-8 sm:p-14">
                  <span className="text-[#D2BCA1] font-semibold tracking-widest uppercase text-xs mb-3 block">Welcome to the future of hiring</span>
                  <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-white mb-4 leading-tight">
                    Find the perfect candidate <br className="hidden sm:block" />in seconds, not hours.
                  </h1>
                  <p className="text-[#D2BCA1] max-w-2xl text-lg font-light mb-8">
                    Leverage the power of AI to screen hundreds of CVs against your specific job requirements instantly.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => setActiveTab('requirements')}
                      className="bg-[#273F5B] text-white px-8 py-4 rounded-full font-medium hover:bg-[#1C2D42] transition-all flex items-center gap-2"
                    >
                      Start Screening <ArrowRight className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setActiveTab('profiles')}
                      className="bg-[#FFFFFF]/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-full font-medium hover:bg-[#FFFFFF]/20 transition-all"
                    >
                      View Saved Profiles
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#FFFFFF] rounded-[32px] p-8 border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <div className="w-12 h-12 bg-[#E9ECF0] rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-6 h-6 text-[#273F5B]" />
                  </div>
                  <h3 className="text-xl font-serif font-semibold text-[#273F5B] mb-3">1. Define Requirements</h3>
                  <p className="text-[#7F715F] font-light leading-relaxed">Create detailed job profiles specifying experience, skills, and industry requirements.</p>
                </div>
                <div className="bg-[#FFFFFF] rounded-[32px] p-8 border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <div className="w-12 h-12 bg-[#FFFFFF] rounded-full flex items-center justify-center mb-6">
                    <Upload className="w-6 h-6 text-[#6F481C]" />
                  </div>
                  <h3 className="text-xl font-serif font-semibold text-[#273F5B] mb-3">2. Upload CVs</h3>
                  <p className="text-[#7F715F] font-light leading-relaxed">Upload multiple candidate resumes in PDF, image, or text formats all at once.</p>
                </div>
                <div className="bg-[#FFFFFF] rounded-[32px] p-8 border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <div className="w-12 h-12 bg-[#E9ECF0] rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-6 h-6 text-[#273F5B]" />
                  </div>
                  <h3 className="text-xl font-serif font-semibold text-[#273F5B] mb-3">3. Get AI Analysis</h3>
                  <p className="text-[#7F715F] font-light leading-relaxed">Receive instant match scores, key strengths, and detailed summaries for each candidate.</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'requirements' && (
            <motion.div
              key="requirements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-8"
            >
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-[#FFFFFF] rounded-[32px] p-8 sm:p-10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[#D2BCA1] space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-serif font-semibold text-[#273F5B]">
                      Job Requirements
                    </h2>
                    <div className="w-12 h-12 bg-[#E9ECF0] rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#273F5B]" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7F715F]">Profile Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Senior Backend Engineer"
                        className="w-full bg-[#FFFFFF] border border-[#D2BCA1] rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#273F5B]/30 focus:border-[#273F5B] outline-none transition-all text-[#273F5B] placeholder:text-[#D2BCA1]"
                        value={currentRequirements.name}
                        onChange={e => setCurrentRequirements({...currentRequirements, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7F715F]">Field / Industry</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Fintech, Healthcare"
                        className="w-full bg-[#FFFFFF] border border-[#D2BCA1] rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#273F5B]/30 focus:border-[#273F5B] outline-none transition-all text-[#273F5B] placeholder:text-[#D2BCA1]"
                        value={currentRequirements.field}
                        onChange={e => setCurrentRequirements({...currentRequirements, field: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7F715F]">Experience Required</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5+ years"
                        className="w-full bg-[#FFFFFF] border border-[#D2BCA1] rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#273F5B]/30 focus:border-[#273F5B] outline-none transition-all text-[#273F5B] placeholder:text-[#D2BCA1]"
                        value={currentRequirements.experience}
                        onChange={e => setCurrentRequirements({...currentRequirements, experience: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7F715F]">Key Skills</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Python, AWS, Docker"
                        className="w-full bg-[#FFFFFF] border border-[#D2BCA1] rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#273F5B]/30 focus:border-[#273F5B] outline-none transition-all text-[#273F5B] placeholder:text-[#D2BCA1]"
                        value={currentRequirements.skills}
                        onChange={e => setCurrentRequirements({...currentRequirements, skills: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7F715F]">Other Requirements</label>
                    <textarea 
                      placeholder="Any specific certifications or cultural fit requirements..."
                      className="w-full bg-[#FFFFFF] border border-[#D2BCA1] rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#273F5B]/30 focus:border-[#273F5B] outline-none transition-all h-32 resize-none text-[#273F5B] placeholder:text-[#D2BCA1]"
                      value={currentRequirements.otherRequirements}
                      onChange={e => setCurrentRequirements({...currentRequirements, otherRequirements: e.target.value})}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-[#D2BCA1] gap-4 items-center">
                    {activeProfileId && (
                      <span className="flex items-center text-sm text-[#273F5B] font-medium mr-auto bg-[#E9ECF0] px-3 py-1.5 rounded-full">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Profile Active
                      </span>
                    )}
                    <button 
                      onClick={saveProfile}
                      className="flex items-center gap-2 text-[#6F481C] font-medium text-sm hover:bg-[#F5F2ED] px-6 py-3 rounded-full transition-all border border-transparent hover:border-[#D2BCA1]"
                    >
                      <Save className="w-4 h-4" />
                      {activeProfileId ? "Update Profile" : "Save as Profile"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#FFFFFF] rounded-[32px] p-8 sm:p-10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[#D2BCA1] space-y-6 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-serif font-semibold text-[#273F5B]">
                      Upload CVs
                    </h2>
                    <div className="w-12 h-12 bg-[#E9ECF0] rounded-full flex items-center justify-center">
                      <Upload className="w-5 h-5 text-[#273F5B]" />
                    </div>
                  </div>
                  <p className="text-sm text-[#7F715F] leading-relaxed font-light">
                    Upload one or multiple CVs (PDF, Image, or Text) to screen them against the requirements.
                  </p>
                  
                  {!activeProfileId && (
                    <div className="bg-[#F4EBE1] border border-[#D2BCA1] text-[#6F481C] p-4 rounded-2xl text-sm flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>You must <strong>Save as Profile</strong> before uploading CVs. This ensures candidates are linked to the correct job.</p>
                    </div>
                  )}
                  
                  <div className={cn("relative group flex-1 min-h-[200px]", !activeProfileId && "opacity-50 pointer-events-none")}>
                    <input 
                      type="file" 
                      multiple 
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="h-full border-2 border-dashed border-[#C2A88D] rounded-[24px] p-8 flex flex-col items-center justify-center text-center group-hover:border-[#273F5B] group-hover:bg-[#E9ECF0]/50 transition-all bg-[#FFFFFF]">
                      <div className="w-16 h-16 bg-[#FFFFFF] rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-[#D2BCA1]">
                        <Upload className="w-6 h-6 text-[#7F715F] group-hover:text-[#273F5B]" />
                      </div>
                      <span className="text-sm font-medium text-[#7F715F]">
                        {selectedFiles.length > 0 
                          ? <span className="text-[#273F5B] font-semibold">{selectedFiles.length} files selected</span>
                          : "Click or drag files here"}
                      </span>
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#D2BCA1] group/file">
                          <div className="p-2 bg-[#FFFFFF] rounded-xl shadow-sm border border-[#D2BCA1]">
                            <FileText className="w-4 h-4 text-[#273F5B]" />
                          </div>
                          <span className="truncate flex-1 text-[#273F5B] font-medium">{f.name}</span>
                          <button 
                            onClick={() => removeFile(i)}
                            className="p-1.5 text-[#D2BCA1] hover:text-[#A76825] hover:bg-[#F6EFE9] rounded-lg transition-all"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-3 text-[#A76825] text-sm bg-[#F6EFE9] p-4 rounded-2xl border border-[#E6D2C0]">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button 
                    onClick={handleScreening}
                    disabled={isScreening || selectedFiles.length === 0}
                    className="w-full bg-[#273F5B] text-white py-4 rounded-full font-medium hover:bg-[#1C2D42] transition-all shadow-md shadow-[#273F5B]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                  >
                    {isScreening ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Screening...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Start Screening
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && (() => {
            // Determine which profile to show results for
            const profilesWithResults = jobProfiles.filter(p => 
              screenings.some(s => s.jobProfileId === p.id)
            );
            
            const displayProfileId = resultsProfileId || activeProfileId || (profilesWithResults.length > 0 ? profilesWithResults[0].id : null);
            const displayProfile = jobProfiles.find(p => p.id === displayProfileId);

            const currentScreenings = screenings
              .filter(s => s.jobProfileId === displayProfileId)
              .sort((a, b) => b.score - a.score);
            
            const selectedRank = selectedScreening 
              ? currentScreenings.findIndex(s => s.id === selectedScreening.id) + 1 
              : null;

            return (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {selectedScreening ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedScreening(null)}
                      className="flex items-center gap-2 text-[#7F715F] hover:text-[#273F5B] transition-colors font-medium text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to all results
                    </button>
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-2 bg-[#E9ECF0] text-[#273F5B] hover:bg-[#E9ECF0] px-4 py-2 rounded-full transition-colors font-medium text-sm border border-[#C5D0DC]"
                    >
                      <FileText className="w-4 h-4" /> Generate Report
                    </button>
                  </div>

                  <div className="bg-[#FFFFFF] rounded-[32px] p-8 sm:p-10 border border-[#D2BCA1] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    {/* [ Header ] Name + Score + Status */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[#D2BCA1]">
                      <div>
                        <h2 className="text-3xl font-serif font-semibold text-[#273F5B] mb-2">{selectedScreening.candidateName}</h2>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-[#7F715F] bg-[#F5F2ED] px-3 py-1 rounded-full border border-[#D2BCA1]">
                            {selectedScreening.fileName || "CV Document"}
                          </span>
                          <span className="text-[#7F715F] bg-[#F5F2ED] px-3 py-1 rounded-full border border-[#D2BCA1]">
                            {new Date(selectedScreening.createdAt?.toDate()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm text-[#7F715F] font-medium mb-1">Overall Score</div>
                          <div className="text-4xl font-bold text-[#273F5B]">{selectedScreening.score}%</div>
                        </div>
                        {selectedScreening.recommendation && (
                          <div className={cn(
                            "px-6 py-3 rounded-2xl border-2 font-bold text-lg text-center min-w-[140px]",
                            selectedScreening.recommendation.includes("Strong") ? "bg-[#E9ECF0] text-[#1C2D42] border-[#C5D0DC]" :
                            selectedScreening.recommendation.includes("Hire") ? "bg-[#E9ECF0] text-[#273F5B] border-[#C5D0DC]" :
                            selectedScreening.recommendation.includes("Consider") ? "bg-[#F4EBE1] text-[#6F481C] border-[#D2BCA1]" :
                            "bg-[#F6EFE9] text-[#A76825] border-[#E6D2C0]"
                          )}>
                            {selectedScreening.recommendation}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* [ Score Breakdown ] Bars */}
                    <div className="py-8 border-b border-[#D2BCA1]">
                      <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-6">Score Breakdown</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm font-medium mb-2">
                            <span className="text-[#7F715F]">Overall Match</span>
                            <span className="text-[#273F5B]">{selectedScreening.score}%</span>
                          </div>
                          <div className="h-3 w-full bg-[#E9ECF0] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${selectedScreening.score}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full",
                                selectedScreening.score >= 80 ? "bg-[#273F5B]" : 
                                selectedScreening.score >= 60 ? "bg-[#A76825]" : "bg-[#A76825]"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* [ AI Summary ] */}
                    <div className="py-8 border-b border-[#D2BCA1]">
                      <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-4 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-[#A76825]" /> AI Summary
                      </h3>
                      <div className="bg-[#F5F2ED] rounded-2xl p-6 border border-[#D2BCA1]">
                        <p className="text-[#273F5B] leading-relaxed mb-4">{selectedScreening.summary}</p>
                        {selectedScreening.smartInsight && (
                          <div className="flex items-start gap-3 pt-4 border-t border-[#D2BCA1]/50">
                            <Star className="w-5 h-5 text-[#A76825] shrink-0 mt-0.5" />
                            <p className="text-[#7F715F] text-sm italic leading-relaxed">{selectedScreening.smartInsight}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* [ Strengths | Weaknesses ] */}
                    <div className="py-8 border-b border-[#D2BCA1]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" /> Strengths
                          </h3>
                          <ul className="space-y-3">
                            {selectedScreening.keyFeatures.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-3 bg-[#FFFFFF] p-3 rounded-xl border border-[#D2BCA1] shadow-sm">
                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                <span className="text-[#273F5B] text-sm leading-relaxed">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" /> Weaknesses & Concerns
                          </h3>
                          <ul className="space-y-3">
                            {selectedScreening.redFlags && selectedScreening.redFlags.length > 0 ? (
                              selectedScreening.redFlags.map((flag, idx) => (
                                <li key={idx} className="flex items-start gap-3 bg-[#FDF8F8] p-3 rounded-xl border border-red-100 shadow-sm">
                                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                  <span className="text-[#991B1B] text-sm leading-relaxed">{flag}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-[#7F715F] text-sm italic p-3">No major weaknesses identified.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* [ Job Match ] */}
                    <div className="py-8 border-b border-[#D2BCA1]">
                      <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-6 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-[#273F5B]" /> Job Match Analysis
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-[#D2BCA1] shadow-sm">
                          <h4 className="font-semibold text-[#273F5B] mb-3 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#A76825]" /> Experience Match
                          </h4>
                          <p className="text-[#7F715F] text-sm leading-relaxed">
                            {selectedScreening.experienceMatch || "Analysis not available for this older screening."}
                          </p>
                        </div>
                        <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-[#D2BCA1] shadow-sm">
                          <h4 className="font-semibold text-[#273F5B] mb-3 flex items-center gap-2">
                            <Code className="w-4 h-4 text-[#A76825]" /> Skills Match
                          </h4>
                          <p className="text-[#7F715F] text-sm leading-relaxed">
                            {selectedScreening.skillsMatch || "Analysis not available for this older screening."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* [ Final Decision ] */}
                    <div className="pt-8">
                      <h3 className="text-lg font-serif font-semibold text-[#273F5B] mb-4 flex items-center gap-2">
                        <Medal className="w-5 h-5 text-[#273F5B]" /> Final Decision & Next Steps
                      </h3>
                      <div className="bg-[#273F5B] rounded-2xl p-6 text-white shadow-md">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div>
                            <h4 className="text-xl font-bold mb-2">Recommendation: {selectedScreening.recommendation}</h4>
                            <p className="text-[#C5D0DC] text-sm leading-relaxed max-w-2xl">
                              Based on the overall match score of {selectedScreening.score}% and the analysis of experience and skills, this candidate is marked as {selectedScreening.recommendation}.
                            </p>
                          </div>
                          {selectedScreening.improvementSuggestions && selectedScreening.improvementSuggestions.length > 0 && (
                            <div className="bg-[#1C2D42] p-4 rounded-xl border border-[#3A5A80] min-w-[250px]">
                              <h5 className="text-sm font-semibold text-[#E9ECF0] mb-2">Missing for perfection:</h5>
                              <ul className="space-y-1">
                                {selectedScreening.improvementSuggestions.slice(0, 2).map((sug, idx) => (
                                  <li key={idx} className="text-xs text-[#C5D0DC] flex items-start gap-2">
                                    <span className="text-[#A76825]">•</span> {sug}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-4xl font-serif font-semibold text-[#273F5B]">Screening Results</h2>
                      {displayProfile && (
                        <p className="text-[#7F715F] mt-2">Showing results for: <span className="font-semibold text-[#6F481C]">{displayProfile.name}</span></p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedResultIds.size > 0 && (
                        <button 
                          onClick={deleteSelectedScreenings}
                          className="text-sm font-medium text-white bg-[#A76825] hover:bg-[#8A561E] px-5 py-2 rounded-full transition-colors shadow-sm"
                        >
                          Delete Selected ({selectedResultIds.size})
                        </button>
                      )}
                      {displayProfileId && currentScreenings.length > 0 && (
                        <button 
                          onClick={() => clearAllCurrentScreenings(displayProfileId)}
                          className="text-sm font-medium text-[#A76825] hover:bg-[#F6EFE9] px-5 py-2 rounded-full transition-colors border border-[#E6D2C0]"
                        >
                          Delete All
                        </button>
                      )}
                      <span className="text-sm font-medium text-[#273F5B] bg-[#E9ECF0] px-5 py-2 rounded-full border border-[#C5D0DC]">
                        {currentScreenings.length} candidates
                      </span>
                    </div>
                  </div>

                  {profilesWithResults.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {profilesWithResults.map(profile => (
                        <button
                          key={profile.id}
                          onClick={() => {
                            loadProfile(profile);
                            setActiveTab('results');
                          }}
                          className={cn(
                            "px-6 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                            displayProfileId === profile.id
                              ? "bg-[#273F5B] text-white border-[#273F5B] shadow-md shadow-[#273F5B]/20"
                              : "bg-[#FFFFFF] text-[#7F715F] border-[#D2BCA1] hover:border-[#273F5B] hover:text-[#273F5B]"
                          )}
                        >
                          {profile.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {!displayProfileId ? (
                    <div className="bg-[#FFFFFF] rounded-[32px] p-20 text-center border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                      <div className="w-24 h-24 bg-[#FFFFFF] rounded-full flex items-center justify-center mx-auto mb-8 border border-[#D2BCA1]">
                        <Briefcase className="w-10 h-10 text-[#D2BCA1]" />
                      </div>
                      <h3 className="text-2xl font-serif font-semibold mb-4 text-[#273F5B]">No profiles with results</h3>
                      <p className="text-[#7F715F] max-w-md mx-auto font-light leading-relaxed">Please select or create a job profile and upload CVs to view screening results.</p>
                      <button 
                        onClick={() => setActiveTab('profiles')}
                        className="mt-6 bg-[#6F481C] text-white px-8 py-3 rounded-full font-medium text-sm hover:bg-[#6F481C] transition-colors"
                      >
                        Go to Profiles
                      </button>
                    </div>
                  ) : currentScreenings.length === 0 ? (
                    <div className="bg-[#FFFFFF] rounded-[32px] p-20 text-center border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                      <div className="w-24 h-24 bg-[#FFFFFF] rounded-full flex items-center justify-center mx-auto mb-8 border border-[#D2BCA1]">
                        <Search className="w-10 h-10 text-[#D2BCA1]" />
                      </div>
                      <h3 className="text-2xl font-serif font-semibold mb-4 text-[#273F5B]">No results yet</h3>
                      <p className="text-[#7F715F] max-w-md mx-auto font-light leading-relaxed">Upload candidate CVs in the Requirements tab to see the AI analysis here.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-3">
                      {currentScreenings.map((res, index) => (
                        <motion.div 
                          key={res.id}
                          onClick={() => setSelectedScreening(res)}
                          className={cn(
                            "bg-[#FFFFFF] rounded-2xl p-4 shadow-sm border flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group",
                            selectedResultIds.has(res.id) ? "border-[#273F5B] bg-[#F8FAFC]" : "border-[#D2BCA1]"
                          )}
                        >
                          <div 
                            onClick={(e) => toggleResultSelection(res.id, e)}
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                              selectedResultIds.has(res.id) ? "bg-[#273F5B] border-[#273F5B] text-white" : "border-[#C5D0DC] text-transparent hover:border-[#273F5B]"
                            )}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </div>

                          <div className="w-10 h-10 bg-[#F5F2ED] rounded-full flex items-center justify-center border border-[#D2BCA1] shrink-0">
                            <User className="w-5 h-5 text-[#6F481C]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-[#273F5B] truncate">{res.candidateName}</h4>
                            <p className="text-xs text-[#7F715F] truncate flex items-center gap-1 mt-0.5">
                              <FileText className="w-3 h-3" /> {res.fileName || 'CV Document'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-24 justify-end pr-4">
                            <div className="text-lg font-bold text-[#273F5B]">{res.score}%</div>
                          </div>

                          <div className="shrink-0 w-32 hidden sm:block">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
                              res.recommendation.includes("Strong") ? "bg-[#E9ECF0] text-[#1C2D42] border-[#C5D0DC]" :
                              res.recommendation.includes("Hire") ? "bg-[#E9ECF0] text-[#273F5B] border-[#C5D0DC]" :
                              res.recommendation.includes("Potential") ? "bg-[#F4EBE1] text-[#6F481C] border-[#D2BCA1]" :
                              "bg-[#F6EFE9] text-[#A76825] border-[#E6D2C0]"
                            )}>
                              {res.recommendation}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => deleteScreening(res.id, e)}
                              className="p-2 text-[#D2BCA1] hover:text-[#A76825] hover:bg-[#F6EFE9] rounded-full transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 text-[#273F5B] hover:bg-[#E9ECF0] rounded-full transition-all"
                              title="View Details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
            );
          })()}

          {activeTab === 'profiles' && (
            <motion.div
              key="profiles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-4xl font-serif font-semibold text-[#273F5B]">Saved Job Profiles</h2>
                <div className="flex items-center gap-4">
                  {selectedProfileIds.size > 0 && (
                    <button
                      onClick={deleteSelectedProfiles}
                      className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-6 py-3 rounded-full transition-colors font-medium text-sm border border-red-200"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Selected ({selectedProfileIds.size})
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setCurrentRequirements({
                        name: '',
                        experience: '',
                        field: '',
                        skills: '',
                        otherRequirements: ''
                      });
                      setActiveProfileId(null);
                      setActiveTab('requirements');
                    }}
                    className="flex items-center gap-2 bg-[#6F481C] text-white px-6 py-3 rounded-full font-medium text-sm hover:bg-[#6F481C] transition-colors shadow-md shadow-[#6F481C]/20"
                  >
                    <Plus className="w-4 h-4" />
                    New Profile
                  </button>
                </div>
              </div>

              {jobProfiles.length === 0 ? (
                <div className="bg-[#FFFFFF] rounded-[32px] p-20 text-center border border-[#D2BCA1] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <div className="w-24 h-24 bg-[#FFFFFF] rounded-full flex items-center justify-center mx-auto mb-8 border border-[#D2BCA1]">
                    <Layers className="w-10 h-10 text-[#D2BCA1]" />
                  </div>
                  <h3 className="text-2xl font-serif font-semibold mb-4 text-[#273F5B]">No saved profiles</h3>
                  <p className="text-[#7F715F] max-w-md mx-auto font-light leading-relaxed">Save your job requirements to reuse them later and speed up your screening process.</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {jobProfiles.map((profile) => (
                    <motion.div 
                      key={profile.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#FFFFFF] rounded-2xl p-4 shadow-sm border border-[#D2BCA1] hover:shadow-md transition-all flex items-center gap-4 group cursor-pointer"
                      onClick={() => loadProfile(profile)}
                    >
                      <div 
                        onClick={(e) => toggleProfileSelection(profile.id, e)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                          selectedProfileIds.has(profile.id) ? "bg-[#273F5B] border-[#273F5B] text-white" : "border-[#C5D0DC] text-transparent hover:border-[#273F5B]"
                        )}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>

                      <div className="w-10 h-10 bg-[#E9ECF0] rounded-full flex items-center justify-center border border-[#C5D0DC] shrink-0">
                        <Briefcase className="w-5 h-5 text-[#273F5B]" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-6">
                        <div className="w-1/4 min-w-[150px]">
                          <h3 className="text-lg font-serif font-semibold text-[#273F5B] truncate">{profile.name}</h3>
                        </div>
                        <div className="w-1/4 min-w-[120px]">
                          <span className="text-xs font-semibold uppercase tracking-widest text-[#7F715F] block mb-1">Field</span>
                          <span className="text-sm font-medium text-[#273F5B] truncate block">{profile.field || 'N/A'}</span>
                        </div>
                        <div className="w-1/4 min-w-[120px]">
                          <span className="text-xs font-semibold uppercase tracking-widest text-[#7F715F] block mb-1">Experience</span>
                          <span className="text-sm font-medium text-[#273F5B] truncate block">{profile.experience || 'N/A'}</span>
                        </div>
                        <div className="flex-1 min-w-[150px] hidden md:block">
                          <span className="text-xs font-semibold uppercase tracking-widest text-[#7F715F] block mb-1">Skills</span>
                          <span className="text-sm text-[#7F715F] truncate block">{profile.skills || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          onClick={(e) => deleteProfile(profile.id, e)}
                          className="w-8 h-8 flex items-center justify-center bg-[#FFFFFF] border border-[#D2BCA1] hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-full text-[#D2BCA1] transition-colors shadow-sm"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); loadProfile(profile); }}
                          className="w-8 h-8 flex items-center justify-center bg-[#FFFFFF] border border-[#D2BCA1] hover:bg-[#F5F2ED] rounded-full text-[#6F481C] transition-colors shadow-sm"
                          title="Load Profile"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isReportModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsReportModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#FFFFFF] rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-[#D2BCA1]"
              >
                <div className="p-6 border-b border-[#D2BCA1] flex items-center justify-between bg-[#FFFFFF]">
                  <h2 className="text-2xl font-serif font-semibold text-[#273F5B]">Candidate Evaluation Report</h2>
                  <button 
                    onClick={() => setIsReportModalOpen(false)}
                    className="w-10 h-10 flex items-center justify-center bg-[#FFFFFF] border border-[#D2BCA1] hover:bg-[#F4EBE1] rounded-full text-[#7F715F] transition-colors"
                  >
                    <Trash2 className="w-4 h-4 hidden" />
                    <span className="text-xl leading-none">&times;</span>
                  </button>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1 bg-[#F4EBE1]">
                  {isGeneratingReport ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                      <Loader2 className="w-10 h-10 animate-spin text-[#273F5B]" />
                      <p className="text-[#7F715F] font-medium">Generating professional report...</p>
                    </div>
                  ) : reportText ? (
                    <div className="max-w-4xl mx-auto bg-[#FFFFFF] p-10 md:p-16 shadow-lg border border-[#D2BCA1] min-h-[800px]">
                      <div ref={reportRef} id="report-content" className="prose prose-stone prose-headings:font-serif prose-headings:text-[#273F5B] prose-a:text-[#6F481C] prose-hr:border-[#D2BCA1] prose-li:marker:text-[#7F715F] max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>{reportText}</Markdown>
                      </div>
                    </div>
                  ) : null}
                </div>
                
                <div className="p-6 border-t border-[#D2BCA1] bg-[#FFFFFF] flex justify-end gap-4">
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="px-6 py-3 rounded-full font-medium text-[#7F715F] hover:bg-[#D2BCA1] transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSavePDF}
                    disabled={isGeneratingReport || !reportText}
                    className="px-6 py-3 rounded-full font-medium bg-[#6F481C] text-white hover:bg-[#6F481C] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Save PDF
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFFFFF]/90 backdrop-blur-xl border-t border-[#D2BCA1] sm:hidden px-2 py-4 flex justify-around items-center z-40 pb-safe">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'requirements', icon: FileText, label: 'Reqs' },
          { id: 'results', icon: CheckCircle2, label: 'Results' },
          { id: 'profiles', icon: Layers, label: 'Profiles' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex flex-col items-center gap-2 p-2 rounded-xl transition-all",
              activeTab === tab.id ? "text-[#273F5B]" : "text-[#7F715F]"
            )}
          >
            <tab.icon className={cn("w-5 h-5", activeTab === tab.id && "fill-[#273F5B]/20")} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
