import { useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useBattles } from "../lib/hooks";
import data from "../data.json";

export default function GalaxyView() {
    const { galaxy } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), data.galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }
    const battles = useBattles(id);
    return (
        <BaseLayout>
            Galaxy View
        </BaseLayout>
    );
}
