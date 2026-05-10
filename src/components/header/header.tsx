import { useNavigate, useParams } from "react-router-dom";
import logo from "../../assets/logo.png";
import { adminLogin, adminLogout } from "../../lib/api";
import { useAdminSession } from "../../lib/hooks";
import { Button } from "../button/button";
import GalaxySelect from "../galaxySelect/galaxySelect";
import styles from './header.module.scss';

export default function Header() {
  const session = useAdminSession();
  const isAdmin = !!session;
  const navigate = useNavigate();
  const { galaxy } = useParams();
  const id = parseInt(galaxy || "1", 10);

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
          <Button variant="secondary" onClick={() => adminLogout()}>Logout</Button> :
          <Button variant="secondary" onClick={() => {adminLogin(window.prompt() || "").catch(() => alert("Invalid token"))}}>Login</Button>
        }
        <Button onClick={() => navigate(`/g/${id}/submit`)}>
          Submit
          <span>(Ctrl + V)</span>
        </Button>
      </div>
    </header>
  );
}
