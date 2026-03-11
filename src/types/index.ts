export interface Workout {
  id: number;
  user_id: number;
  assigned_workout_id: number | null;
  date: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace: string;
  calories: number;
  avg_heart_rate: number;
  feeling: number | null;
  type: 'easy' | 'tempo' | 'intervals' | 'long_run' | 'race' | 'fartlek' | 'other';
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
  birth_date: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  language: string;
  is_coach: boolean;
  is_admin: boolean;
  coach_description: string;
  coach_public: boolean;
  onboarding_completed: boolean;
  has_coach: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
}

export type ExpectedField = 'time' | 'distance' | 'heart_rate' | 'feeling';

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
  expected_fields: ExpectedField[] | null;
  result_time_seconds: number | null;
  result_distance_km: number | null;
  result_heart_rate: number | null;
  result_feeling: number | null;
  image_file_id: number | null;
  image_url: string | null;
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
  extra_info: string;
  image_file_id: number | null;
  image_url: string | null;
  is_public: boolean;
  is_verified: boolean;
  rejection_reason: string;
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
  coach_locality: string;
  coach_level: string;
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
  student_count: number;
  verified_achievement_count: number;
  is_my_coach: boolean;
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
  extra_info: string;
  image_file_id: number | null;
  image_url: string | null;
  created_at: string;
  coach_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Invitation {
  id: number;
  type: 'coach_invite' | 'student_request';
  sender_id: number;
  receiver_id: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
  sender_name: string;
  sender_avatar: string;
  receiver_name: string;
  receiver_avatar: string;
}

export interface NotificationAction {
  key: string;
  label: string;
  style: 'primary' | 'danger' | 'default';
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  actions: NotificationAction[] | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: number;
  user_id: number;
  workout_assigned: boolean;
  workout_completed_or_skipped: boolean;
}

export interface FileResponse {
  id: number;
  uuid: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
}
