import { useRole } from "../context/RoleContext";
import AthleteHome from "./AthleteHome";
import CoachDashboard from "./CoachDashboard";

export default function Home() {
  const { isCoachMode } = useRole();
  return isCoachMode ? <CoachDashboard /> : <AthleteHome />;
}
