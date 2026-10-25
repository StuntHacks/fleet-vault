import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { getSolution } from "../lib/api";
import { useAdminSession } from "../lib/hooks";
import { Solution } from "../lib/types";
import { SolutionForm } from "./submit";
import styles from "./galaxy.module.scss";

export default function EditView() {
    const session = useAdminSession();
    const navigate = useNavigate();
    const id = Number(useParams().solution);
    const [solution, setSolution] = useState<Solution | null | undefined>(undefined);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (session === null) navigate('/');
    }, [session, navigate]);

    useEffect(() => {
        let current = true;
        setError(false);
        getSolution(id)
            .then((s) => { if (current) setSolution(s); })
            .catch(() => { if (current) setError(true); });
        return () => { current = false; };
    }, [id]);

    if (!session) return <BaseLayout />;
    if (solution) return <SolutionForm key={solution.id} solution={solution} />;

    return (
        <BaseLayout>
            {error && <p className={styles.error}>Error loading solution</p>}
            {!error && solution === null && <p className={styles.info}>Solution not found</p>}
            {!error && solution === undefined && <p className={styles.info}>Loading...</p>}
        </BaseLayout>
    );
}
