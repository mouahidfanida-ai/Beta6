
import { supabase } from './supabase';
import { ClassGroup, Session, Student, Activity } from '../types';

// Map DB snake_case to TS camelCase
const mapClassFromDB = (data: any): ClassGroup => ({
  id: data.id,
  name: data.name,
  description: data.description || '',
});

const mapSessionFromDB = (data: any): Session => ({
  id: data.id,
  classId: data.class_id,
  title: data.title,
  description: data.description || '',
  videoUrl: data.video_url || '',
  pdfUrl: data.pdf_url,
  date: data.date,
  aiNotes: data.ai_notes,
  isHighlight: data.is_highlight || false,
});

const mapStudentFromDB = (data: any): Student => ({
  id: data.id,
  classId: data.class_id,
  name: data.name || '',
  uniqueId: data.unique_number ? Number(data.unique_number) : undefined,
  note1: Number(data.note1) || 0,
  note2: Number(data.note2) || 0,
  note3: Number(data.note3) || 0,
});

const mapActivityFromDB = (data: any): Activity => ({
  id: data.id,
  title: data.title,
  date: data.date,
  description: data.description || '',
  imageUrl: data.image_url || '',
  pdfUrl: data.pdf_url || '',
});

// Helper to check for missing table errors
const isTableMissingError = (error: any) => {
  return error.code === '42P01' || error.code === 'PGRST205';
};

// Helper for UUID validation
const isValidUUID = (id: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

export const getClasses = async (): Promise<ClassGroup[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    if (isTableMissingError(error)) {
        console.warn('Supabase: "classes" table missing. Please run the SQL setup script.');
        return [];
    }
    console.error('Error fetching classes:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapClassFromDB);
};

export const getClass = async (id: string): Promise<ClassGroup | null> => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching class:', JSON.stringify(error, null, 2));
    return null;
  }
  if (!data) return null;
  return mapClassFromDB(data);
};

export const saveClass = async (newClass: Partial<ClassGroup>): Promise<ClassGroup | null> => {
  const { data, error } = await supabase
    .from('classes')
    .insert([{ 
      name: newClass.name, 
      description: newClass.description 
    }])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating class:', JSON.stringify(error, null, 2));
    return null;
  }
  if (!data) return null;
  return mapClassFromDB(data);
};

export const deleteClass = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);
    
    if (error) {
        console.error('Error deleting class:', JSON.stringify(error, null, 2));
        return false;
    }
    return true;
};

export const getSessions = async (): Promise<Session[]> => {
  // 1. Fetch main session rows
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isTableMissingError(error)) {
        console.warn('Supabase: "sessions" table missing. Please run the SQL setup script.');
        return [];
    }
    console.error('Error fetching sessions:', JSON.stringify(error, null, 2));
    return [];
  }

  // 2. Fetch extra videos from session_videos table
  const { data: extraVideos, error: videoError } = await supabase
    .from('session_videos')
    .select('*');

  if (videoError && !isTableMissingError(videoError)) {
      console.error('Error fetching extra videos:', JSON.stringify(videoError, null, 2));
  }

  // 3. Merge data
  return (sessions || []).map(s => {
      const session = mapSessionFromDB(s);
      
      // Get extra videos for this session
      const relatedVideos = extraVideos 
          ? extraVideos.filter((v: any) => v.session_id === s.id).map((v: any) => v.url)
          : [];

      // Combine: [primary_video_url, ...extra_videos]
      // Filter out empty strings
      const allUrls = [session.videoUrl, ...relatedVideos].filter(url => url && url.trim() !== '');
      
      // Deduplicate
      session.videoUrls = [...new Set(allUrls)];
      
      return session;
  });
};

export const uploadSessionVideo = async (file: File): Promise<string | null> => {
  try {
    // 1. Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 2. Upload to 'videos' bucket
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file);

    if (uploadError) {
      // Check if bucket missing
      if (uploadError.message.includes("Bucket not found")) {
        alert("Supabase Error: 'videos' Storage Bucket not found.\n\nPlease create a public bucket named 'videos' in your Supabase Dashboard.");
      } else {
        console.error('Error uploading video:', uploadError);
        alert(`Upload failed: ${uploadError.message}`);
      }
      return null;
    }

    // 3. Get Public URL
    const { data } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error("Unexpected upload error:", error);
    return null;
  }
};

export const saveSession = async (newSession: Partial<Session> & { videoUrls?: string[] }): Promise<Session | null> => {
  // Use the first video as the primary one for backward compatibility
  const primaryVideoUrl = newSession.videoUrls && newSession.videoUrls.length > 0 
      ? newSession.videoUrls[0] 
      : (newSession.videoUrl || '');

  const payload: any = {
      class_id: newSession.classId,
      title: newSession.title,
      description: newSession.description,
      video_url: primaryVideoUrl,
      pdf_url: newSession.pdfUrl,
      date: newSession.date,
      ai_notes: newSession.aiNotes,
      is_highlight: newSession.isHighlight || false
  };

  let savedData = null;

  // Helper function to perform the insert/update
  const performOp = async (currentPayload: any) => {
      if (newSession.id) {
        return await supabase
          .from('sessions')
          .update(currentPayload)
          .eq('id', newSession.id)
          .select()
          .maybeSingle();
      } else {
        return await supabase
          .from('sessions')
          .insert([currentPayload])
          .select()
          .maybeSingle();
      }
  };

  let { data, error } = await performOp(payload);

  // RETRY LOGIC: If 'is_highlight' column is missing (PGRST204)
  if (error && (error.code === 'PGRST204' || error.message?.includes('is_highlight'))) {
      console.warn("Column 'is_highlight' missing in DB. Retrying save without it.");
      delete payload.is_highlight;
      const retryResult = await performOp(payload);
      data = retryResult.data;
      error = retryResult.error;
      
      if (!error) {
          console.warn("Session saved without highlight feature due to schema mismatch.");
      }
  }

  if (error) {
      console.error('Error saving session:', JSON.stringify(error, null, 2));
      return null;
  }
  
  savedData = data;
  
  if (!savedData) return null;
  const savedSession = mapSessionFromDB(savedData);

  // 2. Save Additional Videos (Index 1+) to session_videos table
  if (newSession.videoUrls && newSession.videoUrls.length > 1) {
      // Clear old videos first if updating, to be safe (simple sync)
      if (newSession.id) {
          await supabase.from('session_videos').delete().eq('session_id', newSession.id);
      }

      const extraVideos = newSession.videoUrls.slice(1).map(url => ({
          session_id: savedSession.id,
          url: url
      }));
      
      const { error: videoError } = await supabase
          .from('session_videos')
          .insert(extraVideos);

      if (videoError) {
           if (isTableMissingError(videoError)) {
               alert("Warning: 'session_videos' table missing. Only the first video was saved. Run SQL script to fix.");
           } else {
               console.error("Error saving extra videos:", videoError);
           }
      }
  }

  // Return complete object
  savedSession.videoUrls = newSession.videoUrls || (primaryVideoUrl ? [primaryVideoUrl] : []);
  
  return savedSession;
};

export const deleteSession = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting session:', JSON.stringify(error, null, 2));
    return false;
  }
  return true;
};

export const getStudents = async (classId: string): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    // NOTE: Removed server-side sort by unique_number to prevent crash if column is missing (error 42703)
    .order('name', { ascending: true });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn('Supabase: "students" table missing. Please run the SQL setup script.');
      return [];
    }
    console.error('Error fetching students:', JSON.stringify(error, null, 2));
    return [];
  }

  const students = (data || []).map(mapStudentFromDB);

  // Sort client-side: Unique ID (if exists) -> Name
  return students.sort((a, b) => {
      // Put students with IDs first, sorted by ID
      const idA = a.uniqueId ?? Number.MAX_SAFE_INTEGER;
      const idB = b.uniqueId ?? Number.MAX_SAFE_INTEGER;
      
      if (idA !== idB) return idA - idB;
      return a.name.localeCompare(b.name);
  });
};

export const getStudent = async (id: string): Promise<Student | null> => {
  // Validate UUID format to prevent postgres error 22P02
  // If id is "ClassName+UUID" (broken format), this check will fail gracefully
  if (!isValidUUID(id)) {
    console.warn(`getStudent called with invalid UUID format: ${id}. Skipping fetch.`);
    return null;
  }

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching student:', JSON.stringify(error, null, 2));
    return null;
  }
  if (!data) return null;
  return mapStudentFromDB(data);
};

export const saveStudent = async (student: Partial<Student>): Promise<Student | null> => {
  const payload: any = {
    class_id: student.classId,
    name: student.name,
    note1: student.note1 ?? 0,
    note2: student.note2 ?? 0,
    note3: student.note3 ?? 0,
    unique_number: student.uniqueId
  };
  
  // Only include ID if it's a valid UUID (not a temp ID)
  if (student.id && !student.id.startsWith('temp-')) {
    payload.id = student.id;
  }

  // Auto-increment logic: if unique_number is missing, calculate it
  if (!payload.unique_number) {
    try {
        // Use select('*') instead of select('unique_number') to prevent 42703 error if column is missing
        const { data: existingStudents, error: fetchError } = await supabase
            .from('students')
            .select('*') 
            .eq('class_id', student.classId);
            
        if (!fetchError && existingStudents) {
             const maxId = existingStudents.reduce((max: number, curr: any) => {
                const num = Number(curr.unique_number) || 0;
                return num > max ? num : max;
            }, 0);
            payload.unique_number = maxId + 1;
        }
    } catch (err) {
        console.warn('Failed to calculate unique number', err);
    }
  }

  let { data, error } = await supabase
    .from('students')
    .upsert([payload])
    .select()
    .maybeSingle();

  // Retry logic if unique_number column is missing in DB (Error 42703)
  if (error && (error.code === '42703' || error.message?.includes('unique_number'))) {
      console.warn("Column 'unique_number' missing in DB. Saving student without it.");
      delete payload.unique_number;
      const retry = await supabase
        .from('students')
        .upsert([payload])
        .select()
        .maybeSingle();
        
      data = retry.data;
      error = retry.error;
  }

  if (error) {
    console.error('Error saving student:', JSON.stringify(error, null, 2));
    return null;
  }
  if (!data) return null;
  return mapStudentFromDB(data);
};

export const ensureClassStudentNumbers = async (classId: string): Promise<boolean> => {
  // 1. Get all students
  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('name'); // Alphabetical order for ID assignment

  if (error || !students) return false;

  // 2. iterate and assign numbers to those who don't have them
  // We determine the next available ID by looking at the max existing ID.
  let maxId = students.reduce((acc, curr) => {
      const num = curr.unique_number ? Number(curr.unique_number) : 0;
      return num > acc ? num : acc;
  }, 0);

  const updates = [];
  
  for (const s of students) {
      if (!s.unique_number) {
          maxId++;
          updates.push({
              id: s.id,
              unique_number: maxId
          });
      }
  }

  if (updates.length === 0) return true; // Nothing to do

  // 3. Perform updates
  let success = true;
  for (const update of updates) {
      const { error: updateError } = await supabase
          .from('students')
          .update({ unique_number: update.unique_number })
          .eq('id', update.id);
      
      if (updateError) {
          console.error("Failed to update student number", JSON.stringify(updateError));
          
          if (updateError.code === '42703') {
             alert("Database Update Required:\n\nThe 'unique_number' column is missing in your 'students' table.\n\nPlease run this SQL in your Supabase SQL Editor:\n\nALTER TABLE students ADD COLUMN unique_number INTEGER;");
             return false; // Stop immediately
          }
          success = false;
      }
  }
  
  return success;
};

export const deleteStudent = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) {
        console.error('Error deleting student:', JSON.stringify(error, null, 2));
        return false;
    }
    return true;
};

export const getActivities = async (): Promise<Activity[]> => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    if (isTableMissingError(error)) {
        console.warn('Supabase: "activities" table missing. Please run the SQL setup script.');
        return [];
    }
    console.error('Error fetching activities:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapActivityFromDB);
};

export const getActivity = async (id: string): Promise<Activity | null> => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching activity:', JSON.stringify(error, null, 2));
    return null;
  }
  if (!data) return null;
  return mapActivityFromDB(data);
};

export const saveActivity = async (activity: Partial<Activity>): Promise<Activity | null> => {
  const payload: any = {
    title: activity.title,
    date: activity.date,
    description: activity.description,
    image_url: activity.imageUrl,
    pdf_url: activity.pdfUrl
  };

  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

  let resultData = null;
  let errorObj = null;

  if (activity.id) {
    const { data, error } = await supabase
      .from('activities')
      .update(payload)
      .eq('id', activity.id)
      .select()
      .maybeSingle();
      
    errorObj = error;
    resultData = data;
  } else {
    const { data, error } = await supabase
      .from('activities')
      .insert([payload])
      .select()
      .maybeSingle();
      
    errorObj = error;
    resultData = data;
  }

  if (errorObj) {
    const err = errorObj as any;
    console.error('Error saving activity:', JSON.stringify(err, null, 2));
    return null;
  }
  
  if (!resultData) return null;
  return mapActivityFromDB(resultData);
};

export const deleteActivity = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting activity:', JSON.stringify(error, null, 2));
    return false;
  }
  return true;
};
