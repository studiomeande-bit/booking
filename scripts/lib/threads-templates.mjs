// Threads 자동 게시 문구 템플릿 (scripts/threads-post.mjs 가 씀).
//
// - 분야(category)는 portfolio-data.json 의 category 와 같다: portrait·family·kids·maternity·wedding·snap.
// - 같은 분야 세션이 올라올 때마다 순서대로 돌려 쓴다(threads-state.json 의 counters). 영어·독일어는 같은 id 를 쓴다.
// - months 가 있으면 그 달(베를린 기준)에만 후보에 들어간다(시즌 문구).
// - 글자 수 500 이하, 해시태그는 하나만(Threads 는 글 하나에 토픽 태그 하나만 링크한다).
//   scripts/check-threads-post.mjs 가 이 규칙을 검사한다.
// - 독일어는 SNS 용 du 말투. 성별이 드러나는 직업명(Fotograf/Fotografin)은 쓰지 않는다.

export const TEMPLATES = {
  portrait: [
    {
      id: 'portrait-1',
      en: `New profile photo time? 💼

At Studio mean in Oberursel, near Frankfurt, I shoot portraits for LinkedIn, job applications, websites and artists.

No camera experience needed. I guide your pose and expression step by step.

Want a new portrait? Comment below and I'll DM you.

#headshots`,
      de: `Zeit für ein neues Profilfoto? 💼

Im Studio mean in Oberursel bei Frankfurt fotografiere ich Porträts für LinkedIn, Bewerbungen, Websites und Künstler:innen.

Kameraerfahrung brauchst du keine. Ich begleite dich Schritt für Schritt bei Pose und Ausdruck.

Lust auf ein neues Porträt? Kommentiere und ich schreibe dir per DM.

#bewerbungsfoto`,
    },
    {
      id: 'portrait-2',
      en: `Your profile photo is often the first thing people see. Make it count.

This is from a recent portrait session at Studio mean, our photo & video studio near Frankfurt. Calm light, a simple background, and plenty of time to get comfortable.

📸 Need a fresh portrait for work or your website? Drop a comment and I'll reach out.

#portraitphotography`,
      de: `Dein Profilfoto ist oft das Erste, was andere von dir sehen.

Das hier ist aus einem aktuellen Porträtshooting im Studio mean, unserem Foto- & Videostudio bei Frankfurt. Ruhiges Licht, schlichter Hintergrund und genug Zeit, um locker zu werden.

📸 Neues Porträt für Job oder Website? Kommentiere und ich melde mich.

#businessportrait`,
    },
    {
      id: 'portrait-3',
      en: `Most people say "I'm not photogenic." Then they see their photos. 🙂

A portrait session at Studio mean near Frankfurt is relaxed: we talk, try a few looks, and I show you the shots as we go.

Business, creative, or just for you.

💬 Want to try? Leave a comment and I'll DM you the details.

#profilephoto`,
      de: `Viele sagen: „Ich bin nicht fotogen.“ Bis sie ihre Fotos sehen. 🙂

Ein Porträtshooting im Studio mean bei Frankfurt ist entspannt: Wir reden, probieren ein paar Looks aus, und ich zeige dir die Bilder direkt.

Business, kreativ oder einfach für dich.

💬 Lust drauf? Kommentiere und ich schicke dir die Details per DM.

#portraitfotografie`,
    },
  ],

  family: [
    {
      id: 'family-1',
      en: `Kids don't sit still, and that's the fun part.

At Studio mean in Oberursel, near Frankfurt, I don't force poses. We play, laugh, move around, and I catch the moments in between.

If your little ones are growing way too fast, now is a good time to keep this chapter.

📸 Want a family shoot? Comment below and I'll DM you.

#familyphotography`,
      de: `Kinder sitzen nicht still, und genau das macht Spaß.

Im Studio mean in Oberursel bei Frankfurt zwinge ich niemanden in Posen. Wir spielen, lachen, bewegen uns, und ich halte die Momente dazwischen fest.

Wenn die Kleinen gerade viel zu schnell groß werden, ist jetzt ein guter Zeitpunkt.

📸 Lust auf ein Familienshooting? Kommentiere und ich schreibe dir per DM.

#familienfotos`,
    },
    {
      id: 'family-2',
      en: `One afternoon, one family, a lot of laughing. 📸

From a recent family session at Studio mean, our photo & video studio near Frankfurt. Clean light, a calm space and no rush, so everyone can relax, even the little ones.

Grandparents, newborns, the whole crew: everyone's welcome.

Want photos like these? Leave a comment and I'll reach out.

#familyphotos`,
      de: `Ein Nachmittag, eine Familie, viel Lachen. 📸

Aus einem aktuellen Familienshooting im Studio mean, unserem Foto- & Videostudio bei Frankfurt. Schönes Licht, ruhige Atmosphäre und kein Zeitdruck, damit sich alle entspannen können.

Großeltern, Babys, die ganze Bande: alle sind willkommen.

Solche Fotos auch für euch? Kommentiere und ich melde mich.

#familienshooting`,
    },
    {
      id: 'family-3',
      en: `The photos you'll be glad you took in ten years.

A family session at Studio mean near Frankfurt takes about an hour. Comfortable clothes are enough, and nobody needs posing experience. I'll guide you the whole way.

💬 Thinking about family photos this year? Drop a comment and I'll DM you the details.

#familyportrait`,
      de: `Die Fotos, über die ihr euch in zehn Jahren freut.

Ein Familienshooting im Studio mean bei Frankfurt dauert etwa eine Stunde. Bequeme Kleidung reicht, Posing-Erfahrung braucht niemand. Ich begleite euch die ganze Zeit.

💬 Familienfotos dieses Jahr? Kommentiere und ich schicke dir die Details per DM.

#familienfotografie`,
    },
  ],

  kids: [
    {
      id: 'kids-1',
      en: `Big smiles, small humans. 🧸

Kids sessions at Studio mean in Oberursel, near Frankfurt, are all about play. Toys, bubbles, a bit of silliness and lots of patience. No forced smiles.

First birthday, first day of school, or just because they're growing so fast.

Want a kids shoot? Comment below and I'll DM you.

#kidsphotography`,
      de: `Großes Lachen, kleine Menschen. 🧸

Kindershootings im Studio mean in Oberursel bei Frankfurt sind vor allem Spiel. Spielzeug, Seifenblasen, ein bisschen Quatsch und viel Geduld. Kein gezwungenes Lächeln.

Erster Geburtstag, Einschulung oder einfach, weil sie so schnell wachsen.

Lust auf ein Kindershooting? Kommentiere und ich schreibe dir per DM.

#kinderfotografie`,
    },
    {
      id: 'kids-2',
      en: `First birthday photos, done the relaxed way. 🎂

At Studio mean near Frankfurt we set up the table, the props and the light, then let your little one take their time. Breaks, snacks and cuddles included.

👶 Planning a first birthday shoot? Leave a comment and I'll send you the details.

#firstbirthday`,
      de: `Fotos zum ersten Geburtstag, ganz entspannt. 🎂

Im Studio mean bei Frankfurt bereiten wir Tisch, Deko und Licht vor und lassen deinem Kind dann alle Zeit der Welt. Pausen, Snacks und Kuscheln inklusive.

👶 Shooting zum 1. Geburtstag geplant? Kommentiere und ich schicke dir die Details.

#ersterGeburtstag`,
    },
    {
      id: 'kids-3',
      en: `They'll never be this little again.

From a recent kids session at Studio mean, our photo & video studio near Frankfurt. Every child warms up at their own pace, so we take as long as it needs.

💬 Want photos of your little one? Drop a comment and I'll reach out.

#childphotography`,
      de: `So klein sind sie nie wieder.

Aus einem aktuellen Kindershooting im Studio mean, unserem Foto- & Videostudio bei Frankfurt. Jedes Kind taut in seinem eigenen Tempo auf, deshalb nehmen wir uns so viel Zeit wie nötig.

💬 Fotos von deinem Kind? Kommentiere und ich melde mich.

#kinderfotos`,
    },
  ],

  maternity: [
    {
      id: 'maternity-1',
      en: `Waiting for someone very small. 🤍

Maternity sessions at Studio mean in Oberursel, near Frankfurt, are calm and unhurried. Soft light, comfortable poses, plenty of breaks. Partners and siblings are welcome too.

The best time is around weeks 28 to 34.

Want maternity photos? Comment below and I'll DM you.

#maternityphotography`,
      de: `Warten auf jemand ganz Kleines. 🤍

Babybauch-Shootings im Studio mean in Oberursel bei Frankfurt sind ruhig und ohne Eile. Weiches Licht, bequeme Posen, viele Pausen. Partner:in und Geschwister sind willkommen.

Ideal ist etwa die 28. bis 34. Woche.

Lust auf Babybauchfotos? Kommentiere und ich schreibe dir per DM.

#babybauchshooting`,
    },
    {
      id: 'maternity-2',
      en: `A few months you'll want to remember.

From a recent maternity session at Studio mean, our photo & video studio near Frankfurt. Simple styling, gentle light, and as much time as you need.

🤍 Expecting? Leave a comment and I'll send you the details.

#maternityshoot`,
      de: `Ein paar Monate, an die du dich erinnern willst.

Aus einem aktuellen Babybauch-Shooting im Studio mean, unserem Foto- & Videostudio bei Frankfurt. Schlichtes Styling, sanftes Licht und so viel Zeit, wie du brauchst.

🤍 Du erwartest ein Baby? Kommentiere und ich schicke dir die Details.

#schwangerschaftsfotos`,
    },
    {
      id: 'maternity-3',
      en: `Almost a family of more. 🤍

At Studio mean near Frankfurt, a maternity shoot can be solo, with your partner, or with the big sibling-to-be. I'll guide every pose, so you can just enjoy it.

💬 Thinking about bump photos? Drop a comment and I'll reach out.

#bumpphotos`,
      de: `Bald seid ihr mehr. 🤍

Im Studio mean bei Frankfurt kann ein Babybauch-Shooting allein, mit Partner:in oder mit dem großen Geschwisterkind sein. Ich begleite jede Pose, du kannst es einfach genießen.

💬 Babybauchfotos im Kopf? Kommentiere und ich melde mich.

#babybauchfotos`,
    },
  ],

  wedding: [
    {
      id: 'wedding-1',
      en: `Getting married in Germany? 💍

Studio mean in Oberursel, near Frankfurt, shoots weddings, Standesamt ceremonies and pre-wedding sessions, in the studio or around the city.

Relaxed, natural, and with enough time for the two of you to just be together.

Want to talk about your day? Comment below and I'll DM you.

#weddingphotography`,
      de: `Ihr heiratet in Deutschland? 💍

Studio mean in Oberursel bei Frankfurt fotografiert Hochzeiten, standesamtliche Trauungen und Pre-Wedding-Shootings, im Studio oder in der Stadt.

Entspannt, natürlich und mit genug Zeit, damit ihr einfach ihr selbst sein könnt.

Lust, über euren Tag zu sprechen? Kommentiere und ich schreibe dir per DM.

#hochzeitsfotografie`,
    },
    {
      id: 'wedding-2',
      en: `Just married, or almost. 🤍

From a recent wedding session with Studio mean, our photo & video studio near Frankfurt. A few guided poses, then a lot of real moments.

Standesamt, pre-wedding, or a small celebration with family.

💬 Planning your wedding photos? Leave a comment and I'll send you the details.

#frankfurtwedding`,
      de: `Frisch verheiratet, oder fast. 🤍

Aus einem aktuellen Hochzeitsshooting mit Studio mean, unserem Foto- & Videostudio bei Frankfurt. Ein paar angeleitete Posen, dann viele echte Momente.

Standesamt, Pre-Wedding oder eine kleine Feier mit der Familie.

💬 Ihr plant eure Hochzeitsfotos? Kommentiere und ich schicke dir die Details.

#standesamt`,
    },
    {
      id: 'wedding-3',
      en: `The dress, the flowers, the nerves, the laughing. 💐

A wedding shoot with Studio mean near Frankfurt doesn't need a big production. Just bring yourselves, and I'll take care of the light and the posing.

Want photos like these? Drop a comment and I'll reach out.

#weddingphotos`,
      de: `Das Kleid, die Blumen, die Aufregung, das Lachen. 💐

Ein Hochzeitsshooting mit Studio mean bei Frankfurt braucht keine große Produktion. Bringt einfach euch selbst mit, um Licht und Posen kümmere ich mich.

Solche Fotos auch für euch? Kommentiere und ich melde mich.

#hochzeitsfotos`,
    },
  ],

  snap: [
    {
      id: 'snap-1',
      en: `Frankfurt makes a pretty good backdrop. 📍

Besides our studio in Oberursel, Studio mean also shoots outdoor snaps around the city: Römerberg, the Eiserner Steg, the Main at golden hour.

Couples, friends, solo, or just visiting Frankfurt for a few days.

🌿 Want candid snaps? Comment below and I'll DM you.

#frankfurt`,
      de: `Frankfurt ist eine ziemlich gute Kulisse. 📍

Neben dem Studio in Oberursel fotografiert Studio mean auch draußen in der Stadt: Römerberg, Eiserner Steg, der Main zur goldenen Stunde.

Paare, Freunde, allein oder nur ein paar Tage zu Besuch in Frankfurt.

🌿 Lust auf natürliche Fotos? Kommentiere und ich schreibe dir per DM.

#frankfurt`,
    },
    {
      id: 'snap-2',
      en: `Natural light, real moments, nothing too posed.

From a recent outdoor snap session with Studio mean, our photo & video studio near Frankfurt. We walk, talk, and I catch what happens in between.

Great for travel memories, couples and friends.

📸 Want photos like these? Leave a comment and I'll reach out.

#candidphotography`,
      de: `Natürliches Licht, echte Momente, nichts Gestelltes.

Aus einem aktuellen Outdoor-Shooting mit Studio mean, unserem Foto- & Videostudio bei Frankfurt. Wir laufen, reden, und ich halte fest, was dazwischen passiert.

Ideal für Reiseerinnerungen, Paare und Freunde.

📸 Solche Fotos auch für dich? Kommentiere und ich melde mich.

#fotoshooting`,
    },
    {
      id: 'snap-3',
      en: `Visiting Frankfurt? Take home more than phone photos. ✈️

Studio mean shoots relaxed snap sessions in the old town and along the river. About an hour, an easy walking pace, and I'll show you the best spots.

💬 Interested? Drop a comment and I'll DM you the details.

#frankfurtphotographer`,
      de: `Zu Besuch in Frankfurt? Nimm mehr mit als Handyfotos. ✈️

Studio mean fotografiert entspannte Outdoor-Shootings in der Altstadt und am Main. Etwa eine Stunde, gemütliches Tempo, und ich zeige dir die schönsten Ecken.

💬 Interesse? Kommentiere und ich schicke dir die Details per DM.

#outdoorshooting`,
    },
    {
      id: 'snap-xmas',
      months: [11, 12],
      en: `Christmas market lights, Römerberg, the Main at dusk. 🎄

This season I'm shooting outdoor snaps around Frankfurt with Studio mean, our photo & video studio in Oberursel. Real moments, nothing too posed.

Couples, friends, solo, even with your dog 🐶

Want in? Leave a comment and I'll DM you the details.

#weihnachtsmarkt`,
      de: `Lichter vom Weihnachtsmarkt, Römerberg, der Main in der Dämmerung. 🎄

Diese Saison fotografiere ich draußen in Frankfurt, mit Studio mean, unserem Foto- & Videostudio in Oberursel. Echte Momente, nichts Gestelltes.

Paare, Freunde, allein, gerne auch mit Hund 🐶

Dabei? Kommentiere und ich schicke dir die Details per DM.

#weihnachtsmarkt`,
    },
  ],
};

export const CATEGORIES = Object.keys(TEMPLATES);
