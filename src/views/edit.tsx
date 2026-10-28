import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { getSolution, getSolutionUpdate } from "../lib/api";
import { useAdminSession } from "../lib/hooks";
import { Solution } from "../lib/types";
import { SolutionForm } from "./submit";
import styles from "./galaxy.module.scss";

export default function EditView({ suggest }: { suggest?: boolean }) {
    const session = useAdminSession();
    const navigate = useNavigate();
    const id = Number(useParams().solution);
    const updateId = Number(useSearchParams()[0].get("update")) || undefined;
    const [solution, setSolution] = useState<Solution | null | undefined>(undefined);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (session === null && !suggest) navigate('/');
        if (session && suggest) navigate(`/edit/${id}`, { replace: true });
    }, [session, suggest, id, navigate]);

    useEffect(() => {
        let current = true;
        setError(false);
        Promise.all([getSolution(id), updateId ? getSolutionUpdate(updateId) : null])
            .then(([s, update]) => {
                if (!current) return;
                if (updateId && !update) throw new Error("Update not found");
                setSolution(s && update ? { ...s, ...update.changes, purchases: { ...s.purchases, ...update.changes.purchases } } : s);
            })
            .catch(() => { if (current) setError(true); });
        return () => { current = false; };
    }, [id, updateId]);

    if (!session && !suggest) return <BaseLayout />;
    if (solution) return <SolutionForm key={solution.id} solution={solution} suggest={suggest} updateId={updateId} />;

    return (
        <BaseLayout>
            {error && <p className={styles.error}>{updateId ? "Error loading update, it may already be resolved" : "Error loading solution"}</p>}
            {!error && solution === null && <p className={styles.info}>Solution not found</p>}
            {!error && solution === undefined && <p className={styles.info}>Loading...</p>}
        </BaseLayout>
    );
}
