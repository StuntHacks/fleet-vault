import Header from "../header/header";
import styles from './baselayout.module.css';

interface BaseLayoutProps {
  children?: React.ReactNode;
}

export function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
