import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useAdminSession } from "../lib/hooks";

export default function AdvisorView() {
    const session = useAdminSession();
    const navigate = useNavigate();

    useEffect(() => {
        if (session === null) {
            navigate('/');
        }
    }, [session, navigate]);

    if (session === undefined || session === null) {
        return null;
    }

    return (
        <BaseLayout>
            Advisor Explorer
        </BaseLayout>
    );
}
