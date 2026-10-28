import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Footer from "../footer/footer";
import Header from "../header/header";
import styles from './baselayout.module.scss';

interface BaseLayoutProps {
  children?: React.ReactNode;
  galaxy?: number;
}

export function BaseLayout({ children, galaxy }: BaseLayoutProps) {
  const { galaxy: param } = useParams();
  const id = galaxy ?? parseInt(param ?? "", 10);

  useEffect(() => {
    document.title = id ? `G${id} - Unnamed Space Idle FleetVault` : "Unnamed Space Idle FleetVault";
  }, [id]);

  return (
    <>
      <Header galaxy={galaxy} />
      <main className={styles.main}>
        {children}
      </main>
      <Footer />
    </>
  );
}
