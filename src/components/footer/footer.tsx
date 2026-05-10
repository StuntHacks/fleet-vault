import { useEffect, useState } from "react";
import { useAdminSession, useUsername } from "../../lib/hooks";
import { Checkbox } from "../checkbox/checkbox";
import styles from './footer.module.scss';

export default function Footer() {
  const session = useAdminSession();
  const username = useUsername();
  const [ darkMode, setDarkMode ] = useState(() => {
    const stored = localStorage.getItem('fleetvault_darkmode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
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
  
  return (
    <div className={styles.footer}>
      <Checkbox className={styles.darkMode} name="darkMode" checked={darkMode} onChange={setDarkMode}>
        Dark Mode
      </Checkbox>
      {username && !!session ? `| Logged in as ${username}` : ''}
      <span className={styles.version}>
        v{process.env.REACT_APP_VERSION}
        <span className={styles.footnote}> - report bugs in #wiki-stuff on the discord</span>
      </span>
    </div>
  );
}
