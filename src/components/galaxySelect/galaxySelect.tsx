import { Link, useParams } from 'react-router-dom';
import { clsx } from "clsx"
import styles from './galaxySelect.module.css';
import data from '../../data.json';
import { useState } from 'react';

export default function GalaxySelect() {
  const [shown, setShown] = useState(false);

  const { galaxy } = useParams();
  let id = parseInt(galaxy || "1", 10);
  id = Math.min(Math.max(id, 1), data.galaxies.length);
  if (isNaN(id)) {
    id = 1;
  }

  return (
    <div
      className={clsx(styles.galaxySelect, { [styles.shown]: shown })}
      onClick={() => setShown(!shown)}
    >
      Galaxy {id}
      <div className={styles.dropdown} onClick={(e) => { e.stopPropagation(); }}>
        {data.galaxies.map((g, index) => index + 1 === id ? undefined : (
          <Link key={index} to={`/g/${index + 1}`} className={clsx(styles.dropdownItem, { [styles.selected]: index + 1 === id })}>
            Galaxy {index + 1}
          </Link>
        ))}
      </div>
    </div>
  );
}
