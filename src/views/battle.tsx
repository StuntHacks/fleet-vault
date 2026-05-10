import { useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useSolutions } from "../lib/hooks";
import data from "../data.json";

export default function BattleView() {
    const { galaxy, battle } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), data.galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }
    const solutions = useSolutions(id, parseInt(battle || "1", 10));
    return (
        <BaseLayout>
            {solutions.loading && <p>Loading...</p>}
            {solutions.error && <p>Error loading solutions</p>}
            {!solutions.loading && !solutions.error && (
                <>
                    <h1>Best</h1>
                    <ul>
                        {solutions.best.map((s) => (
                            <li key={s.id}>
                                <a href={s.screenshot_url!} target="_blank" rel="noopener noreferrer">
                                    <img src={s.screenshot_url!} alt="screenshot" style={{ maxWidth: "300px" }} />
                                </a>
                                <p>Combat Stats: {s.combat_stats}</p>
                                <p>FR Used: {s.fr_used}</p>
                                <p>FR Committed: {s.fr_committed}</p>
                            </li>
                        ))}
                    </ul>
                    <h1>Obsolete</h1>
                </>
            )}
        </BaseLayout>
    );
}
