import { Link, useParams } from "react-router-dom";
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
            {battles.loading && <p>Loading...</p>}
            {battles.error && <p>Error loading battles</p>}
            {!battles.loading && !battles.error && (
                <>
                    {!battles.battles.length && <p>No solutions submitted yet</p>}
                    <ul>
                        {battles.battles.filter((b) => data.galaxies[id - 1].battles[b] !== undefined).map((b) => (
                            <li key={data.galaxies[id - 1].battles[b].id}>
                                <Link to={`/g/${id}/b/${b}`}>
                                    {data.galaxies[id - 1].battles[b].name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </BaseLayout>
    );
}
