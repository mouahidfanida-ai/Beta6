
import React, { useState, useEffect } from 'react';
import { getClasses, getSessions, getStudents } from '../services/store';
import { ClassGroup, Session, Student } from '../types';
import { Video, FileText, Calendar, ArrowLeft, BookOpen, Loader2, Calculator, GraduationCap, Filter, Check, ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const StudentPortal: React.FC = () => {
  const location = useLocation();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(location.state?.classId || null);
  
  // New state for tabs and students
  const [activeTab, setActiveTab] = useState<'sessions' | 'grades'>('sessions');
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Filter & UI State
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [fetchedClasses, fetchedSessions] = await Promise.all([
        getClasses(),
        getSessions()
      ]);
      setClasses(fetchedClasses);
      setSessions(fetchedSessions);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Handle direct navigation via state updates
  useEffect(() => {
    if (location.state?.classId) {
        setSelectedClassId(location.state.classId);
    }
  }, [location.state]);

  // Fetch students when a class is selected
  useEffect(() => {
    if (selectedClassId) {
        const fetchStudentsData = async () => {
            setIsLoadingStudents(true);
            const data = await getStudents(selectedClassId);
            setStudents(data);
            setIsLoadingStudents(false);
        };
        fetchStudentsData();
    } else {
        setStudents([]);
    }
  }, [selectedClassId]);

  const handleClassSelect = (classId: string) => {
      setSelectedClassId(classId);
      setActiveTab('sessions');
      setSelectedMonths([]);
      setExpandedSessions(new Set());
  };

  const handleBackToClasses = () => {
      setSelectedClassId(null);
      setStudents([]);
      setSelectedMonths([]);
      setExpandedSessions(new Set());
  };

  const toggleMonth = (month: string) => {
      setSelectedMonths(prev => 
          prev.includes(month) 
              ? prev.filter(m => m !== month) 
              : [...prev, month]
      );
  };

  const toggleSessionExpansion = (sessionId: string) => {
      setExpandedSessions(prev => {
          const newSet = new Set(prev);
          if (newSet.has(sessionId)) {
              newSet.delete(sessionId);
          } else {
              newSet.add(sessionId);
          }
          return newSet;
      });
  };

  // Get sessions for current class
  const currentClassSessions = selectedClassId 
      ? sessions.filter(s => s.classId === selectedClassId)
      : [];

  // Get available months (YYYY-MM)
  const availableMonths: string[] = Array.from<string>(new Set(
      currentClassSessions.map(s => s.date.substring(0, 7))
  )).sort().reverse();

  // Filter logic
  const filteredSessions = currentClassSessions.filter(s => {
      if (selectedMonths.length === 0) return true;
      return selectedMonths.includes(s.date.substring(0, 7));
  });

  const currentClass = classes.find(c => c.id === selectedClassId);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
        if (url.includes('dropbox.com')) {
            return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
        }
        if (url.includes('drive.google.com')) {
            // Convert /view to /preview for Google Drive
            return url.replace('/view', '/preview');
        }
        return url;
    } catch (e) {
        return url;
    }
  };

  const calculateAverage = (s: Student) => {
    const sum = (Number(s.note1) || 0) + (Number(s.note2) || 0) + (Number(s.note3) || 0);
    return (sum / 3).toFixed(2);
  };

  const formatMonthLabel = (monthStr: string) => {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getProfileLink = (student: Student) => {
      const cls = classes.find(c => c.id === student.classId);
      if (!cls) return '#';
      // Clean class name to be URL friendly (alphanumeric only)
      const cleanClassName = cls.name.replace(/[^a-zA-Z0-9]/g, '');
      const uniqueId = student.uniqueId || student.id; 
      // Format: ClassNameNumber (e.g. 5thGrade12)
      return `/student-profile/${cleanClassName}${uniqueId}`;
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
              <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Loading Portal...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      {/* Hero Section */}
      <div className="bg-slate-900 pt-20 pb-32 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl relative overflow-hidden mx-2 sm:mx-4 md:mx-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-600/30 via-slate-900 to-slate-900"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-6">Student Portal</h1>
            <p className="text-lg md:text-xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
                {selectedClassId 
                  ? `Accessing resources for ${currentClass?.name}` 
                  : 'Select your class below to access training videos, notes, and your grades.'}
            </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20 -mt-16 md:-mt-20">
        
        {/* Class Selection Grid */}
        {!selectedClassId && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {classes.map(cls => {
                    const sessionCount = sessions.filter(s => s.classId === cls.id).length;
                    return (
                        <div 
                            key={cls.id} 
                            onClick={() => handleClassSelect(cls.id)}
                            className="bg-white rounded-[2.5rem] p-8 shadow-card border border-slate-100 cursor-pointer hover:border-brand-300 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group relative z-20"
                        >
                            <div className="flex flex-col h-full">
                                <div className="p-5 bg-brand-50 w-fit rounded-3xl mb-8 group-hover:bg-brand-600 transition-colors duration-300">
                                    <BookOpen className="w-8 h-8 text-brand-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 mb-3">{cls.name}</h3>
                                <p className="text-slate-500 text-sm mb-8 flex-1 leading-relaxed font-medium">{cls.description}</p>
                                
                                <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                        {sessionCount} Sessions
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {classes.length === 0 && (
                    <div className="col-span-full text-center py-24 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
                        <p className="text-slate-400 font-medium">No classes available yet.</p>
                    </div>
                )}
            </div>
        )}

        {/* Class Detail View */}
        {selectedClassId && (
            <div className="animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-20">
                     <button 
                        onClick={handleBackToClasses}
                        className="inline-flex items-center px-6 py-3 bg-white rounded-full text-sm font-bold text-slate-600 hover:text-brand-600 hover:bg-white shadow-soft transition-all hover:-translate-y-1 w-full md:w-auto justify-center md:justify-start"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        All Classes
                    </button>

                    <div className="flex p-1.5 bg-white rounded-full shadow-soft border border-slate-100 w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`flex-1 md:flex-none flex items-center justify-center px-6 md:px-8 py-3 rounded-full text-sm font-bold transition-all ${
                                activeTab === 'sessions' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            <Video className="w-4 h-4 mr-2" />
                            Sessions
                        </button>
                        <button
                            onClick={() => setActiveTab('grades')}
                            className={`flex-1 md:flex-none flex items-center justify-center px-6 md:px-8 py-3 rounded-full text-sm font-bold transition-all ${
                                activeTab === 'grades' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            <GraduationCap className="w-4 h-4 mr-2" />
                            Grades
                        </button>
                    </div>
                </div>

                {/* Sessions Tab Content */}
                {activeTab === 'sessions' && (
                    <div className="space-y-8 md:space-y-10 animate-fadeIn">
                        
                        {/* Month Filter Section */}
                        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-card border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-brand-50 rounded-xl">
                                    <Filter className="w-5 h-5 text-brand-600" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Filter by Month</h3>
                            </div>
                            <div className="flex flex-wrap gap-2 md:gap-3">
                                {availableMonths.map((month: string) => {
                                    const isSelected = selectedMonths.includes(month);
                                    return (
                                        <button
                                            key={month}
                                            onClick={() => toggleMonth(month)}
                                            className={`inline-flex items-center px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                                                isSelected
                                                ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/30'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-white'
                                            }`}
                                        >
                                            {isSelected && <Check className="w-4 h-4 mr-2" />}
                                            {formatMonthLabel(month)}
                                        </button>
                                    );
                                })}
                                {availableMonths.length === 0 && <p className="text-slate-400 font-medium italic">No session history available.</p>}
                            </div>
                        </div>

                        {/* Mobile Rotation Hint */}
                        <div className="md:hidden text-center -mb-2">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-100/50 py-2 rounded-full mx-auto w-fit px-4 border border-slate-100">
                                <Smartphone className="w-3 h-3 text-brand-500" />
                                Rotate phone for best video experience
                             </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 md:gap-10">
                            {filteredSessions.map(session => {
                                    const videoUrls: string[] = session.videoUrls && session.videoUrls.length > 0 ? session.videoUrls : [session.videoUrl];
                                    const isExpanded = expandedSessions.has(session.id);
                                    
                                    return (
                                    <div key={session.id} className="bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-card border border-slate-100 overflow-hidden p-5 sm:p-8 md:p-12 hover:shadow-xl transition-all duration-300">
                                        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 sm:mb-10 gap-4">
                                            <div className="w-full sm:w-auto">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="inline-block px-4 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-bold uppercase tracking-widest">
                                                        {session.date}
                                                    </span>
                                                    {session.isHighlight && (
                                                         <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                                            Featured
                                                         </span>
                                                    )}
                                                </div>
                                                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">{session.title}</h3>
                                            </div>
                                            <button 
                                                onClick={() => toggleSessionExpansion(session.id)}
                                                className={`p-3 rounded-full transition-colors self-end sm:self-start ${isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600'}`}
                                            >
                                                {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                                            </button>
                                        </div>
                                        
                                        <div className={`grid grid-cols-1 ${isExpanded ? 'lg:grid-cols-12' : ''} gap-8 md:gap-12`}>
                                            <div className={`${isExpanded ? 'lg:col-span-7' : 'w-full'} space-y-6 transition-all`}>
                                                {videoUrls.map((url, idx) => {
                                                    const embedUrl = getEmbedUrl(url);
                                                    const isDrive = embedUrl.includes('drive.google.com');
                                                    return (
                                                    <div key={idx} className="rounded-2xl md:rounded-[2rem] overflow-hidden bg-black aspect-video shadow-2xl relative group ring-2 sm:ring-4 ring-slate-50 w-full">
                                                        {isDrive ? (
                                                            <iframe 
                                                                src={embedUrl} 
                                                                className="w-full h-full border-0" 
                                                                allowFullScreen 
                                                                title="Video Player"
                                                            />
                                                        ) : (
                                                            <video 
                                                                controls 
                                                                className="w-full h-full object-cover"
                                                                src={embedUrl}
                                                            />
                                                        )}
                                                    </div>
                                                )})}
                                            </div>

                                            {isExpanded && (
                                                <div className="lg:col-span-5 flex flex-col gap-6 animate-fadeIn">
                                                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[2rem] flex-1">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Description</h4>
                                                        <p className="text-slate-600 text-base sm:text-lg leading-relaxed whitespace-pre-line font-medium">{session.description}</p>
                                                    </div>

                                                    {session.aiNotes && (
                                                        <div className="bg-amber-50 p-6 sm:p-8 rounded-[2rem] border border-amber-100/50">
                                                            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Quiz / Notes</h4>
                                                            <p className="text-amber-900/80 text-sm sm:text-base whitespace-pre-line font-medium leading-relaxed">{session.aiNotes}</p>
                                                        </div>
                                                    )}

                                                    {session.pdfUrl && (
                                                        <a 
                                                            href={session.pdfUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="flex items-center justify-center p-6 bg-white border-2 border-slate-100 rounded-[2rem] text-slate-700 font-bold hover:border-brand-500 hover:text-brand-600 hover:shadow-lg transition-all"
                                                        >
                                                            <FileText className="w-6 h-6 mr-3" />
                                                            Download PDF Resource
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 sm:mt-12 flex justify-center border-t border-slate-50 pt-8">
                                            <button 
                                                onClick={() => toggleSessionExpansion(session.id)}
                                                className={`flex items-center w-full sm:w-auto justify-center px-8 py-4 rounded-full font-bold text-sm transition-all group ${
                                                    isExpanded 
                                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                                                        : 'bg-slate-900 text-white hover:bg-brand-600 shadow-lg hover:shadow-brand-500/30'
                                                }`}
                                            >
                                                {isExpanded ? 'Hide Description & Quiz' : 'Show Description & Quiz'}
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 ml-2 group-hover:-translate-y-1 transition-transform" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-1 transition-transform" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    );
                            })}
                        </div>
                        
                        {filteredSessions.length === 0 && (
                            <div className="text-center py-24 bg-white rounded-[2.5rem] border border-slate-200 border-dashed">
                                <p className="text-slate-500 font-medium text-lg">No sessions available matching your filter.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Grades Tab Content */}
                {activeTab === 'grades' && (
                    <div className="bg-white rounded-[2.5rem] shadow-card border border-slate-100 overflow-hidden animate-fadeIn p-6 sm:p-10">
                        <div className="flex items-center gap-6 mb-10">
                            <div className="p-4 bg-slate-50 rounded-3xl">
                                <Calculator className="w-8 h-8 text-brand-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Performance Report</h2>
                                <p className="text-slate-500 font-medium text-sm sm:text-base">Your grades for this academic year.</p>
                            </div>
                        </div>
                        
                        {isLoadingStudents ? (
                             <div className="text-center py-16">
                                <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto" />
                             </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="px-6 sm:px-8 py-5 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest w-16">#</th>
                                            <th className="px-6 sm:px-8 py-5 text-left text-xs font-extrabold text-slate-400 uppercase tracking-widest">Student Name</th>
                                            <th className="px-6 sm:px-8 py-5 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">Term 1</th>
                                            <th className="px-6 sm:px-8 py-5 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">Term 2</th>
                                            <th className="px-6 sm:px-8 py-5 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">Term 3</th>
                                            <th className="px-6 sm:px-8 py-5 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">GPA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {students.map((student) => (
                                            <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 sm:px-8 py-6 text-center">
                                                    <span className="text-xs font-bold text-slate-300 bg-slate-100 px-2 py-1 rounded-md">
                                                        {student.uniqueId || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 sm:px-8 py-6 whitespace-nowrap text-base font-bold text-slate-900">
                                                    <Link to={getProfileLink(student)} className="flex items-center gap-3 hover:text-brand-600 transition-colors">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        {student.name}
                                                    </Link>
                                                </td>
                                                <td className="px-6 sm:px-8 py-6 whitespace-nowrap text-center">
                                                    <span className="inline-block w-12 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">{student.note1}</span>
                                                </td>
                                                <td className="px-6 sm:px-8 py-6 whitespace-nowrap text-center">
                                                    <span className="inline-block w-12 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">{student.note2}</span>
                                                </td>
                                                <td className="px-6 sm:px-8 py-6 whitespace-nowrap text-center">
                                                    <span className="inline-block w-12 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">{student.note3}</span>
                                                </td>
                                                <td className="px-6 sm:px-8 py-6 whitespace-nowrap text-center">
                                                    <span className="inline-block px-4 py-2 bg-brand-100 text-brand-700 rounded-xl text-sm font-extrabold shadow-sm">
                                                        {calculateAverage(student)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentPortal;
