export interface Workout {
  id: number;
  user_id: number;
  date: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace: string;
  calories: number;
  avg_heart_rate: number;
  type: 'easy' | 'tempo' | 'intervals' | 'long_run' | 'race' | 'other';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string;
  sex: string;
  age: number;
  weight_kg: number;
  language: string;
  is_coach: boolean;
  is_admin: boolean;
  coach_description: string;
  coach_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
}

export interface AssignedWorkout {
  id: number;
  coach_id: number;
  student_id: number;
  title: string;
  description: string;
  type: string;
  distance_km: number;
  duration_seconds: number;
  notes: string;
  status: 'pending' | 'completed' | 'skipped';
  due_date: string;
  created_at: string;
  updated_at: string;
  student_name?: string;
  coach_name?: string;
  segments?: WorkoutSegment[];
}

export interface WorkoutSegment {
  id?: number;
  assigned_workout_id?: number;
  order_index: number;
  segment_type: 'simple' | 'interval';
  repetitions: number;
  value: number;
  unit: 'km' | 'm' | 'min' | 'sec';
  intensity: 'easy' | 'moderate' | 'fast' | 'sprint';
  work_value: number;
  work_unit: 'km' | 'm' | 'min' | 'sec';
  work_intensity: 'easy' | 'moderate' | 'fast' | 'sprint';
  rest_value: number;
  rest_unit: 'km' | 'm' | 'min' | 'sec';
  rest_intensity: 'easy' | 'moderate' | 'fast' | 'sprint';
}

export interface CoachAchievement {
  id: number;
  coach_id: number;
  event_name: string;
  event_date: string;
  distance_km: number;
  result_time: string;
  position: number;
  is_verified: boolean;
  verified_by: number;
  verified_at: string;
  created_at: string;
}

export interface CoachRating {
  id: number;
  coach_id: number;
  student_id: number;
  rating: number;
  comment: string;
  student_name: string;
  created_at: string;
  updated_at: string;
}

export interface CoachListItem {
  id: number;
  name: string;
  avatar_url: string;
  coach_description: string;
  avg_rating: number;
  rating_count: number;
  verified_achievements: number;
}

export interface CoachPublicProfile {
  id: number;
  name: string;
  avatar_url: string;
  coach_description: string;
  avg_rating: number;
  rating_count: number;
  achievements: CoachAchievement[];
  ratings: CoachRating[];
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  avatar_url: string;
  is_coach: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_coaches: number;
  total_ratings: number;
  pending_achievements: number;
}

export interface PendingAchievement {
  id: number;
  coach_id: number;
  event_name: string;
  event_date: string;
  distance_km: number;
  result_time: string;
  position: number;
  created_at: string;
  coach_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
