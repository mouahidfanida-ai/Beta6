
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStudent, saveStudent, getClass, getClasses, getStudents } from '../services/store';
import { Student, ClassGroup } from '../types';
import { ArrowLeft, Loader2, Save, GraduationCap, User, BookOpen, Share2, Copy, Check, X } from 'lucide-react';
import QRCode from 'react-qr-code';

interface StudentProfileProps {
  isTeacher?: boolean;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ isTeacher = false }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      
      let fetchedStudent: Student | null = null;
      let fetchedClass: ClassGroup | null = null;

      // New Parsing Logic for "ClassNameNumber" (e.g., 5thGrade12) OR "ClassNameUUID"
      // 1. Fetch all classes to find longest matching prefix
      const allClasses = await getClasses();
      
      // Sort classes by name length (desc) to find specific matches first (e.g. "Grade 12" before "Grade 1")
      const sortedClasses = allClasses.sort((a, b) => b.name.length - a.name.length);
      
      // Normalize input ID and class names for matching (remove special chars/spaces)
      const normalizedId = id.toLowerCase();
      
      // Try to find a class name that matches the start of the ID
      for (const cls of sortedClasses) {
          const cleanName = cls.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          
          if (normalizedId.startsWith(cleanName)) {
              // Extract the remainder from the ORIGINAL id to preserve casing for UUIDs if needed
              // Note: cleanName length is from the normalized string, which maps 1:1 to original string length if only case changed.
              let remainder = id.slice(cleanName.length);
              
              // Handle underscore separator if present (legacy support)
              if (remainder.startsWith('_')) remainder = remainder.slice(1);
              
              const cleanRemainder = remainder.trim();
              
              // Case 1: Remainder is a Number (Unique Class Number)
              if (!isNaN(Number(cleanRemainder)) && cleanRemainder.length > 0 && cleanRemainder.length < 10) {
                   const uniqueNum = parseInt(cleanRemainder);
                   const studentsInClass = await getStudents(cls.id);
                   fetchedStudent = studentsInClass.find(s => s.uniqueId === uniqueNum) || null;
                   if (fetchedStudent) {
                       fetchedClass = cls;
                       break; 
                   }
              }
              
              // Case 2: Remainder is a UUID (Fallback for old links: ClassName + UUID)
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (uuidRegex.test(cleanRemainder)) {
                   fetchedStudent = await getStudent(cleanRemainder);
                   if (fetchedStudent) {
                       fetchedClass = cls;
                       break;
                   }
              }
          }
      }

      // Fallback: If no smart matching worked, try to treat the *entire* ID as a UUID
      if (!fetchedStudent) {
          fetchedStudent = await getStudent(id);
      }

      setStudent(fetchedStudent);
      
      if (fetchedStudent && fetchedStudent.classId && !fetchedClass) {
        fetchedClass = await getClass(fetchedStudent.classId);
      }
      
      setClassGroup(fetchedClass);
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    
    setIsSaving(true);
    const updated = await saveStudent(student);
    if (updated) {
      setStudent(updated);
      alert("Changes saved successfully!");
    } else {
      alert("Failed to save changes.");
    }
    setIsSaving(false);
  };

  const calculateAverage = (s: Student) => {
    const sum = (Number(s.note1) || 0) + (Number(s.note2) || 0) + (Number(s.note3) || 0);
    return (sum / 3).toFixed(2);
  };

  const getFullDisplayId = () => {
    if (!student || !classGroup) return '';
    const cleanClassName = classGroup.name.replace(/[^a-zA-Z0-9]/g, '');
    const uniqueId = student.uniqueId || student.id; // Use UUID if uniqueId missing, though ugly
    return `${cleanClassName}${uniqueId}`;
  };

  const getShareUrl = () => {
      // Always generate the cleanest share link possible
      const fullId = getFullDisplayId();
      if (!fullId) return window.location.href;
      return `${window.location.origin}/student-profile/${fullId}`;
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <p className="text-slate-500 mb-4 text-lg">Student not found.</p>
        <button onClick={() => navigate(isTeacher ? '/dashboard' : '/student')} className="text-brand-600 font-bold">Return to Previous Page</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-12 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
            <Link to={isTeacher ? "/dashboard" : "/student"} className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to {isTeacher ? 'Dashboard' : 'Portal'}
            </Link>
        </div>

        <div className="bg-white rounded-5xl shadow-card border border-slate-100 overflow-hidden">
           
           {/* Profile Header */}
           <div className="bg-slate-900 p-10 md:p-12 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-10">
                   <GraduationCap className="w-64 h-64" />
               </div>
               
               {/* Share Button (Top Right of Header) */}
               <div className="absolute top-6 right-6 md:top-10 md:right-10 z-20">
                    <button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all shadow-lg border border-white/10 group"
                        title="Share Profile"
                    >
                        <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
               </div>

               <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                   <div className="w-24 h-24 rounded-full bg-brand-500 flex items-center justify-center text-3xl font-bold shadow-lg shadow-brand-500/50 border-4 border-slate-800 relative">
                        {student.name.charAt(0)}
                        {student.uniqueId && (
                             <span className="absolute -bottom-2 -right-2 bg-white text-brand-600 text-xs font-extrabold w-8 h-8 flex items-center justify-center rounded-full border-2 border-slate-900 shadow-sm">
                                #{student.uniqueId}
                             </span>
                        )}
                   </div>
                   <div>
                       <h1 className="text-4xl font-extrabold tracking-tight mb-2">{student.name}</h1>
                       <div className="flex items-center gap-2 text-brand-200 font-medium">
                           <BookOpen className="w-4 h-4" />
                           {classGroup ? (
                               <Link 
                                   to="/student" 
                                   state={{ classId: student.classId }}
                                   className="hover:text-white hover:underline decoration-brand-400 underline-offset-4 transition-all"
                                   title="Go to Class Sessions"
                               >
                                   {classGroup.name}
                               </Link>
                           ) : (
                               'Unassigned Class'
                           )}
                       </div>
                       {student.uniqueId && (
                           <div className="mt-3 inline-flex items-center bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/10">
                               <span className="text-xs font-bold text-brand-200 uppercase tracking-wider mr-2">Student ID:</span>
                               <span className="text-sm font-mono font-bold text-white">{getFullDisplayId()}</span>
                           </div>
                       )}
                   </div>
                   <div className="md:ml-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <span className="block text-xs font-bold text-brand-200 uppercase tracking-widest mb-1">Current GPA</span>
                        <span className="text-4xl font-extrabold text-white">{calculateAverage(student)}</span>
                   </div>
               </div>
           </div>

           {/* Edit Form */}
           <div className="p-10 md:p-12">
               <form onSubmit={handleSave} className="space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="col-span-full">
                           <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 ml-1">Student Name</label>
                           <div className="relative">
                               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                   <User className="h-5 w-5 text-slate-400" />
                               </div>
                               <input 
                                   type="text" 
                                   value={student.name}
                                   onChange={(e) => setStudent({...student, name: e.target.value})}
                                   disabled={!isTeacher}
                                   className={`w-full pl-12 rounded-2xl bg-slate-50 border-transparent p-4 font-bold text-slate-900 text-lg transition-all ${isTeacher ? 'focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10' : 'cursor-default'}`}
                               />
                           </div>
                       </div>

                       <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 col-span-full">
                           <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                               <GraduationCap className="w-5 h-5 text-brand-600" />
                               Academic Performance
                           </h3>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                               {['note1', 'note2', 'note3'].map((term, idx) => (
                                   <div key={term}>
                                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Term {idx + 1}</label>
                                       <input 
                                           type="number" 
                                           value={student[term as keyof Student]}
                                           onChange={(e) => setStudent({...student, [term]: Number(e.target.value)})}
                                           disabled={!isTeacher}
                                           className={`w-full rounded-2xl bg-white border-slate-200 p-4 text-center font-extrabold text-2xl text-slate-900 shadow-sm ${isTeacher ? 'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10' : 'cursor-default bg-slate-100'}`}
                                       />
                                   </div>
                               ))}
                           </div>
                       </div>
                   </div>

                   {isTeacher && (
                       <div className="flex justify-end pt-6 border-t border-slate-50">
                           <button 
                               type="submit" 
                               disabled={isSaving}
                               className="inline-flex items-center px-8 py-4 bg-brand-600 rounded-full text-sm font-bold text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-70"
                           >
                               {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                               Save Changes
                           </button>
                       </div>
                   )}
               </form>
           </div>
        </div>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div 
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsShareModalOpen(false)}
              ></div>
              <div className="bg-white rounded-5xl p-8 md:p-10 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
                  <button 
                      onClick={() => setIsShareModalOpen(false)}
                      className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                  >
                      <X className="w-5 h-5" />
                  </button>

                  <div className="text-center mb-8">
                      <div className="mx-auto w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
                          <Share2 className="w-8 h-8 text-brand-600" />
                      </div>
                      <h3 className="text-2xl font-extrabold text-slate-900">Share Profile</h3>
                      <p className="text-slate-500 font-medium mt-1">Scan to access student grades</p>
                      {getFullDisplayId() && (
                          <p className="text-brand-600 font-mono font-bold mt-2 bg-brand-50 inline-block px-3 py-1 rounded-lg border border-brand-100">
                              ID: {getFullDisplayId()}
                          </p>
                      )}
                  </div>

                  <div className="flex justify-center mb-8 p-4 bg-white rounded-3xl shadow-soft border border-slate-100">
                      <div className="w-48 h-48 bg-white">
                        <QRCode 
                            value={getShareUrl()} 
                            style={{ height: "100%", width: "100%" }} 
                            viewBox={`0 0 256 256`}
                        />
                      </div>
                  </div>

                  <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Or copy link</label>
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              readOnly 
                              value={getShareUrl()} 
                              className="w-full rounded-2xl bg-slate-50 border-none text-xs text-slate-500 p-4 font-mono truncate focus:ring-0"
                          />
                          <button 
                              onClick={handleCopyLink}
                              className={`p-4 rounded-2xl font-bold text-white shadow-lg transition-all ${copied ? 'bg-green-500 shadow-green-500/30' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/30'}`}
                          >
                              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default StudentProfile;
