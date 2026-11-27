import s from './AuthReel.module.css';

// The moving backdrop on the sign-in screens: one continuous reel of the company flyers
// (vision, mission and the seven PROTECT values). Pure CSS, so it costs nothing to run
// and stops for people who ask for reduced motion.
const REEL = [
  { tag: 'Our vision', a: 'Where advisors', b: 'own their future', text: 'Every family protected, with integrity and purpose.', photo: 'our-vision', letter: 'V', pos: 'center 62%' },
  { tag: 'Our mission', a: 'Build a legacy', b: 'worth leaving', text: 'Careers worth having, agencies worth owning, and protection every family can trust.', photo: 'our-mission', letter: 'M', pos: 'center' },
  { tag: 'Value 1 of 7', a: 'Partnership', b: 'We win together', text: 'Your goals are our goals.', photo: 'partnership', letter: 'P', pos: '72% center' },
  { tag: 'Value 2 of 7', a: 'Responsibility', b: 'We do what’s right', text: 'Clients’ best interests first, every time.', photo: 'responsibility', letter: 'R', pos: 'center' },
  { tag: 'Value 3 of 7', a: 'Ownership', b: 'You build it', text: 'You lead it and you keep it: your book, your team, your future.', photo: 'ownership', letter: 'O', pos: 'center' },
  { tag: 'Value 4 of 7', a: 'Transparency', b: 'No fine print', text: 'Every fee, every split, every detail.', photo: 'transparency', letter: 'T', pos: 'center' },
  { tag: 'Value 5 of 7', a: 'Education', b: 'Learn it, lead it', text: 'Knowledge empowers better decisions.', photo: 'education', letter: 'E', pos: '70% center' },
  { tag: 'Value 6 of 7', a: 'Commitment', b: 'We show up', text: 'For our clients, our advisors and our communities.', photo: 'commitment', letter: 'C', pos: 'center' },
  { tag: 'Value 7 of 7', a: 'Trust', b: 'Earned every day', text: 'We protect what matters most.', photo: 'trust', letter: 'T', pos: 'center 30%' },
];
const N = REEL.length;
const SECONDS_EACH = 5;
const TOTAL = N * SECONDS_EACH;
// A few repeated panels at the end so the loop joins without a gap.
const LOOPED = [...REEL, REEL[0], REEL[1]];

// Fixed, hand-placed dots (no randomness, so server and browser render the same thing).
const DOTS = [
  [4, 7, 11, 0.55], [9, 12, 22, 0.8], [14, 5, 16, 0.4], [19, 16, 30, 0.7], [24, 9, 13, 0.5], [29, 6, 26, 0.85], [34, 22, 19, 0.45], [39, 8, 33, 0.65],
  [44, 12, 15, 0.5], [49, 5, 24, 0.75], [54, 16, 28, 0.6], [59, 7, 12, 0.4], [64, 10, 35, 0.8], [7, 20, 37, 0.5], [22, 6, 18, 0.7], [37, 14, 27, 0.55], [52, 9, 21, 0.45], [62, 6, 31, 0.7],
];

export default function AuthReel() {
  return (
    <div className={s.reelWrap} aria-hidden="true" style={{ '--n': N, '--total': `${TOTAL}s` }}>
      <div className={s.reel}>
        {/* one panel before the first, so the left side is never empty when the loop starts */}
        {[REEL[N - 1], ...LOOPED].map((p, k) => (
          <div key={k} className={s.photo} style={{ '--k': k - 1, backgroundImage: `url(/flyers/photos/${p.photo}.jpg)`, backgroundPosition: p.pos }} />
        ))}
      </div>
      <div className={s.tint} />
      <div className={s.letters}>
        {LOOPED.map((p, k) => <span key={k} style={{ '--k': k }}>{p.letter}</span>)}
      </div>
      <div className={s.wash} />

      {REEL.map((p, k) => {
        const d = k * SECONDS_EACH - TOTAL - 1.1;
        return (
          <div key={p.photo} className={s.copy}>
            <span className={s.tag} style={{ animationDelay: `${d}s` }}>{p.tag}</span>
            <p className={s.headline}>
              <span><b style={{ animationDelay: `${d + 0.14}s` }}>{p.a}</b></span>
              <span><b className={s.gold} style={{ animationDelay: `${d + 0.28}s` }}>{p.b}<i>.</i></b></span>
            </p>
            <p className={s.text} style={{ animationDelay: `${d + 0.46}s` }}>{p.text}</p>
          </div>
        );
      })}

      <div className={s.dots}>
        {DOTS.map(([left, size, dur, op], k) => (
          <i key={k} style={{ left: `${left}%`, width: size, height: size, opacity: op, animationDuration: `${dur}s`, animationDelay: `-${(k * 2.7) % dur}s` }} />
        ))}
      </div>
      <div className={s.progress}><i /></div>
    </div>
  );
}
