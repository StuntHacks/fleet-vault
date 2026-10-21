import { Link, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useBattles } from "../lib/hooks";
import { galaxies } from "../lib/battles";

export default function GalaxyView() {
    const { galaxy } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }
    const battles = useBattles(id);
    const withSolutions = galaxies[id - 1].battles.filter((b) => battles.battles.includes(b.id));
    return (
        <BaseLayout>
            {battles.loading && <p>Loading...</p>}
            {battles.error && <p>Error loading battles</p>}
            {!battles.loading && !battles.error && (
                <>
                    {!withSolutions.length && <p>No solutions submitted yet</p>}
                    <ul>
                        {withSolutions.map((b) => (
                            <li key={b.id}>
                                <Link to={`/g/${id}/b/${b.id}`}>{b.name}</Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </BaseLayout>
    );
}
