import { useNavigate } from 'react-router-dom';
import logo from "../../assets/logo.png";
import { adminLogin } from "../../lib/api";
import { useAdminSession } from "../../lib/hooks";
import { Button } from "../button/button";
import GalaxySelect from "../galaxySelect/galaxySelect";
import styles from './header.module.scss';

export default function Header() {
  const session = useAdminSession();
  const isAdmin = !!session;
  const navigate = useNavigate();

  console.log(session?.user.user_metadata)

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <img src={logo} className={styles.logo} alt="logo" />
        <h1>FleetVault</h1>
      </div>
      <div className={styles.galaxy}>
        <GalaxySelect />
      </div>
      <div className={styles.login}>
        {isAdmin ?
          <Button variant="secondary" onClick={() => navigate('/advisors')}>Advisor Explorer</Button> :
          <Button variant="secondary" onClick={() => {adminLogin(window.prompt() || "")}}>Login</Button>
        }
        <Button onClick={() => { }}>
          Submit
          <span>(Ctrl + V)</span>
        </Button>
      </div>
    </header>
  );
}
