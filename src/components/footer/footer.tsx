import { useEffect, useState } from "react";
import { useMatch, useParams } from "react-router-dom";
import { useAdminSession, useUsername } from "../../lib/hooks";
import { Checkbox } from "../checkbox/checkbox";
import styles from './footer.module.scss';
import { adminLogin } from "../../lib/api";

export default function Footer() {
  const session = useAdminSession();
  const username = useUsername();
  const { galaxy } = useParams();
  const isGalaxyPage = [useMatch('/'), useMatch('/g'), useMatch('/g/:galaxy')].some(Boolean);

  const [ darkMode, setDarkMode ] = useState(() => {
    const stored = localStorage.getItem('fleetvault_darkmode');
    if (stored !== null) return stored === 'true';
    return true;
  })
   
  useEffect(() => {
    const body = document.body
    localStorage.setItem('fleetvault_darkmode', String(darkMode))
    if (darkMode) {
      body.classList.add('dark')
      body.classList.remove('light')
    } else {
      body.classList.add('light')
      body.classList.remove('dark')
    }
  }, [darkMode])

  const login = () => {
    const token = window.prompt("Curator login: please enter your login token. If you don't have one, ignore this button, it's not needed to use this website.");
    if (token === null) return;
    adminLogin(token || "").catch(() => alert("Invalid token"))
  }
  
  return (
    <footer className={styles.footer}>
      <Checkbox className={styles.darkMode} name="darkMode" checked={darkMode} onChange={setDarkMode}>
        Dark Mode
      </Checkbox>
      {username && !!session ? (
        <span>| Logged in as {username}</span>
      ) : (
          <>
          |&nbsp;<a href="#/" onClick={login}>Login</a>
          </>
      )}
      {isGalaxyPage && process.env.REACT_APP_API_URL && (
        <>&nbsp;|&nbsp;<a href={`${process.env.REACT_APP_API_URL}/g/${galaxy ?? 1}`} target="_blank" rel="noreferrer">API</a></>
      )}
      <span className={styles.version}>
        v{process.env.REACT_APP_VERSION}
        <span className={styles.footnote}> - report bugs & feedback in <a href="https://discord.com/channels/1023372620705566740/1335896763118129152" target="_blank" rel="noreferrer">#fleet-discussion</a> on the discord</span>
      </span>
    </footer>
  );
}
