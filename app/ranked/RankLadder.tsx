import type { CSSProperties } from "react";
import styles from "./RankLadder.module.css";
import RankEmblem from "./RankEmblem";
import { PLACEMENT_GAMES, TIERS, type Tier } from "./config";
import { rankOf, type Rank } from "./rating";

const ROMAN = ["I", "II", "III", "IV", "V"];

const nextTier = (tier: Tier) => TIERS[TIERS.indexOf(tier) + 1] ?? null;

/** Ratings of a tier, as shown: the lowest tier takes everything below the next */
const range = (tier: Tier) => {
  const next = nextTier(tier);
  if (!next) return `${tier.from} points et plus`;
  if (TIERS.indexOf(tier) === 0) return `jusqu'à ${next.from - 1} points`;
  return `${tier.from} – ${next.from - 1} points`;
};

/** Every rank, best first, with the player's own marked */
const Tiers = ({ current }: { current: Rank | null }) => (
  <ol className={styles.tiers}>
    {[...TIERS].reverse().map((tier) => {
      const next = nextTier(tier);
      // Drawn at its top division (every pip filled)
      const rank = rankOf(next ? next.from - 1 : tier.from, PLACEMENT_GAMES);
      const mine = !!current?.placed && current.tier.id === tier.id;
      const best = !next;
      return (
        <li
          key={tier.id}
          className={`${styles.tier} ${best ? styles.best : ""} ${mine ? styles.mine : ""}`}
          style={{ "--tier": tier.color, "--tier-dark": tier.dark } as CSSProperties}
        >
          <RankEmblem rank={rank} size={best ? 54 : 38} />
          <span className={styles.tierText}>
            <strong className={best ? styles.bestName : styles.tierName}>{tier.name}</strong>
            <small>
              {range(tier)} · {tier.divisions > 1 ? `${tier.divisions} divisions` : "le sommet, sans division"}
            </small>
          </span>
          {mine && (
            <span className={styles.you}>
              {tier.divisions > 1 ? `Toi · ${ROMAN[current!.division - 1]}` : "Toi"}
            </span>
          )}
        </li>
      );
    })}
  </ol>
);

/** What the divisions are, on the player's tier (or Or): the steps and their points */
export const Divisions = ({ current }: { current: Rank | null }) => {
  const own = current?.placed && current.tier.divisions > 1 ? current : null;
  const tier = own?.tier ?? TIERS.find((t) => t.id === "or") ?? TIERS[0];
  const next = nextTier(tier)!;
  const width = (next.from - tier.from) / tier.divisions;
  const steps = Array.from({ length: tier.divisions }, (_, i) => Math.round(tier.from + i * width));
  return (
    <section className={styles.divisions} aria-label="Les divisions">
      <h3>Les divisions I, II, III</h3>
      <p>
        Chaque rang est découpé en {tier.divisions} divisions de {Math.round(width)} points : la{" "}
        <b>I</b> pour y entrer, la <b>{ROMAN[tier.divisions - 1]}</b> juste avant le rang suivant. Les
        losanges sous l&apos;emblème montrent ta division.
      </p>
      <div
        className={styles.steps}
        style={{ "--tier": tier.color, "--tier-dark": tier.dark, "--steps": steps.length } as CSSProperties}
        role="img"
        aria-label={`${tier.name} : ${steps
          .map((from, i) => `${ROMAN[i]} dès ${from} points`)
          .join(", ")}, puis ${next.name} à ${next.from} points`}
      >
        {steps.map((from, i) => (
          <span key={i} className={`${styles.step} ${own && own.division === i + 1 ? styles.here : ""}`}>
            <b>
              {tier.name} {ROMAN[i]}
            </b>
            <small>{from}</small>
          </span>
        ))}
        <span className={styles.nextStep}>
          <b>{next.divisions > 1 ? `${next.name} I` : next.name}</b>
          <small>{next.from}</small>
        </span>
      </div>
      <p className={styles.note}>
        Gagne des points pour monter de division ; passe la {ROMAN[tier.divisions - 1]} et tu changes de
        rang. Le Morpion Mastermind n&apos;a pas de division : c&apos;est le sommet.
      </p>
    </section>
  );
};

/** Every rank of the ladder, best first (the divisions are explained by Divisions) */
const RankLadder = ({ current }: { current: Rank | null }) => (
  <div className={styles.ladder}>
    <p className={styles.intro}>
      {TIERS.length} rangs, du {TIERS[0].name} au {TIERS[TIERS.length - 1].name}. Ton rang est
      révélé après {PLACEMENT_GAMES} parties de placement.
    </p>
    <Tiers current={current} />
  </div>
);

export default RankLadder;
