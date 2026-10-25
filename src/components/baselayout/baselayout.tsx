import Footer from "../footer/footer";
import Header from "../header/header";
import styles from './baselayout.module.scss';

interface BaseLayoutProps {
  children?: React.ReactNode;
  galaxy?: number;
}

export function BaseLayout({ children, galaxy }: BaseLayoutProps) {
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
