import logo from "../../assets/logo.png";
import { Button } from "../button/button";
import styles from './header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <img src={logo} className={styles.logo} alt="logo" />
        <h1>FleetVault</h1>
      </div>
      <div className={styles.galaxy}>
        Galaxy 1
      </div>
      <div className={styles.login}>
        <Button onClick={() => {}}>Curator Login</Button>
      </div>
    </header>
  );
}
