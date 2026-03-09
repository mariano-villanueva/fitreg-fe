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

export interface AuthResponse {
  token: string;
  user: User;
}
