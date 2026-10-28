import { getUpdatedSolutions } from "../lib/api";
import { SolutionQueue } from "./flagged";

export default function UpdatesView() {
    return <SolutionQueue load={getUpdatedSolutions} empty="No pending updates" />;
}
